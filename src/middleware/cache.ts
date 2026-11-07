import type { Context, MiddlewareHandler } from 'hono';

import type { AppEnv } from '@/types';

const CACHE_STATUS_HEADER = 'X-Cache';
const CACHE_HIT = 'HIT';
const CACHE_MISS = 'MISS';

type CacheKeyResolver = (c: Context<AppEnv>) => Request | null | Promise<Request | null>;
type CachePredicate = (response: Response, c: Context<AppEnv>) => boolean | Promise<boolean>;
type CacheEnabledPredicate = (c: Context<AppEnv>) => boolean | Promise<boolean>;

type CacheOptions = {
	ttl: number;
	enabled?: CacheEnabledPredicate;
	key?: CacheKeyResolver;
	shouldCache?: CachePredicate;
	stripHeaders?: string[];
};

export function cache(options: CacheOptions): MiddlewareHandler<AppEnv> {
	const cacheControl = `public, max-age=${options.ttl}`;

	return async (c, next) => {
		if (options.enabled && !(await options.enabled(c))) {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		const cacheKey = await (options.key ?? createDefaultCacheKey)(c);
		if (!cacheKey) {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		const cachedResponse = await caches.default.match(cacheKey);
		if (cachedResponse) {
			const headers = new Headers(cachedResponse.headers);
			headers.set('Cache-Control', cacheControl);
			headers.set(CACHE_STATUS_HEADER, CACHE_HIT);

			return stripCorsHeaders(cachedResponse);
		}

		await next();

		c.header(CACHE_STATUS_HEADER, CACHE_MISS);

		const shouldCache = await (options.shouldCache ?? cacheSuccessfulResponses)(c.res, c);

		if (!shouldCache) {
			return;
		}

		c.header('Cache-Control', cacheControl);

		const responseToCache = stripCorsHeaders(c.res.clone());
		responseToCache.headers.delete(CACHE_STATUS_HEADER);

		for (const header of options.stripHeaders ?? []) {
			responseToCache.headers.delete(header);
		}

		c.executionCtx.waitUntil(caches.default.put(cacheKey, responseToCache));
	};
}

function createDefaultCacheKey(c: Context<AppEnv>) {
	if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
		return null;
	}

	return new Request(c.req.url, { method: 'GET' });
}

function cacheSuccessfulResponses(response: Response) {
	return response.ok;
}

function stripCorsHeaders(response: Response): Response {
	const headers = new Headers(response.headers);

	// Remove all CORS headers from cached responses.
	for (const name of [...headers.keys()]) {
		if (name.toLowerCase().startsWith('access-control-')) {
			headers.delete(name);
		}
	}

	// Remove Origin from Vary to avoid duplicated Vary: Origin.
	const vary = headers.get('Vary');

	if (vary) {
		const values = vary
			.split(',')
			.map((value) => value.trim())
			.filter((value) => value.toLowerCase() !== 'origin');

		if (values.length > 0) {
			headers.set('Vary', values.join(', '));
		} else {
			headers.delete('Vary');
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
