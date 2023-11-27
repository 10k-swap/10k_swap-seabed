import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { AppService } from '../service/app'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('app/estimated_fees', async ({ restful }) => {
    const fees = await new AppService().estimatedFees()

    restful.json(fees)
  })
}
