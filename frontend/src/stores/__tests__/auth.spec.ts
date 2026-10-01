import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, TOKEN_STORAGE_KEY } from '@/api/client'
import { useAuthStore, type AuthUser } from '@/stores/auth'

const USER_STORAGE_KEY = 'saas.authUser'

const admin: AuthUser = {
  id: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'company-1',
}

function loginPayload(token = 'jwt-token'): unknown {
  return { accessToken: token, tokenType: 'Bearer', user: admin }
}

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response
}

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in, persists the session and exposes getters', async () => {
    const fetchMock = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse(loginPayload()))
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)

    await store.login('admin@empresa.com', 'Password123!')

    expect(store.isAuthenticated).toBe(true)
    expect(store.isAdmin).toBe(true)
    expect(store.user).toEqual(admin)
    expect(store.pending).toBe(false)
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token')
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? 'null')).toEqual(admin)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/auth/login')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'admin@empresa.com', password: 'Password123!' }))
  })

  it('rejects invalid credentials without touching the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ statusCode: 401, message: 'Invalid credentials' }, 401, 'Unauthorized'),
        ),
    )

    const store = useAuthStore()
    const failure = (await store
      .login('admin@empresa.com', 'wrong')
      .catch((error: unknown) => error)) as ApiError

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.statusCode).toBe(401)
    expect(store.isAuthenticated).toBe(false)
    expect(store.pending).toBe(false)
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('restores a persisted session on creation', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token')
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(admin))

    const store = useAuthStore()

    expect(store.token).toBe('stored-token')
    expect(store.user).toEqual(admin)
    expect(store.isAuthenticated).toBe(true)
  })

  it('discards corrupted stored user data but keeps the token', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token')
    localStorage.setItem(USER_STORAGE_KEY, 'not-json{')

    const store = useAuthStore()

    expect(store.token).toBe('stored-token')
    expect(store.user).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('logs out and clears storage', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token')
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(admin))

    const store = useAuthStore()
    store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('refreshes the user profile from /auth/me', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token')
    const fetchMock = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ user: { ...admin, name: 'Nuevo' } }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    await store.refreshUser()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.anything())
    expect(store.user?.name).toBe('Nuevo')
    expect(store.isAuthenticated).toBe(true)
  })

  it('ends the session when the token is rejected with 401', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ statusCode: 401, message: 'Unauthorized' }, 401, 'Unauthorized'),
        ),
    )

    const store = useAuthStore()
    await store.refreshUser()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('keeps the session on transient network failures', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token')
    vi.stubGlobal(
      'fetch',
      vi
        .fn<(input: string, init: RequestInit) => Promise<Response>>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const store = useAuthStore()
    await store.refreshUser()

    expect(store.isAuthenticated).toBe(true)
  })

  it('skips the profile refresh when unauthenticated', async () => {
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    await store.refreshUser()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
