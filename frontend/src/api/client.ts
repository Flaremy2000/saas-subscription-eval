export const TOKEN_STORAGE_KEY = 'saas.accessToken'

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/+$/, '')

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

interface ErrorEnvelope {
  statusCode?: number
  message?: string | string[]
}

export class ApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

function toMessage(message: string | string[] | undefined, fallback: string): string {
  if (typeof message === 'string' && message.length > 0) return message
  if (Array.isArray(message) && message.length > 0) return message.join(' ')
  return fallback
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options
  const headers = new Headers({ Accept: 'application/json' })

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }

  const text = await response.text()
  let payload: unknown
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = undefined
    }
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope
    const message = toMessage(envelope.message, response.statusText || `Error ${response.status}`)
    throw new ApiError(response.status, message)
  }

  return payload as T
}
