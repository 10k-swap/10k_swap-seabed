import { BigNumberish, num, RPC } from 'starknet'
import { PAIR_CREATED_EVENT_KEY } from '../constants'
import { PairReserve } from '../model/pair_reserve'
import { get10kStartBlockByEnv, sleep } from '../util'
import { Core } from '../util/core'
import { accessLogger } from '../util/logger'
import { PoolService } from './pool'
import { StarknetService } from './starknet'
import { RpcsService } from './rpcs'

const cachePairCreatedEvents: {
  updateTime: number
  events: RPC.SPEC.EMITTED_EVENT[]
} = { updateTime: 0, events: [] }

export class PairReservesService {
  constructor(private repoPairReserve = Core.db.getRepository(PairReserve)) {}

  async collectPairReserves() {
    if (StarknetService.latestBlockNumber <= 0) {
      accessLogger.warn(
        'CollectPairReserves waiting StarknetService update latestBlockNumber.'
      )
      while (StarknetService.latestBlockNumber <= 0) {
        await sleep(100)
      }
    }

    // let events = cachePairCreatedEvents.events
    // const nowTime = new Date().getTime()
    // if (
    //   nowTime - cachePairCreatedEvents.updateTime > 300_000 ||
    //   events.length == 0
    // ) {
    //   events = await new PoolService().getPairCreatedEvents()
    //   cachePairCreatedEvents.events = events
    // }

    // Only collect pairs now: ETH/USDC, USDC/USDT, STRK/USDC, STRK/ETH
    let events: RPC.SPEC.EMITTED_EVENT[] = JSON.parse(
      '[{"block_hash":"0xfbd4712a64ad9e41d1743b57305d3e8d18c3808e6b1c12fb834383a4cbef20","block_number":5065,"data":["0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325","0x1"],"from_address":"0x1c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2","keys":["0x19437bf1c5c394fc8509a2e38c9c72c152df0bac8be777d4fc8f959ac817189"],"transaction_hash":"0xeccaa6f7b058a82408e04b0cf1d137f20eb599f714c19a42ec951fb3f07ee5"},{"block_hash":"0x1b14ac8e71c9f2b457ab8b1b3adeef765676673df7a80d700ecff7f0f1bde47","block_number":5924,"data":["0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0","0x8"],"from_address":"0x1c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2","keys":["0x19437bf1c5c394fc8509a2e38c9c72c152df0bac8be777d4fc8f959ac817189"],"transaction_hash":"0x3537a906232db6ca2390660b9bc0bf69920a792e89363d0f4d912c25d4cad78"},{"block_hash":"0x6651f2f1d56dc66cd6cd09a16e524dd89f4eea318039a334f31df613cff92aa","block_number":562381,"data":["0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840","0xb"],"from_address":"0x1c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2","keys":["0x19437bf1c5c394fc8509a2e38c9c72c152df0bac8be777d4fc8f959ac817189"],"transaction_hash":"0xf63e65cb869ab2dcbc3d1154266ff83e88a27e07d3e6f0ce9b8313c7fa7232"},{"block_hash":"0x419f7013490af509e746c99409ce8544d9dadab5869135cd93ba276d6f8b7aa","block_number":562386,"data":["0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e","0xc"],"from_address":"0x1c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2","keys":["0x19437bf1c5c394fc8509a2e38c9c72c152df0bac8be777d4fc8f959ac817189"],"transaction_hash":"0x5ed55a47df5f09aabcd7c44a1e5d546d2acde4b4febff3341b22ae25ddfcb0c"}]'
    )

    await Promise.all(
      events.map((item) => {
        const { block_number, keys, data } = item
        if (keys[0] != PAIR_CREATED_EVENT_KEY || data.length != 4) {
          return
        }

        const pairAddress = num.toHex(data[2])

        return this.collectPairReservesOne(pairAddress, block_number)
      })
    )
  }

  private async collectPairReservesOne(
    pairAddress: string,
    defaultStartBlockNumber = get10kStartBlockByEnv()
  ) {
    const lastPairReserves = await this.repoPairReserve.findOne(undefined, {
      select: ['block_number'],
      where: { pair_address: pairAddress },
      order: { block_number: 'DESC' },
    })

    let bnArray: number[] = []
    let i = (lastPairReserves?.block_number || defaultStartBlockNumber - 1) + 1

    for (; i <= StarknetService.latestBlockNumber; i++) {
      bnArray.push(i)

      if (i % 30 === 0 || i >= StarknetService.latestBlockNumber) {
        accessLogger.info(
          `Collect pairReserves[${pairAddress}], blockNumbers: ${bnArray.join(
            ', '
          )}`
        )

        const list = await Promise.all(
          bnArray.map((item) =>
            this.getPairReservesByBlockNumber(item, pairAddress)
          )
        )

        // Bulk update the database to prevent missing chunk data when the application is down.
        await this.repoPairReserve.save(
          list.map((item) => {
            return {
              pair_address: item.pairAddress,
              block_number: item.blockNumber,
              reserve0: num.toBigInt(item.reserve0) + '',
              reserve1: num.toBigInt(item.reserve1) + '',
              block_timestamp_last: new Date(item.blockTimestampLast * 1000),
            }
          })
        )

        bnArray = []
      }
    }
  }

  async getPairReservesByBlockNumber(
    blockNumber: number,
    pairAddress: string,
    tryCount = 5
  ): Promise<{
    blockNumber: number
    pairAddress: string
    reserve0: BigNumberish
    reserve1: BigNumberish
    blockTimestampLast: number
  }> {
    try {
      return await new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(function () {
          reject(new Error('Timeout Error'))
        }, 6000)

        const rpcProvider = RpcsService.createRandomRpcProvider()

        try {
          const {
            result: [reserve0, reserve1, blockTimestampLast],
          } = await rpcProvider.callContract(
            {
              contractAddress: pairAddress,
              entrypoint: 'getReserves',
            },
            blockNumber
          )

          resolve({
            blockNumber,
            pairAddress,
            reserve0,
            reserve1,
            blockTimestampLast: Number(num.toBigInt(blockTimestampLast)),
          })
        } catch (err) {
          reject(err)
        }

        clearTimeout(timeoutId)
      })
    } catch (err) {
      tryCount -= 1
      if (tryCount <= 0) throw err

      // Exponential Avoidance
      const ms = parseInt(tryCount * tryCount * 200 + '')
      await sleep(ms <= 5000 ? ms : 5000) // max: 5000ms

      return await this.getPairReservesByBlockNumber(
        blockNumber,
        pairAddress,
        tryCount
      )
    }
  }
}
