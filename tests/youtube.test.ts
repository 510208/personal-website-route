import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import youtube from '../src/routes/social/youtube';
import { createProxyTestContext } from './helpers/proxy';

const ROUTE = '/youtube/v3/channels';
const CHANNEL_ID = 'UC6orwHdQNVzwHsA6M7HYD9g';
const QUERY = `id=${CHANNEL_ID}&part=statistics,id`;
const REQUEST_PATH = `${ROUTE}?${QUERY}`;
let context: ReturnType<typeof createProxyTestContext>;

beforeEach(() => {
	context = createProxyTestContext('/youtube/v3', youtube);
});
afterEach(async () => {
	await context.cleanup();
});

describe('YouTube endpoint allowlist', () => {
	it('returns statistics for the configured channel using the server API key', async () => {
		const response = await context.request(REQUEST_PATH);
		const [input, options] = context.upstream.mock.calls[0]!;
		const url = new URL(String(input));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: 'upstream result' });
		expect(url.origin + url.pathname).toBe('https://www.googleapis.com/youtube/v3/channels');
		expect(Object.fromEntries(url.searchParams)).toEqual({ id: CHANNEL_ID, part: 'statistics,id', key: 'youtube-test-key' });
		expect(options).toEqual({ method: 'GET', redirect: 'error' });
	});

	it('accepts a different query order and URL-encoded commas', async () => {
		const response = await context.request(`${ROUTE}?part=statistics%2Cid&id=${CHANNEL_ID}`);

		expect(response.status).toBe(200);
		expect(context.upstream).toHaveBeenCalledTimes(1);
	});

	it.each([
		['missing parameters', ''],
		['missing part', `id=${CHANNEL_ID}`],
		['missing channel', 'part=statistics,id'],
		['different channel', 'id=another-channel&part=statistics,id'],
		['multiple channels', `id=${CHANNEL_ID},another-channel&part=statistics,id`],
		['different parts', `id=${CHANNEL_ID}&part=snippet`],
		['additional parameter', `${QUERY}&maxResults=50`],
		['client API key', `${QUERY}&key=client-key`],
		['duplicate channel', `${QUERY}&id=another-channel`],
		['duplicate part', `${QUERY}&part=snippet`],
		['duplicate allowed value', `${QUERY}&id=${CHANNEL_ID}`],
		['alternate selector', 'mine=true&part=statistics,id'],
	])('rejects %s before cache lookup', async (_, query) => {
		const path = `${ROUTE}?${query}`;
		context.seedCache(path);
		const response = await context.request(path);

		expect(response.status).toBe(400);
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it.each(['/youtube/v3', '/youtube/v3/search', '/youtube/v3/videos', '/youtube/v3/channels/extra', '/youtube/v3/channels/'])(
		'rejects unlisted route %s even if it is cached',
		async (path) => {
			context.seedCache(path);
			const response = await context.request(path);

			expect(response.status).toBe(404);
			expect(context.cacheMatch).not.toHaveBeenCalled();
			expect(context.upstream).not.toHaveBeenCalled();
		},
	);

	it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])('rejects %s requests', async (method) => {
		context.seedCache(REQUEST_PATH);
		const response = await context.request(REQUEST_PATH, { method });

		expect(response.status).toBe(405);
		expect(response.headers.get('Allow')).toBe('GET');
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it('requires the server API key before cache lookup', async () => {
		context.seedCache(REQUEST_PATH);
		const response = await context.request(REQUEST_PATH, undefined, { YOUTUBE_DATA_API_KEY: '' });

		expect(response.status).toBe(400);
		expect(context.cacheMatch).not.toHaveBeenCalled();
		expect(context.upstream).not.toHaveBeenCalled();
	});

	it('caches successful responses for 30 minutes', async () => {
		await context.request(REQUEST_PATH);
		await context.flushCache();
		const response = await context.request(REQUEST_PATH);

		expect(response.headers.get('X-Cache')).toBe('HIT');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=1800');
		expect(context.upstream).toHaveBeenCalledTimes(1);
	});

	it('preserves upstream errors without caching them', async () => {
		context.upstream.mockResolvedValueOnce(Response.json({ error: 'quotaExceeded' }, { status: 403 }));
		const response = await context.request(REQUEST_PATH);
		await context.flushCache();

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'quotaExceeded' });
		expect(context.cachePut).not.toHaveBeenCalled();
	});

	it('sets local CORS and JSON headers and removes stale body metadata', async () => {
		context.upstream.mockResolvedValueOnce(
			new Response('{}', {
				headers: { 'Access-Control-Allow-Origin': '*', 'Content-Length': '999', 'Content-Encoding': 'gzip' },
			}),
		);
		const response = await context.request(REQUEST_PATH);

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://samhacker.xyz');
		expect(response.headers.get('Content-Type')).toBe('application/json; charset=UTF-8');
		expect(response.headers.has('Content-Length')).toBe(false);
		expect(response.headers.has('Content-Encoding')).toBe(false);
	});

	it('returns 502 without caching redirect failures', async () => {
		context.upstream.mockRejectedValueOnce(new TypeError('Redirect rejected'));
		const response = await context.request(REQUEST_PATH);
		await context.flushCache();

		expect(response.status).toBe(502);
		expect(context.upstream.mock.calls[0]?.[1]?.redirect).toBe('error');
		expect(context.cachePut).not.toHaveBeenCalled();
	});

	it.each([400, 401, 403, 429, 500])('does not cache upstream HTTP %i responses', async (status) => {
		context.upstream.mockResolvedValueOnce(Response.json({ error: 'upstream error' }, { status }));

		const response = await context.request(REQUEST_PATH);

		expect(response.status).toBe(status);

		await context.flushCache();

		expect(context.cachePut).not.toHaveBeenCalled();
	});

	it.each(['foo=bar', 'api_key=attacker-key', 'Authorization=Basic%20attacker', 'user=someone-else&foo=bar'])(
		'rejects unknown query parameters: %s',
		async (query) => {
			const path = `${ROUTE}?${query}`;

			const response = await context.request(path);

			expect(response.status).toBe(400);
			expect(context.cacheMatch).not.toHaveBeenCalled();
			expect(context.upstream).not.toHaveBeenCalled();
		},
	);

	it('does not forward client headers to Google', async () => {
		await context.request(REQUEST_PATH, {
			headers: {
				Authorization: 'Bearer attacker-token',
				Cookie: 'session=attacker',
				'X-Forwarded-For': '127.0.0.1',
			},
		});

		const [, options] = context.upstream.mock.calls[0]!;

		expect(options).toEqual({
			method: 'GET',
			redirect: 'error',
		});
	});

	it('rejects non-JSON upstream responses', async () => {
		context.upstream.mockResolvedValueOnce(
			new Response('<html>Unexpected response</html>', {
				headers: {
					'Content-Type': 'text/html',
				},
			}),
		);

		const response = await context.request(REQUEST_PATH);

		expect(response.status).toBe(502);

		await context.flushCache();

		expect(context.cachePut).not.toHaveBeenCalled();
	});

	it('never exposes the server API key in the response', async () => {
		const response = await context.request(REQUEST_PATH);
		const body = await response.text();

		expect(body).not.toContain('wakatime-test-key');
	});

	it.each([
		['HTML', '<html>Unexpected response</html>', 'text/html'],
		['invalid JSON', '{invalid json}', 'application/json'],
		['empty body', '', 'application/json'],
	])('rejects %s upstream responses', async (_, body, contentType) => {
		context.upstream.mockResolvedValueOnce(
			new Response(body, {
				headers: {
					'Content-Type': contentType,
				},
			}),
		);

		const response = await context.request(REQUEST_PATH);

		expect(response.status).toBe(502);

		await context.flushCache();

		expect(context.cachePut).not.toHaveBeenCalled();
	});
});
