import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export function createSpaServer(distDir: string, port: number): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rawUrl = req.url?.split('?')[0] || '/';
      const safePath = path.normalize(rawUrl).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(distDir, safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end('Server error');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

export async function setupMockApiRoutes(page: Page) {
  // Public Models
  await page.route('**/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          slug: 'turtle-id',
          name: 'Turtle Identification Model',
          description: 'Specialist sea turtle detection and identification with pixel bounding boxes.',
          license: 'see model card',
          is_open: true,
          price_usd: '0.002000',
          meta: {},
        },
        {
          slug: 'bioclip',
          name: 'BioCLIP Foundation Model',
          description: 'Broad biodiversity taxonomic classification and species identification.',
          license: 'see model card',
          is_open: false,
          price_usd: '0.001000',
          meta: {},
        },
      ]),
    });
  });

  // User Auth me endpoint
  await page.route('**/me', async (route) => {
    // If request comes from admin app, return admin user
    const url = route.request().url();
    const referer = route.request().headers()['referer'] || '';
    if (url.includes(':4175') || referer.includes(':4175')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-uuid-001',
          email: 'admin@layerto.test',
          name: 'Super Administrator',
          role: 'admin',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-uuid-042',
        email: 'developer@layerto.test',
        name: 'Jane Doe',
        role: 'user',
        status: 'active',
        created_at: '2026-02-15T12:00:00Z',
      }),
    });
  });

  // Balance
  await page.route('**/v1/balance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance_micro_usd: 12500000,
        balance_usd: '$12.500000',
        free_calls_used: 18,
        free_calls_limit: 50,
        free_calls_remaining: 32,
      }),
    });
  });

  // API Keys
  await page.route('**/v1/keys', async (route) => {
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON() || {};
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'key-new-123',
          name: data.name || 'test-key',
          key: 'lt_live_99f23b7c89a014e4b931fa0218de93',
          prefix: 'lt_live_99f2',
          expires_at: data.expires_at || null,
          created_at: new Date().toISOString(),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'key-uuid-1',
          name: 'production-gateway',
          prefix: 'lt_live_4a12',
          created_at: '2026-03-01T10:00:00Z',
          last_used_at: '2026-10-20T08:14:00Z',
          revoked_at: null,
          expires_at: '2027-03-01T00:00:00Z',
        },
        {
          id: 'key-uuid-2',
          name: 'local-development',
          prefix: 'lt_live_9b83',
          created_at: '2026-03-10T14:30:00Z',
          last_used_at: null,
          revoked_at: null,
          expires_at: null,
        },
        {
          id: 'key-uuid-3',
          name: 'old-staging-key',
          prefix: 'lt_live_11f8',
          created_at: '2026-01-12T09:00:00Z',
          last_used_at: '2026-02-01T12:00:00Z',
          revoked_at: '2026-02-05T12:00:00Z',
          expires_at: '2026-02-01T00:00:00Z',
        },
      ]),
    });
  });

  // Usage
  await page.route('**/v1/usage*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        from: '2026-09-20T00:00:00Z',
        to: '2026-10-21T00:00:00Z',
        total_requests: 1420,
        total_charge_micro_usd: 2450000,
        total_charge_usd: '$2.450000',
        by_model: [
          {
            model_slug: 'turtle-id',
            requests: 980,
            charge_micro_usd: 1960000,
            charge_usd: '$1.960000',
          },
          {
            model_slug: 'bioclip',
            requests: 440,
            charge_micro_usd: 490000,
            charge_usd: '$0.490000',
          },
        ],
      }),
    });
  });

  // Requests
  await page.route('**/v1/requests*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          seq: 142,
          request_id: '4b684534-1188-4ff4-bf99-2775fba1894d',
          created_at: '2026-10-21T08:12:00Z',
          model_slug: 'turtle-id',
          routed: 'direct',
          status: 'executed',
          latency_ms: 812,
          charge_micro_usd: 2000,
          charge_usd: '$0.002000',
        },
        {
          seq: 141,
          request_id: '8ef93021-9922-4110-a921-6677fba1001a',
          created_at: '2026-10-21T07:45:00Z',
          model_slug: 'bioclip',
          routed: 'auto',
          status: 'executed',
          latency_ms: 320,
          charge_micro_usd: 1000,
          charge_usd: '$0.001000',
        },
        {
          seq: 140,
          request_id: '22c10943-3321-4fa9-b881-5501fa009943',
          created_at: '2026-10-20T22:10:00Z',
          model_slug: 'turtle-id',
          routed: 'auto',
          status: 'pending',
          latency_ms: 0,
          charge_micro_usd: 2000,
          charge_usd: '$0.002000',
        },
        {
          seq: 139,
          request_id: '11002233-4455-6677-8899-aabbccddeeff',
          created_at: '2026-10-20T20:00:00Z',
          model_slug: 'turtle-id',
          routed: 'direct',
          status: 'failed',
          latency_ms: 45,
          charge_micro_usd: 0,
          charge_usd: '$0.000000',
        },
      ]),
    });
  });

  // Playground Vision inference
  await page.route('**/api/playground/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request_id: '99221100-aacc-4455-9988-112233445566',
        model: 'turtle-id',
        routed: 'direct',
        predictions: [
          {
            label: 'Chelonia mydas',
            confidence: 0.96,
            bbox: [100, 80, 250, 180],
            extra: { individual_id: 'turtle-042' },
          },
          {
            label: 'Carapace marking',
            confidence: 0.82,
            bbox: [140, 110, 180, 130],
            extra: { pattern: 'radial' },
          },
        ],
        model_version: '2026.10.1',
        latency_ms: 812,
        charge_usd: '$0.002000',
      }),
    });
  });

  // Admin users list & detail
  await page.route('**/admin/users*', async (route) => {
    const url = route.request().url().split('?')[0];
    const segments = url.split('/');
    const lastSeg = segments[segments.length - 1];

    if (lastSeg && lastSeg !== 'users' && lastSeg !== 'approve' && lastSeg !== 'suspend' && lastSeg !== 'credit') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: lastSeg,
          email: 'developer@layerto.test',
          name: 'Jane Doe',
          role: 'user',
          status: 'active',
          created_at: '2026-02-15T12:00:00Z',
          balance_usd: '12.500000',
          free_calls_used: 18,
          active_keys: 2,
          requests_30d: 1420,
          spend_30d_usd: '2.450000',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'u-1',
          email: 'admin@layerto.test',
          name: 'Administrator',
          role: 'admin',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-2',
          email: 'developer@layerto.test',
          name: 'Jane Doe',
          role: 'user',
          status: 'active',
          created_at: '2026-02-15T12:00:00Z',
        },
        {
          id: 'u-3',
          email: 'newbie@university.edu',
          name: 'Alex Researcher',
          role: 'user',
          status: 'pending',
          created_at: '2026-10-21T06:00:00Z',
        },
        {
          id: 'u-4',
          email: 'bad-actor@spam.test',
          name: 'Bot',
          role: 'user',
          status: 'suspended',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]),
    });
  });

  // Admin models
  await page.route('**/admin/models*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm-1',
          slug: 'turtle-id',
          name: 'Turtle Identification Model',
          description: 'Specialist sea turtle detection and identification with pixel bounding boxes.',
          license: 'see model card',
          is_open: true,
          price_per_call: 2000,
          price_per_call_usd: '$0.002000',
          enabled: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'm-2',
          slug: 'bioclip',
          name: 'BioCLIP Foundation Model',
          description: 'Broad biodiversity taxonomic classification and species identification.',
          license: 'see model card',
          is_open: false,
          price_per_call: 1000,
          price_per_call_usd: '$0.001000',
          enabled: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
  });

  // Admin routes
  await page.route('**/admin/routes*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'r-1',
          keyword: 'sea turtle',
          priority: 10,
          model_id: 'm-1',
          model_slug: 'turtle-id',
          model_name: 'Turtle Identification Model',
          model_enabled: true,
        },
        {
          id: 'r-2',
          keyword: 'hawksbill',
          priority: 20,
          model_id: 'm-1',
          model_slug: 'turtle-id',
          model_name: 'Turtle Identification Model',
          model_enabled: true,
        },
        {
          id: 'r-3',
          keyword: 'කැස්බෑවා',
          priority: 5,
          model_id: 'm-1',
          model_slug: 'turtle-id',
          model_name: 'Turtle Identification Model',
          model_enabled: true,
        },
      ]),
    });
  });

  // Admin stats
  await page.route('**/admin/stats*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: { pending: 1, active: 2, suspended: 1 },
        models: { enabled: 2, disabled: 0 },
        routes: 3,
        requests_24h: 48,
        revenue_30d_micro_usd: 2450000,
        revenue_30d_usd: '2.450000',
      }),
    });
  });

  // Admin events
  await page.route('**/admin/events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          seq: 105,
          type: 'request.executed',
          created_at: '2026-10-21T08:12:00Z',
          user_email: 'developer@layerto.test',
          request_id: '4b684534-1188-4ff4-bf99-2775fba1894d',
          model_slug: 'turtle-id',
        },
        {
          seq: 104,
          type: 'request.received',
          created_at: '2026-10-21T08:11:59Z',
          user_email: 'developer@layerto.test',
          request_id: '4b684534-1188-4ff4-bf99-2775fba1894d',
          model_slug: 'turtle-id',
        },
        {
          seq: 103,
          type: 'credit.added',
          created_at: '2026-10-20T14:00:00Z',
          user_email: 'developer@layerto.test',
        },
        {
          seq: 102,
          type: 'user.approved',
          created_at: '2026-10-19T10:00:00Z',
          user_email: 'alex@university.edu',
        },
      ]),
    });
  });

  // Admin ledger verify
  await page.route('**/admin/ledger/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        checked: 184,
      }),
    });
  });
}
