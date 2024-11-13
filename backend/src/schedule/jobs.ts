import schedule from 'node-schedule'
import { AnalyticsServiceCache } from '../service/analytics_cache'
import { FaucetService } from '../service/faucet'
import { OKXService } from '../service/okx'
import { PairEventService } from '../service/pair_event'
import { PairTransactionService } from '../service/pair_transaction'
import { PairTransferService } from '../service/pair_transfer'
import { PoolService } from '../service/pool'
import { StarknetService } from '../service/starknet'
import { errorLogger } from '../util/logger'
import { PairReservesService } from '../service/pair_reserves'
import { ActivityDefispringService } from '../service/activity_defispring'

// import { doSms } from '../sms/smsSchinese'
class MJob {
  protected rule:
    | string
    | number
    | schedule.RecurrenceRule
    | schedule.RecurrenceSpecDateRange
    | schedule.RecurrenceSpecObjLit
    | Date
  protected callback?: () => any
  protected jobName?: string

  /**
   * @param rule
   * @param callback
   * @param jobName
   */
  constructor(
    rule:
      | string
      | number
      | schedule.RecurrenceRule
      | schedule.RecurrenceSpecDateRange
      | schedule.RecurrenceSpecObjLit
      | Date,
    callback?: () => any,
    jobName?: string
  ) {
    this.rule = rule
    this.callback = callback
    this.jobName = jobName
  }

  public schedule(immediate: boolean = false): schedule.Job {
    const job = schedule.scheduleJob(this.rule, async () => {
      try {
        this.callback && (await this.callback())
      } catch (error) {
        let message = `MJob.schedule error: ${error.message}, rule: ${this.rule}`
        if (this.jobName) {
          message += `, jobName: ${this.jobName}`
        }
        errorLogger.error(error)
      }
    })

    if (immediate) setImmediate(() => job.invoke())

    return job
  }
}

// Pessimism Lock Job
class MJobPessimism extends MJob {
  public schedule(immediate: boolean = false): schedule.Job {
    let pessimismLock = false

    const _callback = this.callback

    this.callback = async () => {
      if (pessimismLock) {
        return
      }
      pessimismLock = true

      try {
        _callback && (await _callback())
      } catch (error) {
        throw error
      } finally {
        // Always release lock
        pessimismLock = false
      }
    }

    return super.schedule(immediate)
  }
}

export function jobFaucetTwitter() {
  const callback = async () => {
    await new FaucetService().fromTwitter()
  }

  new MJobPessimism(
    '*/10 * * * * *',
    callback,
    jobFaucetTwitter.name
  ).schedule()
}

export function jobOKXCache() {
  const callback = async () => {
    await new OKXService().cache()
  }

  new MJobPessimism('*/5 * * * * *', callback, jobOKXCache.name).schedule(true)
}

export function jobPairEventStartWork() {
  const callback = async () => {
    await new PairEventService().startWork()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairEventStartWork.name
  ).schedule()
}

export function jobPairTransactionPurify() {
  const callback = async () => {
    await new PairTransactionService().purify()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairTransactionPurify.name
  ).schedule()
}

export function jobPairTransactionAccountAddress() {
  const callback = async () => {
    await new PairTransactionService().purifyAccountAddress()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairTransactionAccountAddress.name
  ).schedule()
}

export function jobPairTransferPurify() {
  const callback = async () => {
    await new PairTransferService().purify()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairTransferPurify.name
  ).schedule()
}

export function jobCollectPairReserves() {
  const callback = async () => {
    await new PairReservesService().collectPairReserves()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobCollectPairReserves.name
  ).schedule()
}

export function jobPoolCollect() {
  const callback = async () => {
    await new PoolService().collect()
  }

  new MJobPessimism('*/5 * * * * *', callback, jobPoolCollect.name).schedule(
    true
  )
}

export function jobCacheTVLsByDayAndVolumesByDay() {
  const callback = async () => {
    const analyticsServiceCache = new AnalyticsServiceCache()
    await analyticsServiceCache.cacheTVLsByDayAndVolumesByDay()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobCacheTVLsByDayAndVolumesByDay.name
  ).schedule()
}

export function jobUpdateLatestBlockNumber() {
  const callback = async () => {
    await new StarknetService().updateLatestBlockNumber()
  }

  new MJobPessimism(
    '*/50 * * * * *',
    callback,
    jobUpdateLatestBlockNumber.name
  ).schedule(true)
}

export function jobCollectSNBlock() {
  const callback = async () => {
    await new StarknetService().collectSNBlock()
  }

  new MJobPessimism(
    '*/20 * * * * *',
    callback,
    jobCollectSNBlock.name
  ).schedule()
}

export function jobDefispringStatistics() {
  new ActivityDefispringService().startStatistics()

  // const callback = async () => {
  //   await new ActivityDefispringService().startStatistics()
  // }

  // new MJobPessimism(
  //   '*/10 * * * * *',
  //   callback,
  //   jobDefispringStatistics.name
  // ).schedule()
}

export function jobDefispringCacheQaSTRKGrant() {
  const callback = async () => {
    await new ActivityDefispringService().cacheQaSTRKGrant()
  }

  new MJobPessimism(
    '0 0 */2 * * *',
    callback,
    jobDefispringCacheQaSTRKGrant.name
  ).schedule(true)
}

export function jobDefispringStatisticsSTRKRewards() {
  const callback = async () => {
    await new ActivityDefispringService().statisticsSTRKRewards()
  }

  new MJobPessimism(
    '*/10 * * * * *',
    callback,
    jobDefispringStatisticsSTRKRewards.name
  ).schedule(true)
}
