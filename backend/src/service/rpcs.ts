import { RpcProvider } from 'starknet'
import { isDevelopEnv } from '../util'
import { rpcConfig } from '../config'
import _ from 'lodash'

export class RpcsService {
  defaultRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://starknet-testnet.public.blastapi.io'
        : 'https://starknet.blockpi.network/v1/rpc/public',
    })
  }

  lavaRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://rpc.starknet-testnet.lava.build'
        : 'https://rpc.starknet.lava.build',
    })
  }

  // Warning bug: getEvents only response 10 event
  nethermindRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://free-rpc.nethermind.io/goerli-juno'
        : 'https://free-rpc.nethermind.io/mainnet-juno',
    })
  }

  // Warning bug: getEvents only response 1001 event where over 1000 event
  alchemyRpcProvider() {
    if (rpcConfig.alchemyEndpoints.length <= 0) {
      throw new Error('Miss alchemy rpc endpoint.')
    }

    const endpoint = _.sample(rpcConfig.alchemyEndpoints)

    return new RpcProvider({ nodeUrl: endpoint })
  }

  static createRandomRpcProvider() {
    const random = parseInt(Math.random() * 3 + '')
    const rpcsService = new RpcsService()
    switch (random) {
      case 0:
        return rpcsService.nethermindRpcProvider()
      case 1:
        // return rpcsService.alchemyRpcProvider()
        return rpcsService.lavaRpcProvider()
      default:
        return rpcsService.defaultRpcProvider()
    }
  }
}
