import { GetBlockResponse, Provider } from 'starknet'
import { SnBlock } from '../model/sn_block'
import { sleep } from '../util'
import { Core } from '../util/core'
import { accessLogger } from '../util/logger'

export class StarknetService {
  public static latestBlockNumber = 0

  constructor(
    private provider: Provider,
    private repoSnBlock = Core.db.getRepository(SnBlock)
  ) {}

  async updateLatestBlockNumber() {
    const { block_number } = await this.getSNBlockInfo('latest')

    // TODO: for debug online
    accessLogger.info(`Block_number: ${block_number}`)

    if (block_number > StarknetService.latestBlockNumber) {
      StarknetService.latestBlockNumber = block_number
    }
  }

  async collectSNBlock() {
    const lastSNBlock = await this.repoSnBlock.findOne({
      select: ['block_number'],
      where: {},
      order: { block_number: 'DESC' },
    })

    let bnArray: number[] = []
    let i = (lastSNBlock?.block_number || -1) + 1
    for (; i <= StarknetService.latestBlockNumber; i++) {
      bnArray.push(i)

      if (i % 10 === 0 || i >= StarknetService.latestBlockNumber) {
        accessLogger.info(`Collect starknet blocks: ${bnArray.join(', ')}`)

        const blocks = await Promise.all(
          bnArray.map((item) => this.getSNBlockInfo(item))
        )

        // Bulk update the database to prevent missing chunk data when the application is down.
        await Promise.all(
          blocks.map(async (block) => {
            const one = await this.repoSnBlock.findOne({
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

  async getSNBlockInfo(
    blockNumber: number | string,
    tryCount = 0
  ): Promise<GetBlockResponse> {
    try {
      return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(function () {
          reject(new Error('Timeout Error'))
        }, 3000)
        this.provider
          .getBlock(blockNumber)
          .then((res) => {
            clearTimeout(timeoutId)
            resolve(res)
          })
          .catch(reject)
      })
    } catch (err) {
      tryCount += 1
      if (tryCount > 10) throw err

      // Exponential Avoidance
      const ms = parseInt(tryCount * tryCount * 200 + '')
      await sleep(ms <= 5000 ? ms : 5000) // max: 5000ms

      return await this.getSNBlockInfo(blockNumber, tryCount)
    }
  }
}
