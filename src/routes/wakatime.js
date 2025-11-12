/**
 * WakaTime API 代理 - 只負責產生回應內容
 */

const CACHE_TTL = 1800; // 30分鐘（秒）

const handler = {
	async handle(request, env, ctx) {
		const url = new URL(request.url);

		// 驗證路徑
		if (url.pathname !== '/wakatime_sh') {
			return { body: 'Not Found', status: 404 };
		}

		// 驗證參數
		const wakaPath = url.searchParams.get('path');
		if (!wakaPath) {
			return { body: "Missing 'path' parameter", status: 400 };
		}

		// 驗證 API Key
		const apiKey = env.WAKATIME_API_KEY || '';
		if (!apiKey) {
			return { body: 'Missing API Key', status: 400 };
		}

		// 建立 WakaTime URL
		let wakaUrl = `https://wakatime.com${wakaPath}`;
		const params = [...url.searchParams.entries()]
			.filter(([k]) => k !== 'path')
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');
		if (params) wakaUrl += (wakaPath.includes('?') ? '&' : '?') + params;

		// 檢查快取
		const cacheKey = new Request(request.url, request);
		let cachedResponse = await caches.default.match(cacheKey);
		if (cachedResponse) {
			const body = await cachedResponse.text();
			return {
				body: body,
				status: cachedResponse.status,
				headers: { 'Cache-Control': `public, max-age=${CACHE_TTL}` },
			};
		}

		// 代理請求
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
		const respBody = await wakaResp.text();

		// 快取回應
		const cacheResponse = new Response(respBody, {
			status: wakaResp.status,
			headers: wakaResp.headers,
		});
		cacheResponse.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
		ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

		return {
			body: respBody,
			status: wakaResp.status,
			headers: { 'Cache-Control': `public, max-age=${CACHE_TTL}` },
		};
	},
};

export default handler;
