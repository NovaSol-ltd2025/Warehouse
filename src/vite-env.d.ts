/// <reference types="vite/client" />

declare module '*.gs?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_SHEETS_API_URL?: string;
  readonly VITE_SHEETS_API_TOKEN?: string;
}
