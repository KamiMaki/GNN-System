/**
 * Sanitize a route parameter to prevent code injection attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Returns empty string if the value contains invalid characters.
 */
export function sanitizeRouteParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== 'string') return '';
  const sanitized = raw.replace(/[^a-zA-Z0-9\-_]/g, '');
  return sanitized;
}
