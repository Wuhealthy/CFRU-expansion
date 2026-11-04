"use strict";

const offlineStatus = document.getElementById("offline-status");
const installButton = document.getElementById("install-app-button");
let statusTimer;
let deferredInstallPrompt = null;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
  || navigator.standalone === true;

function showOfflineStatus(message, temporary) {
  if (!offlineStatus) return;
  offlineStatus.textContent = message;
  offlineStatus.classList.remove("hidden");
  clearTimeout(statusTimer);
  if (temporary) {
    statusTimer = setTimeout(() => offlineStatus.classList.add("hidden"), 4000);
  }
}

function updateInstallButton() {
  if (!installButton) return;
  const isHome = !location.hash || location.hash === "#/" || location.hash === "#";
  installButton.classList.toggle("hidden", !isHome || isStandalone() || (!isIos && !deferredInstallPrompt));
  installButton.textContent = isIos ? "添加到主屏幕" : "安装到手机";
}

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (isIos) {
      showOfflineStatus("请点 Safari 的「分享」按钮，再选择「添加到主屏幕」", true);
      return;
    }
    if (!deferredInstallPrompt) return;

    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    updateInstallButton();
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") showOfflineStatus("正在安装火红物语图鉴", true);
    } catch (error) {
      console.error("应用安装提示打开失败", error);
      showOfflineStatus("无法打开安装提示，请使用浏览器菜单添加到主屏幕");
    }
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    showOfflineStatus("火红物语图鉴已安装", true);
  });
  window.addEventListener("hashchange", updateInstallButton);
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", updateInstallButton);
  updateInstallButton();
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
