import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import analytics from './analytics'
import app from './app'
import pool from './pool'

export default function () {
  const router = new KoaRouter<DefaultState, Context>({ prefix: '/' })

  app(router)

  pool(router)

  analytics(router)

  return router.routes()
}
