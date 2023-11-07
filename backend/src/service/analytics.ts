import dayjs from 'dayjs'
import { utils } from 'ethers'
import { number as sNumber } from 'starknet'
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm'
import { PairTransaction } from '../model/pair_transaction'
import { dateFormatNormal } from '../util'
import { Core } from '../util/core'
import { CoinbaseService } from './coinbase'
import type { Pair } from './pool'
import { PoolService } from './pool'

export class AnalyticsService {
  private repoPairTransaction: Repository<PairTransaction>

  constructor() {
    this.repoPairTransaction = Core.db.getRepository(PairTransaction)
  }

  async getTVLsByDay(startTime: Date | undefined = undefined) {
    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.select(
      `to_char(event_time, 'YYYY-MM-DD') as event_time_day, pair_address, CONCAT(ROUND(SUM(CAST(amount0 as numeric)), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 as numeric)), 0), '') as sum_amount1, key_name, swap_reverse`
    ) // CONCAT ''. Prevent automatic conversion to scientific notation
    queryBuilder.where('key_name IN (:...keynames)', {
      keynames: ['Mint', 'Burn', 'Swap'],
    })
    queryBuilder
      .addGroupBy('event_time_day')
      .addGroupBy('pair_address')
      .addGroupBy('key_name')
      .addGroupBy('swap_reverse')
    queryBuilder.addOrderBy('event_time_day', 'ASC')

    const rawMany = await queryBuilder.getRawMany<{
      event_time_day: string
      pair_address: string
      sum_amount0: string
      sum_amount1: string
      key_name: string
      swap_reverse: number
    }>()

    const tvls: { date: string; tvl: number }[] = []
    if (rawMany.length > 1) {
      const startDay = dayjs(rawMany[0].event_time_day)
      const endDay = dayjs(rawMany[rawMany.length - 1].event_time_day)

      let tvl_usd = 0
      for (let i = 0; ; i++) {
        const currentDate = startDay.add(i, 'day')
        if (currentDate.unix() > endDay.unix()) {
          break
        }

        for (const item of rawMany) {
          if (currentDate.unix() !== dayjs(item.event_time_day).unix()) {
            continue
          }

          const targetPair = this.getTargetPair(item.pair_address)
          if (!targetPair) {
            continue
          }

          if (item.key_name == 'Swap') {
            if (item.swap_reverse == 0) {
              tvl_usd += await this.amount0AddAmount1ForUsd(
                item.sum_amount0,
                '-' + item.sum_amount1,
                targetPair
              )
            } else {
              tvl_usd += await this.amount0AddAmount1ForUsd(
                '-' + item.sum_amount0,
                item.sum_amount1,
                targetPair
              )
            }
          } else {
            const _usd = await this.amount0AddAmount1ForUsd(
              item.sum_amount0,
              item.sum_amount1,
              targetPair
            )

            // TODO: Excessive values may overflow
            if (item.key_name === 'Mint') tvl_usd += _usd
            if (item.key_name === 'Burn') tvl_usd -= _usd
          }
        }

        if (startTime && currentDate.diff(startTime) < 0) continue

        tvls.push({ date: currentDate.format('YYYY-MM-DD'), tvl: tvl_usd })
      }
    }

    return tvls
  }

  async getVolumesByDay(startTime: Date | undefined = undefined) {
    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.select(
      `to_char(event_time, 'YYYY-MM-DD') as event_time_day, pair_address, CONCAT(ROUND(SUM(CAST(amount0 as numeric)), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 as numeric)), 0), '') as sum_amount1, swap_reverse`
    ) // CONCAT ''. Prevent automatic conversion to scientific notation
    queryBuilder.where('key_name = :keyname AND event_time >= :startTime', {
      keyname: 'Swap',
      startTime: dateFormatNormal(startTime),
    })
    queryBuilder
      .addGroupBy('event_time_day')
      .addGroupBy('pair_address')
      .addGroupBy('swap_reverse')
    queryBuilder.addOrderBy('event_time_day', 'ASC')

    const rawMany = await queryBuilder.getRawMany<{
      event_time_day: string
      pair_address: string
      sum_amount0: string
      sum_amount1: string
      swap_reverse: number
    }>()

    const volumes: { date: string; volume: number }[] = []
    if (rawMany.length > 1) {
      const startDay = dayjs(rawMany[0].event_time_day)
      const endDay = dayjs(rawMany[rawMany.length - 1].event_time_day)

      for (let i = 0; ; i++) {
        const currentDate = startDay.add(i, 'day')
        if (currentDate.unix() > endDay.unix()) {
          break
        }

        let volume_usd = 0
        for (const item of rawMany) {
          if (currentDate.unix() !== dayjs(item.event_time_day).unix()) {
            continue
          }

          const targetPair = this.getTargetPair(item.pair_address)
          if (!targetPair) {
            continue
          }

          // TODO: Excessive values may overflow
          volume_usd += await this.getPairVolumeForUsd(
            item.sum_amount0,
            item.sum_amount1,
            targetPair,
            item.swap_reverse
          )
        }

        if (startTime && currentDate.diff(startTime) < 0) continue

        volumes.push({
          date: currentDate.format('YYYY-MM-DD'),
          volume: volume_usd,
        })
      }
    }

    return volumes
  }

  async getTransactions(
    startTime: number,
    endTime: number,
    keyName: string,
    page = 1
  ) {
    const limit = 10
    page = page < 1 ? 1 : page

    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.andWhere(`account_address != ''`)
    if (keyName) {
      queryBuilder.andWhere('key_name = :keyName', { keyName })
    }
    if (startTime > 0) {
      queryBuilder.andWhere('event_time >= :startTimeFormat', {
        startTimeFormat: dateFormatNormal(startTime * 1000),
      })
    }
    if (endTime > 0) {
      queryBuilder.andWhere('event_time <= :endTimeFormat', {
        endTimeFormat: dateFormatNormal(endTime * 1000),
      })
    }
    queryBuilder.addOrderBy('event_time', 'DESC').addOrderBy('id', 'DESC')
    queryBuilder.limit(limit).offset(limit * (page - 1))

    const [transactions, total] = await queryBuilder.getManyAndCount()

    for (const item of transactions) {
      item['token0'] = undefined
      item['token1'] = undefined
      item['amount0_human'] = ''
      item['amount1_human'] = ''
      item['fee_usd'] = ''

      const pair = this.getTargetPair(item.pair_address)
      if (pair) {
        item['token0'] = pair.token0
        item['token1'] = pair.token1

        item['amount0_human'] = utils.formatUnits(
          item.amount0,
          pair.token0.decimals
        )
        item['amount1_human'] = utils.formatUnits(
          item.amount1,
          pair.token1.decimals
        )

        if (sNumber.toBN(item.fee).gtn(0)) {
          const coinbaseService = new CoinbaseService()
          const [_decimals, _symbol] =
            item.swap_reverse === 0
              ? [pair.token0.decimals, pair.token0.symbol]
              : [pair.token1.decimals, pair.token1.symbol]
          item['fee_usd'] = await coinbaseService.exchangeToUsd(
            item.fee,
            _decimals,
            _symbol
          )
        }
      }
    }

    return { transactions, total, limit, page }
  }

  async getTransactionsSummary(startTime: number, endTime: number) {
    const swapFees = await this.getPairSwapFees(startTime, endTime)

    const profits: {
      address: string
      name: string
      symbol: string
      decimals: number
      amount: string
      amountHuman: string
    }[] = []
    for (const item of swapFees) {
      const pair = this.getTargetPair(item.pair_address)
      if (!pair) {
        continue
      }

      const feeToken = item.swap_reverse === 0 ? pair.token0 : pair.token1
      const targetProfit = profits.find(
        (profit) => profit.address == feeToken.address
      )
      const amount = sNumber.toBN(item.sum_fee + '')

      if (targetProfit) {
        targetProfit.amount = amount.add(sNumber.toBN(targetProfit.amount)) + ''
        targetProfit.amountHuman = utils.formatUnits(
          targetProfit.amount,
          feeToken.decimals
        )
      } else {
        const amountHuman = utils.formatUnits(amount + '', feeToken.decimals)
        profits.push({ ...feeToken, amount: amount + '', amountHuman })
      }
    }

    // QueryBuilder
    const [startOne, endOne] = await Promise.all([
      this.repoPairTransaction.findOne({
        select: ['id'],
        where:
          startTime > 0
            ? {
                event_time: MoreThanOrEqual(new Date(startTime * 1000)),
              }
            : {},
        order: { event_time: 'ASC' },
      }),
      this.repoPairTransaction.findOne({
        select: ['id'],
        where:
          endTime > 0
            ? {
                event_time: LessThanOrEqual(new Date(endTime * 1000)),
              }
            : {},
        order: { event_time: 'DESC' },
      }),
    ])
    let total = (endOne?.id || 0) - (startOne?.id || 0)
    if (total < 0) total = 0

    return { total, profits }
  }

  async getPairs(startTime: number, endTime: number, page = 1) {
    // Currently not working
    const limit = 100
    page = page < 1 ? 1 : page

    const [
      pairVolumes24Hour,
      pairVolumes7Day,
      pairSwapFees24Hour,
      pairSwapFeesTotal,
    ] = await Promise.all([
      this.getPairVolumes24Hour(),
      this.getPairVolumes7Day(),
      this.getPairSwapFees24Hour(),
      this.getPairSwapFees(startTime, endTime),
    ])

    const pairs: (Pair & {
      liquidity: number
      volume24h: number
      volume7d: number
      fees24h: number
      feesTotal: number
    })[] = []
    for (const pair of PoolService.pairs) {
      // Volume(24h)
      let volume24h = 0
      for (const pv24h of pairVolumes24Hour) {
        if (pv24h.pair_address == pair.pairAddress) {
          volume24h += await this.getPairVolumeForUsd(
            pv24h.sum_amount0,
            pv24h.sum_amount1,
            pair,
            pv24h.swap_reverse
          )
        }
      }

      // Volume(7d)
      let volume7d = 0
      for (const pv7d of pairVolumes7Day) {
        if (pv7d.pair_address == pair.pairAddress) {
          volume7d += await this.getPairVolumeForUsd(
            pv7d.sum_amount0,
            pv7d.sum_amount1,
            pair,
            pv7d.swap_reverse
          )
        }
      }

      // fees(24h)
      let f24Amount0 = 0,
        f24Amount1 = 0
      pairSwapFees24Hour.forEach((item) => {
        if (pair.pairAddress == item.pair_address) {
          if (item.swap_reverse == 0) f24Amount0 += item.sum_fee
          if (item.swap_reverse == 1) f24Amount1 += item.sum_fee
        }
      })
      const fees24h = await this.amount0AddAmount1ForUsd(
        f24Amount0,
        f24Amount1,
        pair
      )

      // fees(total)
      let fTotalAmount0 = 0,
        fTotalAmount1 = 0
      pairSwapFeesTotal.forEach((item) => {
        if (pair.pairAddress == item.pair_address) {
          if (item.swap_reverse == 0) fTotalAmount0 += item.sum_fee
          if (item.swap_reverse == 1) fTotalAmount1 += item.sum_fee
        }
      })
      const feesTotal = await this.amount0AddAmount1ForUsd(
        fTotalAmount0,
        fTotalAmount1,
        pair
      )

      pairs.push({
        ...pair,
        volume24h,
        volume7d,
        fees24h,
        feesTotal,
      })
    }

    return { pairs, total: 0, limit, page }
  }

  async getTVLsByAccount(count = 100) {
    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.select(
      `account_address, pair_address, CONCAT(ROUND(SUM(amount0), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1), 0), '') as sum_amount1, key_name`
    ) // CONCAT ''. Prevent automatic conversion to scientific notation
    queryBuilder.where('key_name IN (:...keynames)', {
      keynames: ['Mint', 'Burn'],
    })
    queryBuilder
      .addGroupBy('account_address')
      .addGroupBy('pair_address')
      .addGroupBy('key_name')

    const rawMany = await queryBuilder.getRawMany<{
      account_address: string
      pair_address: string
      sum_amount0: string
      sum_amount1: string
      key_name: string
    }>()

    const tvls: {
      account_address: string
      tvlTotal: number
      tvlPairs: { [key: string]: number }
    }[] = []
    if (rawMany.length > 1) {
      const tvlAccountMap: {
        [key: string]: { [key: string]: number }
      } = {}

      for (const item of rawMany) {
        const targetPair = this.getTargetPair(item.pair_address)
        if (!targetPair) {
          continue
        }

        const _usd = await this.amount0AddAmount1ForUsd(
          item.sum_amount0,
          item.sum_amount1,
          targetPair
        )

        // TODO: Excessive values may overflow
        let tvl_usd = 0
        if (item.key_name === 'Mint') tvl_usd += _usd
        if (item.key_name === 'Burn') tvl_usd -= _usd

        const target = tvlAccountMap[item.account_address] || {}
        if (!target[item.pair_address]) target[item.pair_address] = 0

        target[item.pair_address] += tvl_usd
        tvlAccountMap[item.account_address] = target
      }

      for (const key in tvlAccountMap) {
        const tvlPairs = tvlAccountMap[key]

        let tvlTotal = 0
        for (const key1 in tvlPairs) {
          tvlTotal += tvlPairs[key1]
        }

        tvls.push({ account_address: key, tvlTotal, tvlPairs })
      }
    }

    return tvls.sort((a, b) => b.tvlTotal - a.tvlTotal).slice(0, count)
  }

  private getTargetPair(pairAddress: string) {
    return PoolService.pairs.find((item) => item.pairAddress == pairAddress)
  }

  private async getPairSwapFees(startTime: number, endTime: number) {
    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.select(
      `pair_address, swap_reverse, CONCAT(ROUND(SUM(CAST(fee AS DECIMAL(256,0))), 0), '') as sum_fee`
    )
    queryBuilder.where('key_name = :key_name', { key_name: 'Swap' })
    if (startTime > 0) {
      queryBuilder.andWhere('event_time >= :startTimeFormat', {
        startTimeFormat: dateFormatNormal(startTime * 1000),
      })
    }
    if (endTime > 0) {
      queryBuilder.andWhere('event_time <= :endTimeFormat', {
        endTimeFormat: dateFormatNormal(endTime * 1000),
      })
    }
    queryBuilder.addGroupBy('pair_address').addGroupBy('swap_reverse')

    return await queryBuilder.getRawMany<{
      pair_address: string
      swap_reverse: number
      sum_fee: number
    }>()
  }

  private async getPairSwapFees24Hour() {
    const startTime = dayjs().subtract(24, 'hour').unix()
    return this.getPairSwapFees(startTime, 0)
  }

  private async getPairVolumes(startTime: number, endTime: number) {
    // QueryBuilder
    const queryBuilder = this.repoPairTransaction.createQueryBuilder()
    queryBuilder.select(
      `pair_address, CONCAT(ROUND(SUM(CAST(amount0 AS DECIMAL(256,0))), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 AS DECIMAL(256,0))), 0), '') as sum_amount1, swap_reverse`
    )
    queryBuilder.where('key_name = :key_name', { key_name: 'Swap' })
    if (startTime > 0) {
      queryBuilder.andWhere('event_time >= :startTimeFormat', {
        startTimeFormat: dateFormatNormal(startTime * 1000),
      })
    }
    if (endTime > 0) {
      queryBuilder.andWhere('event_time <= :endTimeFormat', {
        endTimeFormat: dateFormatNormal(endTime * 1000),
      })
    }
    queryBuilder.addGroupBy('pair_address').addGroupBy('swap_reverse')

    return await queryBuilder.getRawMany<{
      pair_address: string
      sum_amount0: string
      sum_amount1: string
      swap_reverse: number
    }>()
  }

  private async getPairVolumes24Hour() {
    const startTime = dayjs().subtract(24, 'hour').unix()
    return this.getPairVolumes(startTime, 0)
  }

  private async getPairVolumes7Day() {
    const startTime = dayjs().subtract(7, 'day').unix()
    return this.getPairVolumes(startTime, 0)
  }

  private async getPairVolumeForUsd(
    amount0: sNumber.BigNumberish | undefined,
    amount1: sNumber.BigNumberish | undefined,
    pair: Pair,
    swap_reverse: number
  ) {
    if (swap_reverse == 0)
      return await this.amount0AddAmount1ForUsd(amount0, 0, pair)

    if (swap_reverse == 1)
      return await this.amount0AddAmount1ForUsd(0, amount1, pair)

    return 0
  }

  private async amount0AddAmount1ForUsd(
    amount0: sNumber.BigNumberish | undefined,
    amount1: sNumber.BigNumberish | undefined,
    pair: Pair
  ) {
    const coinbaseService = new CoinbaseService()
    let amount0Usd = 0,
      amount1Usd = 0
    if (amount0) {
      amount0Usd = await coinbaseService.exchangeToUsd(
        amount0 + '',
        pair.token0.decimals,
        pair.token0.symbol
      )
    }
    if (amount1) {
      amount1Usd = await coinbaseService.exchangeToUsd(
        amount1 + '',
        pair.token1.decimals,
        pair.token1.symbol
      )
    }
    return amount0Usd + amount1Usd
  }
}
