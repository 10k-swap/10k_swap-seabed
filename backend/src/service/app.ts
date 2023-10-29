import { utils } from 'ethers'
import {
  Account,
  Call,
  Provider,
  constants,
  ec,
  number as sNumber,
  uint256,
} from 'starknet'
import { contractConfig } from '../config'
import { equalsIgnoreCase } from '../util'
import { PoolService } from './pool'

export class AppService {
  private provider: Provider

  constructor(provider: Provider) {
    this.provider = provider
  }

  // @Deprecated
  async estimatedFees() {
    throw new Error('Router estimatedFees deprecated!')
  }
}
