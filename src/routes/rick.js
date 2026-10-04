import { Hono } from 'hono';

const RICK_ROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const app = new Hono();

app.all('*', (c) => c.redirect(RICK_ROLL_URL, 302));

export default app;
