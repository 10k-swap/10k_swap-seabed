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
