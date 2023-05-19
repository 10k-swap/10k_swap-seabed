import { Redis } from 'ioredis'
import { Connection } from 'typeorm'

export class Core {
  static db: Connection
  static redis: Redis
}
