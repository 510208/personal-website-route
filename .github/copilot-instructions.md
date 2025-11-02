# Copilot Instructions for AI Coding Agents

## 專案架構

- 本專案為 Cloudflare Workers API 路由，主入口為 `src/worker.js`，所有請求由此分派。
- 路由設計：
  - `/wakatime_sh` 會動態導入 `src/routes/wakatime.js` 處理 WakaTime API 代理，並支援 30 分鐘快取。
  - 其他路徑預設回傳個人資訊（JSON 格式）。
- 路由擴充：新增 API 路由時，請在 `src/routes/` 新增檔案並於 `worker.js` 依路徑分派。

## 開發與部署

- 開發啟動：`npm run dev`（本地 8787 port）
- 部署：`npm run deploy`（使用 wrangler 部署至 Cloudflare）
- 主要設定檔：
  - `wrangler.jsonc`：Worker 設定、路由、觀測性（logs/traces）
  - `.env`：API 金鑰等敏感資訊（如 WAKATIME_API_KEY）

## 重要模式與慣例

- 路由分派採用 `if (url.pathname.startsWith(...))`，動態 import route module。
- API Proxy 需從 query string 取得 `path` 參數，並自動附加 Authorization header。
- 快取使用 `caches.default`，快取 key 為 request.url，快取時間由各 route module 控制。
- 回應格式：所有 API 回應皆為 JSON，錯誤回應需明確 status code 與訊息。
- 個人資訊物件結構可參考 `worker.js` 內 `personalInfo`。

## 外部整合

- WakaTime API 代理：需設置 `WAKATIME_API_KEY` 於環境變數，並以 Basic Auth 方式附加。
- 其他外部 API 請依 wakatime.js 代理模式設計。

## 其他注意事項

- 本專案無測試檔案，請以本地 dev server 驗證 API 行為。
- 請遵循 Prettier 格式化（見 `.prettierrc`）。
- 主要開發語言為 JavaScript，請勿混用 TypeScript。

## 參考檔案

- `src/worker.js`：主路由分派與個人資訊 API
- `src/routes/wakatime.js`：WakaTime API 代理範例
- `wrangler.jsonc`：Cloudflare Worker 設定
- `README.md`：簡要專案說明

---

如有不明確或未涵蓋的部分，請回報以便補充。
