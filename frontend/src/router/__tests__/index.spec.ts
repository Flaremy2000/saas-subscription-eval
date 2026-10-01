import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router, { sanitizeRedirectPath } from '@/router'
import { useAuthStore } from '@/stores/auth'

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('redirects unauthenticated users to login, preserving the target', async () => {
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('redirects authenticated users away from the login view', async () => {
    useAuthStore().token = 'stored-token'

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('allows authenticated users to reach the dashboard', async () => {
    useAuthStore().token = 'stored-token'

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('falls back to the dashboard for unknown paths', async () => {
    useAuthStore().token = 'stored-token'

    await router.push('/does-not-exist')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})

describe('sanitizeRedirectPath', () => {
  it('accepts same-origin paths only', () => {
    expect(sanitizeRedirectPath('/usage')).toBe('/usage')
    expect(sanitizeRedirectPath('//evil.example')).toBe('/')
    expect(sanitizeRedirectPath('https://evil.example')).toBe('/')
    expect(sanitizeRedirectPath(undefined)).toBe('/')
    expect(sanitizeRedirectPath(42)).toBe('/')
  })
})
