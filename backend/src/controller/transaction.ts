import { plainToInstance } from 'class-transformer'
import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { PairTransactionService } from '../service/pair_transaction'

export default function (router: KoaRouter<DefaultState, Context>) {
  router.get('transaction/addresses', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        pair_address: string
        key_name: string
        page: number
      },
      request.query
    )
    params.page = Number(params.page)

    const result = await new PairTransactionService().get_addresses_with_page(
      params.pair_address,
      params.key_name,
      params.page
    )

    restful.json(result)
  })
}
