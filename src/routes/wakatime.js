/**
 * Cloudflare Worker for proxying WakaTime API requests with 30-min cache.
 */

const CACHE_TTL = 1800; // 30分鐘（秒）

const handler = {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname !== '/wakatime_sh') {
			return new Response('Not Found', { status: 404 });
		}

		const wakaPath = url.searchParams.get('path');
		if (!wakaPath) {
			return new Response("Missing 'path' parameter", { status: 400 });
		}

		let wakaUrl = `https://wakatime.com${wakaPath}`;
		const params = [...url.searchParams.entries()]
			.filter(([k]) => k !== 'path')
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');
		if (params) wakaUrl += (wakaPath.includes('?') ? '&' : '?') + params;

		const apiKey = env.WAKATIME_API_KEY || '';
		if (!apiKey) {
			return new Response('Missing API Key', { status: 400 });
		}

		// 產生快取 key（可用 request.url）
		const cacheKey = new Request(request.url, request);

		// 嘗試取得快取
		let response = await caches.default.match(cacheKey);
		if (response) {
			return response;
		}

		const proxyHeaders = new Headers(request.headers);
		proxyHeaders.delete('host');
		proxyHeaders.set('Authorization', 'Basic ' + btoa(apiKey));

		const method = request.method || 'GET';
		const reqInit = {
			method,
			headers: proxyHeaders,
			body: ['POST', 'PUT', 'PATCH'].includes(method) ? await request.text() : undefined,
		};

		const wakaResp = await fetch(wakaUrl, reqInit);

		// 讀取回應內容
		const respBody = await wakaResp.text();

		// 建立新的 Response 並設定快取 header
		response = new Response(respBody, {
			status: wakaResp.status,
			headers: wakaResp.headers,
		});
		response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);

		// 寫入快取
		ctx.waitUntil(caches.default.put(cacheKey, response.clone()));

		return response;
	},
};

export default handler;
