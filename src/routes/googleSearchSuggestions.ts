import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppEnv } from '../types.js';

const CACHE_TTL = 1800;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const CORS_HEADERS = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'];
const ROUTE_PATH = '/search_suggestions';

const app = new Hono<AppEnv>();

app.all('*', async (c) => {
	const url = new URL(c.req.url);
	if (url.pathname !== ROUTE_PATH) {
		return c.text('Not Found', 404);
	}

	const searchPath = url.searchParams.get('q');
	if (!searchPath) {
		return c.json({ error: "Missing 'q' parameter" }, 400);
	}

	const googleUrl = new URL('https://clients1.google.com/complete/search');
	googleUrl.searchParams.set('hl', 'zh-TW');
	googleUrl.searchParams.set('output', 'toolbar');
	googleUrl.searchParams.set('q', searchPath);

	const cacheKey = new Request(c.req.url, c.req.raw);
	const cachedResponse = await caches.default.match(cacheKey);
	if (cachedResponse) {
		return c.newResponse(await cachedResponse.text(), toContentfulStatus(cachedResponse.status), {
			'Cache-Control': CACHE_CONTROL,
			'Content-Type': 'application/json; charset=utf-8',
		});
	}

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');
	const method = c.req.method || 'GET';
	const googleResp = await fetch(googleUrl, {
		method,
		headers: proxyHeaders,
		body: method !== 'GET' && method !== 'HEAD' ? await c.req.text() : undefined,
	});
	if (!googleResp.ok) {
		return c.json({ error: 'Failed to fetch suggestions from Google' }, toContentfulStatus(googleResp.status));
	}

	const suggestions = parseGoogleXmlToJson(await googleResp.text());
	const jsonResponseBody = JSON.stringify(suggestions);
	const cleanedHeaders = stripCorsHeaders(googleResp.headers);
	cleanedHeaders.set('Cache-Control', CACHE_CONTROL);
	cleanedHeaders.set('Content-Type', 'application/json; charset=utf-8');

	c.executionCtx.waitUntil(
		caches.default.put(
			cacheKey,
			new Response(jsonResponseBody, { status: googleResp.status, headers: cleanedHeaders }),
		),
	);

	return c.newResponse(jsonResponseBody, toContentfulStatus(googleResp.status), cleanedHeaders);
});

function parseGoogleXmlToJson(xmlString: string) {
	const suggestions: string[] = [];
	const regex = /<suggestion\s+data="([^"]+)"\s*\/>/g;
	let match;

	while ((match = regex.exec(xmlString)) !== null) {
		if (match[1] !== undefined) {
			suggestions.push(match[1]);
		}
	}

	return suggestions;
}

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
