import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type {
  CompanyUser,
  LicenseAssignment,
  PersonalUsageReport,
  RoleUpdateResponse,
  UsageReport,
} from '@/api/types'
import router from '@/router'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import DashboardView from '@/views/DashboardView.vue'

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

const admin: AuthUser = {
  id: 'u1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'c1',
}

const usageReport: UsageReport = {
  company: { id: 'c1', name: 'Acme Corporation', apiLimit: 100000, licenseLimit: 25 },
  usage: { totalLicenses: 25, usedLicenses: 8, availableLicenses: 17, usagePercentage: 32 },
  api: { used: 81220, limit: 100000, usagePercentage: 81, exceeded: false },
  daily: [{ date: '2026-09-30', apiCalls: 3100 }],
  status: 'warning',
}

const companyUsers: CompanyUser[] = [
  {
    id: 'u1',
    email: 'admin@empresa.com',
    name: 'Ana Admin',
    role: 'ADMIN',
    activeLicenseId: 'l1',
    licenseAssignedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'u2',
    email: 'diego@empresa.com',
    name: 'Diego Ramos',
    role: 'USER',
    activeLicenseId: null,
    licenseAssignedAt: null,
  },
]

const assignPayload: LicenseAssignment = {
  success: true,
  message: 'License assigned successfully',
  license: {
    id: 'new-license',
    userId: 'u2',
    companyId: 'c1',
    status: 'ACTIVE',
    assignedAt: '2026-10-01T00:00:00.000Z',
  },
}

const revokePayload: LicenseAssignment = {
  success: true,
  message: 'License revoked successfully',
  license: {
    id: 'l1',
    userId: 'u1',
    companyId: 'c1',
    status: 'REVOKED',
    assignedAt: '2026-01-10T00:00:00.000Z',
    revokedAt: '2026-10-01T00:00:00.000Z',
  },
}

const rolePayload: RoleUpdateResponse = {
  user: { id: 'u2', email: 'diego@empresa.com', name: 'Diego Ramos', role: 'ADMIN' },
}

const personalUsage: PersonalUsageReport = {
  license: { status: 'ACTIVE', assignedAt: '2026-01-10T00:00:00.000Z', revokedAt: null },
  api: { used: 1240, daily: 41 },
  daily: [{ date: '2026-09-30', apiCalls: 55 }],
}

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response
}

interface StubOptions {
  usageResponse?: () => Promise<Response>
  usersResponse?: () => Promise<Response>
  assignResponse?: () => Promise<Response>
  revokeResponse?: () => Promise<Response>
  roleResponse?: () => Promise<Response>
  personalResponse?: () => Promise<Response>
}

function stubFetch(options: StubOptions = {}) {
  const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>((input) => {
    const url = String(input)
    if (url.endsWith('/licenses/assign')) {
      return options.assignResponse?.() ?? Promise.resolve(jsonResponse(assignPayload))
    }
    if (url.endsWith('/licenses/revoke')) {
      return options.revokeResponse?.() ?? Promise.resolve(jsonResponse(revokePayload))
    }
    if (url.includes('/role')) {
      return options.roleResponse?.() ?? Promise.resolve(jsonResponse(rolePayload))
    }
    if (url.endsWith('/usage/me')) {
      return options.personalResponse?.() ?? Promise.resolve(jsonResponse(personalUsage))
    }
    if (url.endsWith('/usage')) {
      return options.usageResponse?.() ?? Promise.resolve(jsonResponse(usageReport))
    }
    if (url.endsWith('/users')) {
      return options.usersResponse?.() ?? Promise.resolve(jsonResponse({ users: companyUsers }))
    }
    return Promise.resolve(
      jsonResponse({ statusCode: 404, message: 'Not Found' }, 404, 'Not Found'),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function errorResponse(status: number, message: string): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse({ statusCode: status, message }, status, 'Error'))
}

describe('dashboard view', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'stored-token'
    auth.user = admin
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

  function mountDashboard(): VueWrapper {
    wrapper = mount(DashboardView, { global: { plugins: [router] } })
    return wrapper
  }

  it('shows a loading skeleton on first render', () => {
    stubFetch()
    const view = mountDashboard()

    expect(view.find('[aria-label="Cargando panel"]').exists()).toBe(true)
  })

  it('renders KPIs, status alert and the user table', async () => {
    stubFetch()
    const view = mountDashboard()
    await flushPromises()

    expect(view.text()).toContain('Acme Corporation')
    expect(view.text()).toContain('81.220')
    expect(view.text()).toContain('Te acercas al límite contratado')
    expect(view.text()).toContain('Diego Ramos')
    expect(view.text()).toContain('1 de 2 con licencia activa')
    await vi.waitFor(() => {
      expect(view.find('.line-stub').exists()).toBe(true)
    })
  })

  it('assigns a license to an unlicensed user', async () => {
    const fetchMock = stubFetch()
    const view = mountDashboard()
    await flushPromises()

    const diegoRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    const assignButton = diegoRow?.find('button')
    expect(assignButton?.text()).toBe('Asignar')
    await assignButton?.trigger('click')
    await flushPromises()

    const assignCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/licenses/assign'),
    )
    expect(assignCall).toBeDefined()
    expect(String(assignCall?.[1]?.body)).toContain('u2')
    expect(view.text()).not.toContain('Sin licencia')

    const updatedRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    expect(updatedRow?.text()).toContain('Activa')
    expect(updatedRow?.find('button').text()).toBe('Desasignar')
  })

  it('revokes an active license', async () => {
    const fetchMock = stubFetch()
    const view = mountDashboard()
    await flushPromises()

    const anaRow = view.findAll('tbody tr').find((row) => row.text().includes('Ana Admin'))
    const revokeButton = anaRow?.find('button')
    expect(revokeButton?.text()).toBe('Desasignar')
    await revokeButton?.trigger('click')
    await flushPromises()

    const revokeCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/licenses/revoke'),
    )
    expect(revokeCall).toBeDefined()
    expect(String(revokeCall?.[1]?.body)).toContain('u1')

    const updatedRow = view.findAll('tbody tr').find((row) => row.text().includes('Ana Admin'))
    expect(updatedRow?.text()).toContain('Sin licencia')
    expect(updatedRow?.find('button').text()).toBe('Asignar')
  })

  it('updates a user role through the inline selector', async () => {
    const fetchMock = stubFetch()
    const view = mountDashboard()
    await flushPromises()

    const diegoRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    const select = diegoRow?.find('select')
    expect(select?.element.value).toBe('USER')

    await select?.setValue('ADMIN')
    await flushPromises()

    const roleCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/role'))
    expect(roleCall).toBeDefined()
    expect(String(roleCall?.[1]?.body)).toContain('ADMIN')

    const updatedRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    expect(updatedRow?.find('select').element.value).toBe('ADMIN')
  })

  it('rolls back the role selector when the update fails', async () => {
    stubFetch({
      roleResponse: errorResponse(409, 'You cannot change your own role'),
    })
    const view = mountDashboard()
    await flushPromises()

    const diegoRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    await diegoRow?.find('select').setValue('ADMIN')
    await flushPromises()

    const updatedRow = view.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    expect(updatedRow?.find('select').element.value).toBe('USER')
    expect(view.find('[role="alert"]').text()).toContain('You cannot change your own role')
  })

  it('switches admins to the personal consumption tab', async () => {
    const fetchMock = stubFetch()
    const view = mountDashboard()
    await flushPromises()

    const personalTab = view.findAll('[role="tab"]').find((tab) => tab.text() === 'Mi consumo')
    expect(personalTab).toBeDefined()
    await personalTab?.trigger('click')

    await vi.waitFor(() => {
      expect(view.text()).toContain('Llamadas · 30 días')
    })
    expect(view.text()).toContain('1240')
    expect(view.text()).not.toContain('Acme Corporation')

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.endsWith('/usage/me'))).toBe(true)
  })

  it('shows only personal consumption for regular users', async () => {
    useAuthStore().user = { ...admin, role: 'USER' }
    const fetchMock = stubFetch()
    const view = mountDashboard()
    await flushPromises()

    expect(view.find('[role="tablist"]').exists()).toBe(false)
    expect(view.find('tbody').exists()).toBe(false)

    await vi.waitFor(() => {
      expect(view.text()).toContain('Mi consumo')
      expect(view.text()).toContain('1240')
    })

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.endsWith('/usage'))).toBe(false)
    expect(urls.some((url) => url.endsWith('/users'))).toBe(false)
  })

  it('shows a retryable error state when loading fails', async () => {
    stubFetch({ usageResponse: errorResponse(500, 'Database unreachable') })
    const view = mountDashboard()
    await flushPromises()

    expect(view.find('[role="alert"]').text()).toContain('No se pudo cargar el panel')
    expect(view.text()).toContain('Database unreachable')
    expect(view.find('[role="alert"] button').text()).toBe('Reintentar')
  })

  it('ends the session and redirects when requests return 401', async () => {
    stubFetch({ usageResponse: errorResponse(401, 'Unauthorized') })
    mountDashboard()
    await flushPromises()

    expect(useAuthStore().isAuthenticated).toBe(false)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  it('polls usage, skips company refresh on the personal tab and stops after unmount', async () => {
    const fetchMock = stubFetch()
    vi.useFakeTimers()

    const view = mountDashboard()
    await vi.advanceTimersByTimeAsync(0)
    expect(view.text()).toContain('Acme Corporation')

    const callsAfterLoad = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad + 1)
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(String(lastCall?.[0])).toContain('/usage')

    const personalTab = view.findAll('[role="tab"]').find((tab) => tab.text() === 'Mi consumo')
    await personalTab?.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const callsAfterTab = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)

    const newCalls = fetchMock.mock.calls.slice(callsAfterTab).map(([url]) => String(url))
    expect(newCalls.some((url) => url.endsWith('/usage'))).toBe(false)
    expect(newCalls.some((url) => url.endsWith('/usage/me'))).toBe(true)

    view.unmount()
    wrapper = undefined
    const countAfterUnmount = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchMock.mock.calls.length).toBe(countAfterUnmount)
  })
})
