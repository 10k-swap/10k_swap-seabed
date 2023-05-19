import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { AppService } from '../service/app'
import { getProviderFromEnv } from '../util'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('app/estimated_fees', async ({ restful }) => {
    const provider = getProviderFromEnv()

    const fees = await new AppService(provider).estimatedFees()

    restful.json(fees)
  })
}
