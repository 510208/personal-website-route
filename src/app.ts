import { Hono } from 'hono';

import { registerCors } from './middleware/cors.js';
import routes from './routes/index.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

registerCors(app);
app.route('/', routes);

app.notFound((c) => c.text("Not Found\nMaybe you are looking for '/', it has something about me!", 404));

export default app;
