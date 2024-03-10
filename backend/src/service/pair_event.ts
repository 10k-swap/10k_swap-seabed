import { GetBlockResponse, hash, num, uint256 } from 'starknet'
import { Between } from 'typeorm'
import { PairEvent } from '../model/pair_event'
import { SnBlock } from '../model/sn_block'
import { get10kStartBlockByEnv } from '../util'
import { Core } from '../util/core'
import { accessLogger } from '../util/logger'
import { PoolService } from './pool'
import { StarknetService } from './starknet'
import PromisePool from '@supercharge/promise-pool'

const keyNames = {
  [hash.getSelectorFromName('Approval')]: 'Approval',
  [hash.getSelectorFromName('Burn')]: 'Burn',
  [hash.getSelectorFromName('Mint')]: 'Mint',
  [hash.getSelectorFromName('Swap')]: 'Swap',
  [hash.getSelectorFromName('Sync')]: 'Sync',
  [hash.getSelectorFromName('Transfer')]: 'Transfer',
}

export class PairEventService {
  public static completionStatus: {
    fromBlock: number
    toBlock?: number
    updateSnBlock: boolean
    currentBlock: number
    status: 'Received' | 'Pending' | 'Done' | 'Failed'
  } = {
    fromBlock: 0,
    toBlock: undefined,
    updateSnBlock: false,
    currentBlock: 0,
    status: 'Done',
  }

  constructor(
    private repoPairEvent = Core.db.getRepository(PairEvent),
    private repoSnBlock = Core.db.getRepository(SnBlock)
  ) {}

  async startWork() {
    if (PoolService.pairs.length < 1) {
      return
    }

    const lastPairEvent = await this.repoPairEvent.findOne(undefined, {
      order: { block_number: 'DESC' },
      select: ['block_number'],
    })
    const lastSNBlock = await this.repoSnBlock.findOne({
      select: ['block_number'],
      order: { block_number: 'DESC' },
    })

    let i = lastPairEvent?.block_number || get10kStartBlockByEnv()
    for (; i <= (lastSNBlock?.block_number || 0); i++) {
      const snBlock = await this.repoSnBlock.findOne(undefined, {
        where: { block_number: i },
        order: { block_number: 'ASC' },
      })
      if (snBlock?.block_data === undefined) continue

      await this.saveEventsFromBlockData(snBlock.block_data)
    }
  }

  async completion(fromBlock: number, toBlock?: number, updateSnBlock = false) {
    if (
      PairEventService.completionStatus.status === 'Received' ||
      PairEventService.completionStatus.status === 'Pending'
    ) {
      accessLogger.warn(
        `Completion pair event doing: fromBlock: ${PairEventService.completionStatus.fromBlock}, toBlock: ${PairEventService.completionStatus.toBlock}, currentBlock: ${PairEventService.completionStatus.currentBlock}`
      )
      return
    }

    const starknetService = new StarknetService()

    PairEventService.completionStatus = {
      fromBlock,
      toBlock,
      updateSnBlock,
      currentBlock: fromBlock,
      status: 'Pending',
    }

    const done = () => {
      accessLogger.info(
        `Completion pair event done, fromBlock: ${fromBlock} - toBlock: ${toBlock}`
      )
      PairEventService.completionStatus.status = 'Done'
    }

    const failed = (e: Error) => {
      accessLogger.info(
        `Completion pair event failed, fromBlock: ${fromBlock} - currentBlock: ${PairEventService.completionStatus.currentBlock}, error: ${e.message}`
      )
      PairEventService.completionStatus.status = 'Failed'
    }

    const lastSNBlock = await this.repoSnBlock.findOne({
      select: ['block_number'],
      order: { block_number: 'DESC' },
    })

    while (true) {
      if (
        toBlock !== undefined &&
        PairEventService.completionStatus.currentBlock >= toBlock
      ) {
        done()
        break
      }

      const take = 200
      const start = PairEventService.completionStatus.currentBlock
      const end =
        PairEventService.completionStatus.toBlock ||
        lastSNBlock?.block_number ||
        0

      const snBlocks = await this.repoSnBlock.find({
        take: take,
        order: { block_number: 'ASC' },
        where: {
          block_number: Between(start, end),
        },
      })

      if (updateSnBlock) {
        const blockNumbers = new Array(Math.min(end - start + 1, take))
          .fill(undefined)
          .map((_, i) => start + i)

        await PromisePool.withConcurrency(50)
          .for(blockNumbers)
          .handleError((e) => {
            failed(e)
            throw e
          })
          .process(async (blockNumber) => {
            const blockInfo = await starknetService.getStarknetBlockInfo(
              blockNumber
            )

            const targetSnBlock = snBlocks.find(
              (item) => item.block_number == blockInfo.block_number
            )

            if (!targetSnBlock) {
              const one = await this.repoSnBlock.findOne({
                block_number: blockNumber,
              })
              if (one === undefined) {
                await this.repoSnBlock.save({
                  block_number: blockNumber,
                  block_hash: blockInfo.block_hash,
                  block_data: blockInfo,
                })
                const saved = await this.repoSnBlock.findOne({
                  block_number: blockNumber,
                })
                if (saved) snBlocks.push(saved)
              }
            } else if (
              starknetService.getBlockInfoEventsLength(blockInfo) >
              starknetService.getBlockInfoEventsLength(targetSnBlock.block_data)
            ) {
              // It needs to be updated if the new events are longer than the old ones.
              await this.repoSnBlock.update(
                { block_number: blockNumber },
                { block_data: blockInfo }
              )

              targetSnBlock.block_data = blockInfo
            }
          })
      }

      if (snBlocks.length == 0) {
        done()
        break
      }

      for (const snBlock of snBlocks) {
        PairEventService.completionStatus.currentBlock = snBlock.block_number
        let blockInfo = snBlock.block_data

        let events: any[] = []
        for (const receipt of snBlock.block_data.transaction_receipts) {
          events = events.concat(receipt.events)
        }

        // Event length 1001 is generally invalid data. A bug of blast rpc
        if (events.length == 1001) {
          blockInfo = await starknetService.getStarknetBlockInfo(
            snBlock.block_number
          )

          let events2: any[] = []
          for (const receipt of blockInfo.transaction_receipts) {
            events2 = events2.concat(receipt.events)
          }

          accessLogger.info(
            'events.length:',
            events.length,
            ', block:',
            snBlock.block_number,
            ', new events.length:',
            events2.length
          )

          await this.repoSnBlock.update(snBlock.id, {
            block_data: blockInfo,
          })
          accessLogger.info(
            `repoSnBlock.update[${snBlock.id}], block number: ${snBlock.block_number}`
          )
        }

        await this.saveEventsFromBlockData(blockInfo)
      }
    }
  }

  async getLpEvents(pairAddress: string, fromBlock = 0, toBlock = 0) {
    const diff = toBlock - fromBlock
    if (Number.isNaN(diff) || diff <= 0 || diff > 20000) {
      throw new Error(
        `Invalid block, fromBlock: ${fromBlock} - toBlock: ${toBlock}`
      )
    }

    const queryBuilder = this.repoPairEvent.createQueryBuilder()
    queryBuilder.select(
      'id, event_id, pair_address, transaction_hash, key_name, event_data, event_time, block_number'
    )
    if (pairAddress) {
      queryBuilder.andWhere(`pair_address = :pairAddress`, { pairAddress })
    }
    queryBuilder.andWhere(`key_name = 'Transfer'`)
    queryBuilder.andWhere('block_number BETWEEN :fromBlock AND :toBlock', {
      fromBlock,
      toBlock,
    })
    queryBuilder.addOrderBy('block_number', 'ASC')
    queryBuilder.addOrderBy('event_id', 'ASC')

    const events = await queryBuilder.getRawMany()

    const lpEvents: {
      id: number
      event_id: string
      pair_address: string
      transaction_hash: string
      key_name: string
      event_data: string[]
      event_time: string
      block_number: number
      event_data_parsed: { account: string; recipient?: string; amount: string }
    }[] = []
    for (const event of events) {
      try {
        const eventData = JSON.parse(event.event_data)
        if (eventData.length !== 4) {
          accessLogger.warn(`Event[${event.event_id}] event_data invalid`)
          continue
        }

        const eventData0 = num.toBigInt(eventData[0])
        const eventData1 = num.toBigInt(eventData[1])
        const eventDataAmount = num.toHex(
          uint256.uint256ToBN({
            low: eventData[2],
            high: eventData[3],
          })
        )

        // Ignore pair -> zero (Burn)
        if (
          eventData0 === num.toBigInt(event.pair_address) &&
          eventData1 == 0n
        ) {
          continue
        }

        if (num.toBigInt(eventData[0]) === 0n) {
          // Mint
          event['key_name'] = 'Mint'
          event['event_data_parsed'] = {
            account: eventData[1],
            amount: eventDataAmount,
          }
        } else if (
          num.toBigInt(eventData[1]) === num.toBigInt(event.pair_address)
        ) {
          // Burn
          event['key_name'] = 'Burn'
          event['event_data_parsed'] = {
            account: eventData[0],
            amount: eventDataAmount,
          }
        } else {
          // Transfer
          event['event_data_parsed'] = {
            account: eventData[0],
            recipient: eventData[1],
            amount: eventDataAmount,
          }
        }

        event['event_data'] = eventData

        lpEvents.push(event)
      } catch (err: any) {
        accessLogger.warn(
          `Event[${event.event_id}] parse failed: ${err.message}`
        )
      }
    }

    return lpEvents
  }

  private async saveEventsFromBlockData(blockData: GetBlockResponse) {
    const transaction_receipts: {
      transaction_index: number
      transaction_hash: string
      events: { from_address: string; keys: string[]; data: any[] }[]
    }[] = blockData['transaction_receipts']
    if (!(transaction_receipts instanceof Array)) {
      return
    }

    const datas: any[] = []
    for (const item of transaction_receipts) {
      if (!(item.events instanceof Array)) continue

      for (const eventIndex in item.events) {
        const event = item.events[eventIndex]

        // Todo: If a new pair is added and PoolService.pairs is not updated in time, data will be lost.
        const targetPair = PoolService.pairs.find(
          (p) => num.toBigInt(event.from_address) == num.toBigInt(p.pairAddress)
        )
        if (targetPair === undefined) continue

        const key = event.keys.find((k) => keyNames[k] !== undefined)
        if (key === undefined) continue

        datas.push({
          pairAddress: targetPair.pairAddress,
          event_index: eventIndex,
          transaction_index: item.transaction_index,
          transaction_hash: item.transaction_hash,
          name: keyNames[key],
          block_number: blockData.block_number,
          event_data: event.data,
          timestamp: blockData.timestamp,
        })
      }
    }

    await Promise.all(datas.map((data: any) => this.saveWhenNoExist(data)))
  }

  private async saveWhenNoExist(data: any) {
    const { transaction_index, transaction_hash, event_index } = data

    if (!transaction_hash) {
      return
    }

    const event_id = `${transaction_hash}_${event_index}`

    const one = await this.repoPairEvent.findOne({
      where: { event_id },
    })
    if (one) {
      return
    }

    const cursor = Buffer.from(
      `${transaction_hash}_${event_index}__${data.timestamp}${
        transaction_index + ''.padStart(6, '0')
      }${event_index + ''.padStart(6, '0')}`
    ).toString('base64')

    const pairEvent = new PairEvent()
    pairEvent.event_id = event_id
    pairEvent.pair_address = data.pairAddress
    pairEvent.transaction_hash = transaction_hash
    pairEvent.event_data = JSON.stringify(data.event_data)
    pairEvent.key_name = data.name
    pairEvent.block_number = data.block_number
    pairEvent.event_time = new Date(data.timestamp * 1000)
    pairEvent.cursor = cursor
    pairEvent.source_data = JSON.stringify(data)
    pairEvent.status = 0

    if (['Swap', 'Mint', 'Burn'].indexOf(pairEvent.key_name) === -1) {
      pairEvent.status = 99
    }

    return this.repoPairEvent.save(pairEvent)
  }
}
