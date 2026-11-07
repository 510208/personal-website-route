import type { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from '@/types';

const ALLOWED_ORIGINS = new Set([
	'https://samhacker.xyz',
	'https://510208.github.io',
	'https://homepage.samhacker.xyz',

	// Development origins
	'http://localhost:5173',
	'http://localhost:5174',
	'http://localhost:4173',
	'http://localhost:4174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
	'http://127.0.0.1:4173',
	'http://127.0.0.1:4174',
]);

const ALLOW_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOW_HEADERS = ['Content-Type', 'Authorization'];

function isAllowedOrigin(origin: string | undefined): origin is string {
	return !!origin && ALLOWED_ORIGINS.has(origin);
}

export function registerCors(app: Hono<AppEnv>) {
	app.use('*', async (c, next) => {
		const origin = c.req.header('Origin');

		// 不符合白名單時，不套用 CORS middleware。
		// 瀏覽器將無法透過 CORS 讀取回應。
		if (!isAllowedOrigin(origin)) {
			return next();
		}

		return cors({
			origin,
			allowMethods: ALLOW_METHODS,
			allowHeaders: ALLOW_HEADERS,
		})(c, next);
	});
}
