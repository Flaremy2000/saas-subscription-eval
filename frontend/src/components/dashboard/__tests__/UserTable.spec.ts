import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UserTable from '@/components/dashboard/UserTable.vue'
import type { CompanyUser } from '@/api/types'

const users: CompanyUser[] = [
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
  {
    id: 'u3',
    email: 'pablo@empresa.com',
    name: 'Pablo Mendoza',
    role: 'USER',
    activeLicenseId: null,
    licenseAssignedAt: null,
  },
]

function mountTable(
  overrides: Partial<{ canAssign: boolean; assigningUserId: string | null }> = {},
): VueWrapper {
  return mount(UserTable, {
    props: { users, canAssign: true, assigningUserId: null, ...overrides },
  })
}

describe('user table', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders users with role and license badges', () => {
    const wrapper = mountTable()

    expect(wrapper.text()).toContain('Diego Ramos')
    expect(wrapper.text()).toContain('diego@empresa.com')
    expect(wrapper.text()).toContain('1 de 3 con licencia activa')
    expect(wrapper.text()).toContain('Activa')
    expect(wrapper.text()).toContain('Sin licencia')
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('filters users by name or email after a debounce', async () => {
    vi.useFakeTimers()
    const wrapper = mountTable()

    await wrapper.find('#user-search').setValue('diego')
    expect(wrapper.text()).toContain('Pablo Mendoza')

    await vi.advanceTimersByTimeAsync(200)

    expect(wrapper.text()).toContain('Diego Ramos')
    expect(wrapper.text()).not.toContain('Pablo Mendoza')
  })

  it('sorts by license status when the header is toggled', async () => {
    const wrapper = mountTable()
    const licenseHeader = wrapper
      .findAll('th button')
      .find((button) => button.text().includes('Licencia'))
    expect(licenseHeader).toBeDefined()

    await licenseHeader?.trigger('click')
    const ascending = wrapper.findAll('tbody tr').map((row) => row.text())
    expect(ascending[0]).toContain('Diego Ramos')
    expect(ascending[2]).toContain('Ana Admin')

    await licenseHeader?.trigger('click')
    const descending = wrapper.findAll('tbody tr').map((row) => row.text())
    expect(descending[0]).toContain('Ana Admin')
  })

  it('emits the target user when assigning', async () => {
    const wrapper = mountTable()
    const buttons = wrapper.findAll('tbody button')

    expect(buttons).toHaveLength(2)
    await buttons[0]?.trigger('click')

    expect(wrapper.emitted('assign')).toEqual([[users[1]]])
  })

  it('hides assignment actions for read-only viewers', () => {
    const wrapper = mountTable({ canAssign: false })

    expect(wrapper.findAll('tbody button')).toHaveLength(0)
    expect(wrapper.text()).toContain('—')
  })

  it('disables the button of the row being assigned', () => {
    const wrapper = mountTable({ assigningUserId: 'u2' })
    const row = wrapper
      .findAll('tbody tr')
      .find((candidate) => candidate.text().includes('Diego Ramos'))
    const button = row?.find('button')

    expect(button?.attributes('disabled')).toBeDefined()
    expect(button?.text()).toBe('Asignando…')
  })

  it('shows an empty state when nothing matches', async () => {
    vi.useFakeTimers()
    const wrapper = mountTable()

    await wrapper.find('#user-search').setValue('zzz-no-match')
    await vi.advanceTimersByTimeAsync(200)

    expect(wrapper.text()).toContain('No hay usuarios que coincidan con la búsqueda.')
  })
})
