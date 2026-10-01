import { describe, expect, it } from 'vitest'
import { buildDailyUsageData, buildDailyUsageOptions } from '@/components/dashboard/usage-chart'

describe('usage chart config', () => {
  it('maps daily points to labels and dataset values', () => {
    const data = buildDailyUsageData([
      { date: '2026-09-29', apiCalls: 2500 },
      { date: '2026-09-30', apiCalls: 3100 },
    ])

    expect(data.labels).toEqual(['2026-09-29', '2026-09-30'])
    expect(data.datasets[0]?.data).toEqual([2500, 3100])
    expect(data.datasets[0]?.fill).toBe(true)
  })

  it('hides individual points on dense series', () => {
    const daily = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${index + 1}`,
      apiCalls: index * 100,
    }))

    expect(buildDailyUsageData(daily).datasets[0]?.pointRadius).toBe(0)
  })

  it('renders a responsive chart without a legend', () => {
    const options = buildDailyUsageOptions()

    expect(options.responsive).toBe(true)
    expect(options.maintainAspectRatio).toBe(false)
    expect(options.plugins?.legend?.display).toBe(false)
    expect(options.scales?.y).toMatchObject({ beginAtZero: true })
  })

  it('handles an empty series', () => {
    const data = buildDailyUsageData([])

    expect(data.labels).toEqual([])
    expect(data.datasets[0]?.data).toEqual([])
  })
})
