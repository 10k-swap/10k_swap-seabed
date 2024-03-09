import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

@Index(['pair_address'])
@Index(['account_address'])
@Index(['pair_address', 'account_address'])
@Entity()
export class ActivityDefispring extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('varchar', { length: 256 })
  pair_address: string

  @Column('varchar', { length: 256 })
  account_address: string

  @Column('varchar', { length: 256 })
  balance_of: string

  // Partition = Balance of LP * time(s)
  @Column('varchar', { length: 256 })
  partition: string

  @Column('varchar', { length: 256 })
  day: string
}
