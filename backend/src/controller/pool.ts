import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { PoolService } from '../service/pool'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('pool/pairs', async ({ restful }) => {
    restful.json(PoolService.pairs)
  })
}
