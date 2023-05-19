import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

@Index(['event_id'])
@Index(['event_time'])
@Index(['key_name', 'event_time', 'pair_address', 'swap_reverse'])
@Entity()
export class PairTransaction extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('varchar', { length: 256 })
  pair_address: string

  @Column('varchar', { length: 256 })
  event_id: string

  @Column('varchar', { length: 256 })
  transaction_hash: string

  @Column('varchar', { length: 256 })
  key_name: string

  @Column('varchar', { length: 256 })
  account_address: string

  @Column('timestamp', { precision: 6, default: null })
  event_time: Date

  @Column('varchar', { length: 256, default: '' })
  amount0: string

  @Column('varchar', { length: 256, default: '' })
  amount1: string

  @Column('int2', { default: 0 })
  swap_reverse: number // 0: Swap token0 for token1, 1: Swap token1 for token0

  @Column('varchar', { length: 256, default: '' })
  fee: string // If swap_reverse is 0, fee from token0. If swap_reverse is 1, fee from token1
}
