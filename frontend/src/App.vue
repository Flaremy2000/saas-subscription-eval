<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function onLogout(): void {
  auth.logout()
  void router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header
      v-if="auth.isAuthenticated"
      class="sticky top-0 z-10 border-b border-slate-200 bg-white"
    >
      <div
        class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <RouterLink class="text-sm font-semibold tracking-tight text-slate-900" to="/">
          SaaS Subscriptions
        </RouterLink>

        <div class="flex items-center gap-3">
          <span class="hidden text-sm text-slate-500 sm:inline">{{ auth.user?.name }}</span>
          <span
            v-if="auth.user"
            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          >
            {{ auth.user.role }}
          </span>
          <button
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-slate-400 focus:outline-none"
            type="button"
            @click="onLogout"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>
