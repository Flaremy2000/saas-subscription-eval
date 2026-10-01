<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, apiFetch } from '@/api/client'
import type { PersonalUsageReport } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const UsageChart = defineAsyncComponent(() => import('@/components/dashboard/UsageChart.vue'))

const POLL_INTERVAL_MS = 30_000

const numberFormat = new Intl.NumberFormat('es-ES')

const auth = useAuthStore()
const router = useRouter()

const report = shallowRef<PersonalUsageReport | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const refreshError = ref(false)
const lastUpdated = ref<Date | null>(null)

let pollTimer: ReturnType<typeof setInterval> | undefined

async function handleAuthError(error: unknown): Promise<boolean> {
  if (error instanceof ApiError && error.statusCode === 401) {
    auth.logout()
    await router.push({ name: 'login' })
    return true
  }
  return false
}

async function loadPersonalUsage(): Promise<void> {
  try {
    report.value = await apiFetch<PersonalUsageReport>('/usage/me')
    loadError.value = null
    refreshError.value = false
    lastUpdated.value = new Date()
  } catch (error) {
    if (await handleAuthError(error)) return
    loadError.value =
      error instanceof ApiError ? error.message : 'Error inesperado al cargar tu consumo.'
  } finally {
    loading.value = false
  }
}

async function refreshPersonalUsage(): Promise<void> {
  if (document.hidden) return

  try {
    report.value = await apiFetch<PersonalUsageReport>('/usage/me')
    refreshError.value = false
    lastUpdated.value = new Date()
  } catch (error) {
    if (await handleAuthError(error)) return
    refreshError.value = true
  }
}

async function retry(): Promise<void> {
  loading.value = true
  loadError.value = null
  await loadPersonalUsage()
}

const licenseInfo = computed(() => {
  if (!report.value) return null

  const { status, assignedAt, revokedAt } = report.value.license
  const tones: Record<
    PersonalUsageReport['license']['status'],
    { container: string; label: string }
  > = {
    ACTIVE: { container: 'bg-emerald-50 text-emerald-700', label: 'Licencia activa' },
    NONE: { container: 'bg-amber-50 text-amber-700', label: 'Sin licencia' },
    REVOKED: { container: 'bg-slate-100 text-slate-500', label: 'Licencia revocada' },
  }

  const tone = tones[status]
  const date = status === 'REVOKED' ? revokedAt : assignedAt

  return { ...tone, date: date ? new Date(date).toLocaleDateString('es-ES') : null }
})

const lastUpdatedLabel = computed(() =>
  lastUpdated.value
    ? lastUpdated.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—',
)

onMounted(() => {
  void loadPersonalUsage()
  pollTimer = setInterval(() => {
    void refreshPersonalUsage()
  }, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Mi consumo</h1>
        <p class="mt-1 text-sm text-slate-500">Llamadas a la API de tu cuenta · últimos 30 días</p>
      </div>
      <p class="text-xs text-slate-400">
        <span v-if="refreshError" class="font-medium text-amber-600">
          No se pudo actualizar ·
        </span>
        Actualizado {{ lastUpdatedLabel }}
      </p>
    </div>

    <div
      v-if="loading && !report"
      class="space-y-4"
      aria-busy="true"
      aria-label="Cargando consumo personal"
    >
      <div class="h-28 animate-pulse rounded-xl bg-slate-200" />
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="h-28 animate-pulse rounded-xl bg-slate-200" />
        <div class="h-28 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div class="h-72 animate-pulse rounded-xl bg-slate-200" />
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"
      role="alert"
    >
      <p class="text-sm font-medium">No se pudo cargar tu consumo</p>
      <p class="mt-1 text-sm">{{ loadError }}</p>
      <button
        class="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:ring-2 focus:ring-red-400 focus:outline-none"
        type="button"
        @click="retry"
      >
        Reintentar
      </button>
    </div>

    <template v-else-if="report">
      <div
        class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div>
          <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">Tu licencia</p>
          <p class="mt-2 text-sm text-slate-600">
            {{
              licenseInfo?.date
                ? `${licenseInfo.label} · desde el ${licenseInfo.date}`
                : licenseInfo?.label
            }}
          </p>
        </div>
        <span
          v-if="licenseInfo"
          class="rounded-full px-2.5 py-1 text-xs font-medium"
          :class="licenseInfo.container"
        >
          {{ report.license.status === 'NONE' ? 'Sin licencia' : report.license.status }}
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Llamadas · 30 días
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ numberFormat.format(report.api.used) }}
          </p>
          <p class="mt-3 text-xs text-slate-400">totales de tu usuario</p>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">Promedio diario</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ numberFormat.format(report.api.daily) }}
          </p>
          <p class="mt-3 text-xs text-slate-400">llamadas/día</p>
        </div>
      </div>

      <UsageChart v-if="report.daily.length > 0" :daily="report.daily" />
      <div
        v-else
        class="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400"
      >
        Aún no hay llamadas registradas en los últimos 30 días.
      </div>
    </template>
  </div>
</template>
