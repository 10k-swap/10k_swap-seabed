import { PromisePool } from '@supercharge/promise-pool'
import { addAddressPadding, Provider, uint256 } from 'starknet'
import { In, Repository } from 'typeorm'
import { PairEvent } from '../model/pair_event'
import { PairTransaction } from '../model/pair_transaction'
import { sleep } from '../util'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'
import { StarkscanService } from './starkscan'
import { ViewblockService } from './viewblock'
import { VoyagerService } from './voyager'

const TRANSACTION_FEE_RATIO = 3

export class PairTransactionService {
  private provider: Provider
  private starkscanService: StarkscanService
  private repoPairEvent: Repository<PairEvent>
  private repoPairTransaction: Repository<PairTransaction>

  constructor(provider: Provider) {
    this.provider = provider
    this.starkscanService = new StarkscanService(this.provider)
    this.repoPairEvent = Core.db.getRepository(PairEvent)
    this.repoPairTransaction = Core.db.getRepository(PairTransaction)
  }

  async purify() {
    const pairEvents = await this.repoPairEvent.find({
      where: { key_name: In(['Swap', 'Mint', 'Burn']), status: In([0, 2]) },
      // order: { event_time: 'ASC' },
      take: 2000,
    })

    await PromisePool.withConcurrency(50)
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
      take: 400,
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

        accountAddress = addAddressPadding(accountAddress)

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
    if (index % this.totalGroupGetAccountAddress === 0) {
      const tx = await this.provider.getTransaction(transaction_hash)
      const account_address = tx.contract_address || tx.sender_address
      if (account_address) {
        return account_address
      }
    }

    if (index % this.totalGroupGetAccountAddress === 1) {
      const voyagerService = new VoyagerService(this.provider)
      const resp = await voyagerService
        .getAxiosClient()
        .get(`/api/txn/${transaction_hash}`)

      if (resp.data?.header?.contract_address) {
        return resp.data.header.contract_address as string
      }
    }

    if (index % this.totalGroupGetAccountAddress === 2) {
      const viewblockService = new ViewblockService(this.provider)
      const resp = await viewblockService
        .getAxiosClient()
        .get(`/starknet/txs/${addAddressPadding(transaction_hash)}`)

      await sleep(300)

      if (resp.data?.extra?.contractAddress) {
        return resp.data.extra.contractAddress as string
      }
    }

    // From starkscan ⬇⬇⬇
    const postData = {
      operationName: 'transaction',
      variables: {
        input: {
          transaction_hash,
        },
      },
      query:
        'query transaction($input: TransactionInput!) {\n  transaction(input: $input) {\n    transaction_hash\n    block_hash\n    block_number\n    transaction_index\n    transaction_status\n    transaction_type\n    version\n    signature\n    max_fee\n    actual_fee\n    nonce\n    contract_address\n    entry_point_selector\n    entry_point_type\n    calldata\n    class_hash\n    sender_address\n    constructor_calldata\n    contract_address_salt\n    number_of_events\n    number_of_message_logs\n    number_of_calls\n    timestamp\n    entry_point_selector_name\n    calldata_decoded\n    execution_resources {\n      execution_resources_n_steps\n      execution_resources_n_memory_holes\n      execution_resources_builtin_instance_counter {\n        name\n        value\n        __typename\n      }\n      __typename\n    }\n    erc20_transfer_events {\n      event_id\n      transaction_hash\n      from_address\n      transfer_from_address\n      transfer_to_address\n      transfer_amount\n      call_invocation_type\n      main_call_id\n      timestamp\n      erc20_metadata {\n        contract_address\n        name\n        symbol\n        decimals\n        __typename\n      }\n      __typename\n    }\n    main_calls {\n      call_id\n      call_index\n      caller_address\n      contract_address\n      calldata\n      result\n      call_type\n      class_hash\n      selector\n      entry_point_type\n      selector_name\n      calldata_decoded\n      contract {\n        contract_address\n        class_hash\n        deployed_at_transaction_hash\n        deployed_at_timestamp\n        name_tag\n        implementation_type\n        is_social_verified\n        starknet_id {\n          domain\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    contract {\n      contract_address\n      class_hash\n      deployed_at_transaction_hash\n      deployed_at_timestamp\n      name_tag\n      implementation_type\n      is_social_verified\n      starknet_id {\n        domain\n        __typename\n      }\n      __typename\n    }\n    sender {\n      contract_address\n      class_hash\n      deployed_at_transaction_hash\n      deployed_at_timestamp\n      name_tag\n      implementation_type\n      is_social_verified\n      starknet_id {\n        domain\n        __typename\n      }\n      __typename\n    }\n    deployed_contracts {\n      contract_address\n      class_hash\n      deployed_at_transaction_hash\n      deployed_at_timestamp\n      name_tag\n      implementation_type\n      is_social_verified\n      starknet_id {\n        domain\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}',
    }

    const { data } = await this.starkscanService
      .getAxiosClient()
      .post('/graphql', postData)
    const account_address = (data?.data?.transaction?.contract_address ||
      data?.data?.transaction?.sender_address ||
      '') as string
    if (!account_address) {
      errorLogger.error(
        `Response miss contract_address. transaction_hash: ${transaction_hash}. Response data: ${JSON.stringify(
          data
        )}`
      )
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

    if (amount0In.gtn(0)) {
      pairTransaction.amount0 = amount0In.toString()
      pairTransaction.amount1 = amount1Out.toString()
      pairTransaction.swap_reverse = 0
      pairTransaction.fee = amount0In
        .muln(TRANSACTION_FEE_RATIO)
        .divn(1000)
        .toString()
    } else {
      pairTransaction.amount0 = amount0Out.toString()
      pairTransaction.amount1 = amount1In.toString()
      pairTransaction.swap_reverse = 1
      pairTransaction.fee = amount1In
        .muln(TRANSACTION_FEE_RATIO)
        .divn(1000)
        .toString()
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
