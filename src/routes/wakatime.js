/**
 * Cloudflare Worker for proxying WakaTime API requests.
 */

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

		return new Response(await wakaResp.body, {
			status: wakaResp.status,
			headers: wakaResp.headers,
		});
	},
};

export default handler;
