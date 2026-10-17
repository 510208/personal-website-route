import { Hono } from 'hono';
import type { AppEnv } from '@/types';

import { createGoogleAccessToken } from '@/lib/google-analytics';
import { cache } from '@/middleware/cache';

const app = new Hono<AppEnv>();

const CACHE_TTL = 1800;

app.use(
	'/views',
	cache({
		ttl: CACHE_TTL,
	}),
);

app.get('/views', async (c) => {
	try {
		const env = c.env;

		if (!env.GA_PROPERTY_ID || !env.GA_CLIENT_EMAIL || !env.GA_PRIVATE_KEY) {
			return c.json(
				{
					success: false,
					message: 'Google Analytics credentials are missing',
				},
				500,
			);
		}

		const accessToken = await createGoogleAccessToken(c.env);

		const response = await fetch(
			`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(c.env.GA_PROPERTY_ID)}:runReport`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					dateRanges: [
						{
							startDate: '2015-08-14',
							endDate: 'today',
						},
					],
					metrics: [{ name: 'screenPageViews' }],
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`GA4 API request failed: ${response.status} ${await response.text()}`);
		}

		const report = (await response.json()) as {
			rows?: Array<{
				metricValues?: Array<{ value?: string }>;
			}>;
		};

		const totalViews = Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0);

		return c.json({
			success: true,
			data: {
				totalViews,
			},
		});
	} catch (error) {
		console.error('Google Analytics API error:', error);

		return c.json(
			{
				success: false,
				message: 'Failed to fetch Google Analytics data',
			},
			502,
		);
	}
});

export default app;
