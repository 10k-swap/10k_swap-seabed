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

  async estimatedFees() {
    const estimatedFeesAccount = process.env['ESTIMATED_FEES_ACCOUNT']
    const estimatedFeesPrivateKey = process.env['ESTIMATED_FEES_PRIVATE_KEY']
    const estimatedFeesPair = process.env['ESTIMATED_FEES_PAIR']
    if (!estimatedFeesAccount) {
      throw new Error('Miss process.env.ESTIMATED_FEES_ACCOUNT')
    }
    if (!estimatedFeesPrivateKey) {
      throw new Error('Miss process.env.ESTIMATED_FEES_PRIVATE_KEY')
    }

    const targetPair = PoolService.pairs.find(
      (item) =>
        estimatedFeesPair &&
        equalsIgnoreCase(item.pairAddress, estimatedFeesPair)
    )
    if (!targetPair) {
      throw new Error('Invalid process.env.ESTIMATED_FEES_PAIR')
    }

    const keyPair = ec.getKeyPair(estimatedFeesPrivateKey)
    const account = new Account(this.provider, estimatedFeesAccount, keyPair)

    const routerAddress =
      this.provider.chainId === constants.StarknetChainId.MAINNET
        ? contractConfig.addresses.mainnet.router
        : contractConfig.addresses.goerli.router

    const amount = uint256.bnToUint256(
      sNumber.toBN(utils.parseUnits('0.01', targetPair.decimals) + '')
    )
    const swapCalls: Call[] = [
      {
        contractAddress: targetPair.token0.address,
        entrypoint: 'approve',
        calldata: [routerAddress, amount.low, amount.high],
      },
      {
        contractAddress: routerAddress,
        entrypoint: 'swapExactTokensForTokens',
        calldata: [
          amount.low,
          amount.high,
          1000,
          0,
          2,
          targetPair.token0.address,
          targetPair.token1.address,
          estimatedFeesAccount,
          99999999999,
        ],
      },
    ]

    const swapFee = await account.estimateFee(swapCalls)

    console.warn('swapFee:', swapFee)
  }
}
