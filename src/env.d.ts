// src/env.d.ts
import '@cloudflare/workers-types';

declare global {
	interface CacheStorage {
		default: Cache;
	}
}
