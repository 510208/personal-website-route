import app from './app';
import type { AppEnv } from './types.js';

import { Cron } from 'kuron';
import { refreshThreadsToken } from './utils/meta_apps/threads';

const cron = new Cron<AppEnv>();

cron.schedule('0 0 * * *', async (c) => {
	await refreshThreadsToken(c.env);
});

export default {
	fetch: app.fetch,
	cron: cron.scheduled,
};
