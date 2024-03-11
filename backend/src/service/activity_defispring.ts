import axios from 'axios'
import dayjs from 'dayjs'
import { BigNumber, utils } from 'ethers'
import { BigNumberish } from 'starknet'
import { Between, DeepPartial, IsNull, MoreThan } from 'typeorm'
import { STRK_TOKEN_INFO } from '../constants'
import { ActivityDefispring } from '../model/activity_defispring'
import { PairTransfer } from '../model/pair_transfer'
import { equalBN } from '../util'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'

type AccountHValue = Record<
  string,
  {
    balanceOf: BigNumberish
    partition: BigNumberish
    lastTime: number
  }
>

const activityStartTime = 1708560000000 // Start: 2024-02-22 00:00:00(UTC-0)
const activityEndTime = 1715990400000 // End: 2024-05-18 00:00:00(UTC-0)

// const activityStartTime = 1664582400000 // Start: 2022-10-01 00:00:00(UTC-0) //TODO
// const activityEndTime = 1664582400000 + 86400 * 20 * 1000 // End: 2022-10-20 00:00:00(UTC-0) //TODO

enum QaSTRKGrantPair {
  'USDC/USDT' = '0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
  'STRK/ETH' = '0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e',
  'ETH/USDC' = '0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
  'STRK/USDC' = '0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840',
}

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
      Array<{
        date: string
        allocation: number
        thirty_day_realized_volatility: number
        tvl_usd: number
        apr: number
      }>
    >
  > = undefined

  private accountHKey = 'ActivityDefispring_AccountH'

  constructor(
    private repoPairTransfer = Core.db.getRepository(PairTransfer),
    private repoActivityDefispring = Core.db.getRepository(ActivityDefispring),
    private activityCurrentTime = activityStartTime
  ) {}

  async startStatistics() {
    // const exists = await Core.redis.exists(this.accountHKey)
    // if (exists) return

    await Core.redis.del(this.accountHKey)

    let lastEventTime = (await this.repoPairTransfer.findOne({
      select: ['event_time'],
      order: { event_time: 'ASC' },
    }))!.event_time

    let lastPairTransfer: PairTransfer | undefined = undefined

    while (true) {
      if (lastEventTime.getTime() >= activityEndTime) {
        return
      }

      const newLastEventTime = new Date(
        Math.min(activityEndTime, lastEventTime.getTime() + 86_400_000)
      ) // 24 hours
      const transfers = await this.repoPairTransfer.find({
        where: {
          event_time: Between(lastEventTime, newLastEventTime),
        },
        order: { event_time: 'ASC' },
      })
      lastEventTime = new Date(newLastEventTime.getTime() + 1)

      for (const item of transfers) {
        if (
          this.activityCurrentTime >
            new Date(lastPairTransfer?.event_time || 0).getTime() &&
          this.activityCurrentTime <= new Date(item.event_time).getTime()
        ) {
          await this.gatherAccounts()

          this.activityCurrentTime = this.activityCurrentTime + 86400000
        }

        // Filter
        if (equalBN(item.from_address, item.token_address)) continue
        if (equalBN(item.from_address, item.recipient_address)) continue

        // Mint
        if (
          equalBN(item.from_address, 0) &&
          !equalBN(item.recipient_address, 0)
        ) {
          await this.mint(
            item.token_address,
            item.recipient_address,
            item.amount,
            item.event_time
          )
          continue
        }

        // Burn
        if (
          !equalBN(item.from_address, 0) &&
          equalBN(item.recipient_address, item.token_address)
        ) {
          await this.burn(
            item.token_address,
            item.from_address,
            item.amount,
            item.event_time
          )
          continue
        }

        // Transfer
        await this.transfer(
          item.token_address,
          item.from_address,
          item.recipient_address,
          item.amount,
          item.event_time
        )

        lastPairTransfer = item
      }
    }
  }

  async statisticsSTRKRewards() {
    const l0kswap = ActivityDefispringService.qaSTRKGrant?.['10kSwap']
    if (!l0kswap) return

    for (const key in l0kswap) {
      const list: {
        date: string
        allocation: number
      }[] = l0kswap[key]

      const pairAddress = QaSTRKGrantPair[key]

      for (const item of list) {
        await this.statisticsSTRKRewardsOne(
          pairAddress,
          item.date,
          item.allocation
        )
      }
    }
  }

  async statisticsSTRKRewardsOne(
    pairAddress: string,
    day: string,
    allocation: number
  ) {
    const allocationWei = utils.parseUnits(
      allocation + '',
      STRK_TOKEN_INFO.decimals
    )

    const upOne = await this.repoActivityDefispring.findOne({
      select: ['id'],
      where: { pair_address: pairAddress, day: MoreThan(day) },
    })
    if (upOne?.id === undefined) return

    const queryBuilder = this.repoActivityDefispring.createQueryBuilder()
    queryBuilder.select(
      `CONCAT(ROUND(SUM(CAST(balance_of as numeric)), 0), '') as sum_balance_of`
    )
    queryBuilder.where('pair_address = :pairAddress AND day = :day', {
      pairAddress,
      day,
    })

    const sumBalanceOf = (await queryBuilder.getRawMany())[0]?.sum_balance_of
    if (!sumBalanceOf) return

    let lastId = 0
    while (true) {
      const list = await this.repoActivityDefispring.find({
        where: {
          id: MoreThan(lastId),
          pair_address: pairAddress,
          day,
          rewards: IsNull(),
          balance_of: MoreThan(0),
        },
        take: 2000,
        order: { id: 'ASC' },
      })

      if (list.length <= 0) break

      await Promise.all(
        list.map(async (item) => {
          if (BigNumber.from(item.balance_of).lte(0)) {
            return
          }

          const rewards =
            BigNumber.from(allocationWei)
              .mul(item.balance_of)
              .div(sumBalanceOf) + ''

          await this.repoActivityDefispring.update(item.id, { rewards })
        })
      )

      lastId = list[list.length - 1].id
    }
  }

  async cacheQaSTRKGrant() {
    const { data, status } = await axios.get(
      'https://kx58j6x5me.execute-api.us-east-1.amazonaws.com//starknet/fetchFile?file=qa_strk_grant.json'
    )

    if (status == 200 && data) {
      ActivityDefispringService.qaSTRKGrant = data
      await Core.redis.hset(
        'cacheQaSTRKGrant',
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        JSON.stringify(data)
      )
    }
  }

  async getRewardsByAccount(account: string, fromDay: string, toDay: string) {
    const list = await this.repoActivityDefispring.find({
      where: {
        account_address: account,
        day: Between(fromDay, toDay),
      },
    })

    return list
  }

  private async gatherAccounts() {
    const day = dayjs(this.activityCurrentTime).format('YYYY-MM-DD')

    let cursor = '0'
    while (true) {
      const [_cursor, _kvs] = await Core.redis.hscan(
        this.accountHKey,
        cursor,
        'COUNT',
        500
      )
      cursor = _cursor

      const accounts: [string, AccountHValue][] = []
      for (let index = 0; index < _kvs.length; index += 2) {
        accounts.push([_kvs[index], JSON.parse(_kvs[index + 1])])
      }

      await Promise.all(
        accounts.map(async (item) => {
          const activityDefisprings: DeepPartial<ActivityDefispring>[] = []

          for (const pairAddress in item[1]) {
            // const one = await this.repoActivityDefispring.findOne(
            //   { account_address: item[0], pair_address: pairAddress, day },
            //   {
            //     select: ['id'],
            //   }
            // )
            // if (one) {
            //   await this.repoActivityDefispring.update(one.id, {
            //     balance_of: item[1][pairAddress].balanceOf + '',
            //     partition: item[1][pairAddress].partition + '',
            //   })
            // } else {
            // await this.repoActivityDefispring.save({
            //   pair_address: pairAddress,
            //   account_address: item[0],
            //   balance_of: item[1][pairAddress].balanceOf + '',
            //   partition: item[1][pairAddress].partition + '',
            //   day,
            //   rewards: null,
            // })
            // }

            if (
              BigNumber.from(item[1][pairAddress].balanceOf).gt(0) ||
              BigNumber.from(item[1][pairAddress].partition).gt(0)
            ) {
              activityDefisprings.push({
                pair_address: pairAddress,
                account_address: item[0],
                balance_of: item[1][pairAddress].balanceOf + '',
                partition: item[1][pairAddress].partition + '',
                day,
                rewards: null,
              })
            }

            // Update new partition
            item[1][pairAddress].partition =
              BigNumber.from(item[1][pairAddress].balanceOf).mul(86400) + ''
          }

          if (activityDefisprings.length > 0)
            await this.repoActivityDefispring.save(activityDefisprings)

          await Core.redis.hset(
            this.accountHKey,
            item[0],
            JSON.stringify(item[1])
          )
        })
      )

      if (cursor == '0') break
    }
  }

  private async mint(
    tokenAddress: string,
    account: string,
    amount: BigNumberish,
    eventTime: Date
  ) {
    const value = await Core.redis.hget(this.accountHKey, account)
    const accountCache: AccountHValue = value ? JSON.parse(value) : {}
    const lastTime = new Date(eventTime).getTime()

    const plusPartition = BigNumber.from(amount).mul(
      parseInt((this.activityCurrentTime - lastTime) / 1000 + '')
    )

    accountCache[tokenAddress] = {
      balanceOf:
        BigNumber.from(accountCache[tokenAddress]?.balanceOf || 0).add(amount) +
        '',
      partition:
        BigNumber.from(accountCache[tokenAddress]?.partition || 0).add(
          plusPartition
        ) + '',
      lastTime,
    }

    await Core.redis.hset(
      this.accountHKey,
      account,
      JSON.stringify(accountCache)
    )
  }

  private async burn(
    tokenAddress: string,
    account: string,
    amount: BigNumberish,
    eventTime: Date
  ) {
    const value = await Core.redis.hget(this.accountHKey, account)
    const accountCache: AccountHValue = value ? JSON.parse(value) : {}
    const lastTime = new Date(eventTime).getTime()

    const subPartition = BigNumber.from(amount).mul(
      parseInt((this.activityCurrentTime - lastTime) / 1000 + '')
    )

    accountCache[tokenAddress] = {
      balanceOf:
        BigNumber.from(accountCache[tokenAddress]?.balanceOf || 0).sub(amount) +
        '',
      partition:
        BigNumber.from(accountCache[tokenAddress]?.partition || 0).sub(
          subPartition
        ) + '',
      lastTime,
    }

    await Core.redis.hset(
      this.accountHKey,
      account,
      JSON.stringify(accountCache)
    )
  }

  private async transfer(
    tokenAddress: string,
    fromAccount: string,
    recipientAccount: string,
    amount: BigNumberish,
    eventTime: Date
  ) {
    await this.burn(tokenAddress, fromAccount, amount, eventTime)
    await this.mint(tokenAddress, recipientAccount, amount, eventTime)
  }
}
