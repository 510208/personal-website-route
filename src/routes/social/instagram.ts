import { Hono } from 'hono';

import { cache } from '@/middleware/cache';
import type { AppEnv } from '@/types';

const CACHE_TTL = 10000;

const app = new Hono<AppEnv>();

app.get(
	'/account',
	cache({
		ttl: CACHE_TTL,
	}),
	async (c) => {
		const content = await c.env.THREADS_STORE.get('INSTAGRAM_DATA');
		if (!content) {
			return c.json(
				{
					error: 'INSTAGRAM_DATA_NOT_FOUND',
					message: 'Instagram data not found',
				},
				503,
			);
		}
		return c.json(JSON.parse(content));
	},
);

export default app;
