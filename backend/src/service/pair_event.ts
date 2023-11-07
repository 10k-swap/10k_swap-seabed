import { Provider, hash, number as sNumber } from 'starknet'
import { PairEvent } from '../model/pair_event'
import { SnBlock } from '../model/sn_block'
import { Core } from '../util/core'
import { Pair, PoolService } from './pool'
import { StarknetService } from './starknet'

export class PairEventService {
  private static pairCursors: { [key: string]: string } = {}

  constructor(
    private provider: Provider,
    private repoPairEvent = Core.db.getRepository(PairEvent),
    private repoSnBlock = Core.db.getRepository(SnBlock)
  ) {}

  async startWork() {
    if (PoolService.pairs.length < 1) {
      return
    }

    const keyNames = {
      [hash.getSelectorFromName('Approval')]: 'Approval',
      [hash.getSelectorFromName('Burn')]: 'Burn',
      [hash.getSelectorFromName('Mint')]: 'Mint',
      [hash.getSelectorFromName('Swap')]: 'Swap',
      [hash.getSelectorFromName('Sync')]: 'Sync',
      [hash.getSelectorFromName('Transfer')]: 'Transfer',
    }

    const saveWhenNoExist = async (data: any) => {
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
      return this.repoPairEvent.save(pairEvent)
    }

    const lastPairEvent = await this.repoPairEvent.findOne({
      select: ['block_number'],
      where: {},
      order: { block_number: 'DESC' },
    })

    let i = lastPairEvent?.block_number || 4000
    for (; i <= StarknetService.latestBlockNumber; i++) {
      const snBlock = await this.repoSnBlock.findOne({
        where: { block_number: i },
      })
      if (snBlock?.block_data === undefined) continue

      const transaction_receipts: {
        transaction_index: number
        transaction_hash: string
        events: { from_address: string; keys: string[]; data: any[] }[]
      }[] = snBlock.block_data['transaction_receipts']
      if (!(transaction_receipts instanceof Array)) {
        continue
      }

      const datas: any[] = []
      for (const item of transaction_receipts) {
        if (!(item.events instanceof Array)) continue

        for (const eventIndex in item.events) {
          const event = item.events[eventIndex]

          const targetPair = PoolService.pairs.find((p) =>
            sNumber.toBN(event.from_address).eq(sNumber.toBN(p.pairAddress))
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
            block_number: snBlock.block_data.block_number,
            event_data: event.data,
            timestamp: snBlock.block_data['timestamp'],
          })
        }
      }

      await Promise.all(datas.map((data: any) => saveWhenNoExist(data)))
    }

    // let p = 1
    // while (true) {
    //   try {
    //     const { data } = await voyagerService
    //       .getAxiosClient()
    //       .get(`/api/events?contract=${pair.pairAddress}&ps=50&p=${p}`, {
    //         headers,
    //       })

    //     const items: any[] | undefined = data?.items
    //     if (items == undefined) {
    //       throw 'undefined items!'
    //     }
    //     if (items.length <= 0) {
    //       break
    //     }

    //     await Promise.all(items.map((item: any) => saveWhenNoExist(item)))

    //     p += 1
    //   } catch (e) {
    //     errorLogger.error(`PairEvent collect failed: ${e.message}`)
    //     await sleep(1000)
    //   }
    // }
  }

  private async getAfterCursor(pair: Pair) {
    if (PairEventService.pairCursors[pair.pairAddress]) {
      return PairEventService.pairCursors[pair.pairAddress]
    }

    const pairEvent = await this.repoPairEvent.findOne({
      select: ['cursor'],
      where: { pair_address: pair.pairAddress },
      order: { event_time: 'DESC' },
    })
    return pairEvent?.cursor || ''
  }
}
