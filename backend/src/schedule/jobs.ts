import schedule from 'node-schedule'
import { Provider } from 'starknet'
import { CoinbaseService } from '../service/coinbase'
import { FaucetService } from '../service/faucet'
import { PairEventService } from '../service/pair_event'
import { PairTransactionService } from '../service/pair_transaction'
import { PoolService } from '../service/pool'
import { errorLogger } from '../util/logger'
import { AnalyticsServiceCache } from '../service/analytics_cache'
import { StarknetService } from '../service/starknet'

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
        errorLogger.error(message)
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

export function jobCoinbaseCache() {
  const callback = async () => {
    await new CoinbaseService().cache()
  }

  new MJobPessimism('*/5 * * * * *', callback, jobCoinbaseCache.name).schedule(
    true
  )
}

export function jobPairEventStartWork(provider: Provider) {
  const callback = async () => {
    await new PairEventService(provider).startWork()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairEventStartWork.name
  ).schedule()
}

export function jobPairTransactionPurify(provider: Provider) {
  const callback = async () => {
    await new PairTransactionService(provider).purify()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairTransactionPurify.name
  ).schedule()
}

export function jobPairTransactionAccountAddress(provider: Provider) {
  const callback = async () => {
    await new PairTransactionService(provider).purifyAccountAddress()
  }

  new MJobPessimism(
    '*/5 * * * * *',
    callback,
    jobPairTransactionAccountAddress.name
  ).schedule()
}

export function jobPoolCollect(provider: Provider) {
  const callback = async () => {
    try {
      await new PoolService(provider).collect()
    } catch (e) {
      console.warn(e)
    }
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

export function jobUpdateLatestBlockNumber(provider: Provider) {
  const callback = async () => {
    await new StarknetService(provider).updateLatestBlockNumber()
  }

  new MJobPessimism(
    '*/50 * * * * *',
    callback,
    jobUpdateLatestBlockNumber.name
  ).schedule(true)
}

export function jobCollectSNBlock(provider: Provider) {
  const callback = async () => {
    await new StarknetService(provider).collectSNBlock()
  }

  new MJobPessimism(
    '*/20 * * * * *',
    callback,
    jobCollectSNBlock.name
  ).schedule()
}
