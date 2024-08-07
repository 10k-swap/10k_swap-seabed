import path from 'path'
import { ConnectionOptions } from 'typeorm'

const synchronize =
  process.env.DB_ORM_SYNCHRONIZE === undefined
    ? false
    : process.env.DB_ORM_SYNCHRONIZE.trim() == 'true'

export const options: ConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'l0k_swap_seabed',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'l0k_swap_seabed',
  synchronize,
  logging: false,
  extra: {},
  maxQueryExecutionTime: 2000, // Show slow query

  entities: [path.resolve(__dirname, '..', 'model', '**', '*.{ts,js}')],
  migrations: [
    //   'src/migration/**/*.ts'
  ],
  subscribers: [
    //   'src/subscriber/**/*.ts'
  ],
}
