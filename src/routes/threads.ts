import { Hono } from 'hono';

import { cache } from '../middleware/cache.js';
import type { AppEnv } from '../types.js';

const CACHE_TTL = 900;

const app = new Hono<AppEnv>();

interface ThreadsInsightsResponse {
	data?: Array<{
		name: string;
		total_value?: {
			value: number;
		};
		values?: Array<{
			value: number;
			end_time?: string;
		}>;
		title?: string;
		description?: string;
	}>;
	error?: {
		message?: string;
		type?: string;
		code?: number;
	};
}

app.get(
	'/account',
	cache({
		ttl: CACHE_TTL,
	}),
	async (c) => {
		try {
			// DONE: 從 Cloudflare KV 取得長期 Token
			const token = await c.env.THREADS_STORE.get('THREADS_LONG_LIVED_TOKEN');

			if (!token) {
				return c.json(
					{
						error: 'THREADS_TOKEN_NOT_FOUND',
						message: 'Threads API Token 尚未設定。',
					},
					503,
				);
			}

			// DONE: 建立 Threads Graph API 請求
			const url = new URL('https://graph.threads.net/v1.0/me/threads_insights');

			url.searchParams.set('metric', 'followers_count');
			url.searchParams.set('access_token', token);

			// DONE: 取得帳號洞察資料
			const response = await fetch(url);

			const result = (await response.json()) as ThreadsInsightsResponse;

			if (!response.ok) {
				console.error('[Threads] Graph API request failed:', {
					status: response.status,
					message: result.error?.message,
					code: result.error?.code,
				});

				return c.json(
					{
						error: 'THREADS_API_ERROR',
						message: '無法取得 Threads 帳號資訊。',
					},
					502,
				);
			}

			// DONE: 將資料回傳給客戶端
			return c.json({
				success: true,
				data: result.data ?? [],
				cached: false,
			});
		} catch (error) {
			console.error('[Threads] Failed to get account insights:', error);

			return c.json(
				{
					error: 'INTERNAL_SERVER_ERROR',
					message: '取得 Threads 帳號資訊時發生錯誤。',
				},
				500,
			);
		}
	},
);

export default app;
