import {
  Column,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { CommonEntity } from '../common'

@Entity()
export class PairTransaction extends CommonEntity {
  @ObjectIdColumn()
  id: ObjectId

  @Column()
  pair_address: string

  @Column()
  event_id: string

  @Column()
  transaction_hash: string

  @Column()
  key_name: string

  @Column()
  account_address: string

  @Column('date', { default: 0 })
  event_time: Date

  @Column('decimal', { precision: 128, default: 0 })
  amount0: string

  @Column('decimal', { precision: 128, default: 0 })
  amount1: string

  @Column('number', { default: 0 })
  swap_reverse: number // 0: Swap token0 for token1, 1: Swap token1 for token0

  @Column('decimal', { precision: 128, default: 0 })
  fee: string // If swap_reverse is 0, fee from token0. If swap_reverse is 1, fee from token1
}
