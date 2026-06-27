/**
 * Google 搜尋建議 API 代理 - 轉發並轉換為 JSON 格式
 */

const CACHE_TTL = 1800; // 30分鐘（秒）
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const CORS_HEADERS = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'];

const handler = {
	async handle(request, env, ctx) {
		const url = new URL(request.url);

		// 驗證路徑
		if (url.pathname !== '/search_suggestions') {
			return { body: 'Not Found', status: 404 };
		}

		// 驗證參數
		const searchPath = url.searchParams.get('q');
		if (!searchPath) {
			return { body: JSON.stringify({ error: "Missing 'q' parameter" }), status: 400, headers: { 'Content-Type': 'application/json' } };
		}

		// 建立 Google URL
		let googleUrl = `https://clients1.google.com/complete/search?hl=zh-TW&output=toolbar&q=${encodeURIComponent(searchPath)}`;

		// 檢查快取 (以原本的快取邏輯為基礎)
		const cacheKey = new Request(request.url, request);
		let cachedResponse = await caches.default.match(cacheKey);
		if (cachedResponse) {
			const body = await cachedResponse.text();
			return {
				body: body,
				status: cachedResponse.status,
				headers: {
					'Cache-Control': CACHE_CONTROL,
					'Content-Type': 'application/json; charset=utf-8',
				},
			};
		}

		// 代理請求設定
		const proxyHeaders = new Headers(request.headers);
		proxyHeaders.delete('host');

		const method = request.method || 'GET';
		const reqInit = {
			method,
			headers: proxyHeaders,
			// ✅ 修正錯誤：只有非 GET/HEAD 請求才允許讀取並帶入 body
			body: method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined,
		};

		// 1. 向 Google 發送請求取得 XML
		const googleResp = await fetch(googleUrl, reqInit);
		if (!googleResp.ok) {
			return {
				body: JSON.stringify({ error: 'Failed to fetch suggestions from Google' }),
				status: googleResp.status,
				headers: { 'Content-Type': 'application/json' },
			};
		}

		const xmlText = await googleResp.text();

		// 2. 解析 XML 並轉換成 JSON 格式
		const suggestions = parseGoogleXmlToJson(xmlText);
		const jsonResponseBody = JSON.stringify(suggestions);

		// 清理上游 headers，再快取回應
		const cleaned = stripCorsHeaders(googleResp.headers);
		const cacheResponse = new Response(jsonResponseBody, {
			status: googleResp.status,
			headers: cleaned,
		});
		cacheResponse.headers.set('Cache-Control', CACHE_CONTROL);
		cacheResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
		ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

		// 3. 回傳 JSON 回應
		return {
			body: jsonResponseBody,
			status: googleResp.status,
			headers: {
				'Cache-Control': CACHE_CONTROL,
				'Content-Type': 'application/json; charset=utf-8', // 確保瀏覽器識別為 JSON
			},
		};
	},
};

/**
 * 輕量級 Google 搜尋建議 XML 解析器
 * 原始 XML 結構：<toplevel><CompleteSuggestion><suggestion data="關鍵字"/></CompleteSuggestion>...</toplevel>
 */
function parseGoogleXmlToJson(xmlString) {
	const suggestions = [];
	// 使用正則表達式撈出所有 data="..." 裡面的值
	const regex = /<suggestion\s+data="([^"]+)"\s*\/>/g;
	let match;

	while ((match = regex.exec(xmlString)) !== null) {
		suggestions.push(match[1]);
	}

	// 回傳統一的 JSON 陣列格式
	return suggestions;
}

function stripCorsHeaders(headers) {
	const cleanedHeaders = new Headers(headers);
	for (const header of CORS_HEADERS) {
		cleanedHeaders.delete(header);
	}
	return cleanedHeaders;
}

export default handler;
