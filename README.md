# Personal Website Route (Cloudflare Workers API)

本專案以 Cloudflare Workers + Hono 實作 API 路由，支援個人資訊查詢與 WakaTime API 代理。

## 架構說明

- 主入口：`src/worker.js`，匯出 Worker 使用的 Hono router。
- 路由設定：`src/router.js`，建立 Hono app、套用 CORS middleware，並分派請求。
- 路由設計：
  - `/` 回傳個人資訊（JSON 格式）。
  - `/cwa/v1/*` 代理中華民國中央氣象署 OpenData API，使用 `src/routes/cwa.js`，支援資料集白名單與 30 分鐘快取。
  - `/wakatime_sh` 代理 WakaTime API，使用 `src/routes/wakatime.js`，支援 30 分鐘快取。
  - `/youtube/v3/*` 代理 YouTube Data API，使用 `src/routes/youtube.js`，支援 30 分鐘快取。
  - `/rick` 重導向至 Rick Roll。
- 路由擴充：新增 API 請於 `src/routes/` 建檔，並於 `router.js` 的 route table 註冊 prefix 與 handler。

## 開發與部署

- 安裝依賴：`pnpm install`
- 開發啟動：`pnpm dev`（本地 8787 port）
- 部署：`pnpm deploy`（wrangler 部署至 Cloudflare）
- 主要設定檔：
  - `wrangler.jsonc`：Worker 設定、路由、觀測性（logs/traces）
  - `.env`：API 金鑰等敏感資訊（如 WAKATIME_API_KEY）

## 重要慣例

- 路由分派由 `src/router.js` 的 Hono app 處理，route module 仍維持 `handle(request, env, ctx)` 介面。
- WakaTime Proxy 需從 query string 取得 `path` 參數，並自動附加 Authorization header。
- CWA Proxy 會從 `/cwa/v1/rest/datastore/{datasetId}` 讀取資料集編號並比對白名單；若請求未帶 `Authorization` query，會自動附加 `CWA_API_KEY`。
- 快取使用 `caches.default`，快取 key 為 request.url，快取時間由各 route module 控制。
- 回應格式由 route module 回傳 `{ body, status, headers }`，再由 `router.js` 統一轉成 `Response`。
- 個人資訊物件結構可參考 `router.js` 內 `getPersonalInfo()`。

## 外部整合

- WakaTime API 代理：需設置 `WAKATIME_API_KEY` 於環境變數，並以 Basic Auth 方式附加。
- 中央氣象署 OpenData API 代理：需設置 `CWA_API_KEY` 於環境變數，資料集白名單可用 `CWA_ALLOWED_DATASETS` 以逗號分隔設定，例如 `F-D0047-073,F-C0032-001`。
- 其他外部 API 請依 wakatime.js 代理模式設計。

## 其他注意事項

- 本專案無測試檔案，請以本地 dev server 驗證 API 行為。
- 請遵循 Prettier 格式化（見 `.prettierrc`）。
- 主要開發語言為 JavaScript，請勿混用 TypeScript。

## 參考檔案

- `src/worker.js`：Worker entry point
- `src/router.js`：主路由分派與個人資訊 API
- `src/routes/`：各 API 路由模組
- `wrangler.jsonc`：Cloudflare Worker 設定
- `.github/copilot-instructions.md`：AI agent 指南
