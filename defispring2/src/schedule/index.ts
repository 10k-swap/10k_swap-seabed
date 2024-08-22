import { appConfig } from '../config'
import { accessLogger } from '../util/logger'
import {} from './jobs'

export const startMasterJobs = async () => {
  if (appConfig.stopJobs === true) {
    accessLogger.warn(
      `Jobs not running. appConfig.stopJobs = ${appConfig.stopJobs}`
    )
    return
  }
}

export const startWorkerJobs = async () => {}
