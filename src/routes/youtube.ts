import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { cache } from '../middleware/cache.js';
import type { AppEnv } from '../types.js';

const CACHE_TTL = 1800;
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

const app = new Hono<AppEnv>();

app.use(
	'*',
	cache({
		ttl: CACHE_TTL,
		enabled: (c) => Boolean(c.env.YOUTUBE_DATA_API_KEY),
		shouldCache: () => true,
	}),
);

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

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');

	const method = c.req.method || 'GET';
	const ytResp = await fetch(ytUrl, {
		method,
		headers: proxyHeaders,
		body: BODY_METHODS.has(method) ? await c.req.text() : null,
	});
	const respBody = await ytResp.text();
	const cleanedHeaders = cleanYouTubeHeaders(ytResp.headers);

	return c.newResponse(respBody, toContentfulStatus(ytResp.status), toHeaderRecord(cleanedHeaders));
});

function cleanYouTubeHeaders(headers: Headers) {
	const cleanedHeaders = new Headers(headers);

	for (const header of STRIPPED_HEADERS) {
		cleanedHeaders.delete(header);
	}

	cleanedHeaders.set('Content-Type', 'application/json; charset=UTF-8');

	return cleanedHeaders;
}

function toContentfulStatus(status: number): ContentfulStatusCode {
	return status as ContentfulStatusCode;
}

function toHeaderRecord(headers: Headers) {
	return Object.fromEntries(headers.entries());
}

export default app;
