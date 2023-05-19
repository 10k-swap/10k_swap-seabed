import axios from 'axios'
import axiosRetry from 'axios-retry'
import { BigNumberish, FixedNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'

export class CoinbaseService {
  public static usdRates: { [key: string]: string } | undefined = undefined

  async cache() {
    const url = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'

    const axiosClient = axios.create()
    axiosRetry(axiosClient, { retries: 3 })

    const resp = await axiosClient.get(url)

    const rates = resp.data?.data?.rates
    if (rates) {
      CoinbaseService.usdRates = rates
      this.fillTKA_TKB()
    }
  }

  async exchangeToUsd(
    amount: BigNumberish,
    decimals: number,
    currency: string
  ) {
    if (!CoinbaseService.usdRates) {
      await this.cache()
    }

    currency = currency.toUpperCase()
    if (!CoinbaseService.usdRates?.[currency]) {
      return 0
    }

    const fnAmount = FixedNumber.from(formatUnits(amount, decimals))
    const fnRate = FixedNumber.from(CoinbaseService.usdRates[currency])

    return fnAmount.divUnsafe(fnRate).toUnsafeFloat()
  }

  private fillTKA_TKB() {
    if (CoinbaseService.usdRates) {
      // Rate from https://goerli.10kswap.com, Time: 2022-10-21 19:30
      CoinbaseService.usdRates.TKA = '11322'
      CoinbaseService.usdRates.TKB = '194516'
    }
  }
}
