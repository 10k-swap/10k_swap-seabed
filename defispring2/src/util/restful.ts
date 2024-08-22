import { Context } from 'koa'
import { ServiceErrorCodes } from '../error/service'

export class Restful {
  private ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  /**
   * json output
   */
  public json(
    data?: any,
    errCode: ServiceErrorCodes = 0,
    errMessage: any = '',
    apis?: Array<[string, string]>
  ): void {
    if (!errMessage) {
      errMessage = ServiceErrorCodes[errCode]
    }

    const response = this.ctx.response
    response.set('content-type', 'application/json')
    response.body = JSON.stringify({ data, errCode, errMessage, apis })
  }
}
