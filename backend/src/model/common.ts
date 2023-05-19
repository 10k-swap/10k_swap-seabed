import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm'

export abstract class CommonEntity extends BaseEntity {
  // ↓ common ↓
  @Column('bigint', { default: 0, unsigned: true })
  created_by: number

  @Column('bigint', { default: 0, unsigned: true })
  updated_by: number

  @Column('timestamp', { precision: 6, default: null })
  published_at?: Date

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date

  @DeleteDateColumn()
  deleted_at!: Date
}
