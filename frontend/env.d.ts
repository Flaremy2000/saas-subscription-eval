/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API requests, e.g. `/api/v1` or an absolute origin. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
