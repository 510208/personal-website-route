import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import wakatime from '../src/routes/social/wakatime';
import { createProxyTestContext } from './helpers/proxy';

const ROUTE = '/wakatime_sh';
const UPSTREAM_URL = 'https://wakatime.com/api/v1/users/SamHacker/all_time_since_today';
let context: ReturnType<typeof createProxyTestContext>;

beforeEach(() => {
	context = createProxyTestContext(ROUTE, wakatime);
});
afterEach(async () => {
	await context.cleanup();
});

describe('WakaTime fixed endpoint', () => {
	it('returns the configured user’s all-time result without a path parameter', async () => {
		const response = await context.request(ROUTE);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: 'upstream result' });
		expect(context.upstream).toHaveBeenCalledExactlyOnceWith(UPSTREAM_URL, {
			method: 'GET',
			headers: { Authorization: `Basic ${btoa('wakatime-test-key')}` },
			redirect: 'error',
		});
	});

	it.each([
		['external URL', 'path=https://google.com'],
		['protocol-relative URL', 'path=//google.com'],
		['different WakaTime path', 'path=/api/v1/users/current'],
		['empty legacy path', 'path='],
		['upstream parameter override', 'user=someone-else'],
		['duplicate path parameters', 'path=/safe&path=https://google.com'],
	])('rejects %s before reading cached data', async (_, query) => {
		const path = `${ROUTE}?${query}`;
		context.seedCache(path);

		const response = await context.request(path);

		expect(response.status).toBe(400);
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])('rejects %s requests', async (method) => {
		context.seedCache(ROUTE);
		const response = await context.request(ROUTE, { method });

		expect(response.status).toBe(405);
		expect(response.headers.get('Allow')).toBe('GET');
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it('rejects subpaths', async () => {
		const response = await context.request(`${ROUTE}/api/v1/users/current`);

		expect(response.status).toBe(404);
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it('requires the server API key even when a response is cached', async () => {
		context.seedCache(ROUTE);
		const response = await context.request(ROUTE, undefined, { WAKATIME_API_KEY: '' });

		expect(response.status).toBe(400);
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it('caches successful responses for 30 minutes', async () => {
		const first = await context.request(ROUTE);
		await context.flushCache();
		const second = await context.request(ROUTE);

		expect(first.headers.get('X-Cache')).toBe('MISS');
		expect(second.headers.get('X-Cache')).toBe('HIT');
		expect(second.headers.get('Cache-Control')).toBe('public, max-age=1800');
		expect(await second.json()).toEqual({ data: 'upstream result' });
		expect(context.upstream).toHaveBeenCalledTimes(1);
	});

	it('keeps local CORS headers and removes stale body metadata', async () => {
		context.upstream.mockResolvedValueOnce(
			Response.json(
				{ data: 'result' },
				{
					headers: { 'Access-Control-Allow-Origin': 'https://wakatime.com', 'Content-Length': '999', 'Content-Encoding': 'gzip' },
				},
			),
		);
		const response = await context.request(ROUTE, {
			headers: {
				Origin: 'https://samhacker.xyz',
			},
		});

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://samhacker.xyz');
		expect(response.headers.has('Content-Length')).toBe(false);
		expect(response.headers.has('Content-Encoding')).toBe(false);
	});

	it('returns 502 without caching redirect failures', async () => {
		context.upstream.mockRejectedValueOnce(new TypeError('Redirect rejected'));
		const response = await context.request(ROUTE);
		await context.flushCache();

		expect(response.status).toBe(502);
		expect(context.upstream.mock.calls[0]?.[1]?.redirect).toBe('error');
		expect(context.cachePut).not.toHaveBeenCalled();
	});
});
