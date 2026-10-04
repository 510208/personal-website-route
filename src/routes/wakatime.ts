import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppEnv } from '../types.js';

const CACHE_TTL = 1800;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const CORS_HEADERS = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'];
const ROUTE_PATH = '/wakatime_sh';

const app = new Hono<AppEnv>();

app.all('*', async (c) => {
	const url = new URL(c.req.url);
	if (url.pathname !== ROUTE_PATH) {
		return c.text('Not Found', 404);
	}

	const wakaPath = url.searchParams.get('path');
	if (!wakaPath) {
		return c.text("Missing 'path' parameter", 400);
	}

	const apiKey = c.env.WAKATIME_API_KEY || '';
	if (!apiKey) {
		return c.text('Missing API Key', 400);
	}

	const wakaUrl = new URL(wakaPath, 'https://wakatime.com');
	for (const [key, value] of url.searchParams.entries()) {
		if (key !== 'path') {
			wakaUrl.searchParams.append(key, value);
		}
	}

	const cacheKey = new Request(c.req.url, c.req.raw);
	const cachedResponse = await caches.default.match(cacheKey);
	if (cachedResponse) {
		const headers = new Headers({ 'Cache-Control': CACHE_CONTROL });
		return c.newResponse(await cachedResponse.text(), toContentfulStatus(cachedResponse.status), headers);
	}

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');
	proxyHeaders.set('Authorization', `Basic ${btoa(apiKey)}`);

	const method = c.req.method || 'GET';
	const wakaResp = await fetch(wakaUrl, {
		method,
		headers: proxyHeaders,
		body: BODY_METHODS.has(method) ? await c.req.text() : undefined,
	});
	const respBody = await wakaResp.text();
	const cleanedHeaders = stripCorsHeaders(wakaResp.headers);
	cleanedHeaders.set('Cache-Control', CACHE_CONTROL);

	c.executionCtx.waitUntil(
		caches.default.put(
			cacheKey,
			new Response(respBody, { status: wakaResp.status, headers: cleanedHeaders }),
		),
	);

	return c.newResponse(respBody, toContentfulStatus(wakaResp.status), new Headers({ 'Cache-Control': CACHE_CONTROL }));
});

function stripCorsHeaders(headers: Headers) {
	const cleanedHeaders = new Headers(headers);

	for (const header of CORS_HEADERS) {
		cleanedHeaders.delete(header);
	}

	return cleanedHeaders;
}

function toContentfulStatus(status: number): ContentfulStatusCode {
	return status as ContentfulStatusCode;
}

export default app;
