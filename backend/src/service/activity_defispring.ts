import axios from 'axios'
import { PairTransfer } from '../model/pair_transfer'
import { Core } from '../util/core'
import { BigNumberish } from 'starknet'
import { MoreThan } from 'typeorm'
import { equalBN } from '../util'
import { BigNumber } from 'ethers'

type AccountHValue = Record<
  string,
  {
    balanceOf: BigNumberish
    lastTransactionHash: string
    lastTimestamp: number
  }
>

const startTimestamp = 1708560000 // Start: 2024-02-22 00:00:00(UTC-0)
const endTimestamp = 1715904000 // End: 2024-05-17 00:00:00(UTC-0)

export class ActivityDefispringService {
  public static qaSTRKGrant?: Record<
    | 'Ekubo'
    | 'MySwap'
    | 'Haiko'
    | '10kSwap'
    | 'StarkDefi'
    | 'Sithswap'
    | 'Nostra'
    | 'Jediswap_v1',
    Record<
      'USDC/USDT' | 'STRK/ETH' | 'ETH/USDC' | 'STRK/USDC',
      {
        date: string
        allocation: number
        thirty_day_realized_volatility: number
        tvl_usd: number
        apr: number
      }
    >
  > = undefined

  private accountHKey = 'ActivityDefispring_AccountH'

  constructor(private pairTransfer = Core.db.getRepository(PairTransfer)) {}

  async startStatistics() {
    await Core.redis.del(this.accountHKey)

    let lastId = 0
    while (true) {
      const startTime = new Date().getTime()

      const transfers = await this.pairTransfer.find({
        where: { id: MoreThan(lastId) },
        order: { event_time: 'ASC', id: 'ASC' },
        take: 20000,
      })

      if (transfers.length <= 0) break

      await this.statisticsBatch(transfers)

      console.log('Used time: ', new Date().getTime() - startTime)

      lastId = transfers[transfers.length - 1].id
    }
  }

  private async statisticsBatch(transfers: PairTransfer[]) {
    for (const item of transfers) {
      // Filter
      if (equalBN(item.from_address, item.token_address)) continue
      if (equalBN(item.from_address, item.recipient_address)) continue

      // Mint
      if (
        equalBN(item.from_address, 0) &&
        !equalBN(item.recipient_address, 0)
      ) {
        await this.mint(item)
        continue
      }

      // Burn
      if (
        !equalBN(item.from_address, 0) &&
        equalBN(item.recipient_address, item.token_address)
      ) {
        await this.burn(item)
        continue
      }

      // Transfer
      await this.transfer(item)
    }
  }

  async cacheQaSTRKGrant() {
    const { data, status } = await axios.get(
      'https://kx58j6x5me.execute-api.us-east-1.amazonaws.com//starknet/fetchFile?file=qa_strk_grant.json'
    )

    if (status == 200 && data) ActivityDefispringService.qaSTRKGrant = data
  }

  private async mint(pairTransfer: PairTransfer) {
    const token = pairTransfer.token_address
    const account = pairTransfer.recipient_address

    const value = await Core.redis.hget(this.accountHKey, account)
    const accountCache: AccountHValue = value ? JSON.parse(value) : {}

    accountCache[token] = {
      balanceOf:
        BigNumber.from(accountCache[token]?.balanceOf || 0).add(
          pairTransfer.amount
        ) + '',
      lastTransactionHash: pairTransfer.transaction_hash,
      lastTimestamp: parseInt(
        new Date(pairTransfer.event_time).getTime() / 1000 + ''
      ),
    }

    await Core.redis.hset(
      this.accountHKey,
      account,
      JSON.stringify(accountCache)
    )
  }

  private async burn(pairTransfer: PairTransfer) {
    const token = pairTransfer.token_address
    const account = pairTransfer.from_address

    const value = await Core.redis.hget(this.accountHKey, account)
    const accountCache: AccountHValue = value ? JSON.parse(value) : {}

    accountCache[token] = {
      balanceOf:
        BigNumber.from(accountCache[token]?.balanceOf || 0).sub(
          pairTransfer.amount
        ) + '',
      lastTransactionHash: pairTransfer.transaction_hash,
      lastTimestamp: parseInt(
        new Date(pairTransfer.event_time).getTime() / 1000 + ''
      ),
    }

    await Core.redis.hset(
      this.accountHKey,
      account,
      JSON.stringify(accountCache)
    )
  }

  private async transfer(pairTransfer: PairTransfer) {}
}
