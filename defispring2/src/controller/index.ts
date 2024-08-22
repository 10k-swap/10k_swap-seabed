import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { plainToInstance } from 'class-transformer'
import { get_raw_calldata, get_raw_root } from '../service/processor'
import { responseJson } from '../util'

export default function () {
  const router = new KoaRouter<DefaultState, Context>({ prefix: '/' })

  router.get('get_calldata', async ({ request, response }) => {
    const params = plainToInstance(
      class {
        round: number
        address: string
      },
      request.query
    )
    params.round = Number(params.round) || 0

    const calldata = await get_raw_calldata(params.round, params.address)

    responseJson(response, calldata)
  })

  router.get('get_root', async ({ request, response }) => {
    const params = plainToInstance(
      class {
        round: number
      },
      request.query
    )
    params.round = Number(params.round) || 0

    const result = await get_raw_root(params.round)

    responseJson(response, result)
  })

  return router.routes()
}
