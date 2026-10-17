export interface AppEnv {
	GA_PROPERTY_ID: string;
	GA_CLIENT_EMAIL: string;
	GA_PRIVATE_KEY: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const encoder = new TextEncoder();

function base64UrlEncode(input: Uint8Array | string): string {
	const bytes = typeof input === 'string' ? encoder.encode(input) : input;

	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodePrivateKey(privateKey: string): ArrayBuffer {
	const pem = privateKey
		.replace(/\\n/g, '\n')
		.replace(/-----BEGIN PRIVATE KEY-----/g, '')
		.replace(/-----END PRIVATE KEY-----/g, '')
		.replace(/\s/g, '');

	const binary = atob(pem);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes.buffer;
}

export async function createGoogleAccessToken(env: AppEnv): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const header = base64UrlEncode(
		JSON.stringify({
			alg: 'RS256',
			typ: 'JWT',
		}),
	);

	const payload = base64UrlEncode(
		JSON.stringify({
			iss: env.GA_CLIENT_EMAIL,
			scope: 'https://www.googleapis.com/auth/analytics.readonly',
			aud: GOOGLE_TOKEN_URL,
			iat: now,
			exp: now + 3600,
		}),
	);

	const unsignedToken = `${header}.${payload}`;

	const key = await crypto.subtle.importKey(
		'pkcs8',
		decodePrivateKey(env.GA_PRIVATE_KEY),
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		false,
		['sign'],
	);

	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsignedToken));

	const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});

	const result = (await response.json()) as {
		access_token?: string;
		error?: string;
	};

	if (!response.ok || !result.access_token) {
		throw new Error(`Google OAuth failed: ${result.error ?? response.status}`);
	}

	return result.access_token;
}
