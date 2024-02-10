import { plainToInstance } from 'class-transformer'
import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { PairEventService } from '../service/pair_event'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('pair/lp_events', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        pair_address: string
        from_block: number
        to_block: number
      },
      request.query
    )

    const result = await new PairEventService().getLpEvents(
      params.pair_address,
      params.from_block,
      params.to_block
    )

    restful.json(result)
  })
}
