# Personal Website Route (Cloudflare Workers API)

本專案以 Cloudflare Workers + Hono 實作 API 路由，支援個人資訊查詢與 WakaTime API 代理。

## 架構說明

- Worker 入口：`src/index.ts`，匯出 Cloudflare Workers 使用的 Hono app；`src/worker.ts` 保留為舊入口相容檔。
- Hono app：`src/app.ts`，註冊全域 middleware、路由與 404 回應。
- Middleware：`src/middleware/`，放置 CORS 等跨路由共用 middleware。
- 路由設計：
  - `/` 回傳個人資訊（JSON 格式）。
  - `/cwa/v1/*` 代理中華民國中央氣象署 OpenData API，使用 `src/routes/cwa.ts`，支援資料集白名單與 30 分鐘快取。
  - `/wakatime_sh` 代理 WakaTime API，使用 `src/routes/wakatime.ts`，支援 30 分鐘快取。
  - `/youtube/v3/*` 代理 YouTube Data API，使用 `src/routes/youtube.ts`，支援 30 分鐘快取。
  - `/search_suggestions` 代理 Google 搜尋建議 API，使用 `src/routes/googleSearchSuggestions.ts`，支援 30 分鐘快取。
  - `/rick` 重導向至 Rick Roll。
- 路由組合：`src/routes/index.ts` 使用 Hono 的 `app.route()` 掛載各子路由。新增 API 時，在 `src/routes/` 建立 Hono app 並於此處掛載。
- 共用資料：`src/utils/` 放置跨模組共用的資料與 helper，例如個人資訊物件。

## 開發與部署

- 安裝依賴：`pnpm install`
- 開發啟動：`pnpm dev`（本地 8787 port）
- 部署：`pnpm deploy`（wrangler 部署至 Cloudflare）
- 主要設定檔：
  - `wrangler.jsonc`：Worker 設定、路由、觀測性（logs/traces）
  - `.env`：API 金鑰等敏感資訊（如 WAKATIME_API_KEY）

## 重要慣例

- 各 route module 匯出 Hono app，以 `app.get()`、`app.all()` 等方法定義 endpoint，並由 `src/routes/index.ts` 組合。
- WakaTime Proxy 需從 query string 取得 `path` 參數，並自動附加 Authorization header。
- CWA Proxy 會從 `/cwa/v1/rest/datastore/{datasetId}` 讀取資料集編號並比對白名單；若請求未帶 `Authorization` query，會自動附加 `CWA_API_KEY`。
- 快取使用 `caches.default`，快取 key 為 request.url，快取時間由各 route module 控制。
- 各 route handler 使用 Hono context 回傳 JSON、文字或代理回應；個人資訊物件位於 `src/utils/personalInfo.ts`。

## 外部整合

- WakaTime API 代理：需設置 `WAKATIME_API_KEY` 於環境變數，並以 Basic Auth 方式附加。
- 中央氣象署 OpenData API 代理：需設置 `CWA_API_KEY` 於環境變數，資料集白名單可用 `CWA_ALLOWED_DATASETS` 以逗號分隔設定，例如 `F-D0047-073,F-C0032-001`。
- 其他外部 API 請依 wakatime.ts 代理模式設計。

## 其他注意事項

- 本專案無測試檔案，請以本地 dev server 驗證 API 行為。
- 請遵循 Prettier 格式化（見 `.prettierrc`）。
- 主要開發語言為 TypeScript，新增程式碼請使用 `.ts` 檔案並維持嚴格型別檢查。

## 參考檔案

- `src/index.ts`：Worker entry point
- `src/app.ts`：Hono app 與全域設定
- `src/middleware/`：共用 middleware
- `src/routes/`：Hono 子路由與路由組合
- `src/utils/`：共用資料與 helper
- `wrangler.jsonc`：Cloudflare Worker 設定
- `.github/copilot-instructions.md`：AI agent 指南
