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
}
