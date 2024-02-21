import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { OKXService } from '../service/okx'
import { PoolService } from '../service/pool'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('pool/pairs', async ({ restful }) => {
    const strkPrice = await new OKXService().getSTRKPrice()

    const newPairs = PoolService.pairs.map((pair) => {
      return { ...pair, strkPrice: strkPrice + '' || pair.strkPrice }
    })

    restful.json(newPairs)
  })
}
