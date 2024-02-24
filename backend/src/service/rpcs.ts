import { RpcProvider } from 'starknet'
import { isDevelopEnv } from '../util'

export class RpcsService {
  defaultRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://starknet-testnet.public.blastapi.io'
        : 'https://starknet-mainnet.public.blastapi.io',
    })
  }

  lavaRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://rpc.starknet-testnet.lava.build'
        : 'https://rpc.starknet.lava.build',
    })
  }

  nethermindRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://free-rpc.nethermind.io/goerli-juno'
        : 'https://free-rpc.nethermind.io/mainnet-juno',
    })
  }

  alchemyRpcProvider() {
    return new RpcProvider({
      nodeUrl: isDevelopEnv()
        ? 'https://starknet-goerli.g.alchemy.com/v2/qtdLys1T51z8inozPo7lSOfQ9mQueQRj'
        : 'https://starknet-mainnet.g.alchemy.com/v2/TgQ5rUXPT1XZUHaSCAzST3j17C2eu27x',
    })
  }

  static createRandomRpcProvider() {
    const random = parseInt(Math.random() * 3 + '')
    const rpcsService = new RpcsService()
    switch (random) {
      case 0:
        return rpcsService.nethermindRpcProvider()
      case 1:
        return rpcsService.alchemyRpcProvider()
      // return rpcsService.lavaRpcProvider()
      default:
        return rpcsService.defaultRpcProvider()
    }
  }
}
