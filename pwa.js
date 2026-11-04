"use strict";

const offlineStatus = document.getElementById("offline-status");
let statusTimer;

function showOfflineStatus(message, temporary) {
  if (!offlineStatus) return;
  offlineStatus.textContent = message;
  offlineStatus.classList.remove("hidden");
  clearTimeout(statusTimer);
  if (temporary) {
    statusTimer = setTimeout(() => offlineStatus.classList.add("hidden"), 4000);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    const message = event.data || {};
    if (message.type === "offline-cache-progress") {
      const percent = Math.floor(message.cached / message.total * 100);
      showOfflineStatus(`正在准备离线图鉴：${percent}%`);
    } else if (message.type === "offline-cache-ready") {
      showOfflineStatus("离线图鉴已准备完成", true);
    } else if (message.type === "offline-cache-error") {
      showOfflineStatus("离线缓存失败，请保持联网并刷新页面重试");
    }
  });

  if (!navigator.serviceWorker.controller) {
    showOfflineStatus("正在准备离线图鉴…");
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(error => {
      console.error("离线图鉴初始化失败", error);
      showOfflineStatus("离线功能无法启用，请使用 HTTPS 并刷新页面重试");
    });
  });
}
