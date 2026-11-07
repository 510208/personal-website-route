const STALE_BODY_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'content-md5', 'digest'];

const UPSTREAM_CORS_HEADERS = [
	'access-control-allow-origin',
	'access-control-allow-methods',
	'access-control-allow-headers',
	'access-control-allow-credentials',
	'access-control-expose-headers',
	'access-control-max-age',
];

export function sanitizeUpstreamHeaders(headers: Headers): Headers {
	const sanitized = new Headers(headers);

	for (const name of [...STALE_BODY_HEADERS, ...UPSTREAM_CORS_HEADERS]) {
		sanitized.delete(name);
	}

	return sanitized;
}
