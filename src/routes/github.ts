import { Hono } from 'hono';
import type { AppEnv } from '../types';

const CACHE_TTL = 3600; // 快取 1 小時（秒）
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;

const ALLOWED_USERS = new Set(['510208']);

const app = new Hono<AppEnv>();

app.get('/user/:username', async (c) => {
	const username = c.req.param('username');
	if (!ALLOWED_USERS.has(username)) {
		return c.text(
			'Forbidden: This username is not allowed to fetch, this api point is not public for everyone, if you need, please contact the owner',
			403,
		);
	}

	const url = new URL(c.req.url);

	// 設定 Cache Key（僅依據 URL 快取，獨立於 Request Headers）
	const cacheKey = new Request(url.toString(), { method: 'GET' });
	const cachedResponse = await caches.default.match(cacheKey);

	if (cachedResponse) {
		const body = await cachedResponse.text();
		c.header('Content-Type', 'application/json');
		c.header('Cache-Control', CACHE_CONTROL);
		c.header('Vary', 'Origin');
		return c.body(body, cachedResponse.status as 200);
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

	// 成功回應才寫入 Cloudflare Cache
	if (githubResp.ok) {
		const cacheResponse = new Response(respBody, {
			status: githubResp.status,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': CACHE_CONTROL,
				Vary: 'Origin',
			},
		});
		c.executionCtx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));
	}

	c.header('Content-Type', 'application/json');
	c.header('Cache-Control', CACHE_CONTROL);
	c.header('Vary', 'Origin');
	c.header('X-Github-Token-Used', githubTokenWasUsed ? 'true' : 'false');

	return c.body(respBody, githubResp.status as 200);
});

export default app;
