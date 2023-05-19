import { getProviderFromEnv, isDevelopEnv } from '../util'
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

  const provider = getProviderFromEnv()

  jobPoolCollect(provider)

  jobCoinbaseCache()

  jobUpdateLatestBlockNumber(provider)
  jobCollectSNBlock(provider)

  jobPairEventStartWork(provider)
  jobPairTransactionPurify(provider)
  jobPairTransactionAccountAddress(provider)

  jobCacheTVLsByDayAndVolumesByDay()
}

export const startWorkerJobs = async () => {}
