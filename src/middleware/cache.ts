import type { Context, MiddlewareHandler } from 'hono';

import type { AppEnv } from '../types.js';

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

			return new Response(cachedResponse.body, {
				status: cachedResponse.status,
				statusText: cachedResponse.statusText,
				headers,
			});
		}

		await next();

		c.header('Cache-Control', cacheControl);
		c.header(CACHE_STATUS_HEADER, CACHE_MISS);

		const shouldCache = await (options.shouldCache ?? cacheSuccessfulResponses)(c.res, c);
		if (!shouldCache) {
			return;
		}

		const responseToCache = c.res.clone();
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
