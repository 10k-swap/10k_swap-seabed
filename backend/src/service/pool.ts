import { AxiosInstance } from 'axios'
import {
  AsyncContractFunction,
  Contract,
  Provider,
  constants,
  number as sNumber,
  uint256,
} from 'starknet'
import { contractConfig } from '../config'
import { sleep } from '../util'
import { Core } from '../util/core'
import { errorLogger } from '../util/logger'
import { CoinbaseService } from './coinbase'
import { StarkscanService } from './starkscan'

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
  lastUpdatedTime?: string
}

export class PoolService {
  public static pairs: Pair[] = []

  private static cacheErc20Infos: { [key: string]: any } = {}

  private provider: Provider
  private factoryAddress: string
  private eventKey: string
  private axiosClient: AxiosInstance

  constructor(provider: Provider) {
    this.provider = provider
    this.eventKey = 'PairCreated'

    switch (this.provider.chainId) {
      case constants.StarknetChainId.MAINNET:
        this.factoryAddress = contractConfig.addresses.mainnet.factory
        break
      case constants.StarknetChainId.TESTNET:
      default:
        this.factoryAddress = contractConfig.addresses.goerli.factory
        break
    }
    this.axiosClient = new StarkscanService(provider).getAxiosClient()
  }

  private async contractCallWithRetry(
    func: AsyncContractFunction,
    args: any[] = [],
    tryTotal = 0
  ) {
    try {
      return await func(args)
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

    try {
      const axiosClient = new StarkscanService(this.provider).getAxiosClient()
      const postData = {
        variables: {
          input: {
            contract_address: address,
          },
        },
        query:
          'query TokenPageQuery(\n  $input: ERC20ContractInput!\n) {\n  erc20Contract(input: $input) {\n    contract_address\n    ...TokenPageOverviewTabFragment_erc20Contract\n    contract {\n      ...ContractFunctionReadWriteTabFragment_contract\n      id\n    }\n    id\n  }\n}\n\nfragment ContractFunctionReadCallsFragment_starknetClass on StarknetClass {\n  is_code_verified\n  abi_final\n}\n\nfragment ContractFunctionReadWriteTabFragment_contract on Contract {\n  contract_address\n  starknet_class {\n    ...ContractFunctionReadCallsFragment_starknetClass\n    ...ContractFunctionWriteCallsFragment_starknetClass\n    id\n  }\n}\n\nfragment ContractFunctionWriteCallsFragment_starknetClass on StarknetClass {\n  is_code_verified\n  abi_final\n}\n\nfragment TokenPageOverviewTabFragment_erc20Contract on ERC20Contract {\n  contract_address\n  name_custom\n  name\n  symbol\n  decimals\n  is_social_verified\n  erc20_contract_stats {\n    total_supply_display\n    number_of_owners\n    id\n  }\n}\n',
      }

      const { data } = await axiosClient.post('/', postData)
      const erc20Contract = data?.data?.erc20Contract

      name = erc20Contract?.name
      symbol = erc20Contract?.symbol
      decimals = parseInt(erc20Contract?.decimals)

      if (!name || !symbol || !decimals || decimals <= 0)
        throw new Error(`TokenPageQuery failed. contract_address: ${address}`)
    } catch (err) {
      const contract = new Contract(
        contractConfig.abis.erc20 as any,
        address,
        this.provider
      )

      // Single execution to prevent RPC error: "Bad Gateway"
      const nameResp = await this.contractCallWithRetry(contract.name)
      const symbolResp = await this.contractCallWithRetry(contract.symbol)
      const decimalsResp = await this.contractCallWithRetry(contract.decimals)

      name = sNumber.toBN(nameResp.name).toBuffer().toString('utf-8')
      symbol = sNumber.toBN(symbolResp.symbol).toBuffer().toString('utf-8')
      decimals = sNumber.toBN(decimalsResp.decimals).toNumber()
    }

    return { name, symbol, decimals }
  }

  private async getPairInfo(address: string) {
    const contract = new Contract(
      contractConfig.abis.l0kPair as any,
      address,
      this.provider
    )

    const decimals = 18 // Always is 18
    const [{ totalSupply }, { reserve0, reserve1 }] = await Promise.all([
      this.contractCallWithRetry(contract.totalSupply),
      this.contractCallWithRetry(contract.getReserves),
    ])

    return {
      totalSupply: sNumber.toHex(uint256.uint256ToBN(totalSupply)),
      decimals: sNumber.toBN(decimals).toNumber(),
      reserve0: sNumber.toHex(reserve0),
      reserve1: sNumber.toHex(reserve1),
    }
  }

  async collect() {
    // Do not update within 10 minutes
    if (PoolService.pairs?.[0]?.lastUpdatedTime) {
      const _time = new Date(PoolService.pairs[0].lastUpdatedTime).getTime()
      if (new Date().getTime() - _time < 600000) return
    }

    const edgerCacheKey = 'pool_service-collect-edges'
    const edgesCacheValue = await Core.redis.get(edgerCacheKey)

    let edges: any[] = edgesCacheValue ? JSON.parse(edgesCacheValue) || [] : []
    if (!Array.isArray(edges) || edges.length <= 0) {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
      const headers = {
        'user-agent': userAgent,
        'content-type': 'application/json',
      }

      const postData = {
        operationName: 'events',
        variables: {
          input: {
            from_address: this.factoryAddress,
            sort_by: 'timestamp',
            order_by: 'desc',
          },
          first: 100,
        },
        query:
          'query events($first: Int, $last: Int, $before: String, $after: String, $input: EventsInput!) {\n  events(\n    first: $first\n    last: $last\n    before: $before\n    after: $after\n    input: $input\n  ) {\n    edges {\n      cursor\n      node {\n        event_id\n        block_hash\n        block_number\n        transaction_hash\n        event_index\n        from_address\n        keys\n        data\n        timestamp\n        key_name\n        data_decoded\n        from_contract {\n          contract_address\n          class_hash\n          deployed_at_transaction_hash\n          deployed_at_timestamp\n          name_tag\n          implementation_type\n          is_social_verified\n          starknet_id {\n            domain\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    pageInfo {\n      hasNextPage\n      __typename\n    }\n    __typename\n  }\n}',
      }

      const resp = await this.axiosClient.post('/graphql', postData, {
        headers,
      })
      edges = resp.data?.data?.events?.edges

      if (!edges || edges.length < 1) {
        errorLogger.error('Get factory events failed')
        return
      }

      await Core.redis.setex(edgerCacheKey, 3_600, JSON.stringify(edges))
    }

    const _pairs: Pair[] = []
    for (const item of edges) {
      const { key_name, data } = item.node

      if (key_name != this.eventKey || data.length != 4) {
        continue
      }

      const token0 = sNumber.toHex(sNumber.toBN(data[0]))
      const token1 = sNumber.toHex(sNumber.toBN(data[1]))
      const pairAddress = sNumber.toHex(sNumber.toBN(data[2]))

      const [token0Info, token1Info, pairInfo] = await Promise.all([
        PoolService.cacheErc20Infos[token0] || this.getErc20Info(token0),
        PoolService.cacheErc20Infos[token1] || this.getErc20Info(token1),
        this.getPairInfo(pairAddress),
      ])
      PoolService.cacheErc20Infos[token0] = token0Info
      PoolService.cacheErc20Infos[token1] = token1Info

      // Goerli mock APR
      const APR = Math.sqrt(parseInt('0x' + pairAddress.slice(-2), 16)).toFixed(
        0
      )

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

      _pairs.push({
        token0: { address: token0, ...token0Info },
        token1: { address: token1, ...token1Info },
        pairAddress: pairAddress,
        ...pairInfo,
        liquidity: liquidity0 + liquidity1,
        APR,
        lastUpdatedTime: new Date().toISOString(),
      })

      await sleep(1000)
    }

    // Replace PoolService._pairs
    PoolService.pairs = _pairs
  }
}
