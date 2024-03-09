import { appConfig } from '../config'
import { accessLogger } from '../util/logger'
import {
  jobDefispringCacheQaSTRKGrant,
  jobCacheTVLsByDayAndVolumesByDay,
  // jobCollectPairReserves,
  jobCollectSNBlock,
  jobOKXCache,
  jobPairEventStartWork,
  jobPairTransactionAccountAddress,
  jobPairTransactionPurify,
  jobPairTransferPurify,
  jobPoolCollect,
  jobUpdateLatestBlockNumber,
  jobDefispringStatistics,
  jobDefispringStatisticsSTRKRewards,
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
  // jobCollectPairReserves()

  jobCacheTVLsByDayAndVolumesByDay()

  // jobDefispringStatistics()
  jobDefispringCacheQaSTRKGrant()
  jobDefispringStatisticsSTRKRewards()
}

export const startWorkerJobs = async () => {}
