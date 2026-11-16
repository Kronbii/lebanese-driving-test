/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Comma-separated hosts that serve the generic app (others may be school custom domains). */
  readonly VITE_APP_HOSTS?: string;
  /** Release id reported with client errors. */
  readonly VITE_RELEASE?: string;
}
