import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UsageChart from '@/components/dashboard/UsageChart.vue'

vi.mock('vue-chartjs', () => ({
  Line: {
    name: 'Line',
    props: {
      data: { type: Object, required: true },
      options: { type: Object, required: true },
    },
    template: '<div class="line-stub" />',
  },
}))

const daily = [
  { date: '2026-09-29', apiCalls: 2500 },
  { date: '2026-09-30', apiCalls: 3100 },
]

describe('usage chart view', () => {
  it('renders the section and feeds the series to the chart', () => {
    const wrapper = mount(UsageChart, { props: { daily } })

    expect(wrapper.text()).toContain('Consumo diario de la API')

    const chart = wrapper.findComponent({ name: 'Line' })
    expect(chart.exists()).toBe(true)
    expect((chart.props('data') as { labels: string[] }).labels).toEqual([
      '2026-09-29',
      '2026-09-30',
    ])
  })

  it('reacts to daily updates', async () => {
    const wrapper = mount(UsageChart, { props: { daily } })

    await wrapper.setProps({ daily: [{ date: '2026-10-01', apiCalls: 100 }] })

    const chart = wrapper.findComponent({ name: 'Line' })
    expect((chart.props('data') as { labels: string[] }).labels).toEqual(['2026-10-01'])
  })
})
