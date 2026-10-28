/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Stadia style name; see MAP_STYLES in src/lib/map-tiles.ts */
  readonly VITE_MAP_STYLE?: string
  /** Optional. Only needed where Stadia domain auth can't be used. Ships in the bundle. */
  readonly VITE_STADIA_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
