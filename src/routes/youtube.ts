import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppEnv } from '../types.js';

const CACHE_TTL = 1800;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

const app = new Hono<AppEnv>();

app.all('*', async (c) => {
	const url = new URL(c.req.url);
	const apiKey = c.env.YOUTUBE_DATA_API_KEY || '';
	if (!apiKey) {
		return c.text('Missing API Key', 400);
	}

	const ytPath = url.pathname.replace(/^\/youtube\/v3/, '') || '/';
	const ytUrl = new URL(`https://www.googleapis.com/youtube/v3${ytPath}`);
	for (const [key, value] of url.searchParams.entries()) {
		ytUrl.searchParams.append(key, value);
	}
	ytUrl.searchParams.set('key', apiKey);

	const cacheKey = new Request(c.req.url, c.req.raw);
	const cachedResponse = await caches.default.match(cacheKey);
	if (cachedResponse) {
		return c.newResponse(await cachedResponse.text(), toContentfulStatus(cachedResponse.status), cleanYouTubeHeaders(cachedResponse.headers));
	}

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');

	const method = c.req.method || 'GET';
	const ytResp = await fetch(ytUrl, {
		method,
		headers: proxyHeaders,
		body: BODY_METHODS.has(method) ? await c.req.text() : undefined,
	});
	const respBody = await ytResp.text();
	const cleanedHeaders = cleanYouTubeHeaders(ytResp.headers);

	c.executionCtx.waitUntil(
		caches.default.put(cacheKey, new Response(respBody, { status: ytResp.status, headers: cleanedHeaders })),
	);

	return c.newResponse(respBody, toContentfulStatus(ytResp.status), cleanedHeaders);
});

function cleanYouTubeHeaders(headers: Headers) {
	const cleanedHeaders = new Headers(headers);

	for (const header of STRIPPED_HEADERS) {
		cleanedHeaders.delete(header);
	}

	cleanedHeaders.set('Content-Type', 'application/json; charset=UTF-8');
	cleanedHeaders.set('Cache-Control', CACHE_CONTROL);

	return cleanedHeaders;
}

function toContentfulStatus(status: number): ContentfulStatusCode {
	return status as ContentfulStatusCode;
}

export default app;
