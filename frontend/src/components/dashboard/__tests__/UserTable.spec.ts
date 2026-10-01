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
  overrides: Partial<{
    canAssign: boolean
    assigningUserId: string | null
    updatingRoleUserId: string | null
    revokingUserId: string | null
    currentUserId: string | null
  }> = {},
): VueWrapper {
  return mount(UserTable, {
    props: {
      users,
      canAssign: true,
      assigningUserId: null,
      updatingRoleUserId: null,
      revokingUserId: null,
      currentUserId: 'u1',
      ...overrides,
    },
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
    const diegoRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    const assignButton = diegoRow?.find('button')

    expect(assignButton?.text()).toBe('Asignar')
    await assignButton?.trigger('click')

    expect(wrapper.emitted('assign')).toEqual([[users[1]]])
  })

  it('emits the target user when revoking', async () => {
    const wrapper = mountTable()
    const anaRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Ana Admin'))
    const revokeButton = anaRow?.find('button')

    expect(revokeButton?.text()).toBe('Desasignar')
    await revokeButton?.trigger('click')

    expect(wrapper.emitted('revoke')).toEqual([[users[0]]])
  })

  it('emits the new role when the selector changes', async () => {
    const wrapper = mountTable({ currentUserId: null })
    const diegoRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    const select = diegoRow?.find('select')

    await select?.setValue('ADMIN')

    expect(wrapper.emitted('changeRole')).toEqual([[users[1], 'ADMIN']])
  })

  it('keeps the selector unchanged when no new role is picked', async () => {
    const wrapper = mountTable({ currentUserId: null })
    const diegoRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))
    const select = diegoRow?.find('select')

    await select?.setValue('USER')

    expect(wrapper.emitted('changeRole')).toBeUndefined()
  })

  it('disables the selector of the current user', () => {
    const wrapper = mountTable()
    const anaRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Ana Admin'))

    expect(anaRow?.find('select').attributes('disabled')).toBeDefined()
  })

  it('disables the selector while the role is being updated', () => {
    const wrapper = mountTable({ currentUserId: null, updatingRoleUserId: 'u2' })
    const diegoRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Diego Ramos'))

    expect(diegoRow?.find('select').attributes('disabled')).toBeDefined()
  })

  it('disables the revoke button while the license is being revoked', () => {
    const wrapper = mountTable({ revokingUserId: 'u1' })
    const anaRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Ana Admin'))

    expect(anaRow?.find('button').attributes('disabled')).toBeDefined()
    expect(anaRow?.find('button').text()).toBe('Revocando…')
  })

  it('hides assignment actions for read-only viewers', () => {
    const wrapper = mountTable({ canAssign: false })

    expect(wrapper.find('select').exists()).toBe(false)
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
