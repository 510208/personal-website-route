import { Hono } from 'hono';

import cwaRoute from './cwa.js';
import googleSearchSuggestionsRoute from './googleSearchSuggestions.js';
import personalRoute from './personal.js';
import rickRoute from './rick.js';
import wakatimeRoute from './wakatime.js';
import youtubeRoute from './youtube.js';
import type { AppEnv } from '../types.js';

const routes = new Hono<AppEnv>();

routes.route('/', personalRoute);
routes.route('/cwa/v1', cwaRoute);
routes.route('/wakatime_sh', wakatimeRoute);
routes.route('/rick', rickRoute);
routes.route('/youtube/v3', youtubeRoute);
routes.route('/search_suggestions', googleSearchSuggestionsRoute);

export default routes;
