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
const HANS_CACHE = new Map();  // 搜索框每键都会对同一查询反复转简体, 缓存一下 (matchSpecies 每只精灵都会调用)
const toHans = s => {
  let v = HANS_CACHE.get(s);
  if (v === undefined) {
    v = s.replace(/[^\x00-\x7f]/g, c => HANT.t2s[c] || c);
    if (HANS_CACHE.size > 500) HANS_CACHE.clear();
    HANS_CACHE.set(s, v);
  }
  return v;
};
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
  if (document.getElementById("cm-card")) cmDraw();  // 卡面是 canvas 画的, 切繁体后需重绘
};
window.setTheme = function (t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("pkdx_theme", t);
  document.querySelectorAll(".theme-switch button").forEach(b => b.classList.toggle("on", b.dataset.themeBtn === t));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === "dark" ? "#1a1d24" : t === "sepia" ? "#f0e6d2" : "#ee1515";
};
(function () {
  const saved = localStorage.getItem("pkdx_theme");
  if (saved) setTheme(saved);
  else document.querySelector('.theme-switch button[data-theme-btn="light"]').classList.add("on");
})();

/* ---------------- 基础索引 ---------------- */
const TYPE_BY_ID = {};        D.types.forEach(t => TYPE_BY_ID[t.id] = t);
const ABIL_BY_ID = {};        D.abilities.forEach(a => ABIL_BY_ID[a.id] = a);
const MOVE_BY_ID = {};        D.moves.forEach(m => MOVE_BY_ID[m.id] = m);
const SPECIES_BY_ID = {};     D.species.forEach(s => SPECIES_BY_ID[s.id] = s);
const TYPES_SHOWN = D.types.filter(t => !t.pseudo);
const SPECIES_FILTER_TYPES = TYPES_SHOWN.filter(t => t.en !== "MYSTERY" && t.en !== "STELLAR");

/* 有该特性的宝可梦 (普通+隐藏) */
const ABIL_USERS = {};
D.species.forEach(s => {
  s.abilities.concat(s.hidden).forEach(a => {
    (ABIL_USERS[a] = ABIL_USERS[a] || []).push(s.id);
  });
});
/* 能学该招式的宝可梦 (levelUp/tm/tutor/egg 全部来源一次建索引, 各形态按自身学招表) */
const MOVE_USERS = {};
D.species.forEach(s => {
  const mids = new Set(s.levelUp.map(r => r[1]));
  s.tm.concat(s.tutor, s.egg).forEach(mid => mids.add(mid));
  mids.forEach(mid => {
    if (mid) (MOVE_USERS[mid] = MOVE_USERS[mid] || new Set()).add(s.id);
  });
});

/* 进化链: 组件划分 */
const EVO_MAIN_SKIP = { EVO_MEGA: 1, EVO_GIGANTAMAX: 1, EVO_AWAKEN: 1, EVO_FORM_ABILITY: 1 };
const FORM_KIND_ZH = { awaken: "觉醒形态", mega: "超级进化", giga: "超极巨化", primal: "原始回归", regional: "地区形态", alt: "特殊形态" };
const FORM_ABILITY_TRANSITIONS = [
  { from: "DARMANITAN", to: "DARMANITANZEN", ability: "ZENMODE", note: "HP≤最大HP的一半时变为达摩模式；HP高于一半时恢复原形。" },
  { from: "DARMANITAN_G", to: "DARMANITAN_G_ZEN", ability: "ZENMODE", note: "HP≤最大HP的一半时变为达摩模式；HP高于一半时恢复原形。" },
  { from: "ZYGARDE", to: "ZYGARDE_COMPLETE", ability: "POWERCONSTRUCT" },
  { from: "ZYGARDE_10", to: "ZYGARDE_COMPLETE", ability: "POWERCONSTRUCT" },
  { from: "WISHIWASHI", to: "WISHIWASHI_S", ability: "SCHOOLING", note: "等级达到20且HP高于最大HP的四分之一时聚集；等级不足20或HP不高于四分之一时恢复原形。" },
  ...["RED", "BLUE", "ORANGE", "YELLOW", "INDIGO", "GREEN", "VIOLET"].map(color => ({
    from: "MINIOR_SHIELD",
    to: `MINIOR_${color}`,
    ability: "SHIELDSDOWN",
    note: "HP降至最大HP的一半以下时变为核心形态；HP高于一半时恢复陨石形态。",
  })),
  { from: "CHERRIM", to: "CHERRIM_SUN", ability: "FLOWERGIFT", note: "有效晴天且未学习觉醒力量、未携带觉醒能量时变为花朵形态；阳光消失后恢复原形。" },
  { from: "MORPEKO", to: "MORPEKO_HANGRY", ability: "HUNGERSWITCH", note: "每回合结束时交替改变形态；太晶化期间不会切换。" },
  { from: "GRENINJA", to: "ASHGRENINJA", ability: "BATTLEBOND", note: "打倒对手后变为牵绊形态。" },
  { from: "MIMIKYU", to: "MIMIKYU_BUSTED", ability: "DISGUISE", note: "替身布偶受到攻击后破损；换下场后恢复原形。" },
  { from: "CRAMORANT", to: ["CRAMORANT_GULPING", "CRAMORANT_GORGING"], ability: "GULPMISSILE", note: "使用冲浪或潜水时变形；HP高于一半为一口吞形态，不高于一半为大口吞形态，受到攻击后恢复原形。" },
  { from: "AEGISLASH", to: "AEGISLASH_BLADE", ability: "STANCECHANGE", note: "使用攻击招式变为剑形态；使用王者盾牌后恢复盾牌形态。" },
  { from: "EISCUE", to: "EISCUE_NOICE", ability: "ICEFACE", note: "受到物理攻击后变为解冻头形态；冰雹天气下出场时恢复结冻头形态。" },
  { from: "TERAPAGOS", to: "TERAPAGOS_TERASTAL", ability: "TERASHIFT", note: "出场时变为太晶形态。" },
  { from: "TERAPAGOS_TERASTAL", to: "TERAPAGOS_STELLAR", text: "太晶化", note: "发动太晶化时变为星晶形态。" },
  { from: "PALAFIN", to: "PALAFIN_HERO", ability: "ZEROTOHERO", note: "离场后再次出场时变为英雄形态；之后再次离场会恢复原形。" },
  { from: "CALYREX", to: "CALYREX_ICE_RIDER", ability: "ASONEICERIDER", note: "使用牵绊缰绳与雪暴马合体。" },
  { from: "CALYREX", to: "CALYREX_SHADOW_RIDER", ability: "ASONESHADOWRIDER", note: "使用牵绊缰绳与灵幽马合体。" },
  ...["ARCEUS", "SILVALLY"].flatMap(baseName => {
    const base = D.species.find(s => s.en === baseName);
    if (!base) return [];
    const ability = baseName === "ARCEUS" ? "MULTITYPE" : "RKSSYSTEM";
    const note = baseName === "ARCEUS"
      ? "携带对应属性的石板或Z纯晶时改变属性和形态；卸下后恢复原形。"
      : "携带对应属性的存储碟时改变属性和形态；卸下后恢复原形。";
    return D.species.filter(s => s.en.startsWith(baseName + "_") && s.dex === base.dex)
      .map(s => ({ from: baseName, to: s.en, ability, note }));
  }),
];
const FORM_ABILITY_EDGES = FORM_ABILITY_TRANSITIONS.flatMap(({ from, to, ability, text, note }) =>
  (Array.isArray(to) ? to : [to]).map(target => {
    const source = D.species.find(s => s.en === from);
    const targetSpecies = D.species.find(s => s.en === target);
    const formAbility = ability && D.abilities.find(a => a.en === ability);
    if (!source || !targetSpecies || (!formAbility && !text)) return null;
    return {
      from: source.id,
      edge: { to: targetSpecies.id, method: "EVO_FORM_ABILITY", text: text || formAbility.zh, note: note || formAbility.desc },
    };
  })
).filter(Boolean);
const speciesEvolutions = id => (SPECIES_BY_ID[id].evolutions || []).concat(
  FORM_ABILITY_EDGES.filter(x => x.from === id).map(x => x.edge)
);
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
D.species.forEach(s => speciesEvolutions(s.id).forEach(e => {
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
/* 搜索每键会重建整页卡片/表格 (桌面 ~15ms, 低端手机 3-6 倍), 防抖一下手感更稳 */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const SEARCH_DEBOUNCE = 150;

/* ---------------- 精灵图加密加载 ----------------
   sprites/bundle_<分块>.js 为 XOR 加密 base64 的合并文件 (每 SPRITE_CHUNK 个编号一块,
   front/icon/front_shiny 三类打包在一起, 约 170KB): 动态 <script> 载入后解密为 ImageBitmap,
   用 canvas 绘制 (无 <img>, 右键另存不可用)。
   合并让离线预缓存从 ~4700 个请求降到 ~25 个; 代价是看一只精灵会顺带载入同块其他个体
   (仅首次, 之后走缓存)。密钥/分块须与 tools/extract_data.py 的 SPR_KEY/SPRITE_CHUNK 一致。 */
const SPR_KEY = [0x5A, 0xC3, 0x11, 0x9E, 0x37, 0x6B, 0xD2, 0x84,
                 0x1F, 0xA6, 0x48, 0xE0, 0x73, 0xCB, 0x95, 0x2D];
const KIND_ID = { front: 0, icon: 1, front_shiny: 2 };
const SPRITE_CHUNK = 64;
const sprCache = {}, sprStore = {}, sprBundleJobs = {};
window.__sprData = function (kind, id, b64) {
  sprStore[kind + id] = b64;
};
function bundleOf(id) {
  return "sprites/bundle_" + Math.floor(id / SPRITE_CHUNK) + ".js";
}
/* bundle 清单: sprites/manifest.json 记录实际生成的 bundle (SW 已预缓存, 离线可用);
   不存在的 bundle 直接快速失败不发请求, 避免 404 污染控制台; 清单拉取失败降级为直接请求 */
let manifestReady = null;
function knownBundles() {
  if (!manifestReady) {
    manifestReady = fetch("sprites/manifest.json" + (window.SPRITE_VER ? "?v=" + window.SPRITE_VER : ""))
      .then(r => r.ok ? r.json() : null)
      .then(m => new Set((m && m.bundles) || []))
      .catch(() => { manifestReady = null; return null; });
  }
  return manifestReady;
}
function ensureBundle(bundle) {
  if (!sprBundleJobs[bundle]) {
    const name = bundle.slice(bundle.lastIndexOf("/") + 1);
    const job = knownBundles().then(known => {
      if (known && !known.has(name)) throw new Error("missing bundle " + name);
      // fetch 加载 (原来用 <script> 注入, 缺失文件的 404 是浏览器原生报错 catch 不掉); SW 对 fetch 同样拦截缓存
      return fetch(bundle + (window.SPRITE_VER ? "?v=" + window.SPRITE_VER : "")).then(r => {
        if (!r.ok) throw new Error("missing " + bundle);
        return r.text();
      }).then(code => { (0, eval)(code); });
    });
    sprBundleJobs[bundle] = job;
    job.catch(() => { delete sprBundleJobs[bundle]; });  // 失败不缓存, 之后进入视口时重试
  }
  return sprBundleJobs[bundle];
}
function loadSprite(kind, id) {
  const key = kind + id;
  if (!sprCache[key]) {
    sprCache[key] = ensureBundle(bundleOf(id)).then(() => {
      const b64 = sprStore[key];
      if (b64 == null) throw new Error("no sprite " + key);
      const bin = atob(b64);
      const seed = (id * 31 + KIND_ID[kind] * 7) & 0xFF;
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i) ^ SPR_KEY[(i + seed) % SPR_KEY.length];
      }
      return createImageBitmap(new Blob([bytes], { type: kind === "icon" ? "image/png" : "image/webp" }));
    }).catch(err => { delete sprCache[key]; throw err; });
  }
  return sprCache[key];
}
/* fit: 裁掉透明边后按原始大小显示 (不放大, 超过 fit 像素才缩小), 用于进化链圆框 */
/* toggle: 点击切换闪光/普通 */
function spriteCanvas(kind, id, cls, fit, toggle) {
  const ev = toggle ? ` onclick="${kind === "front" ? "event.stopPropagation()" : ""};toggleShiny(this)" style="cursor:pointer"` : "";
  return `<canvas class="${cls || ""}" data-spr="${kind}" data-id="${id}"${fit ? ` data-fit="${fit}"` : ""}${ev}></canvas>`;
}
function toggleShiny(cv) {
  if (cv.dataset.spr === "front") {
    cv.dataset.spr = "front_shiny";
  } else if (cv.dataset.spr === "front_shiny") {
    cv.dataset.spr = "front";
  } else {
    return;
  }
  const key = cv.dataset.spr + cv.dataset.id;
  if (!sprCache[key]) {
    drawSpriteCanvas(cv);
  } else {
    sprCache[key].then(bmp => {
      if (cv.dataset.fit) return fitSprite(cv, bmp, +cv.dataset.fit);
      cv.width = bmp.width; cv.height = bmp.height;
      cv.getContext("2d").drawImage(bmp, 0, 0);
      cv.style.width = ""; cv.style.height = "";
    }).catch(() => { cv.dataset.spr = "front"; });  // 闪光图缺失: 还原状态, 画面保持普通图, 不产生 unhandled rejection
  }
}
window.toggleShiny = toggleShiny;
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
  // 块后半段的精灵进入预加载区时提前拉取下一块 bundle, 减少连续滚动白屏; 失败静默, 到时走正常加载路径
  if (id % SPRITE_CHUNK >= SPRITE_CHUNK / 2) ensureBundle(bundleOf(id + SPRITE_CHUNK)).catch(() => {});
  loadSprite(kind, id).then(bmp => {
    if (cv.dataset.fit) return fitSprite(cv, bmp, +cv.dataset.fit);
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0);
  }).catch(() => {
    if (kind === "front") {  // 无正面图时回退图标
      cv.dataset.spr = "icon";
      drawSpriteCanvas(cv);
    } else if (kind === "front_shiny") {  // 闪光图缺失: 状态还原回普通图, 画面保持不变
      cv.dataset.spr = "front";
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
const SPECIES_NAME_PREFIX = { mega: "超级", awaken: "觉醒", giga: "超极巨化" };
const SPECIES_NAME_SUFFIX = {
  ZYGARDE: "50%形态",
  ZYGARDE50_MEGA: "50%形态",
  ZYGARDE_COMPLETE: "完全体形态",
  ZYGARDE_MEGA: "完全体形态",
  ZYGARDE_10: "10%形态",
  ASHGRENINJA: "（小智版）",
  MIMIKYU_BUSTED: "（破布形态）",
  CRAMORANT_GULPING: "（一口吞形态）",
  CRAMORANT_GORGING: "（大口吞形态）",
  AEGISLASH_BLADE: "（剑形态）",
  EISCUE_NOICE: "（解冻头形态）",
  TERAPAGOS_TERASTAL: "（太晶形态）",
  TERAPAGOS_STELLAR: "（星晶形态）",
  PALAFIN_HERO: "（英雄形态）",
  CALYREX_ICE_RIDER: "（骑白马形态）",
  CALYREX_SHADOW_RIDER: "（骑黑马形态）",
};
const MEGA_BASE_SPECIES = {
  ZYGARDE_MEGA: "ZYGARDE_COMPLETE",
  ZYGARDE50_MEGA: "ZYGARDE",
};
function speciesName(s) {
  const typeForm = /^(ARCEUS|SILVALLY)_/.test(s.en) && TYPE_BY_ID[s.types[0]]
    ? `（${TYPE_BY_ID[s.types[0]].zh}属性）` : "";
  return (SPECIES_NAME_PREFIX[s.formKind] || "") + s.zh + (SPECIES_NAME_SUFFIX[s.en] || "") + typeForm;
}
function splitBadge(sp) {
  return `<span class="pill small split-${esc(sp)}">${esc(sp)}</span>`;
}
const STAT_ZH = { hp: "HP", atk: "攻击", def: "防御", spa: "特攻", spd: "特防", spe: "速度" };
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
document.addEventListener("keydown", e => {
  if (e.key === "Escape") hidePopup();
  else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    // 详情页翻页: 输入类元素聚焦或弹窗打开时不触发
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
    if (!mask.classList.contains("hidden")) return;
    dexStep(e.key === "ArrowLeft" ? -1 : 1);
  }
});
/* 全局序列翻页 (键盘 ←/→ 与移动端滑动共用); hash 非 #/p/数字 时静默不动 */
function dexStep(dir) {
  const m = /^#\/p\/(\d+)$/.exec(location.hash);
  if (!m) return;
  const cur = SPECIES_BY_ID[+m[1]];
  const pos = cur && DEX_SEQ_INDEX.get(cur.id);
  if (pos == null) return;
  const t = dir < 0 ? DEX_SEQ[pos - 1] : DEX_SEQ[pos + 1];
  if (t) location.hash = "#/p/" + t.id;
}
/* 详情页左右滑动翻页: 水平位移 ≥60px 且明显大于垂直位移才触发; 起点在表格(横滚)或输入区时忽略 */
let touchStart = null;
document.addEventListener("touchstart", e => {
  if (e.touches.length !== 1) { touchStart = null; return; }
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });
document.addEventListener("touchend", e => {
  if (!touchStart || e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y, dt = Date.now() - touchStart.t;
  touchStart = null;
  if (dt > 900 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
  if (!mask.classList.contains("hidden")) return;
  if (e.target.closest("table, input, textarea")) return;
  dexStep(dx < 0 ? 1 : -1);   // 左滑下一只, 右滑上一只
});
/* 移动端顶栏齿轮菜单: 点齿轮开合, 点击面板外收起 */
window.toggleTopMenu = function (e) {
  e.stopPropagation();
  $("#topbar-extras").classList.toggle("open");
};
document.addEventListener("click", e => {
  if (e.target.closest("#topbar-extras, #menu-toggle")) return;
  $("#topbar-extras")?.classList.remove("open");
});
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
    const baseEn = MEGA_BASE_SPECIES[species.en] || species.en.replace(/_MEGA(?:_[A-Z0-9]+)?$/, "");
    const baseSpecies = D.species.find(s => s.en === baseEn && s.dex === species.dex && s.formKind !== "mega");
    if (!baseSpecies) return "";
    return `<div class="mega-move-change"><b>${esc(speciesName(baseSpecies))}</b> 超级进化为 <b>${esc(speciesName(species))}</b> 时，携带的 <b>${esc(oldMove.zh)}</b> 会变为此招式。</div>`;
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
        <span class="nm">${esc(speciesName(s))}</span>
      </div>`).join("")}
    </div>`);
  mountSprites(popup);
}
window.showAbilityPopup = showAbilityPopup;

/* ---------------- 路由 ---------------- */
const app = $("#app");
$("#back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
let homeState = { q: "", types: new Set(), form: "", sort: { key: "dex", desc: false }, view: localStorage.getItem("pkdx_dex_view") === "list" ? "list" : "card", favOnly: false };
/* 我的收藏 (localStorage): 精灵 id 集合, 首页卡片/列表行/详情页三处入口同步 */
const FAV_KEY = "pkdx_favs";
const favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]").map(Number));
window.toggleFavUI = function (id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(el => el.classList.toggle("on", favs.has(id)));
  if (homeState.favOnly) renderDexArea();   // 仅看收藏模式下, 取消收藏的卡片实时移出
};
window.setFavOnly = function () {
  homeState.favOnly = !homeState.favOnly;
  document.querySelectorAll(".fav-chip").forEach(el => el.classList.toggle("on", homeState.favOnly));
  renderDexArea();
};

/* 每个 hash 记住离开时的滚动位置: 详情页返回列表回到原位 (内容重渲染后 rAF 再校正一次,
   因为 content-visibility 的占位高度展开后会推偏位置) */
const SCROLL_BY_HASH = {};
let lastHash = location.hash || "#/";
history.scrollRestoration = "manual";
window.addEventListener("hashchange", () => {
  SCROLL_BY_HASH[lastHash] = window.scrollY;
  lastHash = location.hash || "#/";
});

function route() {
  const h = location.hash || "#/";
  document.querySelectorAll(".nav a, .menu-nav a").forEach(a =>
    a.classList.toggle("active", a.getAttribute("href") === h || (a.getAttribute("data-nav") === "dex" && h.startsWith("#/p"))));
  $("#topbar-extras")?.classList.remove("open");  // 移动端菜单: 路由跳转后自动收起
  hidePopup();
  const saved = SCROLL_BY_HASH[h];
  // 恢复必须 instant: 全局 scroll-behavior: smooth 在几万像素的页面上要滚 1~2 秒
  window.scrollTo({ top: saved == null ? 0 : saved, behavior: "instant" });
  if (h.startsWith("#/p/")) renderPokemon(+h.slice(4));
  else if (h.startsWith("#/moves")) renderMoves();
  else if (h.startsWith("#/abilities")) renderAbilities();
  else if (h.startsWith("#/items")) renderItems();
  else if (h.startsWith("#/card")) renderCardMaker(/^#\/card\/(\d+)/.exec(h)?.[1]);
  else if (h.startsWith("#/types")) renderTypes();
  else if (h.startsWith("#/features")) renderFeatures();
  else renderHome();
  if (saved != null) requestAnimationFrame(() => window.scrollTo({ top: SCROLL_BY_HASH[h] || 0, behavior: "instant" }));
}
window.addEventListener("hashchange", route);

/* ---------------- 左侧目录 (图鉴 / 招式 / 特性 / 道具四页共用) ----------------
   items: [{ id: 分节元素 id, label }]; 「（首段）」回到顶部; 隐藏状态四页共用并记住 */
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
    <button type="button" class="fav-btn${favs.has(s.id) ? " on" : ""}" data-fav="${s.id}" title="收藏" onclick="event.stopPropagation();toggleFavUI(${s.id})"></button>
    ${spriteCanvas("front", s.id, "mon-spr", null, true)}
    <div class="no">${fmtDex(s.dex)}</div>
    <div class="nm">${esc(speciesName(s))}</div>
    <div class="types">${typePills(s.types, true)}</div>
    ${statKey ? `<div class="stat-tag">${STAT_ZH[statKey]} <b>${s.stats[statKey]}</b></div>` : ""}
    ${s.formLabel ? `<div class="form-badge">${esc(s.formLabel)}</div>` : ""}
  </div>`;
}
window.monCard = monCard;

/* 列表视图: 编号|名称|属性|特性|种族值总和 (纯表格不加载精灵图, 便于快速查找); 点击行进详情, 特性名弹特性弹窗 */
function statTotal(s) {
  return s.stats.hp + s.stats.atk + s.stats.def + s.stats.spa + s.stats.spd + s.stats.spe;
}
function abilityCell(aid, hidden) {
  const a = ABIL_BY_ID[aid];
  if (!a) return "";
  return `<span class="list-abil" onclick="event.stopPropagation();showAbilityPopup(${aid})">${esc(a.zh)}${hidden ? `<i class="list-hidden-tag">隐</i>` : ""}</span>`;
}
function monRow(s) {
  return `<tr onclick="location.hash='#/p/${s.id}'">
    <td class="num">${fmtDex(s.dex)}</td>
    <td class="mv-name"><button type="button" class="fav-btn${favs.has(s.id) ? " on" : ""}" data-fav="${s.id}" title="收藏" onclick="event.stopPropagation();toggleFavUI(${s.id})"></button>${esc(speciesName(s))}${s.formLabel ? `<i class="list-form-badge">${esc(s.formLabel)}</i>` : ""}</td>
    <td class="types-td">${typePills(s.types, true)}</td>
    <td class="abils">${s.abilities.map(a => abilityCell(a, false)).concat(s.hidden.map(a => abilityCell(a, true))).join("")}</td>
    <td class="num">${statTotal(s)}</td>
  </tr>`;
}
function dexListHTML(items) {
  return `<div class="dex-list-wrap"><table class="list-table dex-list">
    <thead><tr><th>编号</th><th>名称</th><th>属性</th><th>特性</th><th>种族值总和</th></tr></thead>
    <tbody>${items.map(monRow).join("")}</tbody>
  </table></div>`;
}

/* 排序: 默认按图鉴编号; 种族值各项默认从高到低, 再点同一项切换升降序 */
const SORT_KEYS = [["dex", "图鉴编号"], ["hp", "HP"], ["atk", "攻击"], ["def", "防御"], ["spa", "特攻"], ["spd", "特防"], ["spe", "速度"]];
function sortChipsHTML() {
  const { key, desc } = homeState.sort;
  return `<span class="chip-label">排序</span>` + SORT_KEYS.map(([k, label]) =>
    `<span class="pill sort-chip${k === key ? " on" : ""}" onclick="setSort('${k}')">${label}${k === key ? (desc ? " ↓" : " ↑") : ""}</span>`).join("");
}

function renderHome() {
  const chips = SPECIES_FILTER_TYPES.map(t =>
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
          ${searchBox("q", "搜索名称 / 编号 / 招式 / 特性，如 十万伏特、威吓", homeState.q)}
          <div class="type-chips"><span class="pill fav-chip${homeState.favOnly ? " on" : ""}" onclick="setFavOnly()">❤ 仅看收藏</span></div>
          <div class="type-chips">${formChips}</div>
          <div class="type-chips">${chips}</div>
          <div class="type-chips" id="sort-chips">${sortChipsHTML()}</div>
          <div class="theme-switch" id="view-switch">
            <button type="button" class="${homeState.view === "card" ? "on" : ""}" onclick="setView('card')">卡片</button>
            <button type="button" class="${homeState.view === "list" ? "on" : ""}" onclick="setView('list')">列表</button>
          </div>
          <span class="count-hint" id="cnt"></span>
        </div>
        <div id="dex-area"></div>
      </div>
    </div>`;

  $("#q").addEventListener("input", debounce(e => { homeState.q = e.target.value.trim(); renderDexArea(); }, SEARCH_DEBOUNCE));
  renderDexArea();
}

/* 搜索词按名字命中招式/特性 (包含匹配, 与名字搜索规则一致; 仅招式名不搜效果描述);
   每个搜索词只解析一次, 免得 filter 每只精灵重复扫描; 无人学的招式过滤掉保证 MOVE_USERS 取值安全 */
let searchHitsCache = { q: null, moves: [], abils: new Set() };
function searchMoveAbilHits(q) {
  if (searchHitsCache.q === q) return searchHitsCache;
  const moves = [], abils = new Set();
  if (q) {
    D.moves.forEach(m => { if (m.id && m.zh && MOVE_USERS[m.id] && m.zh.toLowerCase().includes(q)) moves.push(m.id); });
    D.abilities.forEach(a => { if (a.id && a.zh && a.zh.toLowerCase().includes(q)) abils.add(a.id); });
  }
  searchHitsCache = { q, moves, abils };
  return searchHitsCache;
}
function matchSpecies(s) {
  if (homeState.favOnly && !favs.has(s.id)) return false;  // 仅看收藏
  const raw = toHans(homeState.q), q = raw.toLowerCase();  // 繁体输入先转简体
  const searching = !!(q || homeState.types.size);
  // 形态筛选优先; 未选形态时默认只显示默认形态, 搜索/属性筛选命中时特殊与地区形态一并显示
  if (homeState.form && homeState.form !== "all") {
    if (!FORM_FILTER[homeState.form](s.formKind)) return false;
  } else if (!homeState.form && !s.isDefault && !searching) {
    return false;
  }
  if (q) {
    // 编号搜索容错: 全角数字转半角、去掉 # 前缀与前导零, 006 / #6 / ６ 都能命中编号 6
    const qNum = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/^[#＃]+/, "").replace(/^0+(?=\d)/, "");
    // 名字/编号/形态词之外, 还按招式名与特性名命中: 搜招式列出能学的宝可梦, 搜特性列出持有的宝可梦 (含隐藏)
    const hits = searchMoveAbilHits(q);
    const hit = speciesName(s).toLowerCase().includes(q)
      || (s.dex != null && qNum && String(s.dex) === qNum)
      || (s.tags && s.tags.includes(raw))
      || (hits.moves.length && hits.moves.some(mid => MOVE_USERS[mid].has(s.id)))
      || (hits.abils.size && s.abilities.concat(s.hidden).some(a => hits.abils.has(a)));
    if (!hit) return false;
  }
  if (homeState.types.size) {
    // 多选属性须同时具备 (如 火+飞行); 宝可梦最多两种属性, 选三种及以上不会有结果
    for (const t of homeState.types) if (!s.types.includes(t)) return false;
  }
  return true;
}
function renderDexArea() {
  if (!$("#dex-area")) return;  // 搜索防抖期间已切页: 旧页面的渲染回调直接丢弃
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
  // 卡片视图: 网格卡片; 列表视图: 纯表格
  const block = homeState.view === "list"
    ? items => dexListHTML(items)
    : items => `<div class="dex-grid">${items.map(s => monCard(s, byStat ? key : null)).join("")}</div>`;
  let html = "";
  const present = new Set();
  if (hasDex.length && byStat) {
    // 按种族值排序是全体排名, 不分世代
    html += `<div class="group-h">按${STAT_ZH[key]}排序</div>${block(hasDex)}`;
  } else if (hasDex.length) {
    const byGen = {};
    hasDex.forEach(s => (byGen[dexGen(s.dex)] = byGen[dexGen(s.dex)] || []).push(s));
    Object.keys(byGen).map(Number).sort((a, b) => a - b).forEach(g => {
      present.add("pgen-" + g);
      html += `<section class="gen-sec" id="pgen-${g}">
        <h3 class="gen-h">${GEN_NAMES[g]}<span class="gen-cnt">${byGen[g].length} 只</span></h3>
        ${block(byGen[g])}
      </section>`;
    });
  }
  if (others.length) {
    html += `<div class="group-h">其他形态</div>${block(others)}`;
  }
  if (!html) html = `<div style="text-align:center;color:var(--muted);padding:60px 0">${homeState.favOnly && !favs.size ? "还没有收藏的宝可梦，点击卡片右上角的 ♡ 即可收藏" : "没有找到符合条件的宝可梦"}</div>`;
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
window.setView = function (v) {
  if (homeState.view === v) return;
  homeState.view = v;
  localStorage.setItem("pkdx_dex_view", v);
  document.querySelectorAll("#view-switch button").forEach(el =>
    el.classList.toggle("on", el.getAttribute("onclick").includes(`'${v}'`)));
  renderDexArea();
};

/* ---------------- 详情页 ---------------- */
/* 受击相克: 各属性攻击本精灵的伤害倍数 (防御属性逐个从 typeChart 相乘, 与 cmWeaknesses 同模式);
   只列非 ×1 档, 按 ×4→×2→×½→×¼→×0 排序, 空档不显示 */
function defMatchupHTML(s) {
  const groups = {};
  SPECIES_FILTER_TYPES.forEach(at => {
    let mul = 1, any = false;
    s.types.forEach(dt => {
      const v = (D.typeChart[String(at.id)] || {})[String(dt)];
      if (v != null) { mul *= v; any = true; }
    });
    if (any && mul !== 1) (groups[mul] = groups[mul] || []).push(at);
  });
  const order = [[4, "×4", "x4"], [2, "×2", "x2"], [0.5, "×½", "x05"], [0.25, "×¼", "x025"], [0, "×0", "x0"]];
  const rows = order.map(([mul, label, kind]) => {
    const ts = groups[mul];
    if (!ts) return "";
    return `<div class="mu-row"><span class="mu-label mu-${kind}">${label}</span><div class="mu-types">${ts.map(t => typePill(t, true)).join("")}</div></div>`;
  }).join("");
  return rows || `<i style="color:var(--muted)">无特殊相克。</i>`;
}

/* 全局翻页序列: 有编号按 编号升序+默认形态优先 (与首页排序规则一致, 同编号默认形态排最前),
   无编号条目 (其他形态) 追加尾部; 各形态在序列中相邻 */
const DEX_SEQ = D.species.filter(s => s.dex > 0)
  .sort((a, b) => a.dex - b.dex || (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.id - b.id)
  .concat(D.species.filter(s => !(s.dex > 0)));
const DEX_SEQ_INDEX = new Map(DEX_SEQ.map((s, i) => [s.id, i]));
/* 编号跳转: 容错规则与首页搜索一致 (全角数字/#前缀/前导零); 无匹配输入框短暂红边 */
window.jumpDexNo = function () {
  const inp = $("#jump-no");
  if (!inp) return;
  const raw = inp.value.trim();
  const no = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/^[#＃]+/, "").replace(/^0+(?=\d)/, "");
  const target = no && !isNaN(+no) ? DEX_SEQ.find(s => s.dex === +no) : null;
  if (!target) {
    inp.classList.add("jump-err");
    setTimeout(() => inp.classList.remove("jump-err"), 600);
    return;
  }
  location.hash = "#/p/" + target.id;
};

function evoChainHTML(s) {
  const compId = evoComp[s.id];
  if (!compId) return `<div style="color:var(--muted);font-size:13.5px">该宝可梦没有进化关系。</div>`;
  const members = Object.keys(evoComp).map(Number).filter(id => evoComp[id] === compId);
  const memberSet = new Set(members);
  const mainEdges = [], extraEdges = [];
  members.forEach(id => speciesEvolutions(id).forEach(e => {
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
  members.forEach(id => speciesEvolutions(id).forEach(e => {
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
      <div class="evo-name"><div class="nm">${esc(speciesName(sp))}</div><div class="types">${typePills(sp.types, true)}</div></div>
    </div>`;
  };
  // 同一对宝可梦可能有多种进化方式 (如通信交换 或 使用联系绳): 箭头上全部列出, 以「或」分隔
  const arrow = (from, to) => `<div class="evo-arrow">${speciesEvolutions(from).filter(e => e.to === to)
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

  const seqPos = DEX_SEQ_INDEX.get(s.id);
  const prevS = seqPos > 0 ? DEX_SEQ[seqPos - 1] : null;
  const nextS = seqPos != null && seqPos < DEX_SEQ.length - 1 ? DEX_SEQ[seqPos + 1] : null;

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
      ${spriteCanvas("front", s.id, "hero-spr", null, true)}
      <div>
        <div class="dex-no">${fmtDex(s.dex)}</div>
        <div class="nm">${esc(speciesName(s))}</div>
        ${s.formLabel ? `<div style="margin-top:6px"><span class="pill small" style="background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.45)">${esc(s.formLabel)}</span></div>` : ""}
        <div class="types">${typePills(s.types)}</div>
        <a class="hero-card-btn" href="#/card/${s.id}">✦ 自制卡牌</a>
        <button type="button" class="hero-card-btn fav-hero${favs.has(s.id) ? " on" : ""}" data-fav="${s.id}" onclick="toggleFavUI(${s.id})"></button>
        <button type="button" class="hero-card-btn" onclick="openSharePoster(${s.id})">📤 分享海报</button>
      </div>
      <div class="hero-nav">
        ${prevS
          ? `<button type="button" class="hero-nav-btn" onclick="location.hash='#/p/${prevS.id}'">← ${fmtDex(prevS.dex)} ${esc(speciesName(prevS))}</button>`
          : `<button type="button" class="hero-nav-btn" disabled>← 已是第一只</button>`}
        <div class="hero-jump">
          <input id="jump-no" type="text" inputmode="numeric" placeholder="编号" onkeydown="if(event.key==='Enter')jumpDexNo()">
          <button type="button" onclick="jumpDexNo()">跳转</button>
        </div>
        ${nextS
          ? `<button type="button" class="hero-nav-btn" onclick="location.hash='#/p/${nextS.id}'">${fmtDex(nextS.dex)} ${esc(speciesName(nextS))} →</button>`
          : `<button type="button" class="hero-nav-btn" disabled>已是最后一只 →</button>`}
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
        <h3>属性相克 <span style="color:var(--muted);font-weight:600;font-size:12px">受各属性攻击时的伤害倍数</span></h3>
        ${defMatchupHTML(s)}
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
/* 世代: 1-9 对照 52poke 招式列表, 10 为超级进化招式 (排在第九世代后, 按关联宝可梦的图鉴编号排, 见 extract_data.py);
   世代内按官方编号排序 */
const MOVES_BY_GEN = D.moves.filter(m => m.id).sort((a, b) => a.gen - b.gen || a.no - b.no || a.id - b.id);
function renderMoves() {
  const typeOpts = TYPES_SHOWN.map(t => `<option value="${t.id}">${esc(t.zh)}</option>`).join("");
  const catOpts = MOVE_CAT_ORDER.map(n => `<option value="${esc(n)}">${esc(n)}（${MOVE_CAT_COUNT[n]}）</option>`).join("");
  app.innerHTML = `
    <div class="toc-layout">
      ${tocHTML(GEN_NAMES.slice(1).map((label, i) => ({ id: "gen-" + (i + 1), label })).concat([{ id: "gen-10", label: "超级进化招式" }]))}
      <div class="toc-main">
        <div class="page-title">招式图鉴</div>
        <div class="page-sub">共 ${MOVES_BY_GEN.length} 个招式 · 按世代排序，超级进化招式按对应宝可梦的图鉴编号排列 · 点击行查看详情</div>
        <div class="toolbar">
          ${searchBox("mq", "搜索招式名 / 效果…", moveFilter.q)}
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
  $("#mq").addEventListener("input", debounce(e => { moveFilter.q = e.target.value.trim(); renderMoveRows(); }, SEARCH_DEBOUNCE));
  $("#mtype").addEventListener("change", e => { moveFilter.type = e.target.value; renderMoveRows(); });
  $("#msplit").addEventListener("change", e => { moveFilter.split = e.target.value; renderMoveRows(); });
  $("#mcat").addEventListener("change", e => { moveFilter.cat = e.target.value; renderMoveRows(); });
  renderMoveRows();
}
function renderMoveRows() {
  if (!$("#mgens")) return;  // 搜索防抖期间已切页: 旧页面的渲染回调直接丢弃
  const q = toHans(moveFilter.q).toLowerCase();
  const rows = MOVES_BY_GEN.filter(m => {
    // 名字或效果描述任一命中 (道具页同款)
    if (q && !m.zh.toLowerCase().includes(q) && !(m.desc || "").toLowerCase().includes(q)) return false;
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
      <h3 class="gen-h">${GEN_NAMES[g] || "超级进化招式"}<span class="gen-cnt">${byGen[g].length} 个</span></h3>
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
          ${searchBox("aq", "搜索特性名 / 效果…", abilFilter)}
          <span class="count-hint" id="acnt"></span>
        </div>
        <div id="agens"></div>
      </div>
    </div>`;
  $("#aq").addEventListener("input", debounce(e => { abilFilter = e.target.value.trim(); renderAbilRows(); }, SEARCH_DEBOUNCE));
  renderAbilRows();
}
function renderAbilRows() {
  if (!$("#agens")) return;  // 搜索防抖期间已切页: 旧页面的渲染回调直接丢弃
  const aq = toHans(abilFilter).toLowerCase();
  // 名字或效果任一命中 (道具页同款)
  const list = ABILS_BY_GEN.filter(a => !aq
    || a.zh.toLowerCase().includes(aq) || (a.desc || "").toLowerCase().includes(aq));
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

/* ---------------- 道具页 ---------------- */
let itemFilter = { q: "", pocket: "" };
const ITEM_POCKETS = [
  [3, "精灵球"],
  [1, "道具"],
  [2, "重要物品"],
  [4, "招式学习器"],
  [5, "树果"],
];
const ITEMS_BY_ID = [...(D.items || [])].sort((a, b) => a.id - b.id);
function renderItems() {
  app.innerHTML = `
    <div class="toc-layout">
      ${tocHTML(ITEM_POCKETS.map(([id, label]) => ({ id: "ipocket-" + id, label })))}
      <div class="toc-main">
        <div class="page-title">道具图鉴</div>
        <div class="page-sub">共 ${ITEMS_BY_ID.length} 个道具 · 按背包分类排列 · 排除空道具位</div>
        <div class="toolbar">
          ${searchBox("iq", "搜索道具名或效果…", itemFilter.q)}
          <select id="ipocket" class="search-box item-pocket-filter">
            <option value="">全部分类</option>
            ${ITEM_POCKETS.map(([id, label]) => `<option value="${id}"${itemFilter.pocket === String(id) ? " selected" : ""}>${label}</option>`).join("")}
          </select>
          <span class="count-hint" id="icnt"></span>
        </div>
        <div id="item-sections"></div>
      </div>
    </div>`;
  $("#iq").addEventListener("input", debounce(e => {
    itemFilter.q = e.target.value.trim();
    renderItemRows();
  }, SEARCH_DEBOUNCE));
  $("#ipocket").addEventListener("change", e => {
    itemFilter.pocket = e.target.value;
    renderItemRows();
  });
  renderItemRows();
}
function renderItemRows() {
  if (!$("#item-sections")) return;  // 搜索防抖期间已切页: 旧页面的渲染回调直接丢弃
  const q = toHans(itemFilter.q).toLowerCase();
  const list = ITEMS_BY_ID.filter(item =>
    (!itemFilter.pocket || String(item.pocket) === itemFilter.pocket)
    && (!q || item.zh.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)));
  $("#icnt").textContent = `${list.length} 个道具`;
  const byPocket = {};
  list.forEach(item => (byPocket[item.pocket] = byPocket[item.pocket] || []).push(item));
  $("#item-sections").innerHTML = ITEM_POCKETS.filter(([id]) => byPocket[id]).map(([id, label]) => `
    <section class="gen-sec" id="ipocket-${id}">
      <h3 class="gen-h">${label}<span class="gen-cnt">${byPocket[id].length} 个</span></h3>
      <div class="card item-table-wrap">
        <table class="list-table item-table">
          <thead><tr><th>道具</th><th>效果说明</th><th>价格</th></tr></thead>
          <tbody>${byPocket[id].map(item => `
            <tr>
              <td class="mv-name">${esc(item.zh)}</td>
              <td class="item-desc">${esc(item.desc || "暂无效果说明")}</td>
              <td class="item-price">${item.price ? `${item.price}元` : "—"}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`).join("") || `<div style="text-align:center;color:var(--muted);padding:60px 0">没有找到符合条件的道具</div>`;
  tocMark(new Set(Object.keys(byPocket).map(id => "ipocket-" + id)));
}

/* ---------------- 自制卡牌 (TCG POCKET 风格) ----------------
   自选宝可梦 / 特性 / 最多 4 个招式, canvas 按 TCG POCKET 版面绘制, 可导出 PNG。
   超级进化宝可梦 (gMegaMoveChanges): 招式表中「变化前」的招式在卡面上自动显示为对应的超级进化招式 */
const MEGA_MOVE_MAP = {};   // 物种id -> { 变化前招式id: 超级进化招式id }
D.moves.forEach(m => (m.megaChanges || []).forEach(c => {
  (MEGA_MOVE_MAP[c.species] = MEGA_MOVE_MAP[c.species] || {})[c.oldMove] = m.id;
}));
const TM_LABELS = {};       // 招式id -> TM/HM 编号
D.tms.forEach(t => { if (TM_LABELS[t.move] == null) TM_LABELS[t.move] = t.label; });

const CARD_W = 660, CARD_H = 924, CARD_SCALE = 2;
const CM_SPLIT_COLOR = { "物理": "#d9534f", "特殊": "#3d7dca", "变化": "#8a8f98" };
const cardState = { sp: 0, ability: null, moves: [], shiny: false,
  customAbility: null, customMoves: [], style: "normal" };
let cmRegions = [], cmSprJob = 0, cmFlashTimer = 0;
const cmPoolCache = {};

function cmDefaultSpecies() {
  return (D.species.find(s => s.en === "GENGAR_MEGA")   // 默认展示超级进化招式自动替换
    || D.species.find(s => MEGA_MOVE_MAP[s.id])
    || D.species.find(s => s.isDefault) || D.species[0]).id;
}
function cmSelectSpecies(id) {
  const s = SPECIES_BY_ID[id];
  if (!s) return;
  cardState.sp = id;
  cardState.ability = s.abilities.concat(s.hidden)[0] ?? null;
  cardState.moves = [];
  cardState.shiny = false;
}

/* ---------------- 分享海报 (1080x1440, 复用卡牌 canvas 工具与加密精灵图) ---------------- */
const POSTER_W = 1080, POSTER_H = 1440, POSTER_SCALE = 2;
let posterCard = null, posterJob = 0;
function drawPosterFit(ctx, bmp, cx, cy, box) {
  const sc = Math.min(box / bmp.width, box / bmp.height);
  ctx.drawImage(bmp, cx - bmp.width * sc / 2, cy - bmp.height * sc / 2, bmp.width * sc, bmp.height * sc);
}
function drawRadar(ctx, cx, cy, R, stats, total) {
  const keys = ["hp", "atk", "def", "spa", "spd", "spe"];
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.40)";
  [1, 2 / 3, 1 / 3].forEach(k => {           // 三圈六边形网格
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const [x, y] = pt(i % 6, R * k);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  keys.forEach((_, i) => {                    // 轴线
    const [x, y] = pt(i, R);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
  });
  ctx.beginPath();                            // 数值多边形 (种族值上限 160 归一化)
  keys.forEach((k, i) => {
    const [x, y] = pt(i, R * Math.min(1, stats[k] / 160));
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  keys.forEach((k, i) => {                    // 顶点标签+数值
    const [x, y] = pt(i, R + 38);
    ctx.font = cmFont(19, true);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${cmT(STAT_ZH[k])} ${stats[k]}`, x, y);
  });
  ctx.font = cmFont(15);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(cmT("总和"), cx, cy - 17);
  ctx.font = cmFont(32, true);
  ctx.fillStyle = "#fff";
  ctx.fillText(total, cx, cy + 12);
}
function drawPoster(ctx, s, art) {
  const t1 = TYPE_BY_ID[s.types[0]], t2 = TYPE_BY_ID[s.types[1]] || t1;
  const c1 = t1 ? t1.color : "#777", c2 = t2 ? t2.color : c1;
  const g = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H);
  g.addColorStop(0, cmMix(c1, "#000000", .18));
  g.addColorStop(1, cmMix(c2, "#000000", .38));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.fillStyle = "rgba(255,255,255,.07)";   // 装饰圆
  ctx.beginPath(); ctx.arc(POSTER_W - 40, 130, 300, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(70, POSTER_H - 260, 240, 0, 7); ctx.fill();

  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = cmFont(26, true);
  ctx.fillText(`#${fmtDex(s.dex)}`, POSTER_W / 2, 74);
  ctx.fillStyle = "#fff";
  ctx.font = cmFont(64, true);
  ctx.shadowColor = "rgba(0,0,0,.30)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.fillText(cmT(speciesName(s)), POSTER_W / 2, 148);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  let px = POSTER_W / 2 - (s.types.length * 150 + (s.formLabel ? 110 : 0)) / 2 + 75;
  s.types.forEach(tid => {                    // 属性 pills
    const t = TYPE_BY_ID[tid];
    ctx.fillStyle = t.color;
    cmRR(ctx, px - 68, 178, 136, 44, 22); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = cmFont(22, true);
    ctx.fillText(cmT(t.zh), px, 208);
    px += 150;
  });
  if (s.formLabel) {
    ctx.fillStyle = "rgba(0,0,0,.30)";
    cmRR(ctx, px - 48, 180, 96, 40, 20); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = cmFont(19, true);
    ctx.fillText(cmT(s.formLabel), px, 207);
  }

  const slot = (cx, label, bmp, missing) => { // 普通/闪光双立绘
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (bmp) drawPosterFit(ctx, bmp, cx, 452, 350);
    else {
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = cmFont(24, true);
      ctx.fillText(cmT(missing), cx, 452);
    }
    ctx.fillStyle = "rgba(0,0,0,.30)";
    cmRR(ctx, cx - 60, 606, 120, 42, 21); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = cmFont(20, true);
    ctx.fillText(cmT(label), cx, 628);
  };
  slot(300, "普通", art.front, "暂无图片");
  slot(780, "闪光", art.shiny, "暂无闪光图");

  drawRadar(ctx, 540, 896, 168, s.stats, s.total);  // 上移缩小: 底部顶点标签不与介绍卡重叠

  ctx.fillStyle = "rgba(0,0,0,.28)";          // 图鉴介绍卡
  cmRR(ctx, 84, 1156, POSTER_W - 168, 104, 20); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = cmFont(20);
  ctx.textAlign = "left";
  const lines = cmWrap(ctx, cmT(s.flavor || "暂无图鉴介绍。"), POSTER_W - 220, 3);
  lines.forEach((ln, i) => ctx.fillText(ln, 116, 1182 + i * 30));

  ctx.fillStyle = "rgba(255,255,255,.94)";    // 底部信息栏 (无二维码, 文字居中)
  cmRR(ctx, 84, 1288, POSTER_W - 168, 116, 24); ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#20242c";
  ctx.font = cmFont(27, true);
  ctx.fillText(cmT("火红物语图鉴"), POSTER_W / 2, 1320);
  ctx.fillStyle = "#5a6470";
  ctx.font = cmFont(19);
  ctx.fillText("wuhealthy.github.io/CFRU-expansion", POSTER_W / 2, 1352);
  ctx.fillStyle = "#8a94a0";
  ctx.font = cmFont(17);
  ctx.fillText(cmT("改版作者：兔砸博士"), POSTER_W / 2, 1382);
}
window.openSharePoster = function (id) {
  const s = SPECIES_BY_ID[id];
  if (!s) return;
  showPopup(`<h2>分享海报</h2>
    <div class="poster-box" id="poster-box"><i style="color:var(--muted)">海报生成中…</i></div>
    <div style="margin-top:12px;text-align:center"><button type="button" class="cm-btn" id="poster-dl" onclick="downloadPoster()" disabled>⬇ 保存图片</button></div>`);
  const cv = document.createElement("canvas");
  cv.width = POSTER_W * POSTER_SCALE; cv.height = POSTER_H * POSTER_SCALE;
  const ctx = cv.getContext("2d");
  ctx.setTransform(POSTER_SCALE, 0, 0, POSTER_SCALE, 0, 0);
  drawPoster(ctx, s, {});                     // 先出底图, 图片加载完成后二次绘制
  const job = ++posterJob;
  Promise.all([
    loadSprite("front", id).catch(() => null),
    loadSprite("front_shiny", id).catch(() => null),
  ]).then(([front, shiny]) => {
    if (job !== posterJob) return;            // 弹窗期间换了精灵: 丢弃旧结果
    drawPoster(ctx, s, { front, shiny });
    const box = $("#poster-box");
    if (!box) return;
    box.innerHTML = "";
    box.appendChild(cv);
    posterCard = { cv, name: speciesName(s) };
    const dl = $("#poster-dl");
    if (dl) dl.disabled = false;
  });
};
window.downloadPoster = function () {
  if (!posterCard) return;
  posterCard.cv.toBlob(b => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `${posterCard.name}_图鉴海报.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, "image/png");
};

function cmMovepool(s) {
  if (cmPoolCache[s.id]) return cmPoolCache[s.id];
  const seen = new Set(), list = [];
  const push = (mid, src) => {
    if (mid && MOVE_BY_ID[mid] && !seen.has(mid)) { seen.add(mid); list.push({ mid, src }); }
  };
  s.levelUp.forEach(([lv, mid]) => push(mid, lv === 0 ? "进化时" : lv === 1 ? "初始" : "Lv." + lv));
  s.tm.forEach(mid => push(mid, TM_LABELS[mid] || "学习器"));
  s.tutor.forEach(mid => push(mid, "教学"));
  s.egg.forEach(mid => push(mid, "蛋"));
  return cmPoolCache[s.id] = list;
}
function cmCardData() {
  const s = SPECIES_BY_ID[cardState.sp];
  const megaMap = MEGA_MOVE_MAP[s.id] || {};
  const stockMoves = cardState.moves.slice(0, 4).map(mid => {
    const to = megaMap[mid];
    return { mid: to || mid, from: to ? mid : 0, custom: false };
  });
  const customMoves = cardState.customMoves
    .filter(m => m && m.name.trim())
    .map(m => ({ mid: 0, from: 0, custom: true, data: {
      zh: m.name, split: m.split || "物理", type: +m.type || 0,
      power: +m.power || 0, acc: m.acc ? +m.acc : "—", desc: m.desc || ""
    }}));
  const moves = [...stockMoves, ...customMoves].slice(0, 4);
  let ability = null, hidden = false;
  if (cardState.customAbility && cardState.customAbility.name.trim()) {
    ability = { zh: cardState.customAbility.name, desc: cardState.customAbility.desc || "", custom: true };
  } else if (cardState.ability != null) {
    ability = ABIL_BY_ID[cardState.ability];
    hidden = s.hidden.includes(cardState.ability);
  }
  return { s, moves, ability, hidden };
}
/* 弱点: 全部 ≥2 倍的攻击属性 (倍率高者在前), 卡面底栏逐个列出, 一行最多 3 个 */
function cmWeaknesses(s) {
  const list = [];
  TYPES_SHOWN.forEach(at => {
    let mul = 1, any = false;
    s.types.forEach(dt => {
      const v = (D.typeChart[String(at.id)] || {})[String(dt)];
      if (v != null) { mul *= v; any = true; }
    });
    if (any && mul >= 2) list.push({ t: at, mult: mul });
  });
  list.sort((a, b) => b.mult - a.mult || a.t.id - b.t.id);
  return list;
}

/* ---- canvas 绘制工具 ---- */
/* canvas 文字不走 DOM 的繁体转换, 绘制时按当前语言显式转换 (词典语料含全部数据与页面文字) */
const cmT = s => (LANG === "hant" ? toHant(s) : s);
function cmFont(size, bold) { return `${bold ? "bold " : ""}${size}px "Segoe UI","Microsoft YaHei","PingFang SC",sans-serif`; }
function cmMix(hex, hex2, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * k);
  return `rgb(${ch(a >> 16, b >> 16)},${ch((a >> 8) & 255, (b >> 8) & 255)},${ch(a & 255, b & 255)})`;
}
function cmRR(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cmWrap(ctx, text, maxW, maxLines) {
  const out = [];
  let cur = "";
  for (const ch of String(text || "")) {
    if (cur && ctx.measureText(cur + ch).width > maxW) {
      out.push(cur);
      if (out.length === maxLines) { out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + "…"; return out; }
      cur = ch;
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function cmTypePill(ctx, t, x, cy, h) {  // 左对齐绘制, 返回宽度
  const zh = cmT(t.zh);
  ctx.font = cmFont(Math.max(11, Math.round(h * .52)), true);
  const w = Math.max(h, ctx.measureText(zh).width + h * .7);
  cmRR(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = t.color; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(zh, x + w / 2, cy + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  return w;
}
function cmShadowText(ctx, on) {
  ctx.shadowColor = on ? "rgba(15,25,45,.5)" : "transparent";
  ctx.shadowBlur = on ? 3 : 0;
  ctx.shadowOffsetY = on ? 1 : 0;
}

const CM_ART = { x: 34, y: 92, w: 592, h: 300 };
/* 卡面主体 (逻辑坐标, 调用前已 setTransform 放大) */
function cmDrawBase(ctx, d, regions) {
  const { s, moves, ability, hidden } = d;
  const M = 34;
  const base = (TYPE_BY_ID[s.types[0]] || { color: "#8899aa" }).color;

  /* 底色 + 金属边框 + 斜向高光 (按卡牌风格分支) */
  const cs = cardState.style || "normal";
  if (cs === "gold") {
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, cmMix("#FFD700", base, .25));
    bg.addColorStop(.5, cmMix("#DAA520", base, .3));
    bg.addColorStop(1, cmMix("#8B6914", base, .35));
    cmRR(ctx, 0, 0, CARD_W, CARD_H, 30);
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 6; cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27);
    const fg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    fg.addColorStop(0, "#FFF8DC"); fg.addColorStop(.5, "#FFD700"); fg.addColorStop(1, "#B8860B");
    ctx.strokeStyle = fg; ctx.stroke();
    ctx.lineWidth = 2; cmRR(ctx, 11, 11, CARD_W - 22, CARD_H - 22, 20);
    ctx.strokeStyle = "rgba(255,215,0,.6)"; ctx.stroke();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, cmMix(base, "#ffffff", .16));
    bg.addColorStop(1, cmMix(base, "#000000", .34));
    cmRR(ctx, 0, 0, CARD_W, CARD_H, 30);
    ctx.fillStyle = bg; ctx.fill();
    if (cs === "holo") {
      const holo = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      holo.addColorStop(0, "rgba(255,80,80,.18)");
      holo.addColorStop(.2, "rgba(255,180,40,.16)");
      holo.addColorStop(.4, "rgba(80,255,120,.14)");
      holo.addColorStop(.6, "rgba(60,180,255,.16)");
      holo.addColorStop(.8, "rgba(180,80,255,.18)");
      holo.addColorStop(1, "rgba(255,80,200,.16)");
      cmRR(ctx, 0, 0, CARD_W, CARD_H, 30);
      ctx.fillStyle = holo; ctx.fill();
    }
    ctx.lineWidth = 5; cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27);
    if (cs === "holo") {
      const hg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      hg.addColorStop(0, "#ff6b6b"); hg.addColorStop(.25, "#ffd93d");
      hg.addColorStop(.5, "#6bcf7f"); hg.addColorStop(.75, "#4d9dff");
      hg.addColorStop(1, "#c77dff");
      ctx.strokeStyle = hg; ctx.stroke();
    } else {
      ctx.strokeStyle = cmMix(base, "#000000", .5); ctx.stroke();
    }
    ctx.lineWidth = 2; cmRR(ctx, 11, 11, CARD_W - 22, CARD_H - 22, 20);
    ctx.strokeStyle = cs === "holo" ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.5)";
    ctx.stroke();
  }
  ctx.save();
  cmRR(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 20); ctx.clip();
  ctx.fillStyle = cs === "gold" ? "rgba(255,215,0,.08)" : "rgba(255,255,255,.05)";
  ctx.beginPath();
  ctx.moveTo(CARD_W * .3, 12); ctx.lineTo(CARD_W * .56, 12);
  ctx.lineTo(CARD_W * .34, CARD_H - 12); ctx.lineTo(CARD_W * .08, CARD_H - 12);
  ctx.closePath(); ctx.fill();
  if (cs === "holo") {
    ctx.fillStyle = "rgba(180,100,255,.06)";
    ctx.beginPath();
    ctx.moveTo(CARD_W * .6, 12); ctx.lineTo(CARD_W * .85, 12);
    ctx.lineTo(CARD_W * .7, CARD_H - 12); ctx.lineTo(CARD_W * .45, CARD_H - 12);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  /* 头部: 小图标位 + 名字 | HP + 属性 */
  ctx.font = cmFont(19, true);
  ctx.fillStyle = "#fff";
  cmShadowText(ctx, true);
  const pills = s.types.map(id => TYPE_BY_ID[id]).filter(Boolean);
  const PH = 26;
  ctx.font = cmFont(Math.round(PH * .52), true);
  const pillWs = pills.map(t => Math.max(PH, ctx.measureText(t.zh).width + PH * .7));
  let px = CARD_W - M - (pillWs.reduce((a, b) => a + b, 0) + (pillWs.length - 1) * 6);
  const pillX0 = px;
  pills.forEach((t, i) => { cmTypePill(ctx, t, px, 47, PH); px += pillWs[i] + 6; });
  let rx = pillX0 - 14;  // HP 数字画在属性徽章左侧 (px 循环后已越过最后一个徽章, 不能用)
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  const hp = String(s.stats.hp);
  ctx.font = cmFont(40, true); ctx.fillStyle = "#fff";
  ctx.fillText(hp, rx, 62); rx -= ctx.measureText(hp).width + 7;
  ctx.font = cmFont(19, true); ctx.fillText("HP", rx, 62);
  ctx.textAlign = "left";
  const name = cmT(speciesName(s));
  let nfs = 33; ctx.font = cmFont(nfs, true);
  while (nfs > 20 && ctx.measureText(name).width > rx - 20 - (M + 2)) { nfs--; ctx.font = cmFont(nfs, true); }
  ctx.fillText(name, M + 2, 62);
  cmShadowText(ctx, false);

  /* 图片窗 */
  const AW = CM_ART;
  const ag = ctx.createLinearGradient(0, AW.y, 0, AW.y + AW.h);
  ag.addColorStop(0, cmMix(base, "#ffffff", .6));
  ag.addColorStop(1, cmMix(base, "#ffffff", .22));
  cmRR(ctx, AW.x, AW.y, AW.w, AW.h, 18);
  ctx.fillStyle = ag; ctx.fill();
  ctx.save();
  cmRR(ctx, AW.x, AW.y, AW.w, AW.h, 18); ctx.clip();
  const glow = ctx.createRadialGradient(AW.x + AW.w / 2, AW.y + AW.h * .72, 24, AW.x + AW.w / 2, AW.y + AW.h * .72, 210);
  glow.addColorStop(0, "rgba(255,255,255,.38)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(AW.x, AW.y, AW.w, AW.h);
  ctx.font = cmFont(15, true); ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.textAlign = "right";
  ctx.fillText(s.dex != null ? "No." + s.dex : "No.—", AW.x + AW.w - 14, AW.y + AW.h - 12);
  ctx.textAlign = "left";
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.65)";
  cmRR(ctx, AW.x, AW.y, AW.w, AW.h, 18); ctx.stroke();
  if (regions) regions.push({ x: AW.x, y: AW.y, w: AW.w, h: AW.h, act: "shiny" });

  /* 特性框 */
  let y = AW.y + AW.h + 18;
  if (ability) {
    ctx.font = cmFont(15);
    const lines = cmWrap(ctx, cmT(ability.desc), CARD_W - M * 2 - 28, 3);
    const bh = 10 + 26 + (lines.length ? 8 + lines.length * 20 : 0) + 10;
    cmRR(ctx, M, y, CARD_W - M * 2, bh, 14);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fill();
    cmRR(ctx, M + 14, y + 10, 56, 26, 13);
    ctx.fillStyle = "#b31212"; ctx.fill();
    ctx.font = cmFont(15, true); ctx.fillStyle = "#fff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(cmT("特性"), M + 42, y + 24);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const abZh = cmT(ability.zh);
    let afs = 22; ctx.font = cmFont(afs, true);
    while (afs > 15 && ctx.measureText(abZh).width > CARD_W - M * 2 - 96 - (hidden ? 92 : 0)) { afs--; ctx.font = cmFont(afs, true); }
    ctx.fillText(abZh, M + 82, y + 30);
    if (hidden) {
      ctx.font = cmFont(13, true);
      const hw = ctx.measureText(cmT("隐藏特性")).width + 16;
      cmRR(ctx, CARD_W - M - 14 - hw, y + 12, hw, 22, 11);
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(cmT("隐藏特性"), CARD_W - M - 14 - hw / 2, y + 24);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
    ctx.font = cmFont(15); ctx.fillStyle = "rgba(255,255,255,.95)";
    lines.forEach((ln, i) => ctx.fillText(ln, M + 14, y + 10 + 26 + 8 + 15 + i * 20));
    if (regions) regions.push({ x: M, y, w: CARD_W - M * 2, h: bh, act: "ability" });
    y += bh + 12;
  }

  /* 招式 (最多 4 个, 行高随描述行数自适应) */
  if (!moves.length) {
    cmRR(ctx, M, y, CARD_W - M * 2, 66, 14);
    ctx.setLineDash([7, 7]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = cmFont(15); ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.textBaseline = "middle";
    ctx.fillText(cmT("在左侧「选择招式」中挑选（最多 4 个）"), M + 18, y + 34);
    ctx.textBaseline = "alphabetic";
    y += 78;
  }
  /* 招式名靠左, 分类徽章+属性图标跟在名字右侧 → 描述区更宽, 能容更长文本 */
  const nameX = M + 8;
  const descMaxW = CARD_W - M - 20 - nameX;
  const descLines = (mv, maxN) => {
    const m = mv.custom ? mv.data : MOVE_BY_ID[mv.mid];
    if (!m || !m.desc) return [];
    ctx.font = cmFont(12.5);
    return cmWrap(ctx, cmT(m.desc), descMaxW, maxN);
  };
  /* 底栏高度按实际弱点行数动态算, 不再固定 96, 避免误判空间不足而压缩描述 */
  const wks = cmWeaknesses(s);
  const wkRows = Math.max(1, Math.ceil(wks.length / 3));
  const bottomH = wkRows * 28 + 24;   // 底栏内容到 fy+44, 余量 24 足够, 52 太保守致 4 招式描述被误压没
  let rowHs = moves.map(mv => {
    const n = descLines(mv, 2).length;
    return n ? 50 + n * 16 + 10 : 56;
  });
  const fits = hs => y + hs.reduce((a, b) => a + b, 0) + bottomH <= CARD_H - 30;
  if (!fits(rowHs)) rowHs = moves.map(mv => {
    const n = descLines(mv, 1).length;
    return n ? 50 + n * 16 + 10 : 56;
  });
  if (!fits(rowHs)) rowHs = moves.map(() => 56);  // 仍不够: 不显示描述
  const rowTops = [];
  { let ty = y; rowHs.forEach(h => { rowTops.push(ty); ty += h; }); }
  moves.forEach((mv, i) => {
    const m = mv.custom ? mv.data : MOVE_BY_ID[mv.mid];
    if (!m) return;
    const ry = rowTops[i];
    if (i) {
      ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M + 6, ry + .5); ctx.lineTo(CARD_W - M - 6, ry + .5); ctx.stroke();
    }
    /* 招式名先画(靠左), 分类徽章+属性图标跟在名字右侧 */
    const mvZh = cmT(m.zh);
    ctx.fillStyle = "#fff";
    cmShadowText(ctx, true);
    let ms = 22; ctx.font = cmFont(ms, true);
    const nameMaxW = CARD_W - M - 92 - nameX;   // 右侧留威力数字位
    while (ms > 16 && ctx.measureText(mvZh).width > nameMaxW) { ms--; ctx.font = cmFont(ms, true); }
    ctx.fillText(mvZh, nameX, ry + 26);
    cmShadowText(ctx, false);
    let iconX = nameX + ctx.measureText(mvZh).width + 10;
    const split = cmT(m.split);
    ctx.font = cmFont(13.5, true);
    const bw = ctx.measureText(split).width + 15;
    cmRR(ctx, iconX, ry + 7, bw, 22, 11);   // 分类徽章与招式名同高, 底 ry+29 让出威力/命中行
    ctx.fillStyle = CM_SPLIT_COLOR[m.split] || "#888"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(split, iconX + bw / 2, ry + 18);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const tPill = TYPE_BY_ID[m.type];         // 招式属性图标 (紧随分类徽章)
    if (tPill) cmTypePill(ctx, tPill, iconX + bw + 7, ry + 18, 22);
    ctx.font = cmFont(13); ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText(cmT(`威力 ${fmtPower(m.power)} · 命中 ${m.acc || "—"}`), nameX, ry + 44);
    if (rowHs[i] > 56) {
      const maxN = rowHs[i] > 86 ? 2 : 1;   // 76=1行(50+16+10), 92=2行, 阈值86区分
      const lines = descLines(mv, maxN);
      ctx.font = cmFont(12.5); ctx.fillStyle = "rgba(255,255,255,.75)";
      lines.forEach((ln, k) => ctx.fillText(ln, nameX, ry + 62 + k * 16));
    }
    if (mv.from) {  // 超级进化替换标记
      ctx.font = cmFont(12.5, true);
      const tag = cmT("超级进化招式");
      const tw = ctx.measureText(tag).width + 14;
      cmRR(ctx, CARD_W - M - 14 - tw, ry + 31, tw, 19, 9.5);
      ctx.fillStyle = "rgba(255,215,80,.95)"; ctx.fill();
      ctx.fillStyle = "#5a3c00";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(tag, CARD_W - M - 14 - tw / 2, ry + 41);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
    const dmg = m.power === 1 || !m.power ? "—" : String(m.power);
    ctx.font = cmFont(30, true); ctx.fillStyle = "#fff";
    cmShadowText(ctx, true);
    ctx.textAlign = "right";
    ctx.fillText(dmg, CARD_W - M - 16, ry + 28);
    ctx.textAlign = "left";
    cmShadowText(ctx, false);
    if (regions) regions.push({ x: M, y: ry, w: CARD_W - M * 2, h: rowHs[i], act: mv.custom ? "customMove" : "move", mid: mv.mid });
  });
  y += rowHs.reduce((a, b) => a + b, 0) + 6;

  /* 底栏: 弱点(全部, 一行最多3个可换行) / 图鉴 / 自制标 + 出处 */
  // wks / wkRows 已在招式段提前算好 (底栏高度据此动态估算, 避免误压缩招式描述)
  // 弱点行数多时底栏整体上移, 避免贴到卡底边框
  const fy = Math.max(y + 6, Math.min(CARD_H - 96, CARD_H - 34 - wkRows * 28));
  ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(M + 6, fy + .5); ctx.lineTo(CARD_W - M - 6, fy + .5); ctx.stroke();
  ctx.font = cmFont(14, true); ctx.fillStyle = "rgba(255,255,255,.92)";
  const wkLabel = cmT("弱点");
  ctx.fillText(wkLabel, M + 8, fy + 24);
  let wx = M + 8 + ctx.measureText(wkLabel).width + 12, wy = fy + 17, wkRow = 0;
  const wkFirstX = wx;  // 换行后的行与第一行第一个弱点对齐
  for (const wk of wks) {
    if (wkRow === 3) { wx = wkFirstX; wy += 28; wkRow = 0; }  // 一行最多 3 个弱点, 多的换行
    ctx.font = cmFont(15, true); ctx.fillStyle = "#fff";
    const mulTxt = "×" + wk.mult;
    const w2 = cmTypePill(ctx, wk.t, wx, wy, 22);
    ctx.fillText(mulTxt, wx + w2 + 5, wy + 6);
    wx += w2 + 5 + ctx.measureText(mulTxt).width + 12;
    wkRow++;
  }
  if (!wks.length) {
    ctx.font = cmFont(15); ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("—", wx, fy + 24);
  }
  if (wks.length <= 3) {  // 弱点换行时中段让位, 图鉴编号图窗里已有
    ctx.font = cmFont(14, true); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.textAlign = "center";
    ctx.fillText(s.dex != null ? cmT("图鉴 No.") + s.dex : "火红物语", CARD_W / 2, fy + 24);
    ctx.textAlign = "left";
  }
  ctx.font = cmFont(14, true); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.textAlign = "right";
  ctx.fillText(cmT(cs === "holo" ? "★ 闪卡" : cs === "gold" ? "★ 金卡" : "★ 自制卡牌"), CARD_W - M - 8, fy + 22);
  ctx.font = cmFont(12); ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fillText(cmT("来自火红物语图鉴"), CARD_W - M - 8, fy + 44);
  ctx.textAlign = "left";
}
/* 精灵图绘制进图片窗 — 素材已是 192px 平滑卡通图, 等比适配缩放 (双线性平滑) */
function cmDrawSprite(ctx, d, bmp) {
  const AW = CM_ART;
  ctx.save();
  cmRR(ctx, AW.x, AW.y, AW.w, AW.h, 18); ctx.clip();
  if (bmp) {
    const scale = Math.min((AW.w - 48) / bmp.width, (AW.h - 36) / bmp.height, 4);
    const w = bmp.width * scale, h = bmp.height * scale;
    ctx.drawImage(bmp, AW.x + (AW.w - w) / 2, AW.y + AW.h - h - 10, w, h);
  }
  ctx.restore();
}
function cmLoadArt(id) {
  const kind = cardState.shiny ? "front_shiny" : "front";
  return loadSprite(kind, id).catch(() => loadSprite("icon", id).catch(() => null));
}
function cmDraw() {
  const cv = $("#cm-card");
  if (!cv || !cardState.sp) return;
  const d = cmCardData();
  const ctx = cv.getContext("2d");
  ctx.setTransform(CARD_SCALE, 0, 0, CARD_SCALE, 0, 0);
  const regions = [];
  cmDrawBase(ctx, d, regions);
  cmRegions = regions;
  const job = ++cmSprJob;
  cmLoadArt(d.s.id).then(bmp => { if (job === cmSprJob) cmDrawSprite(ctx, d, bmp); }).catch(() => {});
}
window.cmDownload = function () {
  const d = cmCardData();
  const cv = document.createElement("canvas");
  cv.width = CARD_W * CARD_SCALE; cv.height = CARD_H * CARD_SCALE;
  const ctx = cv.getContext("2d");
  ctx.setTransform(CARD_SCALE, 0, 0, CARD_SCALE, 0, 0);
  cmDrawBase(ctx, d, null);
  cmLoadArt(d.s.id).then(bmp => {
    cmDrawSprite(ctx, d, bmp);
    cv.toBlob(b => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${speciesName(d.s)}_自制卡牌.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  });
};
window.cmReset = function () {
  cardState.customAbility = null;
  cardState.customMoves = [];
  cardState.style = "normal";
  cmSelectSpecies(cmDefaultSpecies());
  cmRefresh();
};
window.cmPickStyle = function (st) {
  cardState.style = st;
  document.querySelectorAll(".cm-style-btn").forEach(b => {
    b.classList.toggle("on", b.dataset.style === st);
  });
  cmDraw();
};
window.cmPickSpecies = function (id) {
  cmSelectSpecies(id);
  const q = $("#cm-q");
  if (q) { q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); }
  $("#cm-sp-list").classList.add("hidden");
  cmRefresh();
};
window.cmPickAbility = function (aid) { cardState.ability = aid; cmRefresh(); };
window.cmToggleMove = function (mid) {
  const i = cardState.moves.indexOf(mid);
  if (i >= 0) cardState.moves.splice(i, 1);
  else {
    if (cardState.moves.length >= 4) {
      const n = $("#cm-note");
      if (n && !n.querySelector(".cm-warn")) {
        n.insertAdjacentHTML("afterbegin", `<div class="cm-warn">最多只能选择 4 个招式</div>`);
        clearTimeout(cmFlashTimer);
        cmFlashTimer = setTimeout(cmRefresh, 1800);
      }
      return;
    }
    cardState.moves.push(mid);
  }
  cmRefresh();
};
function cmRefresh() {
  const s = SPECIES_BY_ID[cardState.sp];
  if (!s || !$("#cm-cur")) return;
  $("#cm-cur").innerHTML = `
    <div class="cm-cur-box">
      ${spriteCanvas("icon", s.id)}
      <div><b>${esc(speciesName(s))}</b>
        <div class="cm-cur-meta">${fmtDex(s.dex)} ${typePills(s.types, true)}</div>
      </div>
    </div>`;
  const abils = s.abilities.map(a => [a, false]).concat(s.hidden.map(a => [a, true]));
  $("#cm-ab").innerHTML = abils.length ? abils.map(([aid, hid]) => {
    const a = ABIL_BY_ID[aid];
    return `<div class="cm-pick${cardState.ability === aid ? " on" : ""}" onclick="cmPickAbility(${aid})">
      <b>${esc(a.zh)}</b>${hid ? '<span class="tag">隐藏特性</span>' : ""}
      <div class="cm-pick-desc">${esc(a.desc || "")}</div>
    </div>`;
  }).join("") : '<div class="cm-empty">该宝可梦没有特性</div>';
  const megaMap = MEGA_MOVE_MAP[s.id] || {};
  const customCnt = cardState.customMoves.filter(m => m && m.name.trim()).length;
  $("#cm-mv-count").textContent = `已选 ${cardState.moves.length + customCnt} / 4`;
  const chipsParts = cardState.moves.map((mid, i) => {
    const disp = MOVE_BY_ID[megaMap[mid] || mid] || MOVE_BY_ID[mid];
    return `<span class="cm-chip" title="点击移除" onclick="cmToggleMove(${mid})"><i>${i + 1}</i>${esc(disp.zh)}${megaMap[mid] ? " ✦" : ""}<u>✕</u></span>`;
  });
  cardState.customMoves.forEach((m, i) => {
    if (!m || !m.name.trim()) return;
    chipsParts.push(`<span class="cm-chip cm-chip-custom" title="点击移除" onclick="cmRemoveCustomMove(${i})"><i>${cardState.moves.length + i + 1}</i>${esc(m.name)}<u>✕</u></span>`);
  });
  $("#cm-chips").innerHTML = chipsParts.length ? chipsParts.join("") : '<span class="cm-empty">尚未选择招式</span>';
  const q = toHans($("#cm-mq").value.trim()).toLowerCase();
  const rows = cmMovepool(s).filter(({ mid }) => {
    const m = MOVE_BY_ID[mid];
    return !q || m.zh.toLowerCase().includes(q) || m.en.toLowerCase().includes(q);
  });
  $("#cm-mv-list").innerHTML = rows.map(({ mid, src }) => {
    const m = MOVE_BY_ID[mid];
    const to = megaMap[mid];
    const sel = cardState.moves.indexOf(mid);
    return `<div class="cm-row${sel >= 0 ? " on" : ""}" onclick="cmToggleMove(${mid})">
      <span class="cm-ord">${sel >= 0 ? sel + 1 : "+"}</span>
      <span class="cm-mv-name">${esc(m.zh)}</span>
      ${typePill(TYPE_BY_ID[m.type] || { zh: "?", color: "#999" }, true)}
      ${splitBadge(m.split)}
      <span class="cm-mv-meta">${fmtPower(m.power)} / ${m.acc || "—"} · ${esc(src)}</span>
      ${to ? `<span class="cm-mega-hint">✦ 超级进化时自动变为「${esc(MOVE_BY_ID[to].zh)}」</span>` : ""}
    </div>`;
  }).join("") || '<div class="cm-empty">没有匹配的招式</div>';
  const notes = [];
  if (Object.keys(megaMap).length)
    notes.push(`<div>✦ ${esc(speciesName(s))}是超级进化宝可梦：招式表中「变化前」的招式在卡面上会自动显示为对应的超级进化招式。</div>`);
  notes.push(`<div>点击卡面：图片切换闪光形态，特性 / 招式区域可查看详情。</div>`);
  $("#cm-note").innerHTML = notes.join("");
  const cabN = $("#cm-cab-name"), cabD = $("#cm-cab-desc");
  if (cabN && cabD) {
    const ca = cardState.customAbility;
    const nv = ca ? ca.name : "", dv = ca ? ca.desc : "";
    if (cabN.value !== nv) cabN.value = nv;
    if (cabD.value !== dv) cabD.value = dv;
  }
  cmRefreshCustomMoves();
  mountSprites($("#cm-cur"));
  cmDraw();
}
function cmRefreshCustomMoves() {
  const box = $("#cm-custom-mvs");
  if (!box) return;
  const typeOpts = TYPES_SHOWN.map(t => `<option value="${t.id}">${esc(t.zh)}</option>`).join("");
  const splits = ["物理", "特殊", "变化"];
  box.innerHTML = cardState.customMoves.map((m, i) => `
    <div class="cm-cmv-row">
      <div class="cm-cmv-head">
        <input class="cm-input" placeholder="招式名称" value="${esc(m.name || "")}" oninput="cmEditCustomMove(${i},'name',this.value)">
        <button type="button" class="cm-btn ghost cm-mini" onclick="cmRemoveCustomMove(${i})">✕</button>
      </div>
      <div class="cm-cmv-fields">
        <select class="cm-input" onchange="cmEditCustomMove(${i},'type',this.value)">
          <option value="">属性</option>${typeOpts}
        </select>
        <select class="cm-input" onchange="cmEditCustomMove(${i},'split',this.value)">
          <option value="">分类</option>${splits.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <input class="cm-input cm-num" type="number" placeholder="威力" value="${esc(m.power || "")}" oninput="cmEditCustomMove(${i},'power',this.value)">
        <input class="cm-input cm-num" type="number" placeholder="命中" value="${esc(m.acc || "")}" oninput="cmEditCustomMove(${i},'acc',this.value)">
      </div>
      <textarea class="cm-input" placeholder="招式描述" rows="2" oninput="cmEditCustomMove(${i},'desc',this.value)">${esc(m.desc || "")}</textarea>
    </div>`).join("");
  cardState.customMoves.forEach((m, i) => {
    const row = box.children[i];
    if (!row) return;
    const sels = row.querySelectorAll("select");
    if (sels[0] && m.type) sels[0].value = m.type;
    if (sels[1] && m.split) sels[1].value = m.split;
  });
  const addBtn = $("#cm-cmv-add");
  if (addBtn) addBtn.style.display = cardState.customMoves.length >= 4 ? "none" : "";
  const cntEl = $("#cm-cmv-count");
  if (cntEl) cntEl.textContent = `${cardState.customMoves.length} / 4`;
}
window.cmOnCustomAbility = function () {
  const n = $("#cm-cab-name"), d = $("#cm-cab-desc");
  if (!n || !d) return;
  const nv = n.value.trim();
  cardState.customAbility = nv ? { name: nv, desc: d.value } : null;
  cmDraw();
};
window.cmClearCustomAbility = function () {
  cardState.customAbility = null;
  const n = $("#cm-cab-name"), d = $("#cm-cab-desc");
  if (n) n.value = "";
  if (d) d.value = "";
  cmDraw();
};
window.cmAddCustomMove = function () {
  if (cardState.customMoves.length >= 4) return;
  cardState.customMoves.push({ name: "", type: 0, split: "物理", power: 0, acc: "", desc: "" });
  cmRefreshCustomMoves();
  cmDraw();
};
window.cmRemoveCustomMove = function (i) {
  cardState.customMoves.splice(i, 1);
  cmRefreshCustomMoves();
  cmDraw();
};
window.cmEditCustomMove = function (i, field, v) {
  if (!cardState.customMoves[i]) return;
  cardState.customMoves[i][field] = v;
  cmDraw();
};
function renderCardMaker(speciesId) {
  // 从详情页「自制卡牌」按钮进入 (#/card/<id>): 显式切到该宝可梦
  if (speciesId && SPECIES_BY_ID[+speciesId] && +speciesId !== cardState.sp) cmSelectSpecies(+speciesId);
  if (!cardState.sp || !SPECIES_BY_ID[cardState.sp]) cmSelectSpecies(cmDefaultSpecies());
  app.innerHTML = `
    <div class="page-title">自制卡牌</div>
    <div class="page-sub">自选宝可梦、特性与最多 4 个招式，生成专属卡牌，可保存为图片</div>
    <div class="cardmaker">
      <div class="cm-controls">
        <section>
          <div class="cm-title">① 选择宝可梦</div>
          <div id="cm-cur"></div>
          ${searchBox("cm-q", "搜索宝可梦名称 / 编号…", "")}
          <div class="cm-sp-list hidden" id="cm-sp-list"></div>
        </section>
        <section>
          <div class="cm-title">② 选择特性</div>
          <div id="cm-ab"></div>
        </section>
        <section>
          <div class="cm-title">③ 选择招式 <span class="cm-count" id="cm-mv-count"></span></div>
          <div class="cm-chips" id="cm-chips"></div>
          ${searchBox("cm-mq", "在招式表中筛选…", "")}
          <div class="cm-mv-list" id="cm-mv-list"></div>
        </section>
        <section>
          <div class="cm-title">④ 自定义特性 <span class="cm-count">填写后覆盖既有特性</span></div>
          <div class="cm-custom-ab">
            <input class="cm-input" id="cm-cab-name" placeholder="特性名称（如：钢铁意志）" oninput="cmOnCustomAbility()">
            <textarea class="cm-input" id="cm-cab-desc" placeholder="特性描述文本" rows="2" oninput="cmOnCustomAbility()"></textarea>
            <button type="button" class="cm-btn ghost cm-mini" onclick="cmClearCustomAbility()">清除自定义特性</button>
          </div>
        </section>
        <section>
          <div class="cm-title">⑤ 自定义招式 <span class="cm-count" id="cm-cmv-count"></span></div>
          <div id="cm-custom-mvs"></div>
          <button type="button" class="cm-btn ghost cm-mini cm-add-btn" id="cm-cmv-add" onclick="cmAddCustomMove()">+ 添加自定义招式</button>
        </section>
      </div>
      <div class="cm-preview">
        <div class="cm-style-pick">
          <button class="cm-style-btn${cardState.style === "normal" ? " on" : ""}" data-style="normal" onclick="cmPickStyle('normal')">普通</button>
          <button class="cm-style-btn${cardState.style === "holo" ? " on" : ""}" data-style="holo" onclick="cmPickStyle('holo')">闪卡</button>
          <button class="cm-style-btn${cardState.style === "gold" ? " on" : ""}" data-style="gold" onclick="cmPickStyle('gold')">金卡</button>
        </div>
        <canvas id="cm-card" width="${CARD_W * CARD_SCALE}" height="${CARD_H * CARD_SCALE}"></canvas>
        <div class="cm-actions">
          <button type="button" class="cm-btn" onclick="cmDownload()">⬇ 保存图片</button>
          <button type="button" class="cm-btn ghost" onclick="cmReset()">重置</button>
        </div>
        <div class="cm-note" id="cm-note"></div>
      </div>
    </div>`;
  $("#cm-q").addEventListener("input", debounce(e => {
    const raw = e.target.value.trim();
    const q = toHans(raw).toLowerCase();
    const listEl = $("#cm-sp-list");
    if (!q) { listEl.classList.add("hidden"); return; }
    const qNum = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/^[#＃]+/, "").replace(/^0+(?=\d)/, "");
    const hits = D.species.filter(s =>
      speciesName(s).toLowerCase().includes(q)
      || (s.tags && s.tags.includes(raw))
      || (s.dex != null && qNum && String(s.dex) === qNum)).slice(0, 20);
    listEl.innerHTML = hits.map(s => `
      <div class="cm-row" onclick="cmPickSpecies(${s.id})">
        ${spriteCanvas("icon", s.id)}
        <span class="cm-mv-name">${esc(speciesName(s))}</span>
        <span class="cm-mv-meta">${fmtDex(s.dex)}${s.formLabel ? " · " + esc(s.formLabel) : ""}</span>
      </div>`).join("") || '<div class="cm-empty">没有找到符合条件的宝可梦</div>';
    listEl.classList.remove("hidden");
    mountSprites(listEl);
  }, SEARCH_DEBOUNCE));
  $("#cm-mq").addEventListener("input", debounce(cmRefresh, SEARCH_DEBOUNCE));
  $("#cm-card").addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * CARD_W, cy = (e.clientY - r.top) / r.height * CARD_H;
    for (const rg of cmRegions) {
      if (x >= rg.x && x < rg.x + rg.w && cy >= rg.y && cy < rg.y + rg.h) {
        if (rg.act === "shiny") { cardState.shiny = !cardState.shiny; cmDraw(); }
        else if (rg.act === "move") showMovePopup(rg.mid);
        else if (rg.act === "ability" && cardState.ability != null && !(cardState.customAbility && cardState.customAbility.name.trim())) showAbilityPopup(cardState.ability);
        break;
      }
    }
  });
  cmRefresh();
}

/* ---------------- 属性相性页 ---------------- */
function renderTypes() {
  const shown = SPECIES_FILTER_TYPES;
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

function renderFeatures() {
  app.innerHTML = `
    <div class="page-title">版本特色</div>
    <div class="page-sub">火红物语独有系统</div>
    <div class="feature-card">
      <div class="feature-header">
        <span class="feature-icon">✦</span>
        <h2>觉醒形态系统</h2>
      </div>
      <p class="feature-intro">在宝可梦对战中，部分携带特殊道具或招式的宝可梦，在出场时会触发特殊的形态变化。</p>
      <div class="feature-section">
        <h3>触发与属性变化</h3>
        <div class="feature-item">
          <span class="feature-label">触发条件</span>
          <p>宝可梦必须携带道具「觉醒能量」或招式「觉醒力量」，且属于可觉醒的物种。</p>
        </div>
        <div class="feature-item">
          <span class="feature-label">属性重构</span>
          <p>觉醒出场时，宝可梦的【设定属性】变为副属性，当前宝可梦设定的觉醒力量属性变为主属性。</p>
          <div class="feature-example">例：电属性的觉醒电蜘蛛，若其觉醒属性为水，出场则变为水/电属性</div>
        </div>
        <div class="feature-item">
          <span class="feature-label">持续时间</span>
          <p>觉醒形态一旦触发，将持续至本场战斗结束（宝可梦替换下场后再次上场，依然保持觉醒形态）。</p>
        </div>
      </div>
      <div class="feature-shots">
        <div class="feature-shot">
          <img src="data/features/awaken_before.png" alt="觉醒前">
          <span>觉醒前</span>
        </div>
        <div class="feature-shot">
          <img src="data/features/awaken_after.png" alt="觉醒后">
          <span>觉醒后</span>
        </div>
      </div>
      <div class="feature-section">
        <h3>种族值分配规则</h3>
        <p class="feature-note">觉醒形态并非单纯的数值膨胀，而是对体内力量的重新分配：</p>
        <div class="feature-item">
          <span class="feature-label">HP 种族值</span>
          <p>在原有基础上 <strong>+15</strong>。</p>
        </div>
        <div class="feature-item">
          <span class="feature-label">五项能力</span>
          <p>除 HP 外，攻击、防御、特攻、特防、速度这五项种族值合计固定为 <strong>485</strong>。</p>
        </div>
      </div>
      <div class="feature-section">
        <h3>专属招式强化</h3>
        <p>处于觉醒形态时，宝可梦对觉醒力量的掌握将发生质变，携带的「觉醒力量」的威力固定提升至 <strong>90</strong>。</p>
        <div class="feature-item">
          <span class="feature-label">物理/特殊判定</span>
          <p>若使用者的【攻击】高于【特攻】，则该招式在结算时自动变为物理招式；反之则为特殊招式。</p>
        </div>
      </div>
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
  // __bypass: 绕过 Service Worker 的缓存优先拦截, 否则本地开发时轮询永远读到旧文件
  Promise.all([
    fetch("data/data.js?__bypass=1", { cache: "no-store" }),
    fetch("app.js?__bypass=1", { cache: "no-store" }),
  ]).then(([d, a]) => { base.data = dgst(d); base.app = dgst(a); }).catch(() => {});
  setInterval(() => {
    if (!base.data) return;
    Promise.all([
      fetch("data/data.js?__bypass=1", { cache: "no-store" }),
      fetch("app.js?__bypass=1", { cache: "no-store" }),
    ]).then(([d, a]) => {
      const nd = dgst(d), na = dgst(a);
      if (nd !== base.data || na !== base.app) {
        base.data = nd; base.app = na;
        location.reload();
      }
    }).catch(() => { /* 本地服务不可达时静默 */ });
  }, 8000);
})();
