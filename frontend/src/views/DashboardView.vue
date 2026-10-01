<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section>
    <h1 class="text-xl font-semibold text-slate-900">Dashboard</h1>
    <p class="mt-1 text-sm text-slate-500">
      Bienvenido{{ auth.user ? `, ${auth.user.name}` : '' }}. Aquí verás el consumo de tu empresa.
    </p>
  </section>
</template>
