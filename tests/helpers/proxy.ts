import { vi } from 'vitest';
import { Hono } from 'hono';

import { registerCors } from '../../src/middleware/cors';
import type { AppEnv } from '../../src/types';

const TEST_ORIGIN = 'https://example.com';

// Each test gets independent upstream and Workers Cache API mocks.
export function createProxyTestContext<E extends AppEnv>(routePath: string, route: Hono<E>) {
	const app = new Hono<AppEnv>();
	registerCors(app);
	app.route(routePath, route);

	const bindings = { WAKATIME_API_KEY: 'wakatime-test-key', YOUTUBE_DATA_API_KEY: 'youtube-test-key' };
	const entries = new Map<string, Response>();
	const pending: Promise<unknown>[] = [];
	const upstream = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: 'upstream result' }));
	const cacheMatch = vi.fn(async (key: Request) => entries.get(key.url)?.clone());
	const cachePut = vi.fn(async (key: Request, response: Response) => {
		entries.set(key.url, response);
	});
	const executionCtx = {
		waitUntil(promise: Promise<unknown>) {
			pending.push(promise);
		},
		passThroughOnException() {},
		props: {},
	};

	vi.stubGlobal('fetch', upstream);
	vi.stubGlobal('caches', { default: { match: cacheMatch, put: cachePut } });

	return {
		upstream,
		cacheMatch,
		cachePut,
		request(path: string, init?: RequestInit, overrides: Partial<AppEnv['Bindings']> = {}) {
			return app.request(new URL(path, TEST_ORIGIN).href, init, { ...bindings, ...overrides }, executionCtx);
		},
		seedCache(path: string) {
			entries.set(new URL(path, TEST_ORIGIN).href, new Response('old cached response'));
		},
		async flushCache() {
			await Promise.all(pending);
		},
		async cleanup() {
			try {
				await Promise.all(pending);
			} finally {
				vi.unstubAllGlobals();
			}
		},
	};
}
