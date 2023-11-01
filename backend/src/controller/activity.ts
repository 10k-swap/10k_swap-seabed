import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { ActivityService } from '../service/activity'
import { plainToInstance } from 'class-transformer'

export default function (router: KoaRouter<DefaultState, Context>) {
  const activityService = new ActivityService()

  router.get('activity/interacted_by_account', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        startTime: number
        endTime: number
        account: string
      },
      request.query
    )

    const interacted = await activityService.interactedByAccount(
      params.account,
      params.startTime,
      params.endTime
    )

    restful.json({ interacted })
  })
}
