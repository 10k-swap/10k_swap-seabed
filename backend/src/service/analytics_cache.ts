import dayjs from 'dayjs';
import { AnalyticsService } from './analytics'
import { PoolService } from './pool'

export class AnalyticsServiceCache {
  public static cache = {
    lastUpdateTime: new Date(0),
    tvlsByDay: [] as { date: string; tvl: number }[],
    volumesByDay: [] as { date: string; volume: number }[],
  }

  async cacheTVLsByDayAndVolumesByDay() {
    if (PoolService.pairs.length <= 0) {
      return
    }

    // Update cache after more than 10 minutes
    if (
      new Date().getTime() -
        AnalyticsServiceCache.cache.lastUpdateTime.getTime() <=
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
      lastUpdateTime: new Date(),
    }
  }
}
