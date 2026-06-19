# Repository Guidelines

## Project Structure & Module Organization

This is a Cloudflare Workers API project. The Worker entry point is `src/worker.js`, which handles CORS, request dispatch, and the root personal-info JSON response. Route handlers live in `src/routes/` and export a default object with a `handle(request, env, ctx)` method. Current route modules include `wakatime.js`, `youtube.js`, and `rick.js`.

Root configuration files include `wrangler.jsonc` for Worker deployment settings, `.env.example` for expected local variables, `.prettierrc` for formatting, and `.editorconfig` for editor defaults. There is currently no dedicated test directory.

## Build, Test, and Development Commands

Use pnpm, as declared by `packageManager`.

- `pnpm install`: install dependencies from `pnpm-lock.yaml`.
- `pnpm dev` or `pnpm start`: run the Worker locally with Wrangler, usually at `http://localhost:8787`.
- `pnpm deploy`: deploy the Worker using Wrangler.

No automated test script is currently defined. Verify route behavior locally with Wrangler before deploying.

## Coding Style & Naming Conventions

Write JavaScript only; do not introduce TypeScript unless the project is explicitly migrated. Follow Prettier settings: tabs for indentation, single quotes, semicolons, and a 140-character print width. `.editorconfig` also requires LF line endings, UTF-8, final newlines, and trimmed trailing whitespace.

Name route files by endpoint domain or feature, such as `src/routes/youtube.js`. Keep route modules focused on external API behavior, caching, and response shaping. Keep shared request dispatch and CORS behavior in `src/worker.js`.

## Testing Guidelines

Because there is no test framework configured, use manual verification for each changed endpoint. Run `pnpm dev`, call the route you changed, and check status codes, JSON shape, CORS headers, and cache headers where relevant. For proxy routes, test both successful upstream responses and missing or invalid query parameters.

## Commit & Pull Request Guidelines

Recent commits use emoji plus Conventional Commit-style scopes, for example `✨ feat(youtube): 新增 YouTube API 路由處理邏輯`. Keep messages concise and scoped: `✨ feat(worker): ...`, `🐛 fix(wakatime): ...`, or `📝 docs: ...`.

Pull requests should describe the changed routes, list manual verification steps, mention deployment/configuration changes, and link related issues when available. Include screenshots or sample JSON responses for user-facing API changes.

## Security & Configuration Tips

Keep real API keys out of committed files. Prefer local `.env` values and Wrangler secrets for credentials such as `WAKATIME_API_KEY` and `YOUTUBE_DATA_API_KEY`, and keep `.env.example` sanitized with placeholder values only.

The `wrangler.jsonc` file had added into `.gitignore` to prevent accidental commits of real API keys. If you need to update `wrangler.jsonc` for deployment, ensure that sensitive values are replaced with placeholders before committing.
