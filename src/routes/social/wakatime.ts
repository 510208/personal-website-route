import { Hono } from 'hono';

import { cache } from '@/middleware/cache';
import { sanitizeUpstreamHeaders } from '@/utils/response';
import type { AppEnv } from '@/types';

const WAKATIME_URL = 'https://wakatime.com/api/v1/users/SamHacker/all_time_since_today';
const ROUTE_PATH = '/wakatime_sh';
const CACHE_TTL = 1800;

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
	const url = new URL(c.req.url);

	if (url.pathname !== ROUTE_PATH) {
		return c.text('Not Found', 404);
	}

	if (c.req.method !== 'GET') {
		c.header('Allow', 'GET');
		return c.text('Method Not Allowed', 405);
	}

	if (url.searchParams.size > 0) {
		return c.text('Query parameters are not supported', 400);
	}

	if (!c.env.WAKATIME_API_KEY) {
		return c.text('Missing API Key', 400);
	}

	await next();
});

app.use('*', cache({ ttl: CACHE_TTL }));

app.get('*', async (c) => {
	let response: Response;

	try {
		response = await fetch(WAKATIME_URL, {
			method: 'GET',
			headers: {
				Authorization: `Basic ${btoa(c.env.WAKATIME_API_KEY)}`,
			},
			redirect: 'error',
		});
	} catch {
		return c.text('WakaTime upstream request failed', 502);
	}

	const body = await response.text();
	const headers = sanitizeUpstreamHeaders(response.headers);

	return new Response(body, {
		status: response.status,
		headers,
	});
});

export default app;
