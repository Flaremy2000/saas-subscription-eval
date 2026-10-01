import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, TOKEN_STORAGE_KEY } from '@/api/client'

function jsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response
}

function textResponse(text: string, status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(text),
  } as unknown as Response
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('requests the API base path with JSON headers', async () => {
    const fetchMock = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiFetch<{ ok: boolean }>('/usage')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/usage')
    expect(init.method).toBe('GET')
    expect((init.headers as Headers).get('Accept')).toBe('application/json')
    expect((init.headers as Headers).get('Content-Type')).toBeNull()
    expect((init.headers as Headers).get('Authorization')).toBeNull()
  })

  it('attaches the bearer token when a session exists', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-token')
    const fetchMock = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/auth/me')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('serializes request bodies as JSON', async () => {
    const fetchMock = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ id: 'license-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/licenses/assign', { method: 'POST', body: { userId: 'user-1' } })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ userId: 'user-1' }))
  })

  it('maps validation envelopes to ApiError with status and joined messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { statusCode: 400, message: ['email must be an email', 'password is too short'] },
            400,
            'Bad Request',
          ),
        ),
    )

    const failure = (await apiFetch('/auth/login', { method: 'POST', body: {} }).catch(
      (error: unknown) => error,
    )) as ApiError

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.statusCode).toBe(400)
    expect(failure.message).toBe('email must be an email password is too short')
  })

  it('falls back to HTTP status text when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<(input: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValue(textResponse('<html>bad gateway</html>', 502, 'Bad Gateway')),
    )

    const failure = (await apiFetch('/usage').catch((error: unknown) => error)) as ApiError

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.statusCode).toBe(502)
    expect(failure.message).toBe('Bad Gateway')
  })

  it('converts network failures into ApiError with status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<(input: string, init: RequestInit) => Promise<Response>>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const failure = (await apiFetch('/usage').catch((error: unknown) => error)) as ApiError

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.statusCode).toBe(0)
    expect(failure.message).toBe('No se pudo conectar con el servidor.')
  })
})
