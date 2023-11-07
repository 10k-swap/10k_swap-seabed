import path from 'path'
import { DataSourceOptions } from 'typeorm'
import { isDevelopEnv } from '../util'

export const options: DataSourceOptions = {
  name: 'mongodb',
  type: 'mongodb',
  host: process.env.MONGODB_HOST || '127.0.0.1',
  port: Number(process.env.MONGODB_PORT) || 27017,
  username: process.env.MONGODB_USERNAME || 'l0k_swap_seabed',
  password: process.env.MONGODB_PASSWORD || '123456',
  database: process.env.MONGODB_DATABASE || 'l0k_swap_seabed',
  authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
  synchronize: isDevelopEnv(),
  logging: false,
  extra: {},
  maxQueryExecutionTime: 2000, // Show slow query

  entities: [path.resolve(__dirname, '..', 'model', 'mongo', '*.{ts,js}')],
  migrations: [
    //   'src/migration/**/*.ts'
  ],
  subscribers: [
    //   'src/subscriber/**/*.ts'
  ],
}
