"use strict";

const CACHE_NAME = "pkdx-offline-88d5e46dc70a";
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
];
const BATCH_SIZE = 16;
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
        const dataUrl = new URL("data/data.js", SCOPE_URL);
        const dataResponse = await cache.match(dataUrl);
        if (!dataResponse) throw new Error("Offline data file is missing");
        const source = await dataResponse.text();
        const assignment = source.indexOf("=");
        if (assignment < 0) throw new Error("Offline data has an invalid format");
        const data = JSON.parse(source.slice(assignment + 1).trim().replace(/;\s*$/, ""));
        if (!Array.isArray(data.species)) throw new Error("Offline species data is missing");

        const ids = [...new Set(data.species.map(species => species.id))];
        const urls = ids.flatMap(id => [
          new URL(`sprites/front/${id}.js`, SCOPE_URL).href,
          new URL(`sprites/front_shiny/${id}.js`, SCOPE_URL).href,
          new URL(`sprites/icon/${id}.js`, SCOPE_URL).href,
        ]);
        for (let offset = 0; offset < urls.length; offset += BATCH_SIZE) {
          const batch = urls.slice(offset, offset + BATCH_SIZE);
          await cacheSpriteBatch(cache, batch);
          await notifyClients({
            type: "offline-cache-progress",
            cached: offset + batch.length,
            total: urls.length,
          });
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
