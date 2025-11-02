/**
 * Cloudflare Worker for proxying WakaTime API requests with 30-min cache.
 */

const CACHE_TTL = 1800; // 30分鐘（秒）

const handler = {
	async fetch(request, env, ctx) {
		return Response.redirect('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 302);
	},
};

export default handler;
