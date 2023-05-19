import { RedisOptions } from 'ioredis'

export const options: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  // username: process.env.REDIS_USERNAME || 'l0k_swap_seabed', // Not supported yet
  password: process.env.REDIS_PASSWORD || '123456',
}
