<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { CompanyUser, Role } from '@/api/types'

const props = defineProps<{
  users: CompanyUser[]
  canAssign: boolean
  assigningUserId: string | null
  updatingRoleUserId: string | null
  revokingUserId: string | null
  currentUserId: string | null
}>()

const emit = defineEmits<{
  assign: [user: CompanyUser]
  revoke: [user: CompanyUser]
  changeRole: [user: CompanyUser, role: Role]
}>()

const search = ref('')
const appliedSearch = ref('')
const sortKey = ref<'name' | 'license'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    appliedSearch.value = value.trim().toLowerCase()
  }, 200)
})

onUnmounted(() => {
  clearTimeout(debounceTimer)
})

const visibleUsers = computed(() => {
  const query = appliedSearch.value
  const filtered = query
    ? props.users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
      )
    : props.users

  const factor = sortDir.value === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    if (sortKey.value === 'license') {
      const aLicense = a.activeLicenseId ? 1 : 0
      const bLicense = b.activeLicenseId ? 1 : 0
      if (aLicense !== bLicense) return (aLicense - bLicense) * factor
    }
    return a.name.localeCompare(b.name) * factor
  })
})

const licensedCount = computed(
  () => props.users.filter((user) => user.activeLicenseId !== null).length,
)

function toggleSort(key: 'name' | 'license'): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = 'asc'
}

function formatAssignedDate(value: string): string {
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function isRoleDisabled(user: CompanyUser): boolean {
  return (
    user.id === props.currentUserId ||
    props.updatingRoleUserId === user.id ||
    props.revokingUserId === user.id ||
    props.assigningUserId === user.id
  )
}

function onRoleChange(user: CompanyUser, event: Event): void {
  const role = (event.target as HTMLSelectElement).value as Role
  if (role !== user.role) {
    emit('changeRole', user, role)
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white">
    <div
      class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div>
        <h2 class="text-sm font-semibold text-slate-700">Usuarios de la empresa</h2>
        <p class="mt-0.5 text-xs text-slate-400">
          {{ licensedCount }} de {{ users.length }} con licencia activa
        </p>
      </div>

      <div class="relative w-full sm:w-64">
        <label class="sr-only" for="user-search">Buscar usuarios</label>
        <input
          id="user-search"
          v-model="search"
          class="w-full rounded-md border border-slate-300 py-2 pr-8 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none"
          placeholder="Buscar por nombre o correo…"
          type="search"
        />
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr class="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
            <th class="px-4 py-3 font-medium sm:px-5">
              <button
                class="inline-flex items-center gap-1 tracking-wide uppercase hover:text-slate-600"
                type="button"
                @click="toggleSort('name')"
              >
                Usuario
                <span aria-hidden="true">{{
                  sortKey === 'name' && sortDir === 'desc' ? '↓' : '↑'
                }}</span>
              </button>
            </th>
            <th class="px-4 py-3 font-medium sm:px-5">Rol</th>
            <th class="px-4 py-3 font-medium sm:px-5">
              <button
                class="inline-flex items-center gap-1 tracking-wide uppercase hover:text-slate-600"
                type="button"
                @click="toggleSort('license')"
              >
                Licencia
                <span aria-hidden="true">{{
                  sortKey === 'license' && sortDir === 'desc' ? '↓' : '↑'
                }}</span>
              </button>
            </th>
            <th class="px-4 py-3 text-right font-medium sm:px-5">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="user in visibleUsers"
            :key="user.id"
            v-memo="[
              user.activeLicenseId,
              user.role,
              assigningUserId === user.id,
              updatingRoleUserId === user.id,
              revokingUserId === user.id,
            ]"
            class="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
          >
            <td class="px-4 py-3 sm:px-5">
              <p class="font-medium text-slate-800">{{ user.name }}</p>
              <p class="text-xs text-slate-400">{{ user.email }}</p>
            </td>
            <td class="px-4 py-3 sm:px-5">
              <select
                v-if="canAssign"
                class="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                :aria-label="`Rol de ${user.name}`"
                :disabled="isRoleDisabled(user)"
                :value="user.role"
                @change="onRoleChange(user, $event)"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </select>
              <span
                v-else
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  user.role === 'ADMIN'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-slate-100 text-slate-600'
                "
              >
                {{ user.role }}
              </span>
            </td>
            <td class="px-4 py-3 sm:px-5">
              <span
                v-if="user.activeLicenseId"
                class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              >
                Activa{{
                  user.licenseAssignedAt ? ` · ${formatAssignedDate(user.licenseAssignedAt)}` : ''
                }}
              </span>
              <span
                v-else
                class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                Sin licencia
              </span>
            </td>
            <td class="px-4 py-3 text-right sm:px-5">
              <button
                v-if="canAssign && !user.activeLicenseId"
                class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="assigningUserId === user.id"
                type="button"
                @click="emit('assign', user)"
              >
                {{ assigningUserId === user.id ? 'Asignando…' : 'Asignar' }}
              </button>
              <button
                v-else-if="canAssign && user.activeLicenseId"
                class="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:ring-2 focus:ring-red-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="revokingUserId === user.id"
                type="button"
                @click="emit('revoke', user)"
              >
                {{ revokingUserId === user.id ? 'Revocando…' : 'Desasignar' }}
              </button>
              <span v-else class="text-xs text-slate-300">—</span>
            </td>
          </tr>

          <tr v-if="visibleUsers.length === 0">
            <td class="px-4 py-8 text-center text-sm text-slate-400 sm:px-5" colspan="4">
              No hay usuarios que coincidan con la búsqueda.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
