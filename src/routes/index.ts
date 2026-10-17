import { Hono } from 'hono';
import type { AppEnv } from '@/types';

import cwaRoute from '@/routes/weather/cwa';
import githubRoute from '@/routes/social/github';
import googleSearchSuggestionsRoute from '@/routes/googleSearchSuggestions';
import personalRoute from '@/routes/personal';
import rickRoute from '@/routes/rick';
import threadsRoute from '@/routes/social/threads';
import wakatimeRoute from '@/routes/social/wakatime';
import youtubeRoute from '@/routes/social/youtube';
import gaRoute from '@/routes/website/analytics';

const routes = new Hono<AppEnv>();

routes.route('/', personalRoute);
routes.route('/cwa/v1', cwaRoute);
routes.route('/wakatime_sh', wakatimeRoute);
routes.route('/rick', rickRoute);
routes.route('/youtube/v3', youtubeRoute);
routes.route('/search_suggestions', googleSearchSuggestionsRoute);
routes.route('/github', githubRoute);
routes.route('/threads', threadsRoute);
routes.route('/ga', gaRoute);

export default routes;
