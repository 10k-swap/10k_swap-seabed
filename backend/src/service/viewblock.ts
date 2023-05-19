import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import { Provider, constants } from 'starknet'

export class ViewblockService {
  private axiosClient: AxiosInstance

  constructor(private provider: Provider) {
    this.axiosClient = axios.create({
      baseURL: 'https://api.viewblock.io',
      headers: {
        referer: 'https://viewblock.io/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        origin: 'https://viewblock.io',
      },
    })

    this.axiosClient.interceptors.request.use(
      (config) => {
        config.params = { ...config.params, network: 'mainnet' }
        if (this.provider.chainId === constants.StarknetChainId.TESTNET) {
          config.params.network = 'goerli'
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    axiosRetry(this.axiosClient, { retries: 3 })
  }

  getAxiosClient() {
    return this.axiosClient
  }
}
