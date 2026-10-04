import { Hono } from 'hono';

import { getPersonalInfo } from '../utils/personalInfo.js';

const app = new Hono();

app.get('/', (c) => c.json(getPersonalInfo()));

export default app;
