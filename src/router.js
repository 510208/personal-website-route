import { Hono } from 'hono';
import { cors } from 'hono/cors';

import cwaRoute from './routes/cwa.js';
import rickRoute from './routes/rick.js';
import wakatimeRoute from './routes/wakatime.js';
import youtubeRoute from './routes/youtube.js';
import googleSearchSuggestionsRoute from './routes/googleSearchSuggestions.js';

const DEFAULT_ALLOWED_ORIGIN = 'https://510208.github.io';
const ALLOWED_ORIGINS = new Set([
	DEFAULT_ALLOWED_ORIGIN,
	'https://samhacker.xyz',
	'https://homepage.samhacker.xyz',
	'http://localhost:5173',
	'http://localhost:5174',
	'http://localhost:4173',
	'http://localhost:4174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
	'http://127.0.0.1:4173',
	'http://127.0.0.1:4174',
]);
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ALLOW_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOW_HEADERS = ['Content-Type', 'Authorization'];
const ROUTES = [
	{ prefix: '/cwa/v1', handler: cwaRoute },
	{ prefix: '/wakatime_sh', handler: wakatimeRoute },
	{ prefix: '/rick', handler: rickRoute },
	{ prefix: '/youtube/v3', handler: youtubeRoute },
	{ prefix: '/search_suggestions', handler: googleSearchSuggestionsRoute }, // Google 搜尋建議 API 代理
];

const router = new Hono();

router.use('*', async (c, next) => {
	await next();

	c.header('Access-Control-Allow-Methods', ALLOW_METHODS.join(', '));
	c.header('Access-Control-Allow-Headers', ALLOW_HEADERS.join(', '));
	c.header('Vary', 'Origin');
});

router.use(
	'*',
	cors({
		origin: (origin) => resolveAllowedOrigin(origin),
		allowMethods: ALLOW_METHODS,
		allowHeaders: ALLOW_HEADERS,
	}),
);

router.all('*', async (c) => {
	const url = new URL(c.req.url);
	const route = ROUTES.find(({ prefix }) => url.pathname.startsWith(prefix));

	if (route) {
		const result = await route.handler.handle(c.req.raw, c.env, c.executionCtx);
		return toResponse(result);
	}

	if (url.pathname === '/') {
		return c.json(getPersonalInfo());
	}

	return c.text("Not Found\nMaybe you are looking for '/', it has something about me!", 404);
});

function resolveAllowedOrigin(origin) {
	if (!origin) {
		return DEFAULT_ALLOWED_ORIGIN;
	}

	if (ALLOWED_ORIGINS.has(origin) || LOCALHOST_ORIGIN.test(origin) || origin === 'null') {
		return origin;
	}

	return DEFAULT_ALLOWED_ORIGIN;
}

function toResponse({ body = '', status = 200, headers = {} }) {
	const isJSON = typeof body === 'object';
	const responseBody = isJSON ? JSON.stringify(body) : body;
	const responseHeaders = new Headers(headers);

	if (!responseHeaders.has('Content-Type')) {
		responseHeaders.set('Content-Type', isJSON ? 'application/json' : 'text/plain');
	}

	return new Response(responseBody, { status, headers: responseHeaders });
}

function getPersonalInfo() {
	const taipeiYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));

	return {
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
}

export default router;
