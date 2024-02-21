import { parseEther } from 'ethers/lib/utils'
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
import { OKXService } from './okx'
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
        `[{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325","totalSupply":"0x22b3461b638479","decimals":18,"reserve0":"0xf28d62a7c683a7b5b","reserve1":"0xbfc3a25659","liquidity":1646309.084213419,"APR":"75.63","fee24h":"3411.1564937711787","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:45.137Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x17e9e62c04b50800d7c59454754fe31a2193c9c3c6c92c093f2ab0faadf8c87","totalSupply":"0x3ff9744b7af67cb6ba","decimals":18,"reserve0":"0x122ec3223c9830173dfe","reserve1":"0x1924d048fc59824d5","liquidity":171135.0059100776,"APR":"7.07","fee24h":"33.16608100082711","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:46.258Z"},{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x5900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298","totalSupply":"0x8c3895d3d26a2","decimals":18,"reserve0":"0x3a0a7d36269e3733c","reserve1":"0x2df089bcb9","liquidity":394165.38340403786,"APR":"38.24","fee24h":"412.9220061550096","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:47.611Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x22e45d94d5c6c477d9efd440aad71b2c02a5cd5bed9a4d6da10bb7c19fd93ba","totalSupply":"0x606c616","decimals":18,"reserve0":"0x5744e8","reserve1":"0xb0690796","liquidity":5902.494905384493,"APR":"4.14","fee24h":"0.669649442399862","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:48.726Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"pairAddress":"0xf9d8f827734f5fd54571f0e78398033a3c1f1074a471cd4623f2aa45163718","totalSupply":"0x540e8fad81b9","decimals":18,"reserve0":"0x94851ee3071ac168cc","reserve1":"0x4ed0f8","liquidity":5397.0798338316945,"APR":"1.67","fee24h":"0.2468003099384132","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:49.857Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x2e767b996c8d4594c73317bb102c2018b9036aee8eed08ace5f45b3568b94e5","totalSupply":"0x8030b8ba999870","decimals":18,"reserve0":"0x8b89b7db949b2f83904","reserve1":"0x982a6af87","liquidity":82024.82709213073,"APR":"0.24","fee24h":"0.5419481346026062","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:50.973Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x50031010bcee2f43575b3afe197878e064e1a03c12f2ff437f29a2710e0b6ef","totalSupply":"0x4585948","decimals":18,"reserve0":"0x4184e7","reserve1":"0x86143629","liquidity":4462.6449437700885,"APR":"4.94","fee24h":"0.6035617248950351","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:52.085Z"},{"token0":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0","totalSupply":"0x293e772dc6","decimals":18,"reserve0":"0x3042265264","reserve1":"0x3069b76a57","liquidity":415193.018500963,"APR":"1.10","fee24h":"12.486019914915","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:53.195Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41d52e15e82b003bf0ad52ca58393c87abef3e00f1bf69682fd4162d5773f8f","totalSupply":"0x1c5e8d6444460d","decimals":18,"reserve0":"0x22a6a49a6fd751a9914","reserve1":"0x2577f0996","liquidity":20283.146864099122,"APR":"2.14","fee24h":"1.1866429033572305","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:54.305Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x2a6e0ecda844736c4803a385fb1372eff458c365d2325c7d4e08032c7a908f3","totalSupply":"0x231b67e44bf6","decimals":18,"reserve0":"0x72de55b","reserve1":"0x1239162bdeec5eb29","liquidity":123897.03368099355,"APR":"8.09","fee24h":"27.466565328908082","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:55.675Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840","totalSupply":"0xd36d6cf31bf6","decimals":18,"reserve0":"0x908457a7409bbfa76","reserve1":"0x1355895b","liquidity":324.372827,"APR":"0.00","fee24h":"0.000006","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:56.787Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e","totalSupply":"0x2baa65de1de66846","decimals":18,"reserve0":"0x656975053ce9e6767","reserve1":"0x12fb6a0a7f6b0c4","liquidity":251.51299084404778,"APR":"189.44","fee24h":"1.3054075514999453","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:57.902Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x784a8ec64af2b45694b94875fe6adbb57fadf9e196aa1aa1d144d163d0d8c51","totalSupply":"0x62ee0a90af9","decimals":18,"reserve0":"0x42b69aee34b2139a","reserve1":"0x92b441","liquidity":9.614064495965,"APR":"0.00","fee24h":"0","strkPrice":"0","lastUpdatedTime":"2024-02-21T08:07:59.017Z"}]`
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

      // strkPrice from okx
      const strkPrice =
        (await new OKXService().exchangeToUsd(parseEther('1'), 18, 'STRK')) + ''

      const okxService = new OKXService()
      const liquidity0 = await okxService.exchangeToUsd(
        pairInfo.reserve0,
        token0Info.decimals,
        token0Info.symbol
      )
      const liquidity1 = await okxService.exchangeToUsd(
        pairInfo.reserve1,
        token1Info.decimals,
        token1Info.symbol
      )
      const liquidity = liquidity0 + liquidity1

      // fee / tvl * 365 * 100
      const APR = (
        liquidity > 0 ? (fees24h * 365 * 100) / liquidity : 0
      ).toFixed(2)

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
