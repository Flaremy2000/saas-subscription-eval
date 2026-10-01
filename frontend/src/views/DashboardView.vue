<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, apiFetch } from '@/api/client'
import UserTable from '@/components/dashboard/UserTable.vue'
import type {
  CompanyUser,
  LicenseAssignment,
  Role,
  RoleUpdateResponse,
  UsageReport,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const UsageChart = defineAsyncComponent(() => import('@/components/dashboard/UsageChart.vue'))
const PersonalUsage = defineAsyncComponent(() => import('@/components/dashboard/PersonalUsage.vue'))

const POLL_INTERVAL_MS = 30_000

const numberFormat = new Intl.NumberFormat('es-ES')

const auth = useAuthStore()
const router = useRouter()

const usage = shallowRef<UsageReport | null>(null)
const users = shallowRef<CompanyUser[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const refreshError = ref(false)
const assigningUserId = ref<string | null>(null)
const updatingRoleUserId = ref<string | null>(null)
const revokingUserId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const activeTab = ref<'company' | 'personal'>('company')
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

async function loadDashboard(): Promise<void> {
  try {
    const [usageReport, userList] = await Promise.all([
      apiFetch<UsageReport>('/usage'),
      apiFetch<{ users: CompanyUser[] }>('/users'),
    ])
    usage.value = usageReport
    users.value = userList.users
    loadError.value = null
    refreshError.value = false
    lastUpdated.value = new Date()
  } catch (error) {
    if (await handleAuthError(error)) return
    loadError.value =
      error instanceof ApiError ? error.message : 'Error inesperado al cargar el panel.'
  } finally {
    loading.value = false
  }
}

async function refreshUsage(): Promise<void> {
  if (document.hidden || activeTab.value !== 'company') return

  try {
    usage.value = await apiFetch<UsageReport>('/usage')
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
  await loadDashboard()
}

async function assignLicense(user: CompanyUser): Promise<void> {
  assigningUserId.value = user.id
  actionError.value = null

  try {
    const result = await apiFetch<LicenseAssignment>('/licenses/assign', {
      method: 'POST',
      body: { userId: user.id },
    })
    users.value = users.value.map((candidate) =>
      candidate.id === user.id
        ? {
            ...candidate,
            activeLicenseId: result.license.id,
            licenseAssignedAt: result.license.assignedAt,
          }
        : candidate,
    )
    void refreshUsage()
  } catch (error) {
    if (await handleAuthError(error)) return
    actionError.value =
      error instanceof ApiError ? error.message : 'No se pudo asignar la licencia.'
  } finally {
    assigningUserId.value = null
  }
}

async function revokeLicense(user: CompanyUser): Promise<void> {
  if (!user.activeLicenseId) return
  revokingUserId.value = user.id
  actionError.value = null
  const previous = {
    activeLicenseId: user.activeLicenseId,
    licenseAssignedAt: user.licenseAssignedAt,
  }
  users.value = users.value.map((candidate) =>
    candidate.id === user.id
      ? { ...candidate, activeLicenseId: null, licenseAssignedAt: null }
      : candidate,
  )

  try {
    await apiFetch<LicenseAssignment>('/licenses/revoke', {
      method: 'POST',
      body: { userId: user.id },
    })
    void refreshUsage()
  } catch (error) {
    users.value = users.value.map((candidate) =>
      candidate.id === user.id ? { ...candidate, ...previous } : candidate,
    )
    if (await handleAuthError(error)) return
    actionError.value =
      error instanceof ApiError ? error.message : 'No se pudo desasignar la licencia.'
  } finally {
    revokingUserId.value = null
  }
}

async function changeRole(user: CompanyUser, role: Role): Promise<void> {
  updatingRoleUserId.value = user.id
  actionError.value = null
  users.value = users.value.map((candidate) =>
    candidate.id === user.id ? { ...candidate, role } : candidate,
  )

  try {
    await apiFetch<RoleUpdateResponse>(`/users/${user.id}/role`, {
      method: 'PATCH',
      body: { role },
    })
  } catch (error) {
    users.value = users.value.map((candidate) =>
      candidate.id === user.id ? { ...candidate, role: user.role } : candidate,
    )
    if (await handleAuthError(error)) return
    actionError.value = error instanceof ApiError ? error.message : 'No se pudo actualizar el rol.'
  } finally {
    updatingRoleUserId.value = null
  }
}

const statusInfo = computed(() => {
  if (!usage.value) return null

  const { status, api } = usage.value
  const tones: Record<UsageReport['status'], { container: string; dot: string; title: string }> = {
    healthy: {
      container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      dot: 'bg-emerald-500',
      title: 'Consumo dentro del contrato',
    },
    warning: {
      container: 'border-amber-200 bg-amber-50 text-amber-900',
      dot: 'bg-amber-500',
      title: 'Te acercas al límite contratado',
    },
    exceeded: {
      container: 'border-red-200 bg-red-50 text-red-900',
      dot: 'bg-red-500',
      title: 'Límite de API excedido',
    },
  }

  const tone = tones[status]
  const description =
    status === 'exceeded'
      ? `Has superado la cuota en ${numberFormat.format(Math.max(api.used - api.limit, 0))} llamadas.`
      : status === 'warning'
        ? `Ya consumiste el ${api.usagePercentage}% de tu cuota mensual.`
        : `Llevas el ${api.usagePercentage}% de tu cuota mensual.`

  return { ...tone, description }
})

const apiBarTone = computed(() => {
  const status = usage.value?.status
  if (status === 'exceeded') return 'bg-red-500'
  if (status === 'warning') return 'bg-amber-500'
  return 'bg-emerald-500'
})

const lastUpdatedLabel = computed(() =>
  lastUpdated.value
    ? lastUpdated.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—',
)

onMounted(() => {
  if (auth.isAdmin) {
    void loadDashboard()
    pollTimer = setInterval(() => {
      void refreshUsage()
    }, POLL_INTERVAL_MS)
  } else {
    loading.value = false
  }
})

onUnmounted(() => {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer)
  }
})
</script>

<template>
  <div class="space-y-6">
    <nav
      v-if="auth.isAdmin"
      class="flex w-fit gap-1 rounded-lg bg-slate-100 p-1"
      aria-label="Secciones del panel"
      role="tablist"
    >
      <button
        class="rounded-md px-4 py-1.5 text-sm font-medium transition focus:ring-2 focus:ring-slate-400 focus:outline-none"
        :class="
          activeTab === 'company'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        "
        type="button"
        role="tab"
        :aria-selected="activeTab === 'company'"
        @click="activeTab = 'company'"
      >
        Empresa
      </button>
      <button
        class="rounded-md px-4 py-1.5 text-sm font-medium transition focus:ring-2 focus:ring-slate-400 focus:outline-none"
        :class="
          activeTab === 'personal'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        "
        type="button"
        role="tab"
        :aria-selected="activeTab === 'personal'"
        @click="activeTab = 'personal'"
      >
        Mi consumo
      </button>
    </nav>

    <PersonalUsage v-if="!auth.isAdmin || activeTab === 'personal'" />

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p v-if="usage" class="mt-1 text-sm text-slate-500">
            {{ usage.company.name }} · límite de
            {{ numberFormat.format(usage.company.apiLimit) }} llamadas/mes
          </p>
        </div>
        <p class="text-xs text-slate-400">
          <span v-if="refreshError" class="font-medium text-amber-600">
            No se pudo actualizar ·
          </span>
          Actualizado {{ lastUpdatedLabel }}
        </p>
      </div>

      <div v-if="loading && !usage" class="space-y-4" aria-busy="true" aria-label="Cargando panel">
        <div class="h-16 animate-pulse rounded-xl bg-slate-200" />
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="h-28 animate-pulse rounded-xl bg-slate-200" />
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
        <p class="text-sm font-medium">No se pudo cargar el panel</p>
        <p class="mt-1 text-sm">{{ loadError }}</p>
        <button
          class="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:ring-2 focus:ring-red-400 focus:outline-none"
          type="button"
          @click="retry"
        >
          Reintentar
        </button>
      </div>

      <template v-else-if="usage">
        <div
          v-if="statusInfo"
          class="flex items-start gap-3 rounded-xl border p-4"
          :class="statusInfo.container"
          role="status"
        >
          <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="statusInfo.dot" />
          <div>
            <p class="text-sm font-semibold">{{ statusInfo.title }}</p>
            <p class="mt-0.5 text-sm opacity-80">{{ statusInfo.description }}</p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">Consumo API</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ numberFormat.format(usage.api.used) }}
              <span class="text-sm font-normal text-slate-400">
                / {{ numberFormat.format(usage.api.limit) }}
              </span>
            </p>
            <div class="mt-3 h-2 rounded-full bg-slate-100">
              <div
                class="h-2 rounded-full transition-all"
                :class="apiBarTone"
                :style="{ width: `${Math.min(usage.api.usagePercentage, 100)}%` }"
              />
            </div>
            <p class="mt-2 text-xs text-slate-400">{{ usage.api.usagePercentage }}% de la cuota</p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Licencias usadas
            </p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ numberFormat.format(usage.usage.usedLicenses) }}
              <span class="text-sm font-normal text-slate-400">
                / {{ numberFormat.format(usage.usage.totalLicenses) }}
              </span>
            </p>
            <div class="mt-3 h-2 rounded-full bg-slate-100">
              <div
                class="h-2 rounded-full bg-teal-600 transition-all"
                :style="{ width: `${Math.min(usage.usage.usagePercentage, 100)}%` }"
              />
            </div>
            <p class="mt-2 text-xs text-slate-400">{{ usage.usage.usagePercentage }}% asignadas</p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Licencias disponibles
            </p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ numberFormat.format(usage.usage.availableLicenses) }}
            </p>
            <p class="mt-3 text-xs text-slate-400">
              de {{ numberFormat.format(usage.usage.totalLicenses) }} contratadas ·
              {{ numberFormat.format(usage.company.licenseLimit) }} asientos
            </p>
          </div>
        </div>

        <UsageChart :daily="usage.daily" />

        <p
          v-if="actionError"
          class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {{ actionError }}
        </p>

        <UserTable
          :assigning-user-id="assigningUserId"
          :can-assign="auth.isAdmin"
          :current-user-id="auth.user?.id ?? null"
          :revoking-user-id="revokingUserId"
          :updating-role-user-id="updatingRoleUserId"
          :users="users"
          @assign="assignLicense"
          @change-role="changeRole"
          @revoke="revokeLicense"
        />
      </template>
    </template>
  </div>
</template>
