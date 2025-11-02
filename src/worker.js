/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// worker.js
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		// 根據路徑分派到不同 route
		if (url.pathname.startsWith('/wakatime_sh')) {
			// 動態導入對應 route
			const module = await import('./routes/wakatime.js');
			return module.default.fetch(request, env, ctx);
		}
		// 其他路徑可擴充
		return new Response('Not Found', { status: 404 });
	},
};
