import {
  ArgsOrCalldataWithOptions,
  AsyncContractFunction,
  Contract,
  hash,
  num,
  uint256,
} from 'starknet'
import { contractConfig } from '../config'
import {
  bigNumberishToUtf8,
  getRpcProviderByEnv,
  isDevelopEnv,
  sleep,
} from '../util'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'
import { AnalyticsService } from './analytics'
import { CoinbaseService } from './coinbase'
import { RpcsService } from './rpcs'

export type Pair = {
  token0: { address: string; name: string; symbol: string; decimals: number }
  token1: { address: string; name: string; symbol: string; decimals: number }
  pairAddress: string
  decimals: number
  reserve0: string // hex
  reserve1: string // hex
  totalSupply: string // hex
  liquidity: number // reserve0 + reserve1 for usd
  APR: string
  fee24h: string
  strkPrice?: string // Starknet token price(USD)
  lastUpdatedTime?: string
}

export class PoolService {
  public static pairs: Pair[] = isDevelopEnv()
    ? []
    : JSON.parse(
        `[{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325","totalSupply":"0x3e9de296c2bcbb","decimals":18,"reserve0":"0x21c1c0b0673de04991","reserve1":"0x102bba2d5da","liquidity":2223850.211991928,"APR":"6","lastUpdatedTime":"2023-10-28T17:06:24.604Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x17e9e62c04b50800d7c59454754fe31a2193c9c3c6c92c093f2ab0faadf8c87","totalSupply":"0x7de4f006c2204278ea","decimals":18,"reserve0":"0x1ab99a44509df2eeb138","reserve1":"0x3d4697025b884d902","liquidity":252424.1714012365,"APR":"12","lastUpdatedTime":"2023-10-28T17:06:26.169Z"},{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x5900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298","totalSupply":"0x1040d0c015bd82","decimals":18,"reserve0":"0x85c1dd02a45de7aeb","reserve1":"0x401ccd3554","liquidity":550945.8569831392,"APR":"12","lastUpdatedTime":"2023-10-28T17:06:27.638Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x22e45d94d5c6c477d9efd440aad71b2c02a5cd5bed9a4d6da10bb7c19fd93ba","totalSupply":"0x19509d7d","decimals":18,"reserve0":"0x1adbc81","reserve1":"0x23da6b531","liquidity":19231.10270355033,"APR":"14","lastUpdatedTime":"2023-10-28T17:06:29.446Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"pairAddress":"0xf9d8f827734f5fd54571f0e78398033a3c1f1074a471cd4623f2aa45163718","totalSupply":"0xf4989ad8f02c","decimals":18,"reserve0":"0x147c4dc71f13749decd","reserve1":"0x10f7809","liquidity":12114.70371353174,"APR":"5","lastUpdatedTime":"2023-10-28T17:06:31.199Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x2e767b996c8d4594c73317bb102c2018b9036aee8eed08ace5f45b3568b94e5","totalSupply":"0x11c79cb7e33f02a","decimals":18,"reserve0":"0x12eea14cef170a46719f","reserve1":"0x14dad26762","liquidity":178970.64251558163,"APR":"15","lastUpdatedTime":"2023-10-28T17:06:32.895Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x50031010bcee2f43575b3afe197878e064e1a03c12f2ff437f29a2710e0b6ef","totalSupply":"0x14c197d0","decimals":18,"reserve0":"0x16ff37e","reserve1":"0x1ed8dc92a","liquidity":16507.604814512426,"APR":"15","lastUpdatedTime":"2023-10-28T17:06:34.628Z"},{"token0":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0","totalSupply":"0x2eb1ebb5b4","decimals":18,"reserve0":"0x35b2ac87bc","reserve1":"0x35b6c52326","liquidity":461373.2370993241,"APR":"13","lastUpdatedTime":"2023-10-28T17:06:36.357Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41d52e15e82b003bf0ad52ca58393c87abef3e00f1bf69682fd4162d5773f8f","totalSupply":"0xaedbe2c1261d26","decimals":18,"reserve0":"0xce6b91fadd8ad258d29","reserve1":"0xe3576050c","liquidity":121959.20130752062,"APR":"12","lastUpdatedTime":"2023-10-28T17:06:38.090Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x2a6e0ecda844736c4803a385fb1372eff458c365d2325c7d4e08032c7a908f3","totalSupply":"0x8d2bb05c50b5","decimals":18,"reserve0":"0x1aed38f2","reserve1":"0x4ae8495960dfce5a8","liquidity":308404.9272368486,"APR":"16","lastUpdatedTime":"2023-10-28T17:06:39.954Z"}]`
      )

  private static cacheErc20Infos: { [key: string]: any } = {}

  private factoryAddress: string
  private eventKey: string

  constructor() {
    this.eventKey = 'PairCreated'

    if (isDevelopEnv()) {
      this.factoryAddress = contractConfig.addresses.goerli.factory
    } else {
      this.factoryAddress = contractConfig.addresses.mainnet.factory
    }
  }

  private async contractCallWithRetry(
    func: AsyncContractFunction,
    args: ArgsOrCalldataWithOptions = [],
    tryTotal = 0
  ) {
    try {
      return await func(...args)
    } catch (err) {
      tryTotal += 1
      if (tryTotal > 10) throw err

      // Exponential Avoidance
      const ms = parseInt(tryTotal * tryTotal * 200 + '')

      await sleep(ms <= 5000 ? ms : 5000) // max: 5000ms

      return await this.contractCallWithRetry(func, args, tryTotal)
    }
  }

  private async getErc20Info(address: string) {
    let name: string, symbol: string, decimals: number

    const contract = new Contract(
      contractConfig.abis.erc20 as any,
      address,
      getRpcProviderByEnv()
    )

    const [nameResp, symbolResp, decimalsResp] = await Promise.all([
      this.contractCallWithRetry(contract.name),
      this.contractCallWithRetry(contract.symbol),
      this.contractCallWithRetry(contract.decimals),
    ])

    name = bigNumberishToUtf8(nameResp.name)
    symbol = bigNumberishToUtf8(symbolResp.symbol)
    decimals = Number(num.toBigInt(decimalsResp.decimals))

    return { name, symbol, decimals }
  }

  private async getPairInfo(address: string) {
    const contract = new Contract(
      contractConfig.abis.l0kPair as any,
      address,
      getRpcProviderByEnv()
    )

    const decimals = 18 // 10kPair token's decimals always is 18
    const [{ totalSupply }, { reserve0, reserve1 }] = await Promise.all([
      this.contractCallWithRetry(contract.totalSupply),
      this.contractCallWithRetry(contract.getReserves),
    ])

    return {
      totalSupply: num.toHex(uint256.uint256ToBN(totalSupply)),
      decimals: Number(num.toBigInt(decimals)),
      reserve0: num.toHex(reserve0),
      reserve1: num.toHex(reserve1),
    }
  }

  async collect() {
    // Do not update within 10 minutes
    if (PoolService.pairs?.[0]?.lastUpdatedTime) {
      const _time = new Date(PoolService.pairs[0].lastUpdatedTime).getTime()
      if (new Date().getTime() - _time < 600000) return
    }

    const eventKeyHash = hash.getSelectorFromName(this.eventKey)
    const rpcProvider = new RpcsService().lavaRpcProvider()

    const eventsCacheKey = 'pool_service-collect-events'
    const eventsCacheValue = await Core.redis.get(eventsCacheKey)

    let events: { data: string[]; keys: string[] }[] = eventsCacheValue
      ? JSON.parse(eventsCacheValue) || []
      : []
    if (!Array.isArray(events) || events.length <= 0) {
      events = (
        await rpcProvider.getEvents({
          address: this.factoryAddress,
          chunk_size: 100,
        })
      ).events

      if (!events || events.length < 1) {
        errorLogger.error('Get factory events failed')
        return
      }

      await Core.redis.setex(eventsCacheKey, 3_600, JSON.stringify(events))
    }

    const analyticsService = new AnalyticsService()
    const pairSwapFees24Hour = await analyticsService.getPairSwapFees24Hour()

    const _pairs: Pair[] = []
    for (const item of events) {
      const { keys, data } = item

      if (keys[0] != eventKeyHash || data.length != 4) {
        continue
      }

      const token0 = num.toHex(data[0])
      const token1 = num.toHex(data[1])
      const pairAddress = num.toHex(data[2])

      const [token0Info, token1Info, pairInfo] = await Promise.all([
        PoolService.cacheErc20Infos[token0] || this.getErc20Info(token0),
        PoolService.cacheErc20Infos[token1] || this.getErc20Info(token1),
        this.getPairInfo(pairAddress),
      ])
      PoolService.cacheErc20Infos[token0] = token0Info
      PoolService.cacheErc20Infos[token1] = token1Info

      // fees(24h)
      let f24Amount0 = 0,
        f24Amount1 = 0
      pairSwapFees24Hour.forEach((item) => {
        if (pairAddress == item.pair_address) {
          if (item.swap_reverse == 0) f24Amount0 += item.sum_fee
          if (item.swap_reverse == 1) f24Amount1 += item.sum_fee
        }
      })
      const fees24h = await analyticsService.amount0AddAmount1ForUsd(
        f24Amount0,
        f24Amount1,
        { token0: token0Info, token1: token1Info }
      )

      // TODO: strkPrice from coinbase
      const strkPrice = '0'

      const coinbaseService = new CoinbaseService()
      const liquidity0 = await coinbaseService.exchangeToUsd(
        pairInfo.reserve0,
        token0Info.decimals,
        token0Info.symbol
      )
      const liquidity1 = await coinbaseService.exchangeToUsd(
        pairInfo.reserve1,
        token1Info.decimals,
        token1Info.symbol
      )
      const liquidity = liquidity0 + liquidity1

      // fee / tvl * 365 * 100
      const APR = ((fees24h * 365 * 100) / liquidity).toFixed(2)

      _pairs.push({
        token0: { address: token0, ...token0Info },
        token1: { address: token1, ...token1Info },
        pairAddress: pairAddress,
        ...pairInfo,
        liquidity,
        APR,
        fee24h: fees24h + '',
        strkPrice,
        lastUpdatedTime: new Date().toISOString(),
      })

      await sleep(1000)
    }

    // Replace PoolService._pairs
    PoolService.pairs = _pairs
  }
}
