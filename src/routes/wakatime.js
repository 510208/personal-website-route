/**
 * Cloudflare Worker for proxying WakaTime API requests.
 */

const handler = {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

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

		// const apiKey = env.WAKATIME_API_KEY;
		// 1) 嘗試在 env 裡找到 key 名稱 trim 後等於 WAKATIME_API_KEY（不區分大小寫）
		const getEnvValueByTrimmedKey = (envObj, targetKey) => {
			if (!envObj || typeof envObj !== 'object') return undefined;
			const target = targetKey.trim().toUpperCase();
			for (const k of Object.keys(envObj)) {
				if (k && k.trim().toUpperCase() === target) {
					const v = envObj[k];
					return typeof v === 'string' ? v.trim() : v;
				}
			}
			return undefined;
		};
		const apiKey = getEnvValueByTrimmedKey(env, 'WAKATIME_API_KEY');

		if (!apiKey) {
			// 只印出 env 的 key 名稱，避免把敏感值寫進日誌
			const envKeys =
				env && typeof env === 'object'
					? Object.keys(env)
							.map((k) => `'${k}'`)
							.join(', ')
					: '';
			console.debug(`Missing WAKATIME_API_KEY. Available env keys: [${envKeys}]`);
			return new Response('Missing API Key', { status: 400 });
		}
		const proxyHeaders = new Headers(request.headers);
		proxyHeaders.delete('host');
		// Basic auth for WakaTime: base64(apiKey + ':')
		proxyHeaders.set('Authorization', 'Basic ' + btoa(apiKey + ':'));

		const method = request.method || 'GET';
		const reqInit = {
			method,
			headers: proxyHeaders,
			body: ['POST', 'PUT', 'PATCH'].includes(method) ? await request.text() : undefined,
		};

		const wakaResp = await fetch(wakaUrl, reqInit);

		return new Response(await wakaResp.body, {
			status: wakaResp.status,
			headers: wakaResp.headers,
		});
	},
};

export default handler;
