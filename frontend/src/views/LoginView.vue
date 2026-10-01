<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { sanitizeRedirectPath } from '@/router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)

async function onSubmit(): Promise<void> {
  errorMessage.value = null

  const trimmedEmail = email.value.trim()
  if (!trimmedEmail || !password.value) {
    errorMessage.value = 'Ingresa tu correo y contraseña.'
    return
  }

  try {
    await auth.login(trimmedEmail, password.value)
    await router.push(sanitizeRedirectPath(route.query.redirect))
  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value = error.statusCode === 401 ? 'Credenciales inválidas.' : error.message
    } else {
      errorMessage.value = 'Error inesperado. Intenta de nuevo.'
    }
  }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center">
    <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 class="text-lg font-semibold text-slate-900">Iniciar sesión</h1>
      <p class="mt-1 text-sm text-slate-500">Accede al panel de gestión de licencias.</p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
        <div>
          <label class="block text-sm font-medium text-slate-700" for="email">Correo</label>
          <input
            id="email"
            v-model="email"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none"
            autocomplete="username"
            name="email"
            placeholder="tu@empresa.com"
            required
            type="email"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700" for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none"
            autocomplete="current-password"
            name="password"
            required
            type="password"
          />
        </div>

        <p
          v-if="errorMessage"
          class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <button
          class="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="auth.pending"
          type="submit"
        >
          {{ auth.pending ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>
