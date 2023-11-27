import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'
import { GetBlockResponse } from 'starknet'

@Index(['block_number'])
@Entity()
export class SnBlock extends CommonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column('int', { width: 11, unique: true })
  block_number: number

  @Column('varchar', { length: 256 })
  block_hash: string

  @Column('json')
  block_data: GetBlockResponse
}
