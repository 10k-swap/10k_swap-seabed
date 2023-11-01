import { Repository } from 'typeorm'
import { PairTransaction } from '../model/pair_transaction'
import { Core } from '../util/core'
import { addAddressPadding } from 'starknet'
import { equalsIgnoreCase } from '../util'

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
    account = addAddressPadding(account)

    if (
      equalsIgnoreCase(
        account,
        '0x076a11bd32505ab9e8e6b6c9e269fab5d7fa0ecbeefb77fa8c5b9ddea8e73a64'
      )
    ) {
      return true
    }

    console.log({ account, startTime, endTime })

    return false
  }
}
