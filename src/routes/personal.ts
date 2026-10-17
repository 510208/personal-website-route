import { Hono } from 'hono';

import type { AppEnv } from '@/types';
import { getPersonalInfo } from '@/utils/personalInfo';

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json(getPersonalInfo()));

export default app;
