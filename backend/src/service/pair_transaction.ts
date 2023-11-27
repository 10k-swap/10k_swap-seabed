import { PromisePool } from '@supercharge/promise-pool'
import { addAddressPadding, uint256 } from 'starknet'
import { In, Repository } from 'typeorm'
import { PairEvent } from '../model/pair_event'
import { PairTransaction } from '../model/pair_transaction'
import { getRpcProviderByEnv, sleep } from '../util'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'
import { VoyagerService } from './voyager'
import { RpcsService } from './rpcs'

const TRANSACTION_FEE_RATIO = 3

export class PairTransactionService {
  private repoPairEvent: Repository<PairEvent>
  private repoPairTransaction: Repository<PairTransaction>

  constructor() {
    this.repoPairEvent = Core.db.getRepository(PairEvent)
    this.repoPairTransaction = Core.db.getRepository(PairTransaction)
  }

  async purify() {
    const pairEvents = await this.repoPairEvent.find({
      where: { status: In([0, 2]) },
      take: 500,
    })

    await PromisePool.withConcurrency(20)
      .for(pairEvents)
      .process(this.purifyOne.bind(this))
  }

  private async purifyOne(pairEvent: PairEvent) {
    try {
      const pairTransaction = new PairTransaction()
      pairTransaction.pair_address = pairEvent.pair_address
      pairTransaction.event_id = pairEvent.event_id
      pairTransaction.transaction_hash = pairEvent.transaction_hash
      pairTransaction.key_name = pairEvent.key_name
      pairTransaction.event_time = pairEvent.event_time

      // Account address
      // pairTransaction.account_address = await this.getAccountAddress(pairEvent.transaction_hash)
      pairTransaction.account_address = ''

      switch (pairEvent.key_name) {
        case 'Swap':
          await this.eventSwap(pairEvent, pairTransaction)
          break
        case 'Mint':
          await this.eventMint(pairEvent, pairTransaction)
          break
        case 'Burn':
          await this.eventBurn(pairEvent, pairTransaction)
          break
        default:
          errorLogger.error(
            `Invalid key_name: ${pairEvent.key_name}, transaction_hash: ${pairEvent.transaction_hash}`
          )
          return
      }

      await this.updateOrInsert(pairTransaction)

      await this.pairEventPurified(pairEvent)
    } catch (err) {
      errorLogger.error(
        'PurifyOne fail:',
        err.message,
        ', transaction_hash: ',
        pairEvent.transaction_hash
      )
      await this.pairEventPurifyFailed(pairEvent)
    }
  }

  async purifyAccountAddress() {
    const pairTransactions = await this.repoPairTransaction.find({
      where: { account_address: '' },
      order: { id: 'ASC' },
      select: ['id', 'transaction_hash'],
      take: 500,
    })

    const updateAccount = async (
      index: number,
      pairTransaction: PairTransaction
    ) => {
      try {
        let accountAddress = await this.getAccountAddress(
          index,
          pairTransaction.transaction_hash
        )
        if (!accountAddress) {
          return
        }

        accountAddress = addAddressPadding(accountAddress).toLocaleLowerCase()

        await this.repoPairTransaction.update(pairTransaction.id, {
          account_address: accountAddress,
        })
      } catch (err) {
        errorLogger.error(
          'PurifyAccountAddress failed:',
          err.message,
          ', transaction_hash:',
          pairTransaction.transaction_hash,
          ', index:',
          index
        )
      }
    }

    const updateAccountGroup = async (
      pairTransactionGroup: (PairTransaction & { index: number })[]
    ) => {
      if (!pairTransactionGroup) {
        return
      }

      for (const pairTransaction of pairTransactionGroup) {
        await updateAccount(pairTransaction.index, pairTransaction)
      }
    }

    const pairTransactionGroups: (PairTransaction & { index: number })[][] = []
    for (let index = 0; index < pairTransactions.length; index++) {
      const mod = index % this.totalGroupGetAccountAddress
      if (!pairTransactionGroups[mod]) pairTransactionGroups[mod] = []
      pairTransactionGroups[mod].push({
        ...pairTransactions[index],
        index,
      } as any)
    }

    await PromisePool.withConcurrency(this.totalGroupGetAccountAddress)
      .for(pairTransactionGroups)
      .process(updateAccountGroup.bind(this))
  }

  private totalGroupGetAccountAddress = 4
  private async getAccountAddress(index: number, transaction_hash: string) {
    const mod = index % this.totalGroupGetAccountAddress

    if (mod === 0) {
      const voyagerService = new VoyagerService()
      const resp = await voyagerService
        .getAxiosClient()
        .get(`/api/txn/${transaction_hash}`)

      if (resp.data?.header?.contract_address)
        return resp.data.header.contract_address as string
    }

    // Rpc provider ⬇⬇⬇
    const rpcsService = new RpcsService()
    let rpcProvider = rpcsService.blastRpcProvider()
    if (mod == 1) {
      rpcProvider = rpcsService.lavaRpcProvider()
    }
    if (mod == 2) {
      rpcProvider = rpcsService.nethermindRpcProvider()
    }

    const transaction = await rpcProvider.getTransactionByHash(transaction_hash)
    const account_address = transaction
      ? ((transaction['contract_address'] ||
          transaction['sender_address'] ||
          '') as string)
      : ''
    if (!account_address) {
      errorLogger.error(
        `Response miss contract_address. transaction_hash: ${transaction_hash}. index: ${index}`
      )
      await sleep(2000)
    }

    return account_address
  }

  // Swap
  private async eventSwap(
    pairEvent: PairEvent,
    pairTransaction: PairTransaction
  ) {
    const eventData = JSON.parse(pairEvent.event_data)
    if (!eventData || eventData.length != 10) {
      throw `EventSwap: invalid data, transaction_hash: ${pairEvent.transaction_hash}`
    }

    const amount0In = uint256.uint256ToBN({
      low: eventData[1],
      high: eventData[2],
    })
    const amount1In = uint256.uint256ToBN({
      low: eventData[3],
      high: eventData[4],
    })
    const amount0Out = uint256.uint256ToBN({
      low: eventData[5],
      high: eventData[6],
    })
    const amount1Out = uint256.uint256ToBN({
      low: eventData[7],
      high: eventData[8],
    })

    if (amount0In > 0n) {
      pairTransaction.amount0 = amount0In.toString()
      pairTransaction.amount1 = amount1Out.toString()
      pairTransaction.swap_reverse = 0
      pairTransaction.fee =
        (amount0In * BigInt(TRANSACTION_FEE_RATIO)) / 1000n + ''
    } else {
      pairTransaction.amount0 = amount0Out.toString()
      pairTransaction.amount1 = amount1In.toString()
      pairTransaction.swap_reverse = 1
      pairTransaction.fee =
        (amount1In * BigInt(TRANSACTION_FEE_RATIO)) / 1000n + ''
    }
  }

  // Add liquidity
  private async eventMint(
    pairEvent: PairEvent,
    pairTransaction: PairTransaction
  ) {
    const eventData = JSON.parse(pairEvent.event_data)
    if (!eventData || eventData.length != 5) {
      throw `EventMint: invalid data, transaction_hash: ${pairEvent.transaction_hash}`
    }

    const amount0 = uint256.uint256ToBN({
      low: eventData[1],
      high: eventData[2],
    })
    const amount1 = uint256.uint256ToBN({
      low: eventData[3],
      high: eventData[4],
    })

    pairTransaction.amount0 = amount0.toString()
    pairTransaction.amount1 = amount1.toString()
  }

  // Remove liquidity
  private async eventBurn(
    pairEvent: PairEvent,
    pairTransaction: PairTransaction
  ) {
    const eventData = JSON.parse(pairEvent.event_data)
    if (!eventData || eventData.length != 6) {
      throw `EventBurn: invalid data, transaction_hash: ${pairEvent.transaction_hash}`
    }

    const amount0 = uint256.uint256ToBN({
      low: eventData[1],
      high: eventData[2],
    })
    const amount1 = uint256.uint256ToBN({
      low: eventData[3],
      high: eventData[4],
    })

    pairTransaction.amount0 = amount0.toString()
    pairTransaction.amount1 = amount1.toString()
  }

  private async updateOrInsert(pairTransaction: PairTransaction) {
    const one = await this.repoPairTransaction.findOne({
      select: ['id'],
      where: { event_id: pairTransaction.event_id },
    })

    if (one?.id) {
      await this.repoPairTransaction.update({ id: one.id }, pairTransaction)
    } else {
      await this.repoPairTransaction.save(pairTransaction)
    }
  }

  private async pairEventPurified(pairEvent: PairEvent) {
    return await this.repoPairEvent.update(
      {
        id: pairEvent.id,
      },
      { status: 1 }
    )
  }

  private async pairEventPurifyFailed(pairEvent: PairEvent) {
    return await this.repoPairEvent.update(
      {
        id: pairEvent.id,
      },
      { status: 2 }
    )
  }
}
