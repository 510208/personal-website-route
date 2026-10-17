import { Hono } from 'hono';

import cwaRoute from '@/routes/weather/cwa';
import githubRoute from '@/routes/social/github';
import googleSearchSuggestionsRoute from '@/routes/googleSearchSuggestions';
import personalRoute from '@/routes/personal';
import rickRoute from '@/routes/rick';
import threadsRoute from '@/routes/social/threads';
import wakatimeRoute from '@/routes/social/wakatime';
import youtubeRoute from '@/routes/social/youtube';
import type { AppEnv } from '@/types';

const routes = new Hono<AppEnv>();

routes.route('/', personalRoute);
routes.route('/cwa/v1', cwaRoute);
routes.route('/wakatime_sh', wakatimeRoute);
routes.route('/rick', rickRoute);
routes.route('/youtube/v3', youtubeRoute);
routes.route('/search_suggestions', googleSearchSuggestionsRoute);
routes.route('/github', githubRoute);
routes.route('/threads', threadsRoute);

export default routes;
