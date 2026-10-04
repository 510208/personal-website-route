import { Hono } from 'hono';

import type { AppEnv } from '../types.js';

const RICK_ROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const app = new Hono<AppEnv>();

app.all('*', (c) => c.redirect(RICK_ROLL_URL, 302));

export default app;
