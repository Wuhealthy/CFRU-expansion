/* 火红物语图鉴 - 静态图鉴 (数据: data.js → window.PKDX) */
"use strict";
const D = window.PKDX;

/* ---------------- 简体 / 繁体 ----------------
   数据都是简体; 繁体时在浏览器端用 data.js 里的精简 OpenCC 词典 (词组最长匹配 → 单字) 转换。
   页面新插入的文字由 MutationObserver 统一转换, 每个文字节点记住原文, 切回简体直接还原;
   搜索输入一律先转回简体再匹配, 简繁都能搜。 */
const HANT = D.hant;
let LANG = localStorage.getItem("pkdx_lang") === "hant" ? "hant" : "hans";
function toHant(s) {
  if (!/[\u4e00-\u9fff]/.test(s)) return s;
  let out = "";
  for (let i = 0; i < s.length;) {
    let n = Math.min(HANT.maxLen, s.length - i);
    for (; n > 1; n--) {
      const p = HANT.phrases[s.substr(i, n)];
      if (p !== undefined) { out += p; break; }
    }
    if (n > 1) { i += n; continue; }
    out += HANT.chars[s[i]] || s[i];
    i++;
  }
  return out;
}
const toHans = s => s.replace(/[^\x00-\x7f]/g, c => HANT.t2s[c] || c);
const ORIG_TEXT = new WeakMap();
function localize(root) {
  const conv = s => (LANG === "hant" ? toHant(s) : s);
  const one = node => {
    if (node.nodeType === 3) {
      if (!ORIG_TEXT.has(node)) ORIG_TEXT.set(node, node.nodeValue);
      const v = conv(ORIG_TEXT.get(node));
      if (node.nodeValue !== v) node.nodeValue = v;
    } else if (node.nodeType === 1) {
      for (const a of ["placeholder", "title"]) {
        if (!node.hasAttribute(a)) continue;
        const key = "orig" + a;
        if (node.dataset[key] === undefined) node.dataset[key] = node.getAttribute(a);
        node.setAttribute(a, conv(node.dataset[key]));
      }
    }
  };
  one(root);
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) one(n);
}
new MutationObserver(muts => {
  if (LANG !== "hant") return;
  for (const m of muts) m.addedNodes.forEach(localize);
}).observe(document.body, { childList: true, subtree: true });
const PAGE_TITLE = document.title;
window.setLang = function (l) {
  LANG = l;
  localStorage.setItem("pkdx_lang", l);
  document.documentElement.lang = l === "hant" ? "zh-TW" : "zh-CN";
  document.title = l === "hant" ? toHant(PAGE_TITLE) : PAGE_TITLE;
  document.querySelectorAll(".lang-switch button").forEach(b => b.classList.toggle("on", b.dataset.lang === l));
  localize(document.body);
};

/* ---------------- 基础索引 ---------------- */
const TYPE_BY_ID = {};        D.types.forEach(t => TYPE_BY_ID[t.id] = t);
const ABIL_BY_ID = {};        D.abilities.forEach(a => ABIL_BY_ID[a.id] = a);
const MOVE_BY_ID = {};        D.moves.forEach(m => MOVE_BY_ID[m.id] = m);
const SPECIES_BY_ID = {};     D.species.forEach(s => SPECIES_BY_ID[s.id] = s);
const TYPES_SHOWN = D.types.filter(t => !t.pseudo);

/* 有该特性的宝可梦 (普通+隐藏) */
const ABIL_USERS = {};
D.species.forEach(s => {
  s.abilities.concat(s.hidden).forEach(a => {
    (ABIL_USERS[a] = ABIL_USERS[a] || []).push(s.id);
  });
});

/* 进化链: 组件划分 */
const EVO_MAIN_SKIP = { EVO_MEGA: 1, EVO_GIGANTAMAX: 1, EVO_AWAKEN: 1 };
const FORM_KIND_ZH = { awaken: "觉醒形态", mega: "超级进化", giga: "超极巨化", primal: "原始回归", regional: "地区形态", alt: "特殊形态" };
/* 形态筛选: chip 值 -> 该 chip 显示的 formKind 集合 ("特殊形态"含原始回归) */
const FORM_FILTER = {
  regional: k => k === "regional",
  alt: k => k === "alt" || k === "primal",
  mega: k => k === "mega",
  giga: k => k === "giga",
  awaken: k => k === "awaken",
};
const N_DEFAULT = D.species.filter(s => s.isDefault).length;
const evoAdj = {};   // 无向邻接
D.species.forEach(s => (s.evolutions || []).forEach(e => {
  if (e.to == null || !SPECIES_BY_ID[e.to]) return;
  (evoAdj[s.id] = evoAdj[s.id] || []).push(e.to);
  (evoAdj[e.to] = evoAdj[e.to] || []).push(s.id);
}));
const evoComp = {};

(function () {
  let comp = 0;
  const seen = new Set();
  for (const idStr of Object.keys(evoAdj)) {
    const id = +idStr;
    if (seen.has(id)) continue;
    comp++;
    const q = [id];
    while (q.length) {
      const cur = q.pop();
      if (seen.has(cur)) continue;
      seen.add(cur); evoComp[cur] = comp;
      (evoAdj[cur] || []).forEach(n => { if (!seen.has(n)) q.push(n); });
    }
  }
})();

/* ---------------- 工具 ---------------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- 精灵图加密加载 ----------------
   sprites/{front,icon}/NNN.js 为 XOR 加密的 base64 数据,
   动态 <script> 载入后解密为 ImageBitmap, 用 canvas 绘制 (无 <img>, 右键另存不可用)。
   密钥须与 tools/extract_data.py 的 SPR_KEY 一致。 */
const SPR_KEY = [0x5A, 0xC3, 0x11, 0x9E, 0x37, 0x6B, 0xD2, 0x84,
                 0x1F, 0xA6, 0x48, 0xE0, 0x73, 0xCB, 0x95, 0x2D];
const KIND_ID = { front: 0, icon: 1 };
const sprCache = {}, sprPending = {};
window.__sprData = function (kind, id, b64) {
  const key = kind + id;
  if (sprPending[key]) {
    sprPending[key](b64);
    delete sprPending[key];
  }
};
function loadSprite(kind, id) {
  const key = kind + id;
  if (!sprCache[key]) {
    sprCache[key] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "sprites/" + kind + "/" + id + ".js" + (window.SPRITE_VER ? "?v=" + window.SPRITE_VER : "");
      sprPending[key] = b64 => {
        s.remove();
        try {
          const bin = atob(b64);
          const seed = (id * 31 + KIND_ID[kind] * 7) & 0xFF;
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i) ^ SPR_KEY[(i + seed) % SPR_KEY.length];
          }
          createImageBitmap(new Blob([bytes], { type: "image/png" })).then(resolve, reject);
        } catch (e) { reject(e); }
      };
      s.onerror = () => { s.remove(); reject(new Error("missing " + s.src)); };
      document.head.appendChild(s);
    }).catch(err => { delete sprCache[key]; throw err; });
  }
  return sprCache[key];
}
/* fit: 裁掉透明边后按原始大小显示 (不放大, 超过 fit 像素才缩小), 用于进化链圆框 */
function spriteCanvas(kind, id, cls, fit) {
  return `<canvas class="${cls || ""}" data-spr="${kind}" data-id="${id}"${fit ? ` data-fit="${fit}"` : ""}></canvas>`;
}
const sprIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    sprIO.unobserve(en.target);
    drawSpriteCanvas(en.target);
  });
}, { rootMargin: "300px" });
function fitSprite(cv, bmp, box) {
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!px[(y * c.width + x) * 4 + 3]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = c.width - 1; y1 = c.height - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, scale = Math.min(1, box / Math.max(w, h));  // 不放大, 像素图保持原始大小
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(c, x0, y0, w, h, 0, 0, w, h);
  cv.style.width = w * scale + "px";
  cv.style.height = h * scale + "px";
}
function drawSpriteCanvas(cv) {
  const kind = cv.dataset.spr, id = +cv.dataset.id;
  loadSprite(kind, id).then(bmp => {
    if (cv.dataset.fit) return fitSprite(cv, bmp, +cv.dataset.fit);
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0);
  }).catch(() => {
    if (kind === "front") {  // 无正面图时回退图标
      cv.dataset.spr = "icon";
      drawSpriteCanvas(cv);
    }
  });
}
function mountSprites(root) {
  (root || document).querySelectorAll("canvas[data-spr]:not([data-mounted])").forEach(cv => {
    cv.setAttribute("data-mounted", "1");
    sprIO.observe(cv);
  });
}
/* 防复制: 禁右键菜单与拖拽 */
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dragstart", e => e.preventDefault());
function typePill(t, small) {
  return `<span class="pill${small ? " small" : ""}" style="background:${t.color}">${esc(t.zh)}</span>`;
}
function typePills(ids, small) {
  return (ids || []).map(id => typePill(TYPE_BY_ID[id] || { zh: "?", color: "#999" }, small)).join("");
}
function splitBadge(sp) {
  return `<span class="pill small split-${esc(sp)}">${esc(sp)}</span>`;
}
const STAT_ZH = { hp: "HP", atk: "攻击", def: "防御", spe: "速度", spa: "特攻", spd: "特防" };
const EV_ZH = ["HP", "攻击", "防御", "速度", "特攻", "特防"];
function statColor(v) {
  if (v >= 120) return "#3ec76a";
  if (v >= 90) return "#7ec84a";
  if (v >= 60) return "#e8c93e";
  if (v >= 40) return "#e8963e";
  return "#e05a5a";
}
function statBar(key, val) {
  const pct = Math.min(100, val / 255 * 100);
  return `<div class="stat-row"><span class="lb">${STAT_ZH[key]}</span><span class="val">${val}</span><span class="bar"><i style="width:${pct}%;background:${statColor(val)}"></i></span></div>`;
}
function genderText(gf) {
  if (gf === -1) return "无性别";
  if (gf == null) return "未知";
  const m = Math.round((100 - gf) * 10) / 10;
  return `♂ ${m}% / ♀ ${gf}%`;
}
function fmtDex(no) { return no == null ? "—" : "#" + no; }
/* 威力: 1 是威力不固定招式的占位值 (按体重/等级等计算, Z/极巨招式随原招式), 显示「变化」 */
function fmtPower(p) { return p === 1 ? "变化" : (p || "—"); }

/* 搜索框: 右侧 ✕ 在有文字时显示, 点击一键清空 (派发 input 事件, 复用各页面自己的筛选监听) */
function searchBox(id, placeholder, value) {
  return `<div class="search-box"><span>🔍</span>
    <input id="${id}" placeholder="${esc(placeholder)}" value="${esc(value)}">
    <button type="button" class="search-clear${value ? "" : " hidden"}" title="清除" onclick="clearSearch('${id}')">✕</button>
  </div>`;
}
window.clearSearch = function (id) {
  const inp = document.getElementById(id);
  inp.value = "";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.focus();
};
document.addEventListener("input", e => {
  const box = e.target.closest ? e.target.closest(".search-box") : null;
  const btn = box && box.querySelector(".search-clear");
  if (btn) btn.classList.toggle("hidden", !e.target.value);
});

/* ---------------- 弹窗 ---------------- */
const mask = $("#popup-mask"), popup = $("#popup");
mask.addEventListener("click", e => { if (e.target === mask) hidePopup(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") hidePopup(); });
function showPopup(html) {
  popup.innerHTML = `<button class="close" onclick="hidePopup()">✕</button>` + html;
  mask.classList.remove("hidden");
}
function hidePopup() { mask.classList.add("hidden"); }
window.hidePopup = hidePopup;

function showMovePopup(mid) {
  const m = MOVE_BY_ID[mid];
  if (!m) return;
  const t = TYPE_BY_ID[m.type] || { zh: "?", color: "#999" };
  // 招式性质: true 蓝色 / false 灰色 (与宝可梦百科一致); 远程/近身按是否接触判断
  const flagPairs = [
    [m.f[0], "接触类招式", "不是接触类招式"],
    [m.f[1], "受守住影响", "不受守住影响"],
    [m.f[2], "受魔法反射影响", "不受魔法反射影响"],
    [m.f[3], "可以被抢先用", "不可以被抢先用"],
    [m.f[4], "受鹦鹉学舌影响", "不受鹦鹉学舌影响"],
    [m.f[5], "受王者之证等类道具影响", "不受王者之证等类道具影响"],
    [!m.f[0], "是远程招式", "是近身招式"],
  ];
  const cats = (m.c || []).map(i => D.moveCats[i]);
  const megaChanges = (m.megaChanges || []).map(change => {
    const species = SPECIES_BY_ID[change.species];
    const oldMove = MOVE_BY_ID[change.oldMove];
    if (!species || !oldMove) return "";
    return `<div class="mega-move-change"><b>${esc(species.zh)}</b> 超级进化时，携带的 <b>${esc(oldMove.zh)}</b> 会变为此招式。</div>`;
  }).filter(Boolean);
  showPopup(`
    <h2>${esc(m.zh)}</h2>
    <div class="mv-meta">${typePill(t)}${splitBadge(m.split)}
      <span class="pill small" style="background:#5a6b7d">威力 ${fmtPower(m.power)}</span>
      <span class="pill small" style="background:#5a6b7d">命中 ${m.acc || "—"}</span>
      <span class="pill small" style="background:#5a6b7d">PP ${m.pp}</span>
      <span class="pill small" style="background:#5a6b7d">优先度 ${m.priority > 0 ? "+" + m.priority : m.priority}</span>
    </div>
    <div class="mv-desc">${m.desc ? esc(m.desc) : "<i>暂无详细描述</i>"}</div>
    <ul class="mv-flags">${flagPairs.map(([v, yes, no]) =>
      `<li class="${v ? "yes" : "no"}">${v ? esc(yes) : esc(no)}</li>`).join("")}</ul>
    ${cats.length ? `<div class="mv-cats"><div class="cats-title">分类</div>${cats.map(c =>
      `<div class="cat-row"><span class="cat-pill">${esc(c.n)}</span>${c.d ? `<span class="cat-note">${esc(c.d)}</span>` : ""}</div>`).join("")}</div>` : ""}
    <dl class="kv">
      ${m.target ? `<dt>目标</dt><dd>${esc(m.target)}</dd>` : ""}
    </dl>
    ${megaChanges.length ? `<div class="mv-mega-changes"><div class="cats-title">超级进化招式变化</div>${megaChanges.join("")}</div>` : ""}`);
}
window.showMovePopup = showMovePopup;

function showAbilityPopup(aid) {
  const a = ABIL_BY_ID[aid];
  if (!a) return;
  const users = (ABIL_USERS[aid] || []).map(id => SPECIES_BY_ID[id]);
  showPopup(`
    <h2>${esc(a.zh)}</h2>
    <div class="mv-desc" style="margin-top:10px">${a.desc ? esc(a.desc) : "<i>暂无描述</i>"}</div>
    <div class="ab-mons">${users.slice(0, 60).map(s => `
      <div class="m" onclick="location.hash='#/p/${s.id}';hidePopup()">
        ${spriteCanvas("front", s.id)}
        <span class="nm">${esc(s.zh)}</span>
      </div>`).join("")}
    </div>`);
  mountSprites(popup);
}
window.showAbilityPopup = showAbilityPopup;

/* ---------------- 路由 ---------------- */
const app = $("#app");
let homeState = { q: "", types: new Set(), form: "", sort: { key: "dex", desc: false } };

function route() {
  const h = location.hash || "#/";
  document.querySelectorAll(".nav a").forEach(a =>
    a.classList.toggle("active", a.getAttribute("href") === h || (a.getAttribute("data-nav") === "dex" && h.startsWith("#/p"))));
  hidePopup();
  window.scrollTo(0, 0);
  if (h.startsWith("#/p/")) renderPokemon(+h.slice(4));
  else if (h.startsWith("#/moves")) renderMoves();
  else if (h.startsWith("#/abilities")) renderAbilities();
  else if (h.startsWith("#/types")) renderTypes();
  else renderHome();
}
window.addEventListener("hashchange", route);

/* ---------------- 左侧目录 (图鉴 / 招式 / 特性 三页共用) ----------------
   items: [{ id: 分节元素 id, label }]; 「（首段）」回到顶部; 隐藏状态三页共用并记住 */
let tocHidden = localStorage.getItem("pkdx_toc_hidden") === "1";
const GEN_NAMES = ["", "第一世代", "第二世代", "第三世代", "第四世代", "第五世代", "第六世代", "第七世代", "第八世代", "第九世代"];
function tocHTML(items) {
  return `<aside class="toc${tocHidden ? " folded" : ""}">
    <div class="toc-head"><b>目录</b><button type="button" class="toc-toggle" onclick="toggleToc()">${tocHidden ? "显示" : "隐藏"}</button></div>
    <ul class="toc-list">
      <li><a onclick="jumpTo('')">（首段）</a></li>
      ${items.map(it => `<li><a data-sec="${it.id}" onclick="jumpTo('${it.id}')">${it.label}</a></li>`).join("")}
    </ul>
    <div class="toc-note hidden" id="toc-note"></div>
  </aside>`;
}
/* 筛选后没有内容的分节在目录里置灰; note 非空时在目录下方显示说明 */
function tocMark(presentIds, note) {
  document.querySelectorAll(".toc-list a[data-sec]").forEach(a => a.classList.toggle("empty", !presentIds.has(a.dataset.sec)));
  const n = $("#toc-note");
  if (n) { n.textContent = note || ""; n.classList.toggle("hidden", !note); }
}
window.jumpTo = function (id) {
  // 直接跳转 (与百科目录一致); 全局 scroll-behavior: smooth 在几万像素的页面上要滚 1~2 秒, 故强制 instant。
  // 宝可梦卡片有 content-visibility 占位高度, 跳转后临近内容展开会把位置推偏, 稍候校正一次
  if (!id) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
  const sec = document.getElementById(id);
  if (!sec) return;
  sec.scrollIntoView({ block: "start", behavior: "instant" });
  setTimeout(() => {
    const top = sec.getBoundingClientRect().top;
    if (top > 90 || top < 40) sec.scrollIntoView({ block: "start", behavior: "instant" });  // 顶栏遮挡由 scroll-margin-top 处理
  }, 80);
};
window.toggleToc = function () {
  tocHidden = !tocHidden;
  localStorage.setItem("pkdx_toc_hidden", tocHidden ? "1" : "0");
  document.querySelector(".toc").classList.toggle("folded", tocHidden);
  document.querySelector(".toc-toggle").textContent = tocHidden ? "显示" : "隐藏";
  if (LANG === "hant") localize(document.querySelector(".toc-toggle"));
};
/* 宝可梦世代: 按全国图鉴编号 (各世代最后一个编号) */
const GEN_DEX_END = [0, 151, 251, 386, 493, 649, 721, 809, 905, 1025];
const dexGen = dex => GEN_DEX_END.findIndex((end, g) => g > 0 && dex <= end);

/* ---------------- 首页 ---------------- */
function monCard(s, statKey) {
  return `<div class="mon-card" onclick="location.hash='#/p/${s.id}'">
    ${spriteCanvas("front", s.id)}
    <div class="no">${fmtDex(s.dex)}</div>
    <div class="nm">${esc(s.zh)}</div>
    <div class="types">${typePills(s.types, true)}</div>
    ${statKey ? `<div class="stat-tag">${STAT_ZH[statKey]} <b>${s.stats[statKey]}</b></div>` : ""}
    ${s.formLabel ? `<div class="form-badge">${esc(s.formLabel)}</div>` : ""}
  </div>`;
}
window.monCard = monCard;

/* 排序: 默认按图鉴编号; 种族值各项默认从高到低, 再点同一项切换升降序 */
const SORT_KEYS = [["dex", "图鉴编号"], ["hp", "HP"], ["atk", "攻击"], ["def", "防御"], ["spa", "特攻"], ["spd", "特防"], ["spe", "速度"]];
function sortChipsHTML() {
  const { key, desc } = homeState.sort;
  return `<span class="chip-label">排序</span>` + SORT_KEYS.map(([k, label]) =>
    `<span class="pill sort-chip${k === key ? " on" : ""}" onclick="setSort('${k}')">${label}${k === key ? (desc ? " ↓" : " ↑") : ""}</span>`).join("");
}

function renderHome() {
  const chips = TYPES_SHOWN.map(t =>
    `<span class="pill${homeState.types.has(t.id) ? " on" : ""}" style="background:${t.color}"
      onclick="toggleType(${t.id})">${esc(t.zh)}</span>`).join("");
  const formChips = [["", "仅默认形态"], ["all", "全部形态"]]
    .concat(Object.keys(FORM_FILTER).map(k => [k, FORM_KIND_ZH[k]]))
    .map(([v, label]) =>
      `<span class="pill form-chip${homeState.form === v ? " on" : ""}" onclick="setForm('${v}')">${label}</span>`).join("");
  app.innerHTML = `
    <div class="toc-layout">
      ${tocHTML(GEN_NAMES.slice(1).map((label, i) => ({ id: "pgen-" + (i + 1), label })))}
      <div class="toc-main">
        <div class="page-title">宝可梦图鉴</div>
        <div class="page-sub">默认形态 ${N_DEFAULT} 只 · 含特殊/地区形态共 ${D.species.length} 只 · 按世代排列 · 点击卡片查看详情</div>
        <div class="toolbar">
          ${searchBox("q", "搜索名称 / 编号 / 形态，如 阿罗拉、超级进化", homeState.q)}
          <div class="type-chips">${formChips}</div>
          <div class="type-chips">${chips}</div>
          <div class="type-chips" id="sort-chips">${sortChipsHTML()}</div>
          <span class="count-hint" id="cnt"></span>
        </div>
        <div id="dex-area"></div>
      </div>
    </div>`;

  $("#q").addEventListener("input", e => { homeState.q = e.target.value.trim(); renderDexArea(); });
  renderDexArea();
}

function matchSpecies(s) {
  const raw = toHans(homeState.q), q = raw.toLowerCase();  // 繁体输入先转简体
  const searching = !!(q || homeState.types.size);
  // 形态筛选优先; 未选形态时默认只显示默认形态, 搜索/属性筛选命中时特殊与地区形态一并显示
  if (homeState.form && homeState.form !== "all") {
    if (!FORM_FILTER[homeState.form](s.formKind)) return false;
  } else if (!homeState.form && !s.isDefault && !searching) {
    return false;
  }
  if (q) {
    // 只按名字表里的实际名字(含其中的字母, 不区分大小写)、图鉴编号与形态词搜索, 不匹配内部常量名
    const hit = s.zh.toLowerCase().includes(q)
      || (s.dex != null && String(s.dex) === q)
      || (s.tags && s.tags.includes(raw));
    if (!hit) return false;
  }
  if (homeState.types.size) {
    // 多选属性须同时具备 (如 火+飞行); 宝可梦最多两种属性, 选三种及以上不会有结果
    for (const t of homeState.types) if (!s.types.includes(t)) return false;
  }
  return true;
}
function renderDexArea() {
  const list = D.species.filter(matchSpecies);
  $("#cnt").textContent = `筛选结果：${list.length}`;
  const { key, desc } = homeState.sort;
  const byStat = key !== "dex";
  const dir = byStat && desc ? -1 : 1;
  const ordered = list.sort((a, b) => {
    if (byStat) return (a.stats[key] - b.stats[key]) * dir || a.dex - b.dex || a.id - b.id;
    return (a.dex - b.dex || (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.id - b.id) * dir;
  });
  const hasDex = ordered.filter(s => s.dex > 0);
  const others = ordered.filter(s => !(s.dex > 0));
  const card = s => monCard(s, byStat ? key : null);
  let html = "";
  const present = new Set();
  if (hasDex.length && byStat) {
    // 按种族值排序是全体排名, 不分世代
    html += `<div class="group-h">按${STAT_ZH[key]}排序</div><div class="dex-grid">${hasDex.map(card).join("")}</div>`;
  } else if (hasDex.length) {
    const byGen = {};
    hasDex.forEach(s => (byGen[dexGen(s.dex)] = byGen[dexGen(s.dex)] || []).push(s));
    Object.keys(byGen).map(Number).sort((a, b) => a - b).forEach(g => {
      present.add("pgen-" + g);
      html += `<section class="gen-sec" id="pgen-${g}">
        <h3 class="gen-h">${GEN_NAMES[g]}<span class="gen-cnt">${byGen[g].length} 只</span></h3>
        <div class="dex-grid">${byGen[g].map(card).join("")}</div>
      </section>`;
    });
  }
  if (others.length) {
    html += `<div class="group-h">其他形态</div><div class="dex-grid">${others.map(card).join("")}</div>`;
  }
  if (!html) html = `<div style="text-align:center;color:var(--muted);padding:60px 0">没有找到符合条件的宝可梦</div>`;
  $("#dex-area").innerHTML = html;
  tocMark(present, byStat ? "按种族值排序时不分世代，切回「图鉴编号」排序即可按世代跳转" : "");
  mountSprites($("#dex-area"));
}
window.toggleType = function (tid) {
  if (homeState.types.has(tid)) homeState.types.delete(tid);
  else homeState.types.add(tid);
  document.querySelectorAll(".type-chips .pill:not(.form-chip):not(.sort-chip)").forEach(el => {
    const m = el.getAttribute("onclick").match(/\d+/);
    if (m) el.classList.toggle("on", homeState.types.has(+m[0]));
  });
  renderDexArea();
};
window.setForm = function (v) {
  homeState.form = v;
  document.querySelectorAll(".form-chip").forEach(el =>
    el.classList.toggle("on", el.getAttribute("onclick").includes(`'${v}'`)));
  renderDexArea();
};
window.setSort = function (k) {
  const s = homeState.sort;
  if (s.key === k && k !== "dex") s.desc = !s.desc;      // 种族值项: 再点切换升降序
  else { s.key = k; s.desc = k !== "dex"; }               // 换项: 编号升序, 种族值降序
  $("#sort-chips").innerHTML = sortChipsHTML();
  renderDexArea();
};

/* ---------------- 详情页 ---------------- */
function evoChainHTML(s) {
  const compId = evoComp[s.id];
  if (!compId) return `<div style="color:var(--muted);font-size:13.5px">该宝可梦没有进化关系。</div>`;
  const members = Object.keys(evoComp).map(Number).filter(id => evoComp[id] === compId);
  const memberSet = new Set(members);
  const mainEdges = [], extraEdges = [];
  members.forEach(id => (SPECIES_BY_ID[id].evolutions || []).forEach(e => {
    if (e.to == null || !memberSet.has(e.to)) return;
    (EVO_MAIN_SKIP[e.method] ? extraEdges : mainEdges).push({ from: id, e });
  }));
  // 特殊形态(超级进化/超极巨化/觉醒形态等)不参与主链层级; 目标同时是主链节点时按主链处理
  const mainTo = new Set(mainEdges.map(x => x.e.to));
  const extraTo = new Set(extraEdges.map(x => x.e.to));
  for (const t of mainTo) extraTo.delete(t);
  const mainNodes = members.filter(id => !extraTo.has(id));
  const incoming = {};
  mainEdges.forEach(x => incoming[x.e.to] = (incoming[x.e.to] || 0) + 1);
  const roots = mainNodes.filter(id => !incoming[id]);
  const level = {};
  const walk = (id, lv) => {
    if (level[id] != null && level[id] >= lv) return;
    level[id] = lv;
    mainEdges.filter(x => x.from === id).forEach(x => walk(x.e.to, lv + 1));
  };
  (roots.length ? roots : mainNodes.slice(0, 1)).forEach(r => walk(r, 0));
  // 画成树: 每个节点挂在一个来源下 (主链取上一级的来源, 特殊形态取其基础形态), 来源右侧并排
  // 它的所有走向 (主链进化在前, 超级进化/超极巨化/觉醒形态等在后), 箭头上写方式, 再下一行写条件/道具
  const inEdge = {}, parentOf = {}, extraKids = [];
  mainNodes.forEach(id => {
    if (!level[id]) return;
    const x = mainEdges.find(x => x.e.to === id && level[x.from] === level[id] - 1) || mainEdges.find(x => x.e.to === id);
    if (x) { inEdge[id] = x.e; parentOf[id] = x.from; }
  });
  extraEdges.forEach(x => {
    const t = x.e.to;
    if (extraTo.has(t) && !inEdge[t]) { inEdge[t] = x.e; parentOf[t] = x.from; extraKids.push(t); }
  });
  const children = {};
  mainNodes.filter(id => inEdge[id]).concat(extraKids)
    .forEach(id => (children[parentOf[id]] = children[parentOf[id]] || []).push(id));
  // 同一形态可由多个来源变成 (如各种皮卡丘都能超极巨化成同一只): 其余来源也画箭头, 目标只画单个节点不再展开
  const leaves = {};
  members.forEach(id => (SPECIES_BY_ID[id].evolutions || []).forEach(e => {
    const t = e.to;
    if (t == null || !memberSet.has(t) || !inEdge[t] || parentOf[t] === id) return;
    const list = leaves[id] = leaves[id] || [];
    if (!list.some(x => x.to === t)) list.push({ to: t, e });
  }));
  // 官方图鉴样式: 圆形头像(底色取第一属性) + 阶段 + 名字/属性框; 箭头上方写进化条件
  const node = (id, stage, ref) => {
    const sp = SPECIES_BY_ID[id], t = TYPE_BY_ID[sp.types[0]];
    return `<div class="evo-node${id === s.id && !ref ? " cur" : ""}" onclick="location.hash='#/p/${id}'">
      <div class="evo-pic" style="background:${t ? `color-mix(in srgb, ${t.color} 45%, #fff)` : "#eef1f4"}">${spriteCanvas("front", id, "", 64)}</div>
      <div class="evo-stage">${esc(stage)}</div>
      <div class="evo-name"><div class="nm">${esc(sp.zh)}</div><div class="types">${typePills(sp.types, true)}</div></div>
    </div>`;
  };
  // 同一对宝可梦可能有多种进化方式 (如通信交换 或 使用联系绳): 箭头上全部列出, 以「或」分隔
  const arrow = (from, to) => `<div class="evo-arrow">${SPECIES_BY_ID[from].evolutions.filter(e => e.to === to)
    .map(e => `<div class="cond">${esc(e.text)}</div>${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}`)
    .join('<div class="or">或</div>')}<div class="arr">→</div></div>`;
  // 阶段: 起点为「未进化」, 每经一次普通进化 +1 阶; 特殊形态写其方式 (超级进化/超极巨化/觉醒形态…)
  const stageOf = (e, depth) => EVO_MAIN_SKIP[e.method] ? [e.text, depth] : [`${depth + 1}阶进化`, depth + 1];
  const seen = new Set();
  const branch = (id, stage, depth) => {
    seen.add(id);
    const kids = (children[id] || []).filter(k => !seen.has(k));
    const rows = kids.map(k => {
      const [st, d] = stageOf(inEdge[k], depth);
      return `<div class="evo-row">${arrow(id, k)}${branch(k, st, d)}</div>`;
    }).concat((leaves[id] || []).map(x =>
      `<div class="evo-row">${arrow(id, x.to)}<div class="evo-branch">${node(x.to, stageOf(x.e, depth)[0], true)}</div></div>`));
    return `<div class="evo-branch">${node(id, stage)}${rows.length ? `<div class="evo-kids">${rows.join("")}</div>` : ""}</div>`;
  };
  return `<div class="evo-chain">${mainNodes.filter(id => !inEdge[id]).map(id => branch(id, "未进化", 0)).join("")}</div>`;
}

function moveRow(mid, lv, tmNo) {
  const m = MOVE_BY_ID[mid];
  if (!m) return "";
  const t = TYPE_BY_ID[m.type] || { zh: "?", color: "#999" };
  return `<tr onclick="showMovePopup(${mid})">
    <td>${lv != null ? `<span class="lv">${lv === 0 ? "进化" : lv === 1 ? "—" : "Lv." + lv}</span>` : (tmNo != null ? `<span class="tm-col-no">${tmNo}</span>` : "")}</td>
    <td class="mv-name">${esc(m.zh)}</td>
    <td>${typePill(t, true)}</td>
    <td>${splitBadge(m.split)}</td>
    <td class="num">${fmtPower(m.power)}</td>
    <td class="num">${m.acc || "—"}</td>
    <td class="num">${m.pp}</td>
  </tr>`;
}

/* 招式表排序: 每个页签独立, 表头点击循环 升序 → 降序 → 默认(等级/编号)顺序 */
let MT_DATA = null, MT_SORT = null;
const SPLIT_ORDER = { "物理": 0, "特殊": 1, "变化": 2 };
function moveSortVal(col, row) {
  const lv = row[0], mid = row[1], label = row[2], m = MOVE_BY_ID[mid];
  switch (col) {
    case "lv": return lv == null ? 1e9 : lv;
    case "no": return label ? (parseInt(label.replace(/\D/g, ""), 10) || 0) + (label[0] === "H" ? 1000 : 0) : 0;
    case "name": return m.zh;
    case "type": return m.type;
    case "split": return SPLIT_ORDER[m.split] ?? 3;
    case "power": return m.power === 0 ? -1 : m.power === 1 ? 0 : m.power;  // — 在「变化」之前
    case "acc": return m.acc || -1;
    case "pp": return m.pp;
  }
}
function renderMoveTable(tab) {
  const s = MT_SORT[tab];
  const rows = MT_DATA[tab].slice();
  if (s.key) rows.sort((x, y) => {
    const a = moveSortVal(s.key, x), b = moveSortVal(s.key, y);
    const c = typeof a === "string" ? a.localeCompare(b, "zh") : a - b;
    return c * s.dir || x[1] - y[1];
  });
  $("#mtb-" + tab).innerHTML = rows.map(r => moveRow(r[1], tab === "lv" ? r[0] : null, tab === "tm" ? r[2] : null)).join("")
    || "<tr><td colspan=7>—</td></tr>";
  document.querySelectorAll(`#tab-${tab} th.sortable .arrow`).forEach(a => {
    a.textContent = a.closest("th").dataset.col === s.key ? (s.dir > 0 ? "▲" : "▼") : "";
  });
}
window.sortMoves = function (tab, col) {
  const s = MT_SORT[tab];
  if (s.key === col) s.dir = -s.dir; else { s.key = col; s.dir = 1; }
  renderMoveTable(tab);
};
window.switchTab = function (btn) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b === btn));
  ["lv", "tm", "tutor", "egg"].forEach(k => $("#tab-" + k).classList.toggle("hidden", k !== btn.dataset.tab));
};
const mvHead = (tab, cols) => "<thead><tr>" + cols.map(([col, label]) =>
  col ? `<th class="sortable" data-col="${col}" onclick="sortMoves('${tab}','${col}')">${label}<span class="arrow"></span></th>`
      : `<th>${label}</th>`).join("") + "</tr></thead>";
const MV_COLS_LV = [["lv", "等级"], ["name", "招式"], ["type", "属性"], ["split", "分类"], ["power", "威力"], ["acc", "命中"], ["pp", "PP"]];
const MV_COLS_NO = [["no", "编号"], ["name", "招式"], ["type", "属性"], ["split", "分类"], ["power", "威力"], ["acc", "命中"], ["pp", "PP"]];
const MV_COLS_PLAIN = [["", ""], ["name", "招式"], ["type", "属性"], ["split", "分类"], ["power", "威力"], ["acc", "命中"], ["pp", "PP"]];

function renderPokemon(id) {
  const s = SPECIES_BY_ID[id];
  if (!s) { app.innerHTML = `<div class="page-title">未找到该宝可梦</div>`; return; }
  const t1 = TYPE_BY_ID[s.types[0]], t2 = TYPE_BY_ID[s.types[1]];
  const c1 = t1 ? t1.color : "#777", c2 = t2 ? t2.color : (t1 ? t1.color : "#777");
  const evTxt = s.evYield.map((v, i) => v > 0 ? `+${v} ${EV_ZH[i]}` : "").filter(Boolean).join("、") || "无";

  const abilityHTML = s.abilities.map(aid => {
    const a = ABIL_BY_ID[aid];
    return `<div class="ability-row"><span class="ab-name" onclick="showAbilityPopup(${aid})">${esc(a.zh)}</span>
      <div class="ab-desc">${esc(a.desc || "")}</div></div>`;
  }).join("");
  const hiddenHTML = s.hidden.map(aid => {
    const a = ABIL_BY_ID[aid];
    return `<div class="ability-row"><span class="ab-name" onclick="showAbilityPopup(${aid})">${esc(a.zh)}<span class="tag">隐藏特性</span></span>
      <div class="ab-desc">${esc(a.desc || "")}</div></div>`;
  }).join("");

  const tmNames = {};
  D.tms.forEach(t => tmNames[t.move] = tmNames[t.move] || t.label);
  MT_DATA = {
    lv: [...s.levelUp],
    tm: s.tm.map(mid => [null, mid, tmNames[mid] || ""]),
    tutor: s.tutor.map(mid => [null, mid]),
    egg: s.egg.map(mid => [null, mid]),
  };
  MT_SORT = { lv: { key: null, dir: 1 }, tm: { key: null, dir: 1 }, tutor: { key: null, dir: 1 }, egg: { key: null, dir: 1 } };

  app.innerHTML = `
    <a class="back-link" href="#/">← 返回图鉴</a>
    <div class="hero" style="background:linear-gradient(120deg, ${c1}, ${c2})">
      ${spriteCanvas("front", s.id, "hero-spr")}
      <div>
        <div class="dex-no">${fmtDex(s.dex)}</div>
        <div class="nm">${esc(s.zh)}</div>
        ${s.formLabel ? `<div style="margin-top:6px"><span class="pill small" style="background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.45)">${esc(s.formLabel)}</span></div>` : ""}
        <div class="types">${typePills(s.types)}</div>
      </div>
    </div>

    <div class="detail-grid">
      <section class="card sec full">
        <h3>图鉴介绍</h3>
        <p class="flavor">${s.flavor ? esc(s.flavor) : "<i>暂无图鉴介绍。</i>"}</p>
      </section>

      <section class="card sec">
        <h3>种族值 <span style="color:var(--muted);font-weight:600;font-size:12px">总和 ${s.total}</span></h3>
        ${Object.keys(STAT_ZH).map(k => statBar(k, s.stats[k])).join("")}
        <div class="stat-total"><span class="lb" style="width:66px;font-size:13px;color:var(--muted);font-weight:700">总和</span><span class="val">${s.total}</span></div>
      </section>

      <section class="card sec">
        <h3>特性</h3>
        ${abilityHTML || "<i style='color:var(--muted)'>无</i>"}
        ${hiddenHTML ? `<h3 style="margin-top:14px">隐藏特性</h3>${hiddenHTML}` : ""}
      </section>

      <section class="card sec">
        <h3>基本资料</h3>
        <dl class="kv">
          <dt>身高</dt><dd>${s.height || "—"} m</dd>
          <dt>体重</dt><dd>${s.weight || "—"} kg</dd>
          <dt>捕获率</dt><dd>${s.catchRate}</dd>
          <dt>基础经验</dt><dd>${s.expYield}</dd>
          <dt>努力值</dt><dd>${evTxt}</dd>
          ${s.heldItems.length ? `<dt>可携带</dt><dd>${s.heldItems.map(esc).join("、")}</dd>` : ""}
        </dl>
      </section>

      <section class="card sec">
        <h3>培育资料</h3>
        <dl class="kv">
          <dt>性别比例</dt><dd>${genderText(s.genderF)}</dd>
          <dt>蛋组</dt><dd>${s.eggGroups.length ? s.eggGroups.map(esc).join("、") : "—"}${s.eggGroups.length && s.eggCycles ? " · " : ""}${s.eggCycles ? `孵化约 ${s.eggCycles * 257} 步` : ""}</dd>
          <dt>亲密度</dt><dd>${s.friendship}</dd>
          <dt>成长速度</dt><dd>${esc(s.growth || "—")}</dd>
        </dl>
      </section>

      <section class="card sec full">
        <h3>进化链</h3>
        ${evoChainHTML(s)}
      </section>

      <section class="card sec full">
        <h3>招式表</h3>
        <div class="tabs">
          <button class="on" data-tab="lv" onclick="switchTab(this)">升级招式</button>
          <button data-tab="tm" onclick="switchTab(this)">招式学习器（${s.tm.length}）</button>
          <button data-tab="tutor" onclick="switchTab(this)">教学招式（${s.tutor.length}）</button>
          <button data-tab="egg" onclick="switchTab(this)">蛋招式（${s.egg.length}）</button>
        </div>
        <div id="tab-lv">
          <table class="move-table">${mvHead("lv", MV_COLS_LV)}<tbody id="mtb-lv"></tbody></table>
        </div>
        <div id="tab-tm" class="hidden">
          <table class="move-table">${mvHead("tm", MV_COLS_NO)}<tbody id="mtb-tm"></tbody></table>
        </div>
        <div id="tab-tutor" class="hidden">
          <table class="move-table">${mvHead("tutor", MV_COLS_PLAIN)}<tbody id="mtb-tutor"></tbody></table>
        </div>
        <div id="tab-egg" class="hidden">
          <table class="move-table">${mvHead("egg", MV_COLS_PLAIN)}<tbody id="mtb-egg"></tbody></table>
        </div>
      </section>
    </div>`;
  ["lv", "tm", "tutor", "egg"].forEach(renderMoveTable);
  mountSprites(app);
}

/* ---------------- 招式页 ---------------- */
let moveFilter = { q: "", type: "", split: "", cat: "" };
/* 招式类别: 按 moveCats 的官方顺序去重 (连续/反作用力/存在追加效果有多条说明变体), 附带数量 */
const MOVE_CAT_NAMES = {}, MOVE_CAT_COUNT = {}, MOVE_CAT_ORDER = [];
D.moves.forEach(m => {
  const names = new Set((m.c || []).map(i => D.moveCats[i].n));
  MOVE_CAT_NAMES[m.id] = names;
  if (m.id) names.forEach(n => MOVE_CAT_COUNT[n] = (MOVE_CAT_COUNT[n] || 0) + 1);
});
D.moveCats.forEach(c => { if (MOVE_CAT_COUNT[c.n] && !MOVE_CAT_ORDER.includes(c.n)) MOVE_CAT_ORDER.push(c.n); });
/* 世代: 1-9 对照 52poke 招式列表, 10 为原创招式 (排在第九世代后); 世代内按官方编号排序 */
const MOVES_BY_GEN = D.moves.filter(m => m.id).sort((a, b) => a.gen - b.gen || a.no - b.no || a.id - b.id);
function renderMoves() {
  const typeOpts = TYPES_SHOWN.map(t => `<option value="${t.id}">${esc(t.zh)}</option>`).join("");
  const catOpts = MOVE_CAT_ORDER.map(n => `<option value="${esc(n)}">${esc(n)}（${MOVE_CAT_COUNT[n]}）</option>`).join("");
  app.innerHTML = `
    <div class="toc-layout">
      ${tocHTML(GEN_NAMES.slice(1).map((label, i) => ({ id: "gen-" + (i + 1), label })).concat([{ id: "gen-10", label: "原创招式" }]))}
      <div class="toc-main">
        <div class="page-title">招式图鉴</div>
        <div class="page-sub">共 ${MOVES_BY_GEN.length} 个招式 · 按世代排序，原创招式在第九世代之后 · 点击行查看详情</div>
        <div class="toolbar">
          ${searchBox("mq", "搜索招式名…", moveFilter.q)}
          <select id="mtype" class="search-box" style="flex:0 0 140px">
            <option value="">全部属性</option>${typeOpts}
          </select>
          <select id="msplit" class="search-box" style="flex:0 0 120px">
            <option value="">全部分类</option><option>物理</option><option>特殊</option><option>变化</option>
          </select>
          <select id="mcat" class="search-box" style="flex:0 0 190px">
            <option value="">全部类别</option>${catOpts}
          </select>
          <span class="count-hint" id="mcnt"></span>
        </div>
        <div id="mgens"></div>
      </div>
    </div>`;
  $("#mtype").value = moveFilter.type;
  $("#msplit").value = moveFilter.split;
  $("#mcat").value = moveFilter.cat;
  $("#mq").addEventListener("input", e => { moveFilter.q = e.target.value.trim(); renderMoveRows(); });
  $("#mtype").addEventListener("change", e => { moveFilter.type = e.target.value; renderMoveRows(); });
  $("#msplit").addEventListener("change", e => { moveFilter.split = e.target.value; renderMoveRows(); });
  $("#mcat").addEventListener("change", e => { moveFilter.cat = e.target.value; renderMoveRows(); });
  renderMoveRows();
}
function renderMoveRows() {
  const q = toHans(moveFilter.q).toLowerCase();
  const rows = MOVES_BY_GEN.filter(m => {
    if (q && !m.zh.toLowerCase().includes(q)) return false;
    if (moveFilter.type !== "" && String(m.type) !== moveFilter.type) return false;
    if (moveFilter.split && m.split !== moveFilter.split) return false;
    if (moveFilter.cat && !MOVE_CAT_NAMES[m.id].has(moveFilter.cat)) return false;
    return true;
  });
  $("#mcnt").textContent = `${rows.length} 个招式`;
  const byGen = {};
  rows.forEach(m => (byGen[m.gen] = byGen[m.gen] || []).push(m));
  const row = m => `<tr onclick="showMovePopup(${m.id})">
      <td class="mv-name">${esc(m.zh)}</td>
      <td>${typePill(TYPE_BY_ID[m.type] || { zh: "?", color: "#999" }, true)}</td>
      <td>${splitBadge(m.split)}</td>
      <td class="num">${fmtPower(m.power)}</td>
      <td class="num">${m.acc || "—"}</td>
      <td class="num">${m.pp}</td>
      <td class="num">${m.priority > 0 ? "+" + m.priority : m.priority}</td>
    </tr>`;
  $("#mgens").innerHTML = Object.keys(byGen).map(Number).sort((a, b) => a - b).map(g => `
    <section class="gen-sec" id="gen-${g}">
      <h3 class="gen-h">${GEN_NAMES[g] || "原创招式"}<span class="gen-cnt">${byGen[g].length} 个</span></h3>
      <div class="card" style="overflow:auto">
        <table class="list-table">
          <thead><tr><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th><th>优先度</th></tr></thead>
          <tbody>${byGen[g].map(row).join("")}</tbody>
        </table>
      </div>
    </section>`).join("") || `<div style="text-align:center;color:var(--muted);padding:60px 0">没有找到符合条件的招式</div>`;
  // 目录: 筛选后没有招式的世代置灰
  tocMark(new Set(Object.keys(byGen).map(g => "gen-" + g)));
}

/* ---------------- 特性页 ---------------- */
let abilFilter = "";
const ABILS_BY_GEN = D.abilities.filter(a => a.id).sort((a, b) => a.gen - b.gen || a.no - b.no || a.id - b.id);
function renderAbilities() {
  app.innerHTML = `
    <div class="toc-layout">
      ${tocHTML([3, 4, 5, 6, 7, 8, 9].map(g => ({ id: "agen-" + g, label: GEN_NAMES[g] + "引入" })).concat([{ id: "agen-10", label: "原创特性" }]))}
      <div class="toc-main">
        <div class="page-title">特性图鉴</div>
        <div class="page-sub">共 ${D.abilities.length} 个特性 · 按引入世代排列，原创特性在最后 · 点击查看持有该特性的宝可梦</div>
        <div class="toolbar">
          ${searchBox("aq", "搜索特性名…", abilFilter)}
          <span class="count-hint" id="acnt"></span>
        </div>
        <div id="agens"></div>
      </div>
    </div>`;
  $("#aq").addEventListener("input", e => { abilFilter = e.target.value.trim(); renderAbilRows(); });
  renderAbilRows();
}
function renderAbilRows() {
  const aq = toHans(abilFilter).toLowerCase();
  const list = ABILS_BY_GEN.filter(a => !aq || a.zh.toLowerCase().includes(aq));
  $("#acnt").textContent = `${list.length} 个特性`;
  const byGen = {};
  list.forEach(a => (byGen[a.gen] = byGen[a.gen] || []).push(a));
  const row = a => `<tr onclick="showAbilityPopup(${a.id})">
      <td class="mv-name">${esc(a.zh)}</td>
      <td style="color:var(--muted)">${esc(a.desc || "")}</td>
    </tr>`;
  $("#agens").innerHTML = Object.keys(byGen).map(Number).sort((a, b) => a - b).map(g => `
    <section class="gen-sec" id="agen-${g}">
      <h3 class="gen-h">${GEN_NAMES[g] || "原创特性"}引入<span class="gen-cnt">${byGen[g].length} 个</span></h3>
      <div class="card" style="overflow:auto">
        <table class="list-table">
          <thead><tr><th style="width:170px">特性</th><th>效果</th></tr></thead>
          <tbody>${byGen[g].map(row).join("")}</tbody>
        </table>
      </div>
    </section>`).join("") || `<div style="text-align:center;color:var(--muted);padding:60px 0">没有找到符合条件的特性</div>`;
  tocMark(new Set(Object.keys(byGen).map(g => "agen-" + g)));
}

/* ---------------- 属性相性页 ---------------- */
function renderTypes() {
  const shown = TYPES_SHOWN;
  const head = shown.map(t => `<th title="${esc(t.zh)}">${esc(t.zh)}</th>`).join("");
  const rows = shown.map(at => {
    const cells = shown.map(df => {
      const mul = (D.typeChart[String(at.id)] || {})[String(df.id)];
      let cls = "", txt = "";
      if (mul === 2) { cls = "atk2"; txt = "×2"; }
      else if (mul === 0.5) { cls = "atk05"; txt = "×½"; }
      else if (mul === 0) { cls = "atk0"; txt = "×0"; }
      else txt = "";
      return `<td class="${cls}">${txt}</td>`;
    }).join("");
    return `<tr><th><span class="pill small" style="background:${at.color}">${esc(at.zh)}</span></th>${cells}</tr>`;
  }).join("");
  app.innerHTML = `
    <div class="page-title">属性相性表</div>
    <div class="page-sub">纵向为攻击方属性，横向为防御方属性</div>
    <div class="card chart-wrap">
      <table class="chart"><thead><tr><th>攻↘ 防→</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div class="legend">
      <span><i style="background:#d9f2d9"></i>效果绝佳 ×2</span>
      <span><i style="background:#fde3e3"></i>效果不好 ×½</span>
      <span><i style="background:#6b7684"></i>无效 ×0</span>
    </div>`;
}

/* ---------------- 启动 ---------------- */
window.addEventListener("error", e => {
  console.error(e.message);
});
try {
  setLang(LANG);  // 先套用记住的语言 (顶栏 + 标题), 之后渲染的内容由 MutationObserver 转换
  route();
} catch (err) {
  app.innerHTML = `<div class="page-title">页面渲染出错</div><pre style="white-space:pre-wrap">${esc(err.stack || err)}</pre>`;
}

/* ---------------- 离线/本地使用: 文件更新后自动刷新 ----------------
   仅本地 (localhost / 局域网 IP / file:) 生效, 线上站靠版本号即可;
   轮询 data.js 与 app.js 的内容摘要, 有变化就整页刷新一次 (刷新后以新内容为基准, 不会循环) */
(function () {
  const host = location.hostname;
  const isLocal = location.protocol === "http:" &&
    (/^localhost$/i.test(host) || /^127\.|^0\.0\.0\.0|^::1$/.test(host) ||
     /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host) || /\.local$/i.test(host));
  if (!isLocal) return;
  const dgst = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h + ":" + s.length; };
  const base = {};
  Promise.all([
    fetch("data/data.js", { cache: "no-store" }).then(r => r.text()),
    fetch("app.js", { cache: "no-store" }).then(r => r.text()),
  ]).then(([d, a]) => { base.data = dgst(d); base.app = dgst(a); }).catch(() => {});
  setInterval(() => {
    if (!base.data) return;
    Promise.all([
      fetch("data/data.js", { cache: "no-store" }).then(r => r.text()),
      fetch("app.js", { cache: "no-store" }).then(r => r.text()),
    ]).then(([d, a]) => {
      const nd = dgst(d), na = dgst(a);
      if (nd !== base.data || na !== base.app) {
        base.data = nd; base.app = na;
        location.reload();
      }
    }).catch(() => { /* 本地服务不可达时静默 */ });
  }, 8000);
})();
