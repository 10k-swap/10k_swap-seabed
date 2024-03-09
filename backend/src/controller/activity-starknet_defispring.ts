import { plainToInstance } from 'class-transformer'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { addAddressPadding } from 'starknet'
import { ServiceErrorCodes } from '../error/service'
import { ActivityDefispringService } from '../service/activity_defispring'
import { OKXService } from '../service/okx'
import { PairTransactionService } from '../service/pair_transaction'
import { PoolService } from '../service/pool'

async function intractIOCall(
  ctx: Context,
  injection: (address: string) => Promise<any>
) {
  const { request, response } = ctx

  try {
    const params = plainToInstance(
      class {
        address: string
      },
      request.body
    )

    const address = addAddressPadding(params.address).toLocaleLowerCase()
    const result = await injection(address)

    response.body = JSON.stringify({
      data: { result },
      error: { code: 0, message: '' },
    })
  } catch (err: any) {
    const errorCode =
      err.code === undefined ? ServiceErrorCodes.unknown : err.code
    const errorMessage = err.message || ServiceErrorCodes[errorCode]

    response.body = JSON.stringify({
      data: null,
      error: { code: errorCode, message: errorMessage },
    })
  } finally {
    response.set('content-type', 'application/json')
  }
}

export default function (router: KoaRouter<DefaultState, Context>) {
  const pairTransactionService = new PairTransactionService()
  const okxService = new OKXService()

  // Swap from ETH to STRK or STRK to ETH ( min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query1', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pair = PoolService.pairs.find(
        (item) =>
          item.pairAddress ==
          '0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e'
      )
      if (!pair) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        pair.pairAddress,
        'Swap'
      )

      let isAchieved = false
      for (const item of list) {
        let usd = 0

        if (item.swap_reverse == 1) {
          // ETH to STRK
          usd = await okxService.exchangeToUsd(
            item.amount1,
            pair.token1.decimals,
            pair.token1.symbol
          )
        } else {
          // STRK to ETH
          usd = await okxService.exchangeToUsd(
            item.amount0,
            pair.token0.decimals,
            pair.token0.symbol
          )
        }

        if (Math.round(usd) >= 10) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Swap from USDC/USDT to STRK or STRK to USDC/USDT (min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query2', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairSTRK_USDC = PoolService.pairs.find(
        (item) =>
          item.pairAddress ==
          '0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840'
      )
      if (!pairSTRK_USDC) return false

      const pairSTRK_USDT = PoolService.pairs.find(
        (item) =>
          item.pairAddress ==
          '0x784a8ec64af2b45694b94875fe6adbb57fadf9e196aa1aa1d144d163d0d8c51'
      )
      if (!pairSTRK_USDT) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Swap'
      )

      let isAchieved = false
      for (const item of list) {
        const pair =
          item.pair_address == pairSTRK_USDC.pairAddress
            ? pairSTRK_USDC
            : item.pair_address == pairSTRK_USDT.pairAddress
            ? pairSTRK_USDT
            : undefined
        if (!pair) continue

        let usd = 0

        if (item.swap_reverse == 1) {
          // USDC/USDT to STRK
          usd = await okxService.exchangeToUsd(
            item.amount1,
            pair.token1.decimals,
            pair.token1.symbol
          )
        } else {
          // STRK to USDC/USDT
          usd = await okxService.exchangeToUsd(
            item.amount0,
            pair.token0.decimals,
            pair.token0.symbol
          )
        }

        if (Math.round(usd) >= 10) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Swap from USDC/USDT to ETH or ETH to USDC/USDT (min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query3', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairETH_USDC = PoolService.pairs.find(
        (item) =>
          item.pairAddress ==
          '0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325'
      )
      if (!pairETH_USDC) return false

      const pairETH_USDT = PoolService.pairs.find(
        (item) =>
          item.pairAddress ==
          '0x5900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298'
      )
      if (!pairETH_USDT) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Swap'
      )

      let isAchieved = false
      for (const item of list) {
        const pair =
          item.pair_address == pairETH_USDC.pairAddress
            ? pairETH_USDC
            : item.pair_address == pairETH_USDT.pairAddress
            ? pairETH_USDT
            : undefined
        if (!pair) continue

        let usd = 0

        if (item.swap_reverse == 1) {
          // USDC/USDT to ETH
          usd = await okxService.exchangeToUsd(
            item.amount1,
            pair.token1.decimals,
            pair.token1.symbol
          )
        } else {
          // ETH to USDC/USDT
          usd = await okxService.exchangeToUsd(
            item.amount0,
            pair.token0.decimals,
            pair.token0.symbol
          )
        }

        if (Math.round(usd) >= 10) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Add liquidity to STRK-ETH ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query4', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairAddress =
        '0x4ad445ffb6294d1394b3f6a5610642d37c702eaaa47346b680c6af2f102192e'

      const pair = PoolService.pairs.find(
        (item) => item.pairAddress == pairAddress
      )
      if (!pair) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        pairAddress,
        'Mint'
      )

      let isAchieved = false
      for (const item of list) {
        const usd0 = await okxService.exchangeToUsd(
          item.amount0,
          pair.token0.decimals,
          pair.token0.symbol
        )

        const usd1 = await okxService.exchangeToUsd(
          item.amount1,
          pair.token1.decimals,
          pair.token1.symbol
        )

        if (Math.round(usd0 + usd1) >= 20) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Add liquidity to STRK-USDC ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query5', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairAddress =
        '0x66733193503019e4e9472f598ff32f15951a0ddb8fb5001f0beaa8bd1fb6840'

      const pair = PoolService.pairs.find(
        (item) => item.pairAddress == pairAddress
      )
      if (!pair) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        pairAddress,
        'Mint'
      )

      let isAchieved = false
      for (const item of list) {
        const usd0 = await okxService.exchangeToUsd(
          item.amount0,
          pair.token0.decimals,
          pair.token0.symbol
        )

        const usd1 = await okxService.exchangeToUsd(
          item.amount1,
          pair.token1.decimals,
          pair.token1.symbol
        )

        if (Math.round(usd0 + usd1) >= 20) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Add liquidity to ETH-USDC ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query6', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairAddress =
        '0x23c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325'

      const pair = PoolService.pairs.find(
        (item) => item.pairAddress == pairAddress
      )
      if (!pair) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        pairAddress,
        'Mint'
      )

      let isAchieved = false
      for (const item of list) {
        const usd0 = await okxService.exchangeToUsd(
          item.amount0,
          pair.token0.decimals,
          pair.token0.symbol
        )

        const usd1 = await okxService.exchangeToUsd(
          item.amount1,
          pair.token1.decimals,
          pair.token1.symbol
        )

        if (Math.round(usd0 + usd1) >= 20) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Add liquidity to USDC -USDT ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query7', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const pairAddress =
        '0x41a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0'

      const pair = PoolService.pairs.find(
        (item) => item.pairAddress == pairAddress
      )
      if (!pair) return false

      const list = await pairTransactionService.getListByAccount(
        address,
        pairAddress,
        'Mint'
      )

      let isAchieved = false
      for (const item of list) {
        const usd0 = await okxService.exchangeToUsd(
          item.amount0,
          pair.token0.decimals,
          pair.token0.symbol
        )

        const usd1 = await okxService.exchangeToUsd(
          item.amount1,
          pair.token1.decimals,
          pair.token1.symbol
        )

        if (Math.round(usd0 + usd1) >= 20) {
          isAchieved = true
          break
        }
      }

      return isAchieved
    })
  })

  // Deposit liquidity in at least 3 pools
  router.post('activity/starknet_defispring/query8', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Mint'
      )

      const pairAddresses: Record<string, boolean> = {}
      for (const item of list) {
        pairAddresses[item.pair_address] = true
      }

      return Object.keys(pairAddresses).length >= 3
    })
  })

  // Get rewards by account
  router.post(
    'activity/starknet_defispring/rewards',
    async ({ request, restful }) => {
      const params = plainToInstance(
        class {
          account: string
          round: string
        },
        request.query
      )

      const account = addAddressPadding(params.account).toLocaleLowerCase()
      // TODO
      const rewards = await new ActivityDefispringService().getRewardsByAccount(
        account,
        '2024-02-22',
        '2024-03-07'
      )

      let totalRewards = BigNumber.from(0)
      const list = rewards.map((item) => {
        const rewardsWei = BigNumber.from(item.rewards || 0)
        totalRewards = totalRewards.add(rewardsWei)
        return {
          pair_address: item.pair_address,
          rewards: formatEther(rewardsWei),
        }
      })

      restful.json({ list, totalRewards: formatEther(totalRewards) })
    }
  )
}
