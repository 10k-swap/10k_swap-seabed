import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

@Index(['pair_address'])
@Index(['block_number'])
@Index(['block_timestamp_last'])
@Entity()
export class PairReserve extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('varchar', { length: 256 })
  pair_address: string

  @Column('int', { width: 11 })
  block_number: number

  @Column('varchar', { length: 256, default: '' })
  reserve0: string

  @Column('varchar', { length: 256, default: '' })
  reserve1: string

  @Column('timestamp', { precision: 6, default: null })
  block_timestamp_last: Date
}
