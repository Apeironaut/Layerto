/** Public URLs, set per environment via Vite env vars. */
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';
export const DASHBOARD_URL: string = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174';
/** Example base URL shown in code samples. */
export const PUBLIC_API_URL: string = import.meta.env.VITE_PUBLIC_API_URL || API_URL;
/** Portfolio sites live at <name>.<ROOT_DOMAIN>. */
export const ROOT_DOMAIN: string = import.meta.env.VITE_ROOT_DOMAIN || 'layerto.com';
/** The main site's address, so links from a portfolio subdomain lead back to it. */
export const SITE_URL: string =
  import.meta.env.VITE_SITE_URL ||
  (window.location.hostname.endsWith(`.${ROOT_DOMAIN}`) ? `${window.location.protocol}//${ROOT_DOMAIN}` : window.location.origin);
