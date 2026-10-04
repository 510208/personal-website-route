import { Hono } from 'hono';

import cwaRoute from './cwa';
import googleSearchSuggestionsRoute from './googleSearchSuggestions';
import personalRoute from './personal';
import rickRoute from './rick';
import wakatimeRoute from './wakatime';
import youtubeRoute from './youtube';
import githubRoute from './github';
import type { AppEnv } from '../types';

const routes = new Hono<AppEnv>();

routes.route('/', personalRoute);
routes.route('/cwa/v1', cwaRoute);
routes.route('/wakatime_sh', wakatimeRoute);
routes.route('/rick', rickRoute);
routes.route('/youtube/v3', youtubeRoute);
routes.route('/search_suggestions', googleSearchSuggestionsRoute);
routes.route('/github', githubRoute);

export default routes;
