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
import { accessLogger, errorLogger } from '../util/logger'
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
        `[{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325","totalSupply":"0x1f60a0f61a681e","decimals":18,"reserve0":"0xd16300e90006a3114","reserve1":"0xb5ee2e423b","liquidity":1559883.594482571,"APR":"5.56","fee24h":"237.727564282815","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:25.137Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x17e9e62c04b50800d7c59454754fe31a2193c9c3c6c92c093f2ab0faadf8c87","totalSupply":"0x3b3a0c6856c13c475a","decimals":18,"reserve0":"0x11a054d56606cf3dcc64","reserve1":"0x1641c289e435857fc","liquidity":166038.60755330377,"APR":"4.03","fee24h":"18.34736157376011","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:26.259Z"},{"token0":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x5900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298","totalSupply":"0x782a560bd5077","decimals":18,"reserve0":"0x2f7aa54c445628873","reserve1":"0x2951955c7a","liquidity":354060.20185839164,"APR":"6.13","fee24h":"59.49397727218533","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:27.377Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x22e45d94d5c6c477d9efd440aad71b2c02a5cd5bed9a4d6da10bb7c19fd93ba","totalSupply":"0x5028493","decimals":18,"reserve0":"0x471c9c","reserve1":"0x95fe1108","liquidity":5132.4761739648,"APR":"8.58","fee24h":"1.2061045776","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:28.503Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"pairAddress":"0xf9d8f827734f5fd54571f0e78398033a3c1f1074a471cd4623f2aa45163718","totalSupply":"0x533ad483043b","decimals":18,"reserve0":"0x95ca48aa8516790648","reserve1":"0x4cb4a5","liquidity":5586.584709444225,"APR":"1.86","fee24h":"0.28401180777668106","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:29.638Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x2e767b996c8d4594c73317bb102c2018b9036aee8eed08ace5f45b3568b94e5","totalSupply":"0x52e1183d6145a4","decimals":18,"reserve0":"0x5a54caf8fabbfe9321a","reserve1":"0x62462d1fd","liquidity":53038.748952990776,"APR":"0.15","fee24h":"0.22040120273466982","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:30.762Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x50031010bcee2f43575b3afe197878e064e1a03c12f2ff437f29a2710e0b6ef","totalSupply":"0x4343926","decimals":18,"reserve0":"0x3d8a17","reserve1":"0x85b96d9e","liquidity":4508.271426756,"APR":"2.05","fee24h":"0.252728","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:31.878Z"},{"token0":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0","totalSupply":"0x134dc956f6","decimals":18,"reserve0":"0x16aea014c4","reserve1":"0x16941d408f","liquidity":194364.0070208484,"APR":"2.96","fee24h":"15.740686656600001","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:32.986Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x41d52e15e82b003bf0ad52ca58393c87abef3e00f1bf69682fd4162d5773f8f","totalSupply":"0x1add17afa8fdf4","decimals":18,"reserve0":"0x2090b8d2a52adf8b122","reserve1":"0x23c479088","liquidity":19214.76595564949,"APR":"0.12","fee24h":"0.065291","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:34.097Z"},{"token0":{"address":"0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac","name":"Wrapped BTC","symbol":"WBTC","decimals":8},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x2a6e0ecda844736c4803a385fb1372eff458c365d2325c7d4e08032c7a908f3","totalSupply":"0x1fab4a62ea0b","decimals":18,"reserve0":"0x68333c3","reserve1":"0x105f2c59b3a2031d1","liquidity":122268.79645005794,"APR":"4.04","fee24h":"13.520171083736422","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:35.207Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8","name":"USD Coin","symbol":"USDC","decimals":6},"pairAddress":"0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840","totalSupply":"0xeaad3fae5b8156","decimals":18,"reserve0":"0xa000acedce727bc815e","reserve1":"0x162957861b","liquidity":189919.61850136565,"APR":"25.96","fee24h":"135.0529872732223","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:36.322Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","name":"Ether","symbol":"ETH","decimals":18},"pairAddress":"0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e","totalSupply":"0x7304429d97b2ccf928","decimals":18,"reserve0":"0x1272fc8974e41196c7e3","reserve1":"0x2f33aece8d775d0b2","liquidity":350451.26917127764,"APR":"26.95","fee24h":"258.77907731700805","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:37.439Z"},{"token0":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"token1":{"address":"0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8","name":"Tether USD","symbol":"USDT","decimals":6},"pairAddress":"0x784a8ec64af2b45694b94875fe6adbb57fadf9e196aa1aa1d144d163d0d8c51","totalSupply":"0x8ec6c71310aff","decimals":18,"reserve0":"0x60d96ca62cb7cee3ad","reserve1":"0xd8c5dc09","liquidity":7221.924514205288,"APR":"14.40","fee24h":"2.8495198881843202","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:38.833Z"},{"token0":{"address":"0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3","name":"Dai Stablecoin","symbol":"DAI","decimals":18},"token1":{"address":"0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","name":"Starknet Token","symbol":"STRK","decimals":18},"pairAddress":"0x1a4c250cc1e91961755ab2428b1fb0fa89ef2f64d0d155e5fbbbd4cd4531ae7","totalSupply":"0x111d8548327bdbd854","decimals":18,"reserve0":"0x1974e4e27d0db5d39d","reserve1":"0xbbd9cfc6345ddcd95","liquidity":904.2912094079411,"APR":"30.22","fee24h":"0.7487662321365215","strkPrice":"2.0049","lastUpdatedTime":"2024-02-27T07:04:39.989Z"}]`
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
    const rpcProvider = new RpcsService().alchemyRpcProvider()

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
      const strkPrice = (await new OKXService().getSTRKPrice()) + ''

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

    // If the new pairs does not contain the old, the data is invalid
    for (const p of PoolService.pairs) {
      if (_pairs.findIndex((_p) => _p.pairAddress == p.pairAddress) === -1) {
        accessLogger.error(
          `The data is invalid, the new pair must completely contain the old pair. Old pairs length:${PoolService.pairs.length}, new pairs length: ${_pairs.length}`
        )
        return
      }
    }

    // Replace PoolService._pairs
    PoolService.pairs = _pairs
  }
}
