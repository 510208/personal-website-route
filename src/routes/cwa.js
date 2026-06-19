/**
 * 中華民國中央氣象署 OpenData API 代理 - 只負責產生回應內容
 */

const ROUTE_PREFIX = "/cwa/v1";
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api/v1";
const DATASTORE_PATH = "/rest/datastore/";
const CACHE_TTL = 1800; // 30分鐘（秒）
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;
const DEFAULT_ALLOWED_DATASETS = ["F-D0047-073", "F-D0047-093"];
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const STRIPPED_HEADERS = [
  "content-encoding",
  "content-length",
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
];

const handler = {
  async handle(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(ROUTE_PREFIX)) {
      return { body: "Not Found", status: 404 };
    }

    const upstreamPath = url.pathname.slice(ROUTE_PREFIX.length) || "/";
    const datasetId = getDatasetId(upstreamPath);
    if (!datasetId) {
      return { body: "Missing dataset ID", status: 400 };
    }

    if (!getAllowedDatasets(env).has(datasetId)) {
      return { body: "Dataset is not allowed", status: 403 };
    }

    const cwaUrl = buildCwaUrl(upstreamPath, url.searchParams, env);
    if (!cwaUrl) {
      return { body: "Missing API Key", status: 400 };
    }

    const cacheKey = new Request(request.url, request);
    const cachedResponse = await caches.default.match(cacheKey);
    if (cachedResponse) {
      return {
        body: await cachedResponse.text(),
        status: cachedResponse.status,
        headers: toPlainHeaders(cleanCwaHeaders(cachedResponse.headers)),
      };
    }

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete("host");

    const method = request.method || "GET";
    const cwaResp = await fetch(cwaUrl, {
      method,
      headers: proxyHeaders,
      body: BODY_METHODS.has(method) ? await request.text() : undefined,
    });
    const respBody = await cwaResp.text();
    const cleanedHeaders = cleanCwaHeaders(cwaResp.headers);

    const cacheResponse = new Response(respBody, {
      status: cwaResp.status,
      headers: cleanedHeaders,
    });
    ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

    return {
      body: respBody,
      status: cwaResp.status,
      headers: toPlainHeaders(cleanedHeaders),
    };
  },
};

function getDatasetId(pathname) {
  if (!pathname.startsWith(DATASTORE_PATH)) {
    return "";
  }

  return pathname.slice(DATASTORE_PATH.length).split("/")[0] || "";
}

function getAllowedDatasets(env) {
  const configuredDatasets = (env.CWA_ALLOWED_DATASETS || "")
    .split(",")
    .map((dataset) => dataset.trim())
    .filter(Boolean);

  return new Set(configuredDatasets.length > 0 ? configuredDatasets : DEFAULT_ALLOWED_DATASETS);
}

function buildCwaUrl(pathname, searchParams, env) {
  const upstreamUrl = new URL(CWA_API_BASE_URL + pathname);

  if (searchParams.has("Authorization")) {
    upstreamUrl.search = searchParams.toString();
    return upstreamUrl.toString();
  }

  const apiKey = env.CWA_API_KEY || "";
  if (!apiKey) {
    return "";
  }

  const upstreamParams = new URLSearchParams();
  upstreamParams.set("Authorization", apiKey);

  for (const [key, value] of searchParams.entries()) {
    upstreamParams.append(key, value);
  }

  upstreamUrl.search = upstreamParams.toString();
  return upstreamUrl.toString();
}

function cleanCwaHeaders(headers) {
  const cleanedHeaders = new Headers(headers);

  for (const header of STRIPPED_HEADERS) {
    cleanedHeaders.delete(header);
  }

  cleanedHeaders.set("Cache-Control", CACHE_CONTROL);

  return cleanedHeaders;
}

function toPlainHeaders(headers) {
  return Object.fromEntries(headers.entries());
}

export default handler;
