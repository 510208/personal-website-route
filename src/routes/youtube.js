/**
 * YouTube API 代理 - 只負責產生回應內容
 */

const CACHE_TTL = 1800; // 30分鐘（秒)

const handler = {
	async handle(request, env, ctx) {
		const url = new URL(request.url);

		// 驗證路徑
		if (!url.pathname.startsWith('/youtube/v3')) {
			return { body: 'Not Found', status: 404 };
		}

		// 提取 YouTube API 路徑
		let ytPath = url.pathname.replace('/youtube/v3', '') || '/';
		if (!ytPath.startsWith('/')) ytPath = '/' + ytPath;

		// 驗證 API Key
		const apiKey = env.YOUTUBE_DATA_API_KEY || '';
		if (!apiKey) {
			return { body: 'Missing API Key', status: 400 };
		}

		// 建立 YouTube URL
		let ytUrl = `https://www.googleapis.com/youtube/v3${ytPath}`;
		const params = url.searchParams.toString();
		if (params) ytUrl += '?' + params;
		// 附加 API key
		ytUrl += (params ? '&' : '?') + `key=${encodeURIComponent(apiKey)}`;

		// 檢查快取
		const cacheKey = new Request(request.url, request);
		let cachedResponse = await caches.default.match(cacheKey);
		if (cachedResponse) {
			const body = await cachedResponse.text();
			const headers = Object.fromEntries(cachedResponse.headers.entries());
			// 移除可能導致亂碼的壓縮標頭
			delete headers['content-encoding'];
			delete headers['Content-Encoding'];
			delete headers['content-length'];
			delete headers['Content-Length'];
			headers['Cache-Control'] = `public, max-age=${CACHE_TTL}`;
			return {
				body: body,
				status: cachedResponse.status,
				headers: headers,
			};
		}

		// 代理請求
		const proxyHeaders = new Headers(request.headers);
		proxyHeaders.delete('host');

		const method = request.method || 'GET';
		const reqInit = {
			method,
			headers: proxyHeaders,
			body: ['POST', 'PUT', 'PATCH'].includes(method) ? await request.text() : undefined,
		};

		const ytResp = await fetch(ytUrl, reqInit);
		// 讀取文字內容（YouTube Data API 是 JSON），然後複製並清理 headers 再快取／回傳
		const respBody = await ytResp.text();

		// 複製 headers 並移除 content-encoding / content-length，避免客戶端誤解內容編碼
		const cleanedHeaders = new Headers(ytResp.headers);
		cleanedHeaders.delete('content-encoding');
		cleanedHeaders.delete('Content-Encoding');
		cleanedHeaders.delete('content-length');
		cleanedHeaders.delete('Content-Length');
		cleanedHeaders.set('Cache-Control', `public, max-age=${CACHE_TTL}`);

		// 快取回應（使用清理過的 headers）
		const cacheResponse = new Response(respBody, {
			status: ytResp.status,
			headers: cleanedHeaders,
		});
		ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

		const headers = Object.fromEntries(cleanedHeaders.entries());
		return {
			body: respBody,
			status: ytResp.status,
			headers: headers,
		};
	},
};

export default handler;
