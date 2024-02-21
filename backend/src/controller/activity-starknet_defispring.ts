import { plainToInstance } from 'class-transformer'
import { Context, DefaultState, Response } from 'koa'
import KoaRouter from 'koa-router'
import { addAddressPadding } from 'starknet'
import { ServiceErrorCodes } from '../error/service'
import { ActivityService } from '../service/activity'
import { PairTransactionService } from '../service/pair_transaction'

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

  // Swap from ETH to STRK ( min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query1', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Swap'
      )

      // TODO: calculate price

      return false
    })
  })

  // Swap from USDC/ USDT to STRK ( min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query2', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Swap'
      )

      // TODO: calculate price

      return false
    })
  })

  // Swap from USDC/ USDT to ETH ( min 10$ liquidity in 1 txn)
  router.post('activity/starknet_defispring/query3', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Swap'
      )

      // TODO: calculate price

      return false
    })
  })

  // Add liquidity to STRK-ETH ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query4', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Mint'
      )

      return false
    })
  })

  // Add liquidity to STRK-USDC ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query5', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Mint'
      )

      return false
    })
  })

  // Add liquidity to ETH-USDC ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query6', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Mint'
      )

      return false
    })
  })

  // Add liquidity to USDC -USDT ( min 20 $ in 1 txn )
  router.post('activity/starknet_defispring/query7', async (ctx) => {
    await intractIOCall(ctx, async (address) => {
      const list = await pairTransactionService.getListByAccount(
        address,
        undefined,
        'Mint'
      )

      return false
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
}
