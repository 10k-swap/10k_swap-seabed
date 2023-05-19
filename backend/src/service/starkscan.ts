import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import { Provider, constants } from 'starknet'

export class StarkscanService {
  private axiosClient: AxiosInstance

  constructor(private provider: Provider) {
    const headers = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
      'content-type': 'application/json',
    }

    if (this.provider.chainId === constants.StarknetChainId.MAINNET) {
      this.axiosClient = axios.create({
        baseURL: 'https://api.starkscan.co',
        headers,
      })
    } else {
      this.axiosClient = axios.create({
        baseURL: 'https://api-testnet.starkscan.co',
        headers,
      })
    }
    axiosRetry(this.axiosClient, { retries: 3 })
  }

  getAxiosClient() {
    return this.axiosClient
  }
}
