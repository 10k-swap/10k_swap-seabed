import { isDevelopEnv } from '../util'

export default {
  alchemyEndpoints: (
    process.env[
      isDevelopEnv()
        ? 'RPC_GOERLI_ALCHEMY_ENDPOINTS'
        : 'RPC_MAINNET_ALCHEMY_ENDPOINTS'
    ] || ''
  )
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item != ''),
}
