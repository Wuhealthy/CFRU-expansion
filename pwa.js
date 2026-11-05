"use strict";

const offlineStatus = document.getElementById("offline-status");
const installButton = document.getElementById("install-app-button");
const pwaScriptUrl = document.currentScript && document.currentScript.src;
const pwaVersion = pwaScriptUrl ? new URL(pwaScriptUrl).searchParams.get("v") : "";
let statusTimer;
let deferredInstallPrompt = null;
let pageReloading = false;
let swRegistration = null;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(navigator.userAgent);
const isHarmonyOS = /harmonyos/i.test(navigator.userAgent) || /huawei/i.test(navigator.userAgent);
const isMobile = isIos || isAndroid || isHarmonyOS || /mobile/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
  || navigator.standalone === true;

function getInstallButtonLabel() {
  if (isIos) return "添加到主屏幕";
  return isMobile ? "安装到手机" : "安装到桌面";
}

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
  installButton.classList.toggle("hidden", !isHome || isStandalone() || (!isMobile && !deferredInstallPrompt));
  installButton.textContent = getInstallButtonLabel();
}

function reloadAfterOfflineUpdate(version) {
  if (pageReloading) return;
  const reloadKey = `pkdx-auto-reloaded:${version || pwaVersion || "current"}`;
  try {
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, "1");
  } catch (error) {
    console.error("离线图鉴自动刷新状态保存失败", error);
    return;
  }
  pageReloading = true;
  setTimeout(() => location.reload(), 500);
}

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (isIos) {
      showOfflineStatus("请点 Safari 的「分享」按钮，再选择「添加到主屏幕」", true);
      return;
    }
    if (!deferredInstallPrompt) {
      showOfflineStatus(isAndroid || isHarmonyOS
        ? "请点浏览器菜单「安装应用」或「添加到主屏幕」；建议使用 Chrome"
        : isMobile
          ? "请点浏览器菜单「添加到主屏幕」；iPhone 请使用 Safari"
          : "请点浏览器菜单「安装应用」或「添加到桌面」；建议使用 Chrome", true);
      return;
    }

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
  const prepareOfflineCache = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "prepare-offline" });
    }
  };

  navigator.serviceWorker.addEventListener("message", event => {
    const message = event.data || {};
    if (message.type === "offline-cache-progress") {
      const percent = Math.floor(message.cached / message.total * 100);
      showOfflineStatus(`正在准备离线图鉴：${percent}%`);
    } else if (message.type === "offline-cache-ready") {
      showOfflineStatus("离线图鉴已准备完成，正在刷新…");
      reloadAfterOfflineUpdate(message.version);
    } else if (message.type === "offline-cache-error") {
      showOfflineStatus("离线缓存失败，请保持联网并刷新页面重试");
    } else if (message.type === "sw-updated" && navigator.serviceWorker.controller) {
      // 新版本安装完成, 且页面当前被旧版本控制 → 自动刷新换新内容
      // (首次安装时页面尚无 controller, 不刷新)
      showOfflineStatus("图鉴已更新，正在刷新…");
      reloadAfterOfflineUpdate(message.version);  // 等 activate 的缓存清理收尾
    }
  });

  if (!navigator.serviceWorker.controller) {
    showOfflineStatus("正在准备离线图鉴…");
  }

  // 离线图鉴更新后自动刷新: 新版 service worker 安装完成后广播 "sw-updated"
  // (见 sw.js), 上面的 message 监听收到后整页刷新; 这里只维护刷新去重标志
  const checkForUpdate = () => { if (swRegistration) swRegistration.update().catch(() => {}); };
  // 长期开着的页面: 回到前台 / 每 30 分钟检查一次有没有新版本
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
  setInterval(checkForUpdate, 30 * 60 * 1000);

  window.addEventListener("load", () => {
    const swUrl = `sw.js${pwaVersion ? `?v=${encodeURIComponent(pwaVersion)}` : ""}`;
    navigator.serviceWorker.register(swUrl)
      .then(registration => { swRegistration = registration; return navigator.serviceWorker.ready; })
      .then(prepareOfflineCache)
      .catch(error => {
        console.error("离线图鉴初始化失败", error);
        showOfflineStatus("离线功能无法启用，请使用 HTTPS 并刷新页面重试");
      });
  });
}
