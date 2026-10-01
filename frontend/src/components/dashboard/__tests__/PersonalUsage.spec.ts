import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { PersonalUsageReport } from '@/api/types'
import router from '@/router'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import PersonalUsage from '@/components/dashboard/PersonalUsage.vue'

vi.mock('vue-chartjs', () => ({
  Line: {
    name: 'Line',
    props: {
      data: { type: Object, required: true },
      options: { type: Object, required: true },
    },
    template: '<div class="line-stub" />',
  },
}))

const user: AuthUser = {
  id: 'u2',
  email: 'usuario@empresa.com',
  name: 'Carlos Usuario',
  role: 'USER',
  companyId: 'c1',
}

const personalUsage: PersonalUsageReport = {
  license: { status: 'ACTIVE', assignedAt: '2026-01-10T00:00:00.000Z', revokedAt: null },
  api: { used: 1240, daily: 41 },
  daily: [{ date: '2026-09-30', apiCalls: 55 }],
}

const unlicensedUsage: PersonalUsageReport = {
  license: { status: 'NONE', assignedAt: null, revokedAt: null },
  api: { used: 0, daily: 0 },
  daily: [],
}

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response
}

function errorResponse(status: number, message: string): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse({ statusCode: status, message }, status, 'Error'))
}

function stubFetch(payload: PersonalUsageReport = personalUsage) {
  const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(jsonResponse(payload)),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('personal usage component', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'stored-token'
    auth.user = user
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = undefined
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function mountComponent(): VueWrapper {
    wrapper = mount(PersonalUsage, { global: { plugins: [router] } })
    return wrapper
  }

  it('renders the license badge, KPIs and chart', async () => {
    stubFetch()
    const view = mountComponent()
    await vi.waitFor(() => {
      expect(view.text()).toContain('1240')
    })

    expect(view.text()).toContain('Mi consumo')
    expect(view.text()).toContain('Licencia activa')
    expect(view.text()).toContain('41')
    await vi.waitFor(() => {
      expect(view.find('.line-stub').exists()).toBe(true)
    })
  })

  it('shows an unlicensed empty state', async () => {
    stubFetch(unlicensedUsage)
    const view = mountComponent()

    await vi.waitFor(() => {
      expect(view.text()).toContain('Sin licencia')
    })
    expect(view.text()).toContain('Aún no hay llamadas registradas')
    expect(view.find('.line-stub').exists()).toBe(false)
  })

  it('shows a retryable error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const view = mountComponent()

    await vi.waitFor(() => {
      expect(view.find('[role="alert"]').text()).toContain('No se pudo cargar tu consumo')
    })
    expect(view.find('[role="alert"]').text()).toContain('No se pudo conectar con el servidor.')
    expect(view.find('[role="alert"] button').text()).toBe('Reintentar')
  })

  it('surfaces the API error message and retries', async () => {
    let attempt = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        attempt += 1
        return attempt === 1
          ? errorResponse(500, 'Service unavailable')()
          : Promise.resolve(jsonResponse(personalUsage))
      }),
    )
    const view = mountComponent()

    await vi.waitFor(() => {
      expect(view.find('[role="alert"]').text()).toContain('Service unavailable')
    })

    await view.find('[role="alert"] button').trigger('click')
    await vi.waitFor(() => {
      expect(view.text()).toContain('1240')
    })
  })

  it('ends the session and redirects when the request returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ statusCode: 401, message: 'Unauthorized' }, 401, 'Unauthorized'),
        ),
      ),
    )
    mountComponent()
    await flushPromises()

    expect(useAuthStore().isAuthenticated).toBe(false)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  it('refreshes personal usage every 30 seconds and stops after unmount', async () => {
    const fetchMock = stubFetch()
    vi.useFakeTimers()

    const view = mountComponent()
    await vi.advanceTimersByTimeAsync(0)
    expect(view.text()).toContain('1240')

    const callsAfterLoad = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad + 1)

    view.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad + 1)
  })
})
