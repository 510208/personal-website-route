import { Hono } from 'hono';

import { cache } from '@/middleware/cache';
import type { AppEnv } from '@/types';

const CACHE_TTL = 3600; // 快取 1 小時（秒）

const ALLOWED_USERS = new Set(['510208']);

const app = new Hono<AppEnv>();

app.use(
	'/user/:username',
	cache({
		ttl: CACHE_TTL,
		enabled: (c) => {
			const username = c.req.param('username');
			return Boolean(username && ALLOWED_USERS.has(username));
		},
		stripHeaders: ['X-Github-Token-Used'],
	}),
);

app.get('/user/:username', async (c) => {
	const username = c.req.param('username');
	if (!username || !ALLOWED_USERS.has(username)) {
		return c.text(
			'Forbidden: This username is not allowed to fetch, this api point is not public for everyone, if you need, please contact the owner',
			403,
		);
	}

	// 設定呼叫 GitHub API 的請求標頭
	const githubHeaders = new Headers({
		'User-Agent': 'SamHacker-API-Proxy',
		Accept: 'application/vnd.github.v3+json',
	});

	// 若有設定 GITHUB_TOKEN，帶入 Authorization 標頭
	let githubTokenWasUsed = false;
	if (c.env.GITHUB_TOKEN) {
		console.log('GITHUB_TOKEN is set');
		githubHeaders.set('Authorization', `Bearer ${c.env.GITHUB_TOKEN}`);
		githubTokenWasUsed = true;
	}

	const githubResp = await fetch(`https://api.github.com/users/${username}`, {
		method: 'GET',
		headers: githubHeaders,
	});

	const respBody = await githubResp.text();

	c.header('Content-Type', 'application/json');
	c.header('Vary', 'Origin');
	c.header('X-Github-Token-Used', githubTokenWasUsed ? 'true' : 'false');

	return c.body(respBody, githubResp.status as 200);
});

export default app;
