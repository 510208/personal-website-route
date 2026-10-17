import app from '@/app';
import type { AppEnv } from '@/types';

import { Cron } from 'kuron';
import { refreshThreadsToken } from '@/utils/meta_apps/threads';
import { refreshInstagramFollowers } from '@/utils/meta_apps/instagram';

const cron = new Cron<AppEnv>();

cron.schedule('0 0 1,11,21 * *', async (c) => {
	await refreshThreadsToken(c.env);
});

cron.schedule('0 0 1,11,21 * *', async (c) => {
	await refreshInstagramFollowers(c.env);
});

export default {
	fetch: app.fetch,
	scheduled: cron.scheduled,
};
