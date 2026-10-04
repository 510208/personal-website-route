import { Hono } from 'hono';

const CWA_API_BASE_URL = 'https://opendata.cwa.gov.tw/api/v1';
const ROUTE_PREFIX = '/cwa/v1';
const DATASTORE_PATH = '/rest/datastore/';
const CACHE_TTL = 1800;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const CACHE_STATUS_HEADER = 'X-Cache';
const DEFAULT_ALLOWED_DATASETS = ['F-D0047-073', 'F-D0047-093'];
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

const app = new Hono();

app.all('*', async (c) => {
	const url = new URL(c.req.url);
	if (!url.pathname.startsWith(ROUTE_PREFIX)) {
		return c.text('Not Found', 404);
	}

	const upstreamPath = url.pathname.slice(ROUTE_PREFIX.length) || '/';
	const datasetId = getDatasetId(upstreamPath);
	if (!datasetId) {
		return c.text('Missing dataset ID', 400);
	}

	if (!getAllowedDatasets(c.env).has(datasetId)) {
		return c.text('Dataset is not allowed', 403);
	}

	const cwaUrl = buildCwaUrl(upstreamPath, url.searchParams, c.env);
	if (!cwaUrl) {
		return c.text('Missing API Key', 400);
	}

	const cacheKey = new Request(c.req.url, c.req.raw);
	const cachedResponse = await caches.default.match(cacheKey);
	if (cachedResponse) {
		return c.newResponse(await cachedResponse.text(), cachedResponse.status, cleanCwaHeaders(cachedResponse.headers, 'HIT'));
	}

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');

	const method = c.req.method || 'GET';
	const cwaResp = await fetch(cwaUrl, {
		method,
		headers: proxyHeaders,
		body: BODY_METHODS.has(method) ? await c.req.text() : undefined,
	});
	const respBody = await cwaResp.text();
	const cleanedHeaders = cleanCwaHeaders(cwaResp.headers, 'MISS');

	c.executionCtx.waitUntil(
		caches.default.put(
			cacheKey,
			new Response(respBody, { status: cwaResp.status, headers: cleanedHeaders }),
		),
	);

	return c.newResponse(respBody, cwaResp.status, cleanedHeaders);
});

function getDatasetId(pathname) {
	if (!pathname.startsWith(DATASTORE_PATH)) {
		return '';
	}

	return pathname.slice(DATASTORE_PATH.length).split('/')[0] || '';
}

function getAllowedDatasets(env) {
	const configuredDatasets = (env.CWA_ALLOWED_DATASETS || '')
		.split(',')
		.map((dataset) => dataset.trim())
		.filter(Boolean);

	return new Set(configuredDatasets.length > 0 ? configuredDatasets : DEFAULT_ALLOWED_DATASETS);
}

function buildCwaUrl(pathname, searchParams, env) {
	const upstreamUrl = new URL(CWA_API_BASE_URL + pathname);

	if (searchParams.has('Authorization')) {
		upstreamUrl.search = searchParams.toString();
		return upstreamUrl.toString();
	}

	const apiKey = env.CWA_API_KEY || '';
	if (!apiKey) {
		return '';
	}

	const upstreamParams = new URLSearchParams();
	upstreamParams.set('Authorization', apiKey);

	for (const [key, value] of searchParams.entries()) {
		upstreamParams.append(key, value);
	}

	upstreamUrl.search = upstreamParams.toString();
	return upstreamUrl.toString();
}

function cleanCwaHeaders(headers, cacheStatus) {
	const cleanedHeaders = new Headers(headers);

	for (const header of STRIPPED_HEADERS) {
		cleanedHeaders.delete(header);
	}

	cleanedHeaders.set('Cache-Control', CACHE_CONTROL);
	cleanedHeaders.set(CACHE_STATUS_HEADER, cacheStatus);

	return cleanedHeaders;
}

export default app;
