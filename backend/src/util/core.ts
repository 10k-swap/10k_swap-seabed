import { Redis } from 'ioredis'
import { DataSource } from 'typeorm'

export class Core {
  static db: DataSource
  static mongodb: DataSource
  static redis: Redis
}
