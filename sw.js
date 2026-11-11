"use strict";

const CACHE_NAME = "pkdx-offline-ab301f9c0b1b";
const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/data.js",
  "./sprites/manifest.json",
];
const BUNDLE_BATCH = 16;  // bundle 数量少 (~25 个) 单个大, 16 个并行加速; github.io 是 HTTP/2 单连接多路复用
const SCOPE_URL = self.registration.scope;
let offlinePreparation = null;

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
    await Promise.all(names
      .filter(name => name.startsWith("pkdx-offline-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
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

        const urls = manifest.bundles.map(fn => new URL("sprites/" + fn, SCOPE_URL).href);
        // 整个清单最多重试 3 次 (网络间歇被重置时, 已缓存的文件靠 cache.match 秒过, 从断点继续)
        for (let attempt = 1; ; attempt++) {
          try {
            for (let offset = 0; offset < urls.length; offset += BUNDLE_BATCH) {
              const batch = urls.slice(offset, offset + BUNDLE_BATCH);
              await cacheSpriteBatch(cache, batch);
              await notifyClients({
                type: "offline-cache-progress",
                cached: offset + batch.length,
                total: urls.length,
              });
            }
            break;
          } catch (error) {
            if (attempt >= 3) throw error;
            console.error(`Offline sprite cache attempt ${attempt} failed, retrying`, error);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          }
        }

        await notifyClients({ type: "offline-cache-ready", version: CACHE_NAME });
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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
