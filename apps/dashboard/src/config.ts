/** API base URL, set per environment via VITE_API_URL. */
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';
/** Base URL shown in code examples. */
export const PUBLIC_API_URL: string = import.meta.env.VITE_PUBLIC_API_URL || API_URL;
/** Public website (profiles at /@username, model sites at /s/<slug>). */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'http://localhost:5173';
/** Domain whose subdomains host portfolio sites, e.g. naveen.layerto.com. */
export const ROOT_DOMAIN: string = import.meta.env.VITE_ROOT_DOMAIN || 'layerto.com';
