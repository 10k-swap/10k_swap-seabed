import { addAddressPadding } from 'starknet'
import { Between, Repository } from 'typeorm'
import { PairTransaction } from '../model/pair_transaction'
import { equalsIgnoreCase } from '../util'
import { Core } from '../util/core'
import { accessLogger, errorLogger } from '../util/logger'

export class ActivityService {
  private repoPairTransaction: Repository<PairTransaction>

  constructor() {
    this.repoPairTransaction = Core.db.getRepository(PairTransaction)
  }

  /**
   *
   * @param account
   * @param startTime unix timestramp(s)
   * @param endTime unix timestramp(s)
   */
  async interactedByAccount(
    account: string,
    startTime: number,
    endTime: number
  ) {
    try {
      account = addAddressPadding(account).toLowerCase()

      // Whitelist, for test
      if (
        equalsIgnoreCase(
          account,
          '0x076a11bd32505ab9e8e6b6c9e269fab5d7fa0ecbeefb77fa8c5b9ddea8e73a64'
        )
      ) {
        return true
      }

      const one = await this.repoPairTransaction.findOne(undefined, {
        select: ['id'],
        where: {
          account_address: account,
          event_time: Between(
            new Date(startTime * 1000),
            new Date(endTime * 1000)
          ),
          key_name: 'Swap',
        },
      })

      accessLogger.info(
        `Log interactedByAccount - account: ${account}, startTime: ${startTime}, endTime: ${endTime}, id: ${one?.id}`
      )

      return one != undefined
    } catch (e) {
      errorLogger.error(
        'ActivityService interactedByAccount failed:',
        e.message
      )

      return false
    }
  }
}
