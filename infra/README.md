# Layerto Infrastructure & Deployment Guide

This directory contains configuration templates and deployment guidance for Layerto services and frontend builds (`apps/web`, `apps/dashboard`, `apps/admin`).

## 1. Security Headers (`headers.conf`)

The `infra/headers.conf` file provides baseline production security headers:
- **Content-Security-Policy (CSP):**
  - `script-src 'self'`: Disallows inline scripts completely. All JavaScript is bundled and served from same-origin static chunks.
  - `style-src 'self'`: Styles are bundled with the app. No remote stylesheet links.
  - `font-src 'self'`: System font stacks are used (`system-ui, -apple-system, sans-serif`); no third-party font calls (e.g., Google Fonts).
  - `frame-ancestors 'none'`: Prevents clickjacking and framing by any other origin.
  - `connect-src 'self' __API_ORIGIN__`: Specifies permitted API endpoints. Replace `__API_ORIGIN__` with your production API URL (e.g. `https://api.layerto.com`) at build/deploy time.
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **X-Frame-Options:** `DENY`

## 2. Single-Page Application (SPA) Fallback

All client-side routes (e.g. `/docs`, `/models/turtle-id`, `/privacy`, `/keys`, `/playground`) must be routed to `index.html` on unknown paths.

### Nginx Example:
```nginx
server {
    listen 443 ssl http2;
    server_name layerto.com;
    root /var/www/layerto/web/dist;
    index index.html;

    include /etc/nginx/conf.d/headers.conf;

    # SPA routing fallback:
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets with content hash
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### Caddy Example:
```caddyfile
layerto.com {
    root * /var/www/layerto/web/dist
    file_server

    header {
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://api.layerto.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        X-Frame-Options "DENY"
    }

    # SPA routing fallback:
    try_files {path} /index.html
}
```

## 3. Environment Variables

Frontend applications use standard Vite environment variables:
- `VITE_API_URL`: Root URL of the Layerto Core API (defaults to `http://localhost:8080`).
- `VITE_DASHBOARD_URL`: Root URL of the Layerto Dashboard (defaults to `http://localhost:5174`).
