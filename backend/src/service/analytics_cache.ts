import dayjs from 'dayjs'
import { AnalyticsService } from './analytics'
import { PoolService } from './pool'
import { Core } from '../util/core'

export class AnalyticsServiceCache {
  public static cache = {
    lastUpdateTime: 0, // ms
    tvlsByDay: [] as { date: string; tvl: number }[],
    volumesByDay: [] as { date: string; volume: number }[],
  }

  async cacheTVLsByDayAndVolumesByDay() {
    if (PoolService.pairs.length <= 0) {
      return
    }

    const cacheKey = 'analytics_service_cache-cache'
    const cacheValue = await Core.redis.get(cacheKey)

    if (AnalyticsServiceCache.cache.lastUpdateTime == 0 && cacheValue) {
      try {
        AnalyticsServiceCache.cache = JSON.parse(cacheValue)
      } catch (_) {}
    }

    // Update cache after more than 10 minutes
    if (
      new Date().getTime() - AnalyticsServiceCache.cache.lastUpdateTime <=
      600000
    ) {
      return
    }

    const startTime = dayjs().subtract(90, 'day').startOf('day').toDate()
    const analyticsService = new AnalyticsService()

    const tvlsByDay = await analyticsService.getTVLsByDay(startTime)
    if (tvlsByDay.length <= 0) {
      return
    }

    const volumesByDay = await analyticsService.getVolumesByDay(startTime)
    if (volumesByDay.length <= 0) {
      return
    }

    AnalyticsServiceCache.cache = {
      tvlsByDay,
      volumesByDay,
      lastUpdateTime: new Date().getTime(),
    }
    await Core.redis.setex(
      cacheKey,
      3_600,
      JSON.stringify(AnalyticsServiceCache.cache)
    )
  }
}
