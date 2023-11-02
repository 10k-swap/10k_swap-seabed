import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { ActivityService } from '../service/activity'
import { plainToInstance } from 'class-transformer'
import dayjs from 'dayjs'

export default function (router: KoaRouter<DefaultState, Context>) {
  const activityService = new ActivityService()

  router.get('activity/num_2023_11_01', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        account: string
      },
      request.query
    )

    const interacted = await activityService.interactedByAccount(
      params.account,
      dayjs('2023-11-02T00:00:00Z').unix(),
      dayjs('2023-11-17T00:00:00Z').unix()
    )

    restful.json({ interacted })
  })
}
