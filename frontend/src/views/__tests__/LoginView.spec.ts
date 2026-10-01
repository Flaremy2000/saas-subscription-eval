import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TOKEN_STORAGE_KEY } from '@/api/client'
import router from '@/router'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'

const admin: AuthUser = {
  id: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'company-1',
}

function loginPayload(): unknown {
  return { accessToken: 'jwt-token', tokenType: 'Bearer', user: admin }
}

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response
}

async function mountView(): Promise<VueWrapper> {
  await router.push('/login')
  return mount(LoginView, { global: { plugins: [router] } })
}

async function fillCredentials(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('input#email').setValue('admin@empresa.com')
  await wrapper.find('input#password').setValue('Password123!')
}

describe('login view', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the login form', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('input#email').exists()).toBe(true)
    expect(wrapper.find('input#password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Ingresar')
  })

  it('validates required fields before calling the API', async () => {
    const fetchMock = vi.fn<() => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountView()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa tu correo y contraseña.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs in and navigates to the dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(jsonResponse(loginPayload())),
    )

    const wrapper = await mountView()
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })

  it('honors safe redirect targets after login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(jsonResponse(loginPayload())),
    )
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = await mountView()
    await router.push('/login?redirect=/custom')
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/custom')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })

  it('ignores unsafe redirect targets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(jsonResponse(loginPayload())),
    )
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = await mountView()
    await router.push({ path: '/login', query: { redirect: '//evil.example' } })
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })

  it('shows a localized error when credentials are rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<() => Promise<Response>>()
        .mockResolvedValue(
          jsonResponse({ statusCode: 401, message: 'Invalid credentials' }, 401, 'Unauthorized'),
        ),
    )

    const wrapper = await mountView()
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('Credenciales inválidas.')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('disables the submit button while the request is pending', async () => {
    let resolveRequest: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
      ),
    )

    const wrapper = await mountView()
    await fillCredentials(wrapper)

    const submission = wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Ingresando…')

    resolveRequest(jsonResponse(loginPayload()))
    await submission
    await flushPromises()

    expect(button.attributes('disabled')).toBeUndefined()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })
})
