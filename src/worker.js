/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	route_map: {
		'/wakatime': './routes/wakatime.js',
		// 可在此處擴充更多路由
	},

	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		// 標準化路徑 (去尾 slash，並用小寫比較)
		const normalize = (p) => {
			if (!p) return '/';
			let out = p.toLowerCase();
			if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
			return out;
		};
		const reqPath = normalize(url.pathname);
		// 先嘗試標準化後精準比對，若無，再嘗試前綴比對（允許子路徑）
		let modulePath = undefined;
		for (const key of Object.keys(this.route_map)) {
			const normKey = normalize(key);
			if (reqPath === normKey) {
				modulePath = this.route_map[key];
				break;
			}
		}

		if (modulePath) {
			try {
				// 以 import.meta.url 與 new URL 解析相對路徑，避免找不到模組
				const routeModule = await import(new URL(modulePath, import.meta.url).href);
				if (routeModule && routeModule.default && typeof routeModule.default.fetch === 'function') {
					return routeModule.default.fetch(request, env, ctx);
				}
				console.error('Route module loaded but has no default.fetch handler:', modulePath);
				return new Response('Route handler not found', { status: 500 });
			} catch (err) {
				console.error('Failed to import route module:', modulePath, err);
				return new Response('Internal Server Error', { status: 500 });
			}
		}
		// 其他路徑可擴充
		return new Response('Not Found', { status: 404 });
	},
};
