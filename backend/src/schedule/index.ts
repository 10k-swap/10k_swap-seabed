import { isDevelopEnv } from '../util'
import {
  jobCacheTVLsByDayAndVolumesByDay,
  jobCoinbaseCache,
  jobCollectSNBlock,
  jobFaucetTwitter,
  jobPairEventStartWork,
  jobPairTransactionAccountAddress,
  jobPairTransactionPurify,
  jobPoolCollect,
  jobUpdateLatestBlockNumber,
} from './jobs'

export const startMasterJobs = async () => {
  // Only develop env
  if (isDevelopEnv()) jobFaucetTwitter()

  jobPoolCollect()

  jobCoinbaseCache()

  jobUpdateLatestBlockNumber()
  jobCollectSNBlock()

  jobPairEventStartWork()
  jobPairTransactionPurify()
  jobPairTransactionAccountAddress()

  jobCacheTVLsByDayAndVolumesByDay()
}

export const startWorkerJobs = async () => {}
