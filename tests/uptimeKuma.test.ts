import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import uptimeKuma from '../src/routes/uptimeKuma';
import { createProxyTestContext } from './helpers/proxy';

let context: ReturnType<typeof createProxyTestContext>;
const bindings = { UPTIME_KUMA_URL: 'https://status.example.com', UPTIME_KUMA_STATUS_PAGE: 'main' };

beforeEach(() => {
	context = createProxyTestContext('/uptime-kuma', uptimeKuma);
	// Mirror the Workers runtime: redirect: 'error' throws before sending a request.
	context.upstream.mockImplementation(async (_input, init) => {
		if (init?.redirect === 'error') throw new TypeError('Invalid redirect value');
		return Response.json({ ok: true });
	});
});

afterEach(async () => context.cleanup());

describe('Uptime Kuma proxy', () => {
	it('caches for 10 seconds and applies CORS separately for each request', async () => {
		const first = await context.request('/uptime-kuma/status-page', {
			headers: { Origin: 'https://samhacker.xyz' },
		}, bindings);
		await context.flushCache();
		const second = await context.request('/uptime-kuma/status-page', {
			headers: { Origin: 'https://homepage.samhacker.xyz' },
		}, bindings);
		const denied = await context.request('/uptime-kuma/status-page', {
			headers: { Origin: 'https://untrusted.example.com' },
		}, bindings);

		expect(first.headers.get('X-Cache')).toBe('MISS');
		expect(second.headers.get('X-Cache')).toBe('HIT');
		expect(second.headers.get('Cache-Control')).toBe('public, max-age=10');
		expect(first.headers.get('Access-Control-Allow-Origin')).toBe('https://samhacker.xyz');
		expect(second.headers.get('Access-Control-Allow-Origin')).toBe('https://homepage.samhacker.xyz');
		expect(denied.headers.has('Access-Control-Allow-Origin')).toBe(false);
		expect(await second.json()).toEqual({ ok: true });
		expect(context.upstream).toHaveBeenCalledTimes(1);
	});

	it.each([
		['status-page', '/api/status-page/main'],
		['heartbeat', '/api/status-page/heartbeat/main'],
	])('fetches %s with a Workers-compatible redirect mode', async (endpoint, path) => {
		const response = await context.request(`/uptime-kuma/${endpoint}`, undefined, bindings);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(String(context.upstream.mock.calls[0]?.[0])).toBe(`${bindings.UPTIME_KUMA_URL}${path}`);
		expect(context.upstream.mock.calls[0]?.[1]?.redirect).toBe('manual');
	});

	it('rejects redirects without following them', async () => {
		context.upstream.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://other.example.com' } }));
		const response = await context.request('/uptime-kuma/status-page', undefined, bindings);

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: 'Uptime Kuma upstream request failed', upstreamStatus: 302 });
		expect(context.upstream).toHaveBeenCalledTimes(1);
		expect(context.cachePut).not.toHaveBeenCalled();
	});
});
