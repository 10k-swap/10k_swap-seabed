import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

@Entity()
export class TwitterCrawl extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('varchar', { length: 256, unique: true })
  tweet_id: string

  @Column('varchar', { length: 256 })
  user_id: string

  @Column('varchar', { length: 256 })
  username: string

  @Column('timestamp', { precision: 6, default: null })
  tweet_time: Date

  @Column('text')
  content: string

  @Column('varchar', { length: 256, default: '' })
  recipient: string

  @Column('int2', { default: 0 })
  status: number // 0: not faucet, 1: faucet sent, 2:fail, 3: fauceting
}
