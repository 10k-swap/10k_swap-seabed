import { RpcProvider } from 'starknet'
import { isDevelopEnv } from '../util'

export class RpcsService {
  blastRpcProvider() {
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
        ? 'https://limited-rpc.nethermind.io/goerli-juno'
        : 'https://limited-rpc.nethermind.io/mainnet-juno',
    })
  }

  static createRandomRpcProvider() {
    const random = parseInt(Math.random() * 3 + '')
    const rpcsService = new RpcsService()
    switch (random) {
      case 0:
        return rpcsService.blastRpcProvider()
      case 1:
        return rpcsService.lavaRpcProvider()
      default:
        return rpcsService.nethermindRpcProvider()
    }
  }
}