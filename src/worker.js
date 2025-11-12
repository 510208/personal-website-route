/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/**
 * 建立統一的 Response，加入 CORS 標頭
 * @param {string|object} body - 回應內容
 * @param {number} status - HTTP 狀態碼
 * @param {object} additionalHeaders - 額外的標頭
 * @param {Request} request - 原始請求物件（用於檢查 Origin）
 * @returns {Response}
 */
function createResponse(body, status = 200, additionalHeaders = {}, request = null) {
	const isJSON = typeof body === 'object';
	const responseBody = isJSON ? JSON.stringify(body) : body;

	// 允許的來源清單
	const allowedOrigins = [
		'https://510208.github.io',
		'http://localhost:5173',
		'http://localhost:5174',
		'http://localhost:4173',
		'http://localhost:4174',
		'http://127.0.0.1:5173',
		'http://127.0.0.1:5174',
		'http://127.0.0.1:4173',
		'http://127.0.0.1:4174',
	];

	// 檢查請求來源
	const origin = request?.headers.get('Origin') || '';
	const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://510208.github.io';

	const headers = {
		'Content-Type': isJSON ? 'application/json' : 'text/plain',
		'Access-Control-Allow-Origin': allowOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		...additionalHeaders,
	};

	return new Response(responseBody, { status, headers });
}

// worker.js
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 處理 OPTIONS 預檢請求
		if (request.method === 'OPTIONS') {
			return createResponse('', 204, {}, request);
		}

		// 根據路徑分派到不同 route
		if (url.pathname.startsWith('/wakatime_sh')) {
			const module = await import('./routes/wakatime.js');
			const result = await module.default.handle(request, env, ctx);
			return createResponse(result.body, result.status, result.headers || {}, request);
		}

		if (url.pathname.startsWith('/rick')) {
			const module = await import('./routes/rick.js');
			const result = await module.default.handle(request, env, ctx);
			return createResponse(result.body, result.status, result.headers || {}, request);
		}

		if (url.pathname === '/') {
			// 預設回傳個人資訊
			const taipeiYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));

			const personalInfo = {
				name: 'SamHacker',
				aka: ['510208', 'Misaka Itosana'],
				age: taipeiYear - 2010,
				location: 'Taichung, Taiwan',
				links: [
					{ github: 'https://github.com/510208' },
					{ wakatime: 'https://wakatime.com/@SamHacker' },
					{ blog: 'https://samhacker.xyz' },
					{ personal_website: 'https://510208.github.io' },
					{ bento: 'https://bento.me/510208' },
					{ threads: 'https://www.threads.com/@samhacker.xyz' },
					{ youtube: 'https://www.youtube.com/channel/UC6orwHdQNVzwHsA6M7HYD9g' },
				],
				school: 'Taichung Municipal Taichung First Senior High School',
				hobbies: ['programming', 'reading', 'gaming', 'watching anime'],
			};

			return createResponse(personalInfo, 200, {}, request);
		}

		// 預設回應
		return createResponse("Not Found\nMaybe you are looking for '/', it has something about me!", 404, {}, request);
	},
};
