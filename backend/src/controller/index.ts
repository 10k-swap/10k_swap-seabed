import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import analytics from './analytics'
import app from './app'
import pool from './pool'
import activity from './activity'
import transaction from './transaction'

export default function () {
  const router = new KoaRouter<DefaultState, Context>({ prefix: '/' })

  app(router)

  pool(router)

  analytics(router)

  activity(router)

  transaction(router)

  return router.routes()
}
