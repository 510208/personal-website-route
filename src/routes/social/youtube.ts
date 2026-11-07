import { Hono } from 'hono';

import { cache } from '@/middleware/cache';
import type { AppEnv } from '@/types';

// Every allowed request must specify its method, full route path and exact query parameters here.
const ALLOWED_ENDPOINTS = [
	{
		method: 'GET',
		path: '/youtube/v3/channels',
		query: { id: 'UC6orwHdQNVzwHsA6M7HYD9g', part: 'statistics,id' },
	},
];

const CACHE_TTL = 1800;
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

const app = new Hono<AppEnv & { Variables: { endpoint: (typeof ALLOWED_ENDPOINTS)[number] } }>();

// Validate before cache lookup so cached responses cannot bypass the allowlist.
app.use('*', async (c, next) => {
	const url = new URL(c.req.url);

	const endpoints = ALLOWED_ENDPOINTS.filter((endpoint) => endpoint.path === url.pathname);
	if (endpoints.length === 0) {
		return c.text('Not Found', 404);
	}

	const methodEndpoints = endpoints.filter((endpoint) => endpoint.method === c.req.method);
	if (methodEndpoints.length === 0) {
		c.header('Allow', [...new Set(endpoints.map((item) => item.method))].join(', '));
		return c.text('Method Not Allowed', 405);
	}

	const endpoint = methodEndpoints.find((item) => {
		const query = Object.entries(item.query);
		return url.searchParams.size === query.length && query.every(([key, value]) => url.searchParams.get(key) === value);
	});

	if (!endpoint) {
		return c.text('Query parameters are not allowed', 400);
	}

	if (!c.env.YOUTUBE_DATA_API_KEY) {
		return c.text('Missing API Key', 400);
	}

	c.set('endpoint', endpoint);
	await next();
});

app.use('*', cache({ ttl: CACHE_TTL }));

app.all('*', async (c) => {
	// Build the upstream URL from the allowlist rather than forwarding client input.
	const endpoint = c.get('endpoint');
	const url = new URL(endpoint.path, 'https://www.googleapis.com');
	url.search = new URLSearchParams(endpoint.query).toString();
	url.searchParams.set('key', c.env.YOUTUBE_DATA_API_KEY);

	let response: Response;
	try {
		response = await fetch(url, { method: endpoint.method, redirect: 'error' });
	} catch {
		return c.text('YouTube upstream request failed', 502);
	}

	if (!response.ok) {
		const body = await response.text();
		const headers = new Headers(response.headers);

		for (const header of STRIPPED_HEADERS) {
			headers.delete(header);
		}

		return new Response(body, {
			status: response.status,
			headers,
		});
	}

	let body: unknown;

	try {
		body = await response.json();
	} catch {
		return c.text('YouTube returned an invalid JSON response', 502);
	}

	const headers = new Headers(response.headers);

	for (const header of STRIPPED_HEADERS) {
		headers.delete(header);
	}

	headers.set('Content-Type', 'application/json; charset=UTF-8');

	return new Response(JSON.stringify(body), {
		status: response.status,
		headers,
	});
});

export default app;
