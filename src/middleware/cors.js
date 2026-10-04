import { cors } from 'hono/cors';

const DEFAULT_ALLOWED_ORIGIN = 'https://samhacker.xyz';
const ALLOWED_ORIGINS = new Set([
	DEFAULT_ALLOWED_ORIGIN,
	'https://510208.github.io',
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

export function registerCors(app) {
	app.use('*', async (c, next) => {
		await next();

		c.header('Access-Control-Allow-Methods', ALLOW_METHODS.join(', '));
		c.header('Access-Control-Allow-Headers', ALLOW_HEADERS.join(', '));
		c.header('Vary', 'Origin');
	});

	app.use(
		'*',
		cors({
			origin: resolveAllowedOrigin,
			allowMethods: ALLOW_METHODS,
			allowHeaders: ALLOW_HEADERS,
		}),
	);
}

function resolveAllowedOrigin(origin) {
	if (!origin) {
		return DEFAULT_ALLOWED_ORIGIN;
	}

	if (ALLOWED_ORIGINS.has(origin) || LOCALHOST_ORIGIN.test(origin) || origin === 'null') {
		return origin;
	}

	return DEFAULT_ALLOWED_ORIGIN;
}
