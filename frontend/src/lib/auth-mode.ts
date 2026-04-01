/**
 * Auth mode configuration.
 *
 * AUTH_MODE determines which authentication flow to use:
 *   - "mock"     : existing mock login (default) — no external IdP needed
 *   - "keycloak" : NextAuth + Keycloak OIDC — requires AUTH_KEYCLOAK_* env vars
 *
 * To switch to Keycloak, set NEXT_PUBLIC_AUTH_MODE=keycloak in .env.local
 * and configure the AUTH_KEYCLOAK_* variables.
 */
export type AuthMode = 'mock' | 'keycloak';

export const AUTH_MODE: AuthMode =
  (process.env.NEXT_PUBLIC_AUTH_MODE as AuthMode) || 'mock';

export const isKeycloakMode = AUTH_MODE === 'keycloak';
export const isMockMode = AUTH_MODE === 'mock';
