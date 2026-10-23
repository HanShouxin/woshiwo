/// <reference types="vite/client" />

import type { WoshiwoApi } from '../../preload'

declare global {
  interface Window {
    woshiwo: WoshiwoApi
  }
}

export {}
