import { Hono } from 'hono';

import { registerCors } from '@/middleware/cors';
import routes from '@/routes';
import type { AppEnv } from '@/types';

const app = new Hono<AppEnv>();

registerCors(app);
app.route('/', routes);

app.notFound((c) =>
	c.json(
		{
			error: 404,
			message: 'Not Found',
			path: c.req.url,
			description: "Maybe you are looking for ' / ', it has something about me!",
		},
		404,
	),
);

export default app;
