import { Hono, type Context } from 'hono';
import type { AppEnv } from '@/types';
import { cache } from '@/middleware/cache';
import { sanitizeUpstreamHeaders } from '@/utils/response';

const app = new Hono<AppEnv>();

type Endpoint = 'status-page' | 'heartbeat';

const ENDPOINTS: Record<Endpoint, (slug: string) => string> = {
	'status-page': (slug) => `/api/status-page/${slug}`,
	heartbeat: (slug) => `/api/status-page/heartbeat/${slug}`,
};

async function fetchStatusPage(c: Context<AppEnv>, endpoint: Endpoint) {
	const baseUrl = c.env.UPTIME_KUMA_URL;
	const slug = c.env.UPTIME_KUMA_STATUS_PAGE;

	if (!baseUrl || !slug) {
		return c.json({ error: 'Uptime Kuma configuration missing' }, 503);
	}

	if (!/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
		return c.json({ error: 'Invalid status page slug' }, 500);
	}

	let upstreamUrl: URL;

	try {
		const parsed = new URL(baseUrl);

		if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
			return c.json({ error: 'Invalid Uptime Kuma URL' }, 500);
		}

		const basePath = parsed.pathname.replace(/\/+$/, '');

		upstreamUrl = new URL(`${basePath}${ENDPOINTS[endpoint](slug)}`, parsed.origin);
	} catch {
		return c.json({ error: 'Invalid Uptime Kuma URL' }, 500);
	}

	let upstream: Response | undefined;

	try {
		upstream = await fetch(upstreamUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
			// Workers supports only follow/manual; non-2xx redirects are rejected below.
			redirect: 'manual',
			signal: AbortSignal.timeout(8000),
		});

		if (!upstream.ok) {
			return c.json(
				{
					error: 'Uptime Kuma upstream request failed',
					upstreamStatus: upstream.status,
				},
				502,
			);
		}

		const contentType = upstream.headers.get('Content-Type') ?? '';

		if (!contentType.toLowerCase().includes('application/json')) {
			return c.json({ error: 'Invalid upstream content type' }, 502);
		}

		const contentLength = Number(upstream.headers.get('Content-Length'));

		if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
			return c.json({ error: 'Upstream response too large' }, 502);
		}

		const body = await upstream.text();

		if (new TextEncoder().encode(body).byteLength > 1024 * 1024) {
			return c.json({ error: 'Upstream response too large' }, 502);
		}

		let data: unknown;

		try {
			data = JSON.parse(body);
		} catch {
			return c.json({ error: 'Invalid upstream JSON' }, 502);
		}

		if (typeof data !== 'object' || data === null || Array.isArray(data)) {
			return c.json({ error: 'Unexpected upstream response' }, 502);
		}

		const headers = sanitizeUpstreamHeaders(upstream.headers);
		headers.set('Content-Type', 'application/json; charset=utf-8');
		headers.set('Cache-Control', 'public, max-age=10');

		const response = new Response(JSON.stringify(data), {
			status: 200,
			headers,
		});

		return response;
	} catch (error) {
		console.error('Uptime Kuma upstream request failed', {
			endpoint,
			error,
		});
		return c.json({ error: 'Unable to reach Uptime Kuma', target: upstreamUrl }, 502);
	}
}

app.use('*', async (c, next) => {
	if (c.req.method !== 'GET') {
		c.header('Allow', 'GET');
		return c.json({ error: 'Method Not Allowed' }, 405);
	}

	await next();
});

// CORS is registered globally in src/app.ts, outside the cache middleware,
// so cached responses receive the current request's allowed origin.
app.get('/status-page', cache({ ttl: 10 }), (c) => fetchStatusPage(c, 'status-page'));
app.get('/heartbeat', cache({ ttl: 10 }), (c) => fetchStatusPage(c, 'heartbeat'));

export default app;
