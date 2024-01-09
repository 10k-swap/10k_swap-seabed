import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

@Index(['event_id'])
@Index(['event_time'])
@Index(['event_time', 'token_address'])
@Index(['from_address'])
@Index(['recipient_address'])
@Entity()
export class PairTransfer extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('varchar', { length: 256 })
  token_address: string

  @Column('varchar', { length: 256 })
  event_id: string

  @Column('timestamp', { precision: 6, default: null })
  event_time: Date

  @Column('varchar', { length: 256 })
  transaction_hash: string

  @Column('varchar', { length: 256, default: '' })
  from_address: string

  @Column('varchar', { length: 256, default: '' })
  recipient_address: string

  @Column('varchar', { length: 256, default: '' })
  amount: string
}
