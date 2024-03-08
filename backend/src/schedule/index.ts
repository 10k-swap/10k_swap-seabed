import { appConfig } from '../config'
import { accessLogger } from '../util/logger'
import {
  jobCacheTVLsByDayAndVolumesByDay,
  jobCollectPairReserves,
  jobCollectSNBlock,
  jobOKXCache,
  jobPairEventStartWork,
  jobPairTransactionAccountAddress,
  jobPairTransactionPurify,
  jobPairTransferPurify,
  jobPoolCollect,
  jobUpdateLatestBlockNumber,
} from './jobs'

export const startMasterJobs = async () => {
  if (appConfig.stopJobs === true) {
    accessLogger.warn(
      `Jobs not running. appConfig.stopJobs = ${appConfig.stopJobs}`
    )
    return
  }

  // Only develop env
  // if (isDevelopEnv()) jobFaucetTwitter()

  jobPoolCollect()

  jobOKXCache()

  jobUpdateLatestBlockNumber()
  jobCollectSNBlock()

  jobPairEventStartWork()
  jobPairTransactionPurify()
  jobPairTransactionAccountAddress()
  jobPairTransferPurify()
  jobCollectPairReserves()

  jobCacheTVLsByDayAndVolumesByDay()
}

export const startWorkerJobs = async () => {}
