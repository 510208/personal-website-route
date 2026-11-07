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
		const request = c.req.raw;

		// Only GET requests are eligible for caching.
		if (request.method !== 'GET') {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		// Respect request cache directives.
		const requestCacheControl = request.headers.get('Cache-Control') ?? '';
		const pragma = request.headers.get('Pragma') ?? '';

		if (/\b(no-cache|no-store)\b/i.test(requestCacheControl) || /\bno-cache\b/i.test(pragma)) {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		// Check whether caching is enabled.
		if (options.enabled && !(await options.enabled(c))) {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		// Resolve cache key.
		const cacheKey = await (options.key ?? createDefaultCacheKey)(c);

		if (!cacheKey) {
			await next();
			c.header(CACHE_STATUS_HEADER, CACHE_MISS);
			return;
		}

		// Cache HIT.
		const cachedResponse = await caches.default.match(cacheKey);

		if (cachedResponse) {
			const response = stripCorsHeaders(cachedResponse);
			const headers = new Headers(response.headers);

			headers.set('Cache-Control', cacheControl);
			headers.set(CACHE_STATUS_HEADER, CACHE_HIT);

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}

		// Cache MISS.
		await next();

		c.header(CACHE_STATUS_HEADER, CACHE_MISS);

		// Mandatory security checks.
		if (!cacheSuccessfulResponses(c.res, c)) {
			return;
		}

		// Optional route-specific cache condition.
		if (options.shouldCache && !(await options.shouldCache(c.res, c))) {
			return;
		}

		c.header('Cache-Control', cacheControl);

		// Prepare response for caching.
		const responseToCache = stripCorsHeaders(c.res.clone());

		responseToCache.headers.delete(CACHE_STATUS_HEADER);

		for (const header of options.stripHeaders ?? []) {
			responseToCache.headers.delete(header);
		}

		c.executionCtx.waitUntil(caches.default.put(cacheKey, responseToCache));
	};
}

function createDefaultCacheKey(c: Context<AppEnv>): Request | null {
	if (c.req.method !== 'GET') {
		return null;
	}

	return new Request(c.req.url, {
		method: 'GET',
	});
}

function cacheSuccessfulResponses(response: Response, context: Context<AppEnv>): boolean {
	const request = context.req.raw;

	// Only cache successful HTTP 200 responses.
	if (request.method !== 'GET' || response.status !== 200) {
		return false;
	}

	// Do not cache authenticated or cookie-based requests.
	if (request.headers.has('Authorization') || request.headers.has('Cookie')) {
		return false;
	}

	// Do not cache responses containing Set-Cookie.
	if (response.headers.has('Set-Cookie')) {
		return false;
	}

	const cacheControl = response.headers.get('Cache-Control') ?? '';

	// Respect private and no-store directives.
	if (/\b(private|no-store|no-cache)\b/i.test(cacheControl)) {
		return false;
	}

	// Vary: * responses must not be cached.
	const vary = response.headers.get('Vary') ?? '';

	if (vary.trim() === '*') {
		return false;
	}

	return true;
}

function stripCorsHeaders(response: Response): Response {
	const headers = new Headers(response.headers);

	// Remove all CORS headers from cached responses.
	for (const name of [...headers.keys()]) {
		if (name.toLowerCase().startsWith('access-control-')) {
			headers.delete(name);
		}
	}

	// Remove Origin from Vary.
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
