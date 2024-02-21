import axios from 'axios'
import axiosRetry from 'axios-retry'
import { BigNumberish, FixedNumber } from 'ethers'
import { formatUnits, parseEther } from 'ethers/lib/utils'

let usdtTickers: Array<{ instId: string; last: string }> = []

export class OKXService {
  async cache() {
    const url = 'https://www.okx.com/api/v5/market/tickers?instType=SPOT'

    const axiosClient = axios.create()
    axiosRetry(axiosClient, { retries: 3 })

    const resp = await axiosClient.get(url)

    const data = resp.data?.data
    if (data instanceof Array && data.length > 0) {
      usdtTickers = data
      this.fillTKA_TKB()
    }
  }

  // Warning: Currently assuming 1usdt=1usd
  async exchangeToUsd(
    amount: BigNumberish,
    decimals: number,
    currency: string
  ) {
    if (!usdtTickers) {
      await this.cache()
    }

    currency = currency.toUpperCase()

    let rate = '1'
    if (currency != 'USDT') {
      const ticker = usdtTickers.find(
        (item) => item.instId == currency + '-USDT'
      )

      if (!ticker) return 0

      rate = ticker.last
    }

    const fnAmount = FixedNumber.from(formatUnits(amount, decimals))
    const fnRate = FixedNumber.from(rate)

    return fnAmount.mulUnsafe(fnRate).toUnsafeFloat()
  }

  async getSTRKPrice() {
    return await this.exchangeToUsd(parseEther('1'), 18, 'STRK')
  }

  private fillTKA_TKB() {
    if (usdtTickers) {
      // Mock
      usdtTickers.push({ instId: 'TKA-USDT', last: '0.1' })
      usdtTickers.push({ instId: 'TKB-USDT', last: '2' })
    }
  }
}
