import { Repository } from 'typeorm'
import { PairTransaction } from '../model/pair_transaction'
import { Core } from '../util/core'
import { addAddressPadding } from 'starknet'

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

    console.log({ account, startTime, endTime })

    return false
  }
}
