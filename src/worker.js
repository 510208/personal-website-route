/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
const CACHE_TTL = 3600; // seconds

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

		return new Response(JSON.stringify(personalInfo), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	},
};
