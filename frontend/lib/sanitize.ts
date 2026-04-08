/**
 * Sanitize a dynamic route parameter from useParams() to prevent code injection.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Fortify: Dynamic code evaluation - Code Injection mitigation.
 */
const SAFE_PARAM_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function sanitizeParam(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw || typeof raw !== 'string') return '';
    if (!SAFE_PARAM_PATTERN.test(raw)) return '';
    return raw;
}
