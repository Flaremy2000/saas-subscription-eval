import type { ChartData, ChartOptions } from 'chart.js'
import type { UsageReport } from '@/api/types'

type DailyPoint = UsageReport['daily'][number]

export function buildDailyUsageData(daily: DailyPoint[]): ChartData<'line'> {
  return {
    labels: daily.map((day) => day.date),
    datasets: [
      {
        label: 'Llamadas a la API',
        data: daily.map((day) => day.apiCalls),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(13, 148, 136, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: daily.length > 15 ? 0 : 3,
      },
    ],
  }
}

export function buildDailyUsageOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toLocaleString('es-ES')} llamadas` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  }
}
