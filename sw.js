"use strict";

const CACHE_NAME = "pkdx-offline-f994bb928396";
// 注意: 这里的每一项都必须在部署产物里真实存在 — addAll 是原子的, 任何一项 404 都会让整个
// install 失败, SW 永远无法激活, 自动更新/离线全部失效 (曾经因 data/features/awaken_*.png
// 未入库而全站 SW 静默死亡). 可选资源 (如版特色页 <img>) 不要加进来, 404 就让它 404。
const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pwa.js",
  "./emu.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./sprites/manifest.json",
];
const BUNDLE_BATCH = 16;  // bundle 数量少 (~25 个) 单个大, 16 个并行加速; github.io 是 HTTP/2 单连接多路复用
const SCOPE_URL = self.registration.scope;
let offlinePreparation = null;
let dataRevalidAt = 0;  // data.js 后台重验证节流时间戳: URL 带 ?v=内容哈希, 缓存副本通常已是最新,
                        // 每次命中都拉 2MB 纯浪费 (部署后的过期副本只需验证一次)

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(client => client.postMessage(message));
}

async function cacheSpriteBatch(cache, urls) {
  await Promise.all(urls.map(async url => {
    if (await cache.match(url)) return;
    const response = await fetch(url);
    if (response.status === 404) return;  // 该个体没有这张图 (如部分闪光图缺失): 可选资源, 跳过不算失败
    if (!response.ok) {
      throw new Error(`Failed to cache ${url}: HTTP ${response.status}`);
    }
    await cache.put(url, response);
  }));
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_FILES);
      // 新版本安装完成: 通知页面 (页面在旧版本控制下时收到此消息 → 自动刷新换新内容)
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(client => client.postMessage({ type: "sw-updated", version: CACHE_NAME }));
      await self.skipWaiting();
    } catch (error) {
      console.error("Core offline cache installation failed", error);
      throw error;
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const oldNames = names.filter(name => name.startsWith("pkdx-offline-") && name !== CACHE_NAME);
    // 迁移旧缓存到新版本缓存: 更新后首屏直接用旧 data.js/精灵图秒开 (data.js 走 SWR 后台拉新,
    // 精灵图 cache-first 命中旧副本), 而不是清空缓存后对着骨架屏等 2MB 重拉
    await Promise.all(oldNames.map(async name => {
      try {
        const oldCache = await caches.open(name);
        const newCache = await caches.open(CACHE_NAME);
        const keys = await oldCache.keys();
        await Promise.all(keys.map(async req => {
          if (await newCache.match(req)) return;
          const resp = await oldCache.match(req);
          if (resp) await newCache.put(req, resp.clone());
        }));
      } catch (error) {
        console.error("Cache migration failed", error);  // 迁移失败不影响激活, 大不了全量重拉
      }
    }));
    await Promise.all(oldNames.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type !== "prepare-offline") return;
  if (!offlinePreparation) {
    offlinePreparation = (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const manifestUrl = new URL("sprites/manifest.json", SCOPE_URL);
        const manifestResponse = await cache.match(manifestUrl);
        if (!manifestResponse) throw new Error("Sprite manifest is missing");
        const manifest = await manifestResponse.json();
        if (!Array.isArray(manifest.bundles)) throw new Error("Sprite manifest has no bundle list");
        const ver = manifest.ver || {};  // 页面按 ?v=内容哈希 请求 bundle, 预缓存必须用同样的 URL 才能命中

        const urls = manifest.bundles.map(fn => new URL("sprites/" + fn + "?v=" + (ver[fn] || ""), SCOPE_URL).href);
        // 按编号排序: 前 N 个优先缓存 (快速达到基本离线可用), 剩余后台渐进
        const PRELOAD_N = 5;
        const sorted = manifest.bundles.map(fn => ({ fn, n: parseInt(fn.match(/\d+/)[0], 10) }))
          .sort((a, b) => a.n - b.n).map(o => new URL("sprites/" + o.fn + "?v=" + (ver[o.fn] || ""), SCOPE_URL).href);
        const preloadUrls = sorted.slice(0, PRELOAD_N);
        const lazyUrls = sorted.slice(PRELOAD_N);
        const cacheBatched = async (urls, reportProgress) => {
          for (let attempt = 1; ; attempt++) {
            try {
              for (let offset = 0; offset < urls.length; offset += BUNDLE_BATCH) {
                const batch = urls.slice(offset, offset + BUNDLE_BATCH);
                await cacheSpriteBatch(cache, batch);
                if (reportProgress) await notifyClients({
                  type: "offline-cache-progress",
                  cached: offset + batch.length,
                  total: urls.length,
                });
              }
              break;
            } catch (error) {
              if (attempt >= 3) throw error;
              console.error(`Offline cache attempt ${attempt} failed, retrying`, error);
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
          }
        };
        // 第一阶段: 快速缓存前 5 个 bundle (约 7MB, 图鉴前 320 只), 立即报告就绪
        await cacheBatched(preloadUrls, true);
        await notifyClients({ type: "offline-cache-ready", version: CACHE_NAME });
        // 第二阶段: 后台渐进缓存剩余 bundle (离线能力持续增强, 不再发进度条)
        await cacheBatched(lazyUrls, false);
      } catch (error) {
        console.error("Offline sprite cache preparation failed", error);
        await notifyClients({ type: "offline-cache-error" });
        offlinePreparation = null;
      }
    })();
  }
  event.waitUntil(offlinePreparation);
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).searchParams.has("__bypass")) return;  // 页面的更新检查: 绕过缓存直连网络

  const url = new URL(request.url);
  const isDataJS = url.pathname.endsWith("/data/data.js");
  // 导航请求 (站点根 `/` 等无扩展名路径) 必须一并走网络优先: index.html 里写死了全部资源的 ?v=
  // 版本号, 它一旦陈旧整个页面 (导航布局等) 都是旧版; 扩展名正则接不住 `/`, 会落进底部 cache-first
  // 分支 → 主页布局永远停在安装时的旧版, 只能靠强制刷新更新
  const isNav = request.mode === "navigate";
  const isCoreFile = isNav || /\.(js|css|html|webmanifest)$/.test(url.pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isDataJS) {
      // data.js (2MB): stale-while-revalidate — 先返回缓存秒开, 后台节流更新 (10 分钟最多一次)
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        if (Date.now() > dataRevalidAt) {
          dataRevalidAt = Date.now() + 10 * 60 * 1000;
          fetch(request).then(resp => { if (resp.ok) cache.put(request, resp.clone()); }).catch(() => {});
        }
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) { await cache.put(request, response.clone()); return response; }
      } catch (e) {}
      throw new Error("data.js unavailable");
    }
    if (isCoreFile) {
      try {
        // 导航请求强制重新验证: GitHub Pages 的 HTML 带 max-age=600, 默认会命中浏览器 HTTP 缓存,
        // 部署后 10 分钟内依旧拿旧 index.html; no-cache 只是带条件请求, 未变化时仅一个 304 往返
        const response = await fetch(request, isNav ? { cache: "no-cache" } : {});
        if (response.ok) { await cache.put(request, response.clone()); return response; }
      } catch (e) {}
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      throw new Error("core file unavailable");
    }
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
