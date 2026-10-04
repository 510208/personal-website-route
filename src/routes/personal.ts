import { Hono } from 'hono';

import { getPersonalInfo } from '../utils/personalInfo.js';
import type { AppEnv } from '../types.js';

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json(getPersonalInfo()));

export default app;
