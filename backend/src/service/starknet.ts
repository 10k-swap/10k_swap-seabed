import { GetBlockResponse, RPC } from 'starknet'
import { SnBlock } from '../model/sn_block'
import { get10kStartBlockByEnv, getRpcProviderByEnv, sleep } from '../util'
import { Core } from '../util/core'
import { accessLogger } from '../util/logger'
import { RpcsService } from './rpcs'

export class StarknetService {
  public static latestBlockNumber = 0

  constructor(private repoSnBlock = Core.db.getRepository(SnBlock)) {}

  async updateLatestBlockNumber() {
    const { block_number } =
      await getRpcProviderByEnv().getBlockLatestAccepted()

    accessLogger.info(`Block_number: ${block_number}`)

    if (block_number > StarknetService.latestBlockNumber) {
      StarknetService.latestBlockNumber = block_number
    }
  }

  async collectSNBlock() {
    const lastSNBlock = await this.repoSnBlock.findOne(undefined, {
      select: ['block_number'],
      order: { block_number: 'DESC' },
    })

    let bnArray: number[] = []
    let i = (lastSNBlock?.block_number || get10kStartBlockByEnv()) + 1
    for (; i <= StarknetService.latestBlockNumber; i++) {
      bnArray.push(i)

      if (i % 10 === 0 || i >= StarknetService.latestBlockNumber) {
        accessLogger.info(`Collect starknet blocks: ${bnArray.join(', ')}`)

        const blocks = await Promise.all(
          bnArray.map((item) => this.getStarknetBlockInfo(item))
        )

        // Bulk update the database to prevent missing chunk data when the application is down.
        await Promise.all(
          blocks.map(async (block) => {
            const one = await this.repoSnBlock.findOne(undefined, {
              select: ['id'],
              where: { block_number: block.block_number },
            })

            if (one === undefined) {
              await this.repoSnBlock.insert({
                block_number: block.block_number,
                block_hash: block.block_hash,
                block_data: block,
              })
            }
          })
        )

        bnArray = []
      }
    }
  }

  async getStarknetBlockInfo(
    blockNumber: number,
    tryCount = 0
  ): Promise<GetBlockResponse> {
    try {
      return await new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(function () {
          reject(new Error('Timeout Error'))
        }, 100000)

        const rpcProvider = RpcsService.createRandomRpcProvider()

        try {
          const r = await rpcProvider.getBlockWithTxHashes(blockNumber)
          if (!r) {
            throw new Error(
              `GetBlockWithTxHashes[${blockNumber}] failed, rpc: ${rpcProvider.nodeUrl}`
            )
          }

          let events: RPC.SPEC.EMITTED_EVENT[] = []
          let continuationToken: string | undefined = undefined

          while (true) {
            const result = await this.getStarknetBlockEvents(
              blockNumber,
              continuationToken
            )
            events = events.concat(result.events)

            if (result.continuation_token === undefined) {
              break
            }
            continuationToken = result.continuation_token
          }

          const transaction_receipts: any[] = []
          r.transactions.forEach((hash, index) => {
            transaction_receipts.push({
              transaction_index: index,
              transaction_hash: hash,
              events: events.filter((e) => e.transaction_hash == hash),
            })
          })
          r['transaction_receipts'] = transaction_receipts

          resolve(r as GetBlockResponse)
        } catch (err) {
          reject(err)
        }

        clearTimeout(timeoutId)
      })
    } catch (err) {
      tryCount += 1

      if (tryCount > 10) throw err

      // Exponential Avoidance
      const ms = parseInt(tryCount * tryCount * 200 + '')
      await sleep(ms <= 5000 ? ms : 5000) // max: 5000ms

      return await this.getStarknetBlockInfo(blockNumber, tryCount)
    }
  }

  async getStarknetBlockEvents(
    blockNumber: number,
    continuationToken: string | undefined = undefined,
    tryCount = 0
  ): Promise<RPC.SPEC.EVENTS_CHUNK> {
    try {
      return await new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(function () {
          reject(new Error('Timeout Error'))
        }, 30000)

        const rpcProvider = RpcsService.createRandomRpcProvider()

        try {
          const result = await rpcProvider.getEvents({
            from_block: { block_number: blockNumber },
            to_block: { block_number: blockNumber },
            chunk_size: 1000,
            continuation_token: continuationToken,
          })
          if (!result) {
            throw new Error(
              `GetStarknetBlockEvents[${blockNumber}] failed, rpc: ${rpcProvider.nodeUrl}`
            )
          }

          resolve(result)
        } catch (err) {
          reject(err)
        }

        clearTimeout(timeoutId)
      })
    } catch (err) {
      tryCount += 1
      if (tryCount > 3) throw err

      // Exponential Avoidance
      const ms = parseInt(tryCount * tryCount * 200 + '')
      await sleep(ms <= 5000 ? ms : 5000) // max: 5000ms

      return await this.getStarknetBlockEvents(
        blockNumber,
        continuationToken,
        tryCount
      )
    }
  }
}
