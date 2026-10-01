<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import type { UsageReport } from '@/api/types'
import { buildDailyUsageData, buildDailyUsageOptions } from './usage-chart'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{ daily: UsageReport['daily'] }>()

const data = computed(() => buildDailyUsageData(props.daily))
const options = buildDailyUsageOptions()
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div class="mb-3 flex items-baseline justify-between gap-4">
      <h2 class="text-sm font-semibold text-slate-700">Consumo diario de la API</h2>
      <span class="text-xs text-slate-400">últimos 30 días · llamadas/día</span>
    </div>
    <div class="h-56 sm:h-64">
      <Line :data="data" :options="options" />
    </div>
  </section>
</template>
