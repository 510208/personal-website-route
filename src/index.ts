import app from '@/app';
import type { AppEnv } from '@/types';

import { Cron } from 'kuron';
import { refreshThreadsToken } from '@/utils/meta_apps/threads';

const cron = new Cron<AppEnv>();

cron.schedule('0 0 1,11,21 * *', async (c) => {
	await refreshThreadsToken(c.env);
});

export default {
	fetch: app.fetch,
	scheduled: cron.scheduled,
};
