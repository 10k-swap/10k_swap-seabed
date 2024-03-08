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

    let events = cachePairCreatedEvents.events
    const nowTime = new Date().getTime()
    if (
      nowTime - cachePairCreatedEvents.updateTime > 300_000 ||
      events.length == 0
    ) {
      events = await new PoolService().getPairCreatedEvents()
      cachePairCreatedEvents.events = events
    }

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

      if (i % 10 === 0 || i >= StarknetService.latestBlockNumber) {
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
