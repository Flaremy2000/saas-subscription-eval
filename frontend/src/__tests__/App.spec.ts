import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import App from '@/App.vue'

const user: AuthUser = {
  id: 'u1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'c1',
}

describe('app shell', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = undefined
    }
  })

  function mountApp(): VueWrapper {
    wrapper = mount(App, { global: { plugins: [router] } })
    return wrapper
  }

  it('hides the navigation bar for guests', () => {
    const view = mountApp()

    expect(view.find('header').exists()).toBe(false)
    expect(view.text()).not.toContain('Cerrar sesión')
  })

  it('shows the signed-in user identity', () => {
    const auth = useAuthStore()
    auth.token = 'stored-token'
    auth.user = user

    const view = mountApp()

    expect(view.find('header').exists()).toBe(true)
    expect(view.text()).toContain('SaaS Subscriptions')
    expect(view.text()).toContain('Ana Admin')
    expect(view.text()).toContain('ADMIN')
  })

  it('clears the session and navigates to login on logout', async () => {
    const auth = useAuthStore()
    auth.token = 'stored-token'
    auth.user = user

    const view = mountApp()
    const button = view.find('header button')
    expect(button.text()).toBe('Cerrar sesión')

    await button.trigger('click')
    await flushPromises()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(localStorage.getItem('saas.accessToken')).toBeNull()
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  it('renders the routed view inside the main region', async () => {
    const view = mountApp()

    expect(view.find('main').exists()).toBe(true)
    await router.push({ name: 'login' })
    await flushPromises()
    expect(view.findComponent({ name: 'LoginView' }).exists()).toBe(true)
  })
})
