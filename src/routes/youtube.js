/**
 * YouTube API 代理 - 只負責產生回應內容
 */

const CACHE_TTL = 1800; // 30分鐘（秒)
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

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
			return {
				body: body,
				status: cachedResponse.status,
				headers: toPlainHeaders(cleanYouTubeHeaders(cachedResponse.headers)),
			};
		}

		// 代理請求
		const proxyHeaders = new Headers(request.headers);
		proxyHeaders.delete('host');

		const method = request.method || 'GET';
		const reqInit = {
			method,
			headers: proxyHeaders,
			body: BODY_METHODS.has(method) ? await request.text() : undefined,
		};

		const ytResp = await fetch(ytUrl, reqInit);
		// 讀取文字內容（YouTube Data API 是 JSON），然後複製並清理 headers 再快取／回傳
		const respBody = await ytResp.text();
		const cleanedHeaders = cleanYouTubeHeaders(ytResp.headers);

		// 快取回應（使用清理過的 headers）
		const cacheResponse = new Response(respBody, {
			status: ytResp.status,
			headers: cleanedHeaders,
		});
		ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

		return {
			body: respBody,
			status: ytResp.status,
			headers: toPlainHeaders(cleanedHeaders),
		};
	},
};

function cleanYouTubeHeaders(headers) {
	const cleanedHeaders = new Headers(headers);

	for (const header of STRIPPED_HEADERS) {
		cleanedHeaders.delete(header);
	}

	// 強制 Content-Type 為 JSON（避免出現 "text/plain, application/json; charset=UTF-8"）
	cleanedHeaders.set('Content-Type', 'application/json; charset=UTF-8');
	cleanedHeaders.set('Cache-Control', CACHE_CONTROL);

	return cleanedHeaders;
}

function toPlainHeaders(headers) {
	return Object.fromEntries(headers.entries());
}

export default handler;
