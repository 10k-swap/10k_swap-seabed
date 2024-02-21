import path from 'path'

// In a production environment, environment variables come from either the system or Docker
if (process.env.NODE_ENV == 'development') {
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') })
}

import { ListenOptions } from 'net'
import * as logConfig from './log'
import * as ormConfig from './orm'
import * as redisConfig from './redis'
import networkConfig from './network'
import * as contractConfig from './contract'
import faucetConfig from './faucet'

const appConfig = {
  options: <ListenOptions>{
    port: process.env.APP_OPTIONS_PORT || 3000,
    host: process.env.APP_OPTIONS_HOST || '127.0.0.1',
  },

  stopJobs:
    process.env.APP_STOP_JOBS === undefined
      ? false
      : process.env.APP_STOP_JOBS.trim() == 'true',
}

export {
  appConfig,
  ormConfig,
  redisConfig,
  logConfig,
  networkConfig,
  contractConfig,
  faucetConfig,
}
