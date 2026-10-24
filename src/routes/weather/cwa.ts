import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { cache } from '@/middleware/cache';
import type { AppEnv, Bindings } from '@/types';

const CWA_API_BASE_URL = 'https://opendata.cwa.gov.tw/api/v1';
const ROUTE_PREFIX = '/cwa/v1';
const DATASTORE_PATH = '/rest/datastore/';
const CACHE_TTL = 1800;
const DEFAULT_ALLOWED_DATASETS = ['F-D0047-073', 'F-D0047-093'];
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const STRIPPED_HEADERS = [
	'content-encoding',
	'content-length',
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
];

const app = new Hono<AppEnv>();

app.use(
	'*',
	cache({
		ttl: CACHE_TTL,
		enabled: (c) => {
			const url = new URL(c.req.url);
			const upstreamPath = url.pathname.slice(ROUTE_PREFIX.length) || '/';
			const datasetId = getDatasetId(upstreamPath);

			return Boolean(datasetId && getAllowedDatasets(c.env).has(datasetId) && buildCwaUrl(upstreamPath, url.searchParams, c.env));
		},
		shouldCache: () => true,
	}),
);

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

	const proxyHeaders = new Headers(c.req.raw.headers);
	proxyHeaders.delete('host');
	proxyHeaders.set(
		'User-Agent',
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	);

	const method = c.req.method || 'GET';
	const cwaResp = await fetch(cwaUrl, {
		method,
		headers: proxyHeaders,
		body: BODY_METHODS.has(method) ? await c.req.text() : null,
	});
	const respBody = await cwaResp.text();
	const cleanedHeaders = cleanCwaHeaders(cwaResp.headers);

	return c.newResponse(respBody, toContentfulStatus(cwaResp.status), toHeaderRecord(cleanedHeaders));
});

function getDatasetId(pathname: string) {
	if (!pathname.startsWith(DATASTORE_PATH)) {
		return '';
	}

	return pathname.slice(DATASTORE_PATH.length).split('/')[0] || '';
}

function getAllowedDatasets(env: Bindings) {
	const configuredDatasets = (env.CWA_ALLOWED_DATASETS || '')
		.split(',')
		.map((dataset) => dataset.trim())
		.filter(Boolean);

	return new Set(configuredDatasets.length > 0 ? configuredDatasets : DEFAULT_ALLOWED_DATASETS);
}

function buildCwaUrl(pathname: string, searchParams: URLSearchParams, env: Bindings) {
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

function cleanCwaHeaders(headers: Headers) {
	const cleanedHeaders = new Headers(headers);

	for (const header of STRIPPED_HEADERS) {
		cleanedHeaders.delete(header);
	}

	return cleanedHeaders;
}

function toContentfulStatus(status: number): ContentfulStatusCode {
	return status as ContentfulStatusCode;
}

function toHeaderRecord(headers: Headers) {
	return Object.fromEntries(headers.entries());
}

export default app;
