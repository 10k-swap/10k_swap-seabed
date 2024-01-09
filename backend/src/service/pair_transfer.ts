import { PromisePool } from '@supercharge/promise-pool'
import { addAddressPadding, uint256 } from 'starknet'
import { MoreThan } from 'typeorm'
import { PairEvent } from '../model/pair_event'
import { PairTransfer } from '../model/pair_transfer'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'

let latestEventId: string | undefined = undefined

export class PairTransferService {
  constructor(
    private repoPairEvent = Core.db.getRepository(PairEvent),
    private repoPairTransfer = Core.db.getRepository(PairTransfer)
  ) {}

  async purify() {
    if (!latestEventId) {
      latestEventId =
        (
          await this.repoPairTransfer.findOne({
            order: { id: 'DESC' },
          })
        )?.event_id || latestEventId
    }

    let latestPairEventTableId = 0
    if (latestEventId) {
      latestPairEventTableId =
        (
          await this.repoPairEvent.findOne({
            where: { event_id: latestEventId },
          })
        )?.id || latestPairEventTableId
    }

    const pairEvents = await this.repoPairEvent.find({
      where: { id: MoreThan(latestPairEventTableId), status: 99 },
      order: { id: 'ASC' },
      take: 2000,
    })

    await PromisePool.withConcurrency(20)
      .for(pairEvents)
      .process(this.purifyOne.bind(this))

    if (pairEvents.length > 0) {
      latestEventId = pairEvents[pairEvents.length - 1].event_id
    }
  }

  private async purifyOne(pairEvent: PairEvent) {
    if (pairEvent.key_name != 'Transfer') {
      return
    }

    try {
      const pairTransfer = new PairTransfer()
      pairTransfer.token_address = pairEvent.pair_address
      pairTransfer.event_id = pairEvent.event_id
      pairTransfer.event_time = pairEvent.event_time
      pairTransfer.transaction_hash = pairEvent.transaction_hash

      const eventData: string[] = JSON.parse(pairEvent.event_data)
      if (eventData.length !== 4) {
        errorLogger.error(
          `Invalid event_data: ${pairEvent.event_data}, event_id: ${pairEvent.event_id}`
        )
        return
      }

      pairTransfer.from_address = addAddressPadding(
        eventData[0]
      ).toLocaleLowerCase()
      pairTransfer.recipient_address = addAddressPadding(
        eventData[1]
      ).toLocaleLowerCase()
      pairTransfer.amount =
        uint256.uint256ToBN({ low: eventData[2], high: eventData[3] }) + ''

      await this.updateOrInsert(pairTransfer)

      await this.pairEventPurified(pairEvent)
    } catch (err) {
      errorLogger.error(
        'Transfer purifyOne fail:',
        err.message,
        ', transaction_hash: ',
        pairEvent.transaction_hash
      )
      await this.pairEventPurifyFailed(pairEvent)
    }
  }

  private async updateOrInsert(pairTransfer: PairTransfer) {
    const one = await this.repoPairTransfer.findOne({
      select: ['id'],
      where: { event_id: pairTransfer.event_id },
    })

    if (one?.id) {
      await this.repoPairTransfer.update({ id: one.id }, pairTransfer)
    } else {
      await this.repoPairTransfer.save(pairTransfer)
    }
  }

  private async pairEventPurified(pairEvent: PairEvent) {}

  private async pairEventPurifyFailed(pairEvent: PairEvent) {}
}
