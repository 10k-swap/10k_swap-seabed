import { appConfig } from '../config'
import { accessLogger } from '../util/logger'
import {
  jobCacheTVLsByDayAndVolumesByDay,
  jobCoinbaseCache,
  jobCollectSNBlock,
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

  jobCoinbaseCache()

  jobUpdateLatestBlockNumber()
  jobCollectSNBlock()

  jobPairEventStartWork()
  jobPairTransactionPurify()
  jobPairTransactionAccountAddress()
  jobPairTransferPurify()

  jobCacheTVLsByDayAndVolumesByDay()
}

export const startWorkerJobs = async () => {}
