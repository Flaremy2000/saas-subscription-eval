import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, apiFetch, TOKEN_STORAGE_KEY } from '@/api/client'

const USER_STORAGE_KEY = 'saas.authUser'

export type UserRole = 'ADMIN' | 'USER'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  companyId: string
}

interface LoginResponse {
  accessToken: string
  tokenType: string
  user: AuthUser
}

interface MeResponse {
  user: AuthUser
}

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.role === 'string'
    ) {
      return parsed as AuthUser
    }
  } catch {
    // Corrupted storage: fall through and clear it below.
  }

  localStorage.removeItem(USER_STORAGE_KEY)
  return null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStoredToken())
  const user = ref<AuthUser | null>(readStoredUser())
  const pending = ref(false)

  const isAuthenticated = computed(() => token.value !== null)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  async function login(email: string, password: string): Promise<void> {
    pending.value = true
    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      token.value = data.accessToken
      user.value = data.user
      localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
    } finally {
      pending.value = false
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  async function refreshUser(): Promise<void> {
    if (!isAuthenticated.value) return

    try {
      const data = await apiFetch<MeResponse>('/auth/me')
      user.value = data.user
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        logout()
      }
    }
  }

  return {
    token,
    user,
    pending,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    refreshUser,
  }
})
