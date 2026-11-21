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
const EVO_MAIN_SKIP = { EVO_MEGA: 1, EVO_GIGANTAMAX: 1, EVO_AWAKEN: 1, EVO_FORM_ABILITY: 1, EVO_FORM_ITEM: 1 };
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
/* 道具形态变化 (CFRU party_menu.c ItemUseCB_FormChangeItem): 对指定物种使用道具后变为另一形态。
   只画「默认形态 → 异形」方向 (与超级进化表存储方向一致, 双向都画会让全员无根画不出树);
   互变关系在 note 里说明。合体类道具需另一只宝可梦参与, 一并画出并在 note 写明同伴。 */
const FORM_ITEM_TRANSITIONS = [
  { item: "葛拉西蒂亚花", from: "SHAYMIN", to: "SHAYMIN_SKY", note: "仅白天可使用（夜晚无效）；天空形态在夜晚或进出盒子时恢复陆上形态。" },
  { item: "现形镜", from: "TORNADUS", to: "TORNADUS_THERIAN", note: "化身形态与灵兽形态可互相转换。" },
  { item: "现形镜", from: "THUNDURUS", to: "THUNDURUS_THERIAN", note: "化身形态与灵兽形态可互相转换。" },
  { item: "现形镜", from: "LANDORUS", to: "LANDORUS_THERIAN", note: "化身形态与灵兽形态可互相转换。" },
  { item: "现形镜", from: "ENAMORUS", to: "ENAMORUS_THERIAN", note: "化身形态与灵兽形态可互相转换。" },
  { item: "惩戒之壶", from: "HOOPA", to: "HOOPA_UNBOUND", note: "约束形态与解放形态可互相转换。" },
  { item: "金黄色花蜜", from: "ORICORIO", to: "ORICORIO_Y" },
  { item: "桃粉色花蜜", from: "ORICORIO", to: "ORICORIO_P" },
  { item: "兰紫色花蜜", from: "ORICORIO", to: "ORICORIO_S" },
  { item: "基因之楔", from: "KYUREM", to: "KYUREM_BLACK", note: "与捷克罗姆合体；分离后恢复原形。" },
  { item: "基因之楔", from: "KYUREM", to: "KYUREM_WHITE", note: "与莱希拉姆合体；分离后恢复原形。" },
  { item: "索尔合体器", from: "NECROZMA", to: "NECROZMA_DUSK_MANE", note: "与索尔迦雷欧合体；分离后恢复原形。" },
  { item: "露奈合体器", from: "NECROZMA", to: "NECROZMA_DAWN_WINGS", note: "与露奈雅拉合体；分离后恢复原形。" },
];
const FORM_ITEM_EDGES = FORM_ITEM_TRANSITIONS.flatMap(({ item, from, to, note }) => {
  const source = D.species.find(s => s.en === from);
  const target = D.species.find(s => s.en === to);
  if (!source || !target) return [];
  return [{ from: source.id, edge: { to: target.id, method: "EVO_FORM_ITEM", text: `使用${item}`, note: note || "" } }];
});
const speciesEvolutions = id => (SPECIES_BY_ID[id].evolutions || []).concat(
  FORM_ABILITY_EDGES.filter(x => x.from === id).map(x => x.edge),
  FORM_ITEM_EDGES.filter(x => x.from === id).map(x => x.edge)
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
  SHAYMIN_SKY: "（天空形态）",
  TORNADUS_THERIAN: "（灵兽形态）",
  THUNDURUS_THERIAN: "（灵兽形态）",
  LANDORUS_THERIAN: "（灵兽形态）",
  ENAMORUS_THERIAN: "（灵兽形态）",
  HOOPA_UNBOUND: "（解放形态）",
  ORICORIO: "（热辣热辣风格）",
  ORICORIO_Y: "（啪滋啪滋风格）",
  ORICORIO_P: "（呼拉呼拉风格）",
  ORICORIO_S: "（轻盈轻盈风格）",
  NECROZMA_DUSK_MANE: "（黄昏之鬃）",
  NECROZMA_DAWN_WINGS: "（拂晓之翼）",
};
const MEGA_BASE_SPECIES = {
  ZYGARDE_MEGA: "ZYGARDE_COMPLETE",
  ZYGARDE50_MEGA: "ZYGARDE",
};
/* 官方译名整体替换 (后缀拼不出的独立物种名, 如暗黑酋雷姆/焰白酋雷姆) */
const SPECIES_FULL_NAME = { KYUREM_BLACK: "暗黑酋雷姆", KYUREM_WHITE: "焰白酋雷姆" };
function speciesName(s) {
  if (SPECIES_FULL_NAME[s.en]) return SPECIES_FULL_NAME[s.en];
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
/* 详情页左右滑动翻页: 水平位移 ≥60px 且明显大于垂直位移才触发; 起点在表格(横滚)、输入区或任何可横向滚动的容器(如进化链)时忽略 */
let touchStart = null;
/* 起点是否位于横向滚动容器内: overflow-x 为 auto/scroll 且内容确实溢出 (如进化链/图表), 此时滑动应滚动该容器而非翻页 */
const inHScroller = el => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth) return true;
  }
  return false;
};
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
  if (e.target.closest("table, input, textarea") || inHScroller(e.target)) return;
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
  else if (h.startsWith("#/guess")) renderGuess();
  else if (h.startsWith("#/gacha")) renderGacha();
  else if (h.startsWith("#/album")) renderAlbum();
  else if (h.startsWith("#/sync")) renderSync();
  else if (h.startsWith("#/breed")) renderBreed();
  else if (h.startsWith("#/home")) renderPkHome();
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

/* ---------------- 每日宝可梦 ----------------
   以当天日期字符串为种子确定性选一只: 刷新/回访结果一致, 每天自动轮换;
   首页顶部横幅可反复点开查看, 每天首次打开站点自动弹一次窗。 */
const DAILY_SKIP = new Set([
  // 超人气常驻明星不进每日轮换, 让推荐保持"冷门/特殊"的新鲜感
  "BULBASAUR", "IVYSAUR", "VENUSAUR", "CHARMANDER", "CHARMELEON", "CHARIZARD",
  "SQUIRTLE", "WARTORTLE", "BLASTOISE", "PIKACHU", "RAICHU", "EEVEE",
  "MEW", "MEWTWO", "SNORLAX", "GENGAR",
  "GYARADOS", "DRAGONITE", "LUGIA", "HO_OH", "LUCARIO", "GRENINJA",
  "RAYQUAZA", "ARCEUS",
]);
const DAILY_STAT_TITLES = { hp: "血量担当", atk: "物理炮台", def: "钢铁壁垒", spa: "特攻利刃", spd: "特防坚盾", spe: "速度之星" };
const DAILY_INTROS = [
  "今天的缘分之选是{name}！别看它低调，认真了解后说不定正合你的队伍。",
  "命运抽签选中了{name}，快去认识一下这位冷门好手。",
  "{name}今天登上了图鉴头条，它的本事可比名气大。",
  "今日推荐非{name}莫属，也许你会重新发现它的魅力。",
  "轮到{name}值班了，它在图鉴里等你很久了。",
  "{name}悄悄爬上了今日榜单，去看看它有什么独门本领。",
];
function dailyDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
/* xmur3 字符串散列 + mulberry32: 足够均匀的确定性随机, 无需引入库 */
function dailyRand(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = h >>> 0;
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let dailyCache = null;
function dailyPokemon() {
  const key = dailyDateKey();
  if (dailyCache && dailyCache.key === key) return dailyCache;
  const now = new Date();
  const rand = dailyRand("pkdx-daily-" + key);
  const pool = D.species.filter(s => s.isDefault && s.dex > 0 && !DAILY_SKIP.has(s.constName));
  const s = pool[Math.floor(rand() * pool.length)];
  let top = "hp";
  for (const k of Object.keys(DAILY_STAT_TITLES)) if (s.stats[k] > s.stats[top]) top = k;
  const intro = DAILY_INTROS[Math.floor(rand() * DAILY_INTROS.length)].replace("{name}", speciesName(s));
  const weekday = "日一二三四五六"[now.getDay()];
  dailyCache = {
    key, s, top, intro,
    title: DAILY_STAT_TITLES[top],
    dateZh: `${now.getMonth() + 1}月${now.getDate()}日 · 周${weekday}`,
    flavor: s.flavor || `${speciesName(s)}是${s.types.map(id => TYPE_BY_ID[id].zh).join("/")}属性的宝可梦，种族值合计 ${statTotal(s)}，${STAT_ZH[top]}高达 ${s.stats[top]}，是队伍里可靠的${DAILY_STAT_TITLES[top]}。`,
  };
  return dailyCache;
}
function dailyBannerHTML() {
  const d = dailyPokemon();
  const t = TYPE_BY_ID[d.s.types[0]];
  return `<div class="daily-banner" style="background:linear-gradient(100deg, color-mix(in srgb, ${t ? t.color : "#9299A1"} 24%, var(--card)), var(--card) 72%)" onclick="showDailyPopup()" title="每日宝可梦">
    ${spriteCanvas("front", d.s.id, "daily-spr")}
    <div class="daily-banner-info">
      <div class="daily-banner-tag">📅 每日宝可梦 · ${d.dateZh}</div>
      <div class="daily-banner-name">${esc(speciesName(d.s))} <span class="daily-banner-no">${fmtDex(d.s.dex)}</span></div>
      <div class="daily-banner-teaser">「${d.title}」${typePills(d.s.types, true)} · 点击查看今日推荐语</div>
    </div>
    <span class="daily-banner-arrow">›</span>
  </div>`;
}
window.showDailyPopup = function () {
  const d = dailyPokemon();
  showPopup(`
    <div class="daily-pop-tag">📅 每日宝可梦 · ${d.dateZh}</div>
    <h2>${esc(speciesName(d.s))} <span class="daily-pop-no">${fmtDex(d.s.dex)}</span></h2>
    <div class="daily-pop-body">
      <div class="daily-pop-spr">${spriteCanvas("front", d.s.id, "", 96, true)}<div class="daily-pop-hint">点击图片切换闪光</div></div>
      <div class="daily-pop-side">
        <div class="mv-meta">${typePills(d.s.types)}<span class="pill small" style="background:#5a6b7d">${d.title}</span></div>
        <div class="daily-pop-intro">${esc(d.intro)}</div>
        <div class="daily-pop-stat">${STAT_ZH[d.top]} <b>${d.s.stats[d.top]}</b> · 种族值合计 <b>${statTotal(d.s)}</b></div>
      </div>
    </div>
    <div class="mv-desc">${esc(d.flavor)}</div>
    <div class="daily-pop-actions">
      <button type="button" onclick="location.hash='#/p/${d.s.id}';hidePopup()">查看详情</button>
    </div>`);
  mountSprites(popup);
};
/* 每天首次打开自动弹窗: localStorage 记下当天日期, 已弹过则静默 */
function maybeShowDailyPopup() {
  const key = dailyDateKey();
  if (localStorage.getItem("pkdx_daily_seen") === key) return;
  localStorage.setItem("pkdx_daily_seen", key);
  window.showDailyPopup();
}

/* ---------------- 首页 ---------------- */
function monCard(s, statKey) {
  const bestR = gachaBestRarity(s.id);
  return `<div class="mon-card${bestR ? " mon-card-" + bestR : ""}" onclick="location.hash='#/p/${s.id}'">
    <button type="button" class="fav-btn${favs.has(s.id) ? " on" : ""}" data-fav="${s.id}" title="收藏" onclick="event.stopPropagation();toggleFavUI(${s.id})"></button>
    ${spriteCanvas("front", s.id, "mon-spr", null, true)}
    <div class="no">${fmtDex(s.dex)}</div>
    <div class="nm${bestR === "EX" ? " nm-diamond" : bestR === "UR" ? " nm-rainbow" : ""}">${esc(speciesName(s))}</div>
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
        ${dailyBannerHTML()}
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
  mountSprites(app);  // 每日宝可梦横幅的精灵图 (图鉴区已在 renderDexArea 内挂载)
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
  const isList = homeState.view === "list";
  const statKey = byStat ? key : null;
  const present = new Set();
  // 准备分组: [{id, header, items, isSection}]
  const groups = [];
  if (hasDex.length && byStat) {
    groups.push({ id: "dg-stat", header: `<div class="group-h">按${STAT_ZH[key]}排序</div>`, items: hasDex, isSection: false });
  } else if (hasDex.length) {
    const byGen = {};
    hasDex.forEach(s => (byGen[dexGen(s.dex)] = byGen[dexGen(s.dex)] || []).push(s));
    Object.keys(byGen).map(Number).sort((a, b) => a - b).forEach(g => {
      present.add("pgen-" + g);
      groups.push({ id: `pgen-${g}`, header: `<h3 class="gen-h">${GEN_NAMES[g]}<span class="gen-cnt">${byGen[g].length} 只</span></h3>`, items: byGen[g], isSection: true });
    });
  }
  if (others.length) {
    groups.push({ id: "dg-others", header: `<div class="group-h">其他形态</div>`, items: others, isSection: false });
  }
  if (!groups.length) {
    $("#dex-area").innerHTML = `<div style="text-align:center;color:var(--muted);padding:60px 0">${homeState.favOnly && !favs.size ? "还没有收藏的宝可梦，点击卡片右上角的 ♡ 即可收藏" : "没有找到符合条件的宝可梦"}</div>`;
    tocMark(present, "");
    return;
  }
  // 分批渲染: 首批 BATCH_FIRST, 后续每批 BATCH_NEXT (仅卡片视图; 列表视图一次性)
  const BATCH_FIRST = 60, BATCH_NEXT = 120;
  const pending = [];  // [{id, items}]
  let html = "";
  for (const g of groups) {
    const open = g.isSection ? `<section class="gen-sec" id="${g.id}">${g.header}` : g.header;
    const close = g.isSection ? `</section>` : "";
    if (isList) {
      html += open + dexListHTML(g.items) + close;
    } else {
      const first = g.items.slice(0, BATCH_FIRST);
      const rest = g.items.slice(BATCH_FIRST);
      html += open + `<div class="dex-grid" data-grid="${g.id}">${first.map(s => monCard(s, statKey)).join("")}</div>` + close;
      if (rest.length) pending.push({ id: g.id, items: rest });
    }
  }
  $("#dex-area").innerHTML = html;
  tocMark(present, byStat ? "按种族值排序时不分世代，切回「图鉴编号」排序即可按世代跳转" : "");
  mountSprites($("#dex-area"));
  if (!pending.length) return;
  let pi = 0;
  function nextBatch() {
    if (!$("#dex-area") || pi >= pending.length) return;
    const { id, items } = pending[pi];
    const grid = $(`[data-grid="${id}"]`);
    if (!grid) { pi++; nextBatch(); return; }
    const slice = items.slice(0, BATCH_NEXT);
    grid.insertAdjacentHTML("beforeend", slice.map(s => monCard(s, statKey)).join(""));
    mountSprites(grid);
    if (items.length > BATCH_NEXT) pending[pi] = { id, items: items.slice(BATCH_NEXT) };
    else pi++;
    requestAnimationFrame(nextBatch);
  }
  requestAnimationFrame(nextBatch);
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
  // 阶段: 起点为「未进化」, 每经一次普通进化 +1 阶; 特殊形态写其方式 (超级进化/超极巨化/觉醒形态/道具形态变化…)
  const stageOf = (e, depth) => EVO_MAIN_SKIP[e.method]
    ? [e.method === "EVO_FORM_ITEM" ? "形态变化" : e.text, depth]
    : [`${depth + 1}阶进化`, depth + 1];
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
  customAbility: null, customMoves: [], style: "normal", label: null };
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

  ctx.fillStyle = "rgba(255,255,255,.94)";    // 底部信息栏 (右侧含站点二维码, 文字居中)
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
  cmDrawQR(ctx, 888, 1298, 96, false);        // 站点二维码: 扫码直达图鉴 (白底信息栏兼静区)
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

/* 站点二维码: https://wuhealthy.github.io/CFRU-expansion/ (segno 生成 33×33 矩阵, 纠错 Q; 换链接需重新生成) */
const QR_MATRIX = [
    "111111101001000001111101001111111",
    "100000100001000001000100001000001",
    "101110100010110001101110101011101",
    "101110100011101100000010101011101",
    "101110101100101101100001001011101",
    "100000101000000110100110101000001",
    "111111101010101010101010101111111",
    "000000000100100100100100100000000",
    "011111110100100011001010100110001",
    "110001011010000110011011001101101",
    "000011111000111100101010000010110",
    "011010010000010010000100001011101",
    "110101101100101010110010010001011",
    "111010011101110010000111010000011",
    "100101110101010010101110111111110",
    "110111000010001010011100111001100",
    "111000110111110101010011110110001",
    "000010011001000000011101011101101",
    "001010100100100100101000110110100",
    "000101000111110001011110110111101",
    "001010101100110100000011000101000",
    "100101011010110010110001001001001",
    "100001110101001110100100010011010",
    "100100000000110010011100011100111",
    "101110110101011001110010111110001",
    "000000001110111101111010100010101",
    "111111101110101011000101101010110",
    "100000101111100001011111100011110",
    "101110101011101011110010111111010",
    "101110101101101001111001110011001",
    "101110101100000110001101111101000",
    "100000101010010001011110011011100",
    "111111100110000011110001110100110",
];
/* 在 (x,y) 画 size×size 的站点二维码; plate 为真时先铺白色圆角底板 (兼作静区) */
function cmDrawQR(ctx, x, y, size, plate) {
  const n = QR_MATRIX.length, quiet = 2, u = size / (n + quiet * 2);
  if (plate) { cmRR(ctx, x, y, size, size, size * .18); ctx.fillStyle = "#fff"; ctx.fill(); }
  ctx.fillStyle = "#000";
  ctx.beginPath();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (QR_MATRIX[r][c] === "1") ctx.rect(x + (quiet + c) * u, y + (quiet + r) * u, u + .4, u + .4);
  ctx.fill();
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
  } else if (cs === "rainbow") {
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, cmMix(base, "#000000", .6));
    bg.addColorStop(1, "#111111");
    cmRR(ctx, 0, 0, CARD_W, CARD_H, 30);
    ctx.fillStyle = bg; ctx.fill();
    ctx.save();
    cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27); ctx.clip();
    const rainbow = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    rainbow.addColorStop(0, "rgba(255,0,128,0.4)");
    rainbow.addColorStop(0.25, "rgba(255,165,0,0.4)");
    rainbow.addColorStop(0.5, "rgba(0,255,0,0.4)");
    rainbow.addColorStop(0.75, "rgba(0,128,255,0.4)");
    rainbow.addColorStop(1, "rgba(128,0,255,0.4)");
    ctx.fillStyle = rainbow;
    ctx.globalCompositeOperation = "color-dodge";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 5; cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27);
    ctx.strokeStyle = "#E5E7EB"; ctx.stroke();
    ctx.lineWidth = 2; cmRR(ctx, 11, 11, CARD_W - 22, CARD_H - 22, 20);
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.stroke();
  } else if (cs === "diamond") {
    const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, "#1a1a24");
    bg.addColorStop(1, "#0a0a0f");
    cmRR(ctx, 0, 0, CARD_W, CARD_H, 30);
    ctx.fillStyle = bg; ctx.fill();
    ctx.save();
    cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(CARD_W * 0.2, 0); ctx.lineTo(CARD_W * 0.8, 0);
    ctx.lineTo(CARD_W, CARD_H * 0.4); ctx.lineTo(CARD_W * 0.6, CARD_H);
    ctx.lineTo(0, CARD_H * 0.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(200,230,255,0.2)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CARD_W * 0.5, 0); ctx.lineTo(CARD_W, CARD_H); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 6; cmRR(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 27);
    const dg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    dg.addColorStop(0, "#e0f2fe"); dg.addColorStop(0.5, "#ffffff"); dg.addColorStop(1, "#94a3b8");
    ctx.strokeStyle = dg; ctx.stroke();
    ctx.lineWidth = 2; cmRR(ctx, 11, 11, CARD_W - 22, CARD_H - 22, 20);
    ctx.strokeStyle = "rgba(200,230,255,.6)"; ctx.stroke();
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
  ctx.fillStyle = cs === "gold" ? "rgba(255,215,0,.08)" : cs === "rainbow" ? "rgba(180,100,255,.1)" : cs === "diamond" ? "rgba(200,230,255,.08)" : "rgba(255,255,255,.05)";
  ctx.beginPath();
  ctx.moveTo(CARD_W * .3, 12); ctx.lineTo(CARD_W * .56, 12);
  ctx.lineTo(CARD_W * .34, CARD_H - 12); ctx.lineTo(CARD_W * .08, CARD_H - 12);
  ctx.closePath(); ctx.fill();
  if (cs === "holo" || cs === "rainbow") {
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
  ctx.fillText(cmT(cardState.label || (cs === "holo" ? "★ 闪卡" : cs === "gold" ? "★ 金卡" : cs === "rainbow" ? "★ 彩卡" : cs === "diamond" ? "★ 钻石卡" : "★ 自制卡牌")), CARD_W - M - 76, fy + 22);
  ctx.font = cmFont(12); ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fillText(cmT("来自火红物语图鉴"), CARD_W - M - 76, fy + 44);
  cmDrawQR(ctx, CARD_W - M - 68, fy, 60, true);   // 站点二维码: 白底板兼静区, 右缘与原文字边距对齐
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
          <button class="cm-style-btn${cardState.style === "rainbow" ? " on" : ""}" data-style="rainbow" onclick="cmPickStyle('rainbow')">彩卡</button>
          <button class="cm-style-btn${cardState.style === "diamond" ? " on" : ""}" data-style="diamond" onclick="cmPickStyle('diamond')">钻石卡</button>
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

/* SYNC_PREFIX 需在启动块之前声明: PWA 刷新可直接落在 #/sync 深链, route() 同步调用 renderSync */
const SYNC_PREFIX = "pkdx_";

/* ---------------- 宝可梦HOME (游戏存档盒子 ↔ 浏览器 HOME 盒子) ----------------
   本作扩展存档格式 (依 src/save.c / src/pokemon_storage_system.c, 已用 test.sav 全量验证):
   - 128KiB / 32×4KiB 扇区, 双槽 (0-13 / 14-27)。扇区 footer: id u16@0xFF4, checksum u16@0xFF6,
     signature 0x08012025@0xFF8, counter u32@0xFFC。chunk 在槽内轮转, 必须按 footer id 重组;
     游戏只加载 counter 较高且 14 个 chunk 校验全过的槽。
   - 14 个 chunk: 0=SB2(0xF24), 1-4=SB1(0x3D68), 5-13=存储窗口(0x83D0); 扇区 0/4/13 尾部
     0xCC/0x258/0xBA0 是 parasite 区, 绝不能写入。
   - 盒子数据是 58 字节 CompressedPokemon: 未加密、子结构固定序 (无原版 Gen3 的 XOR/洗牌),
     checksum 字段弃用。共 25 盒×30 只:
       盒1-19  = 窗口 + 4 + i*0x6CC
       盒20-22 = 扇区30/31 原始数据 (无 footer 校验): 镜像偏移 0xB0C / 0x11D8 / 0x18A4
       盒23/24 = SB1 + 0x1F08 / 0x25D4
       盒25    = SB2 + 0xB0
   - 校验和 = u32 字累加 → (sum>>16)+sum → 取低 16 位 (与 ROM CalculateSaveChecksum 一致,
     对 test.sav 14 个 chunk 全部命中)。导出时全部重算即可。
   - 昵称/训练家名/盒名用本作中文码表 HOMECN (charmap.tbl 生成, 双字节大端码 + 0xFF 结束,
     贪婪双字节优先解码; 已用真实昵称「妙蛙种子」验证)。 */
const HOMECN={0:" ",1:"À",2:"Á",3:"Â",4:"Ç",5:"È",6:"É",7:"Ê",8:"Ë",9:"Ì",11:"Î",12:"Ï",13:"Ò",14:"Ó",15:"Ô",16:"Œ",17:"Ù",18:"Ú",19:"Û",20:"Ñ",21:"ß",22:"à",23:"á",25:"ç",26:"è",27:"\\e",28:"ê",29:"ë",30:"ì",32:"î",33:"ï",34:"ò",35:"ó",36:"ô",37:"œ",38:"ù",39:"ú",40:"û",41:"ñ",42:"º",43:"ª",45:"&",46:"+",53:"=",54:";",55:"。",58:"、",59:"，",60:"！",61:"？",62:"：",81:"¿",82:"¡",90:"Í",91:"%",92:"（",93:"）",104:"â",111:"í",133:"<",134:">",161:"0",162:"1",163:"2",164:"3",165:"4",166:"5",167:"6",168:"7",169:"8",170:"9",171:"!",172:"?",173:".",174:"-",175:"·",176:"…",177:"“",178:"”",179:"‘",180:"'",181:"♂",182:"♀",183:"\\$",184:",",185:"*",186:"/",187:"A",188:"B",189:"C",190:"D",191:"E",192:"F",193:"G",194:"H",195:"I",196:"J",197:"K",198:"L",199:"M",200:"N",201:"O",202:"P",203:"Q",204:"R",205:"S",206:"T",207:"U",208:"V",209:"W",210:"X",211:"Y",212:"Z",213:"a",214:"b",215:"c",216:"d",217:"e",218:"f",219:"g",220:"h",221:"i",222:"j",223:"k",224:"l",225:"m",226:"n",227:"o",228:"p",229:"q",230:"r",231:"s",232:"t",233:"u",234:"v",235:"w",236:"x",237:"y",238:"z",239:"▶",240:":",241:"Ä",242:"Ö",243:"Ü",244:"ä",245:"ö",246:"ü",250:"\\l",251:"\\p",254:"\\n",255:"$",256:"啊",257:"阿",258:"埃",259:"挨",260:"哎",261:"唉",262:"哀",263:"皑",264:"癌",265:"蔼",266:"矮",267:"艾",268:"碍",269:"爱",270:"隘",271:"鞍",272:"氨",273:"安",274:"俺",275:"按",276:"暗",277:"岸",278:"胺",279:"案",280:"肮",281:"昂",282:"盎",283:"凹",284:"敖",285:"熬",286:"翱",287:"袄",288:"傲",289:"奥",290:"懊",291:"澳",292:"芭",293:"捌",294:"扒",295:"叭",296:"吧",297:"笆",298:"八",299:"疤",300:"巴",301:"拔",302:"跋",303:"靶",304:"把",305:"耙",306:"坝",307:"霸",308:"罢",309:"爸",310:"白",311:"柏",312:"百",313:"摆",314:"佰",315:"败",316:"拜",317:"稗",318:"斑",319:"班",320:"搬",321:"扳",322:"般",323:"颁",324:"板",325:"版",326:"扮",327:"拌",328:"伴",329:"瓣",330:"半",331:"办",332:"绊",333:"邦",334:"帮",335:"梆",336:"榜",337:"膀",338:"绑",339:"棒",340:"磅",341:"蚌",342:"镑",343:"傍",344:"谤",345:"苞",346:"胞",347:"包",348:"褒",349:"剥",350:"薄",351:"雹",352:"保",353:"堡",354:"饱",355:"宝",356:"抱",357:"报",358:"暴",359:"豹",360:"鲍",361:"爆",362:"杯",363:"碑",364:"悲",365:"卑",366:"北",367:"辈",368:"背",369:"贝",370:"钡",371:"倍",372:"狈",373:"备",374:"惫",375:"焙",376:"被",377:"奔",378:"苯",379:"本",380:"笨",381:"崩",382:"绷",383:"甭",384:"泵",385:"蹦",386:"迸",387:"逼",388:"鼻",389:"比",390:"鄙",391:"笔",392:"彼",393:"碧",394:"蓖",395:"蔽",396:"毕",397:"毙",398:"毖",399:"币",400:"庇",401:"痹",402:"闭",403:"敝",404:"弊",405:"必",406:"辟",407:"壁",408:"臂",409:"避",410:"陛",411:"鞭",412:"边",413:"编",414:"贬",415:"扁",416:"便",417:"变",418:"卞",419:"辨",420:"辩",421:"辫",422:"遍",423:"标",424:"彪",425:"膘",426:"表",427:"鳖",428:"憋",429:"别",430:"瘪",431:"彬",432:"斌",433:"濒",434:"滨",435:"宾",436:"摈",437:"兵",438:"冰",439:"柄",440:"丙",441:"秉",442:"饼",443:"炳",444:"病",445:"并",446:"玻",447:"菠",448:"播",449:"拨",450:"钵",451:"波",452:"博",453:"勃",454:"搏",455:"铂",456:"箔",457:"伯",458:"帛",459:"舶",460:"脖",461:"膊",462:"渤",463:"泊",464:"驳",465:"捕",466:"卜",467:"哺",468:"补",469:"埠",470:"不",471:"布",472:"步",473:"簿",474:"部",475:"怖",476:"擦",477:"猜",478:"裁",479:"材",480:"才",481:"财",482:"睬",483:"踩",484:"采",485:"彩",486:"菜",487:"蔡",488:"餐",489:"参",490:"蚕",491:"残",492:"惭",493:"惨",494:"灿",495:"苍",496:"舱",497:"仓",498:"沧",499:"藏",500:"操",501:"糙",502:"槽",503:"",504:"",505:"",506:"",507:"",508:"",509:"",510:"",511:"",512:"曹",513:"草",514:"厕",515:"策",516:"侧",517:"册",518:"测",519:"层",520:"蹭",521:"插",522:"叉",523:"茬",524:"茶",525:"查",526:"碴",527:"搽",528:"察",529:"岔",530:"差",531:"诧",532:"拆",533:"柴",534:"豺",535:"搀",536:"掺",537:"蝉",538:"馋",539:"谗",540:"缠",541:"铲",542:"产",543:"阐",544:"颤",545:"昌",546:"猖",547:"场",548:"尝",549:"常",550:"长",551:"偿",552:"肠",553:"厂",554:"敞",555:"畅",556:"唱",557:"倡",558:"超",559:"抄",560:"钞",561:"朝",562:"嘲",563:"潮",564:"巢",565:"吵",566:"炒",567:"车",568:"扯",569:"撤",570:"掣",571:"彻",572:"澈",573:"郴",574:"臣",575:"辰",576:"尘",577:"晨",578:"忱",579:"沉",580:"陈",581:"趁",582:"衬",583:"撑",584:"称",585:"城",586:"橙",587:"成",588:"呈",589:"乘",590:"程",591:"惩",592:"澄",593:"诚",594:"承",595:"逞",596:"骋",597:"秤",598:"吃",599:"痴",600:"持",601:"匙",602:"池",603:"迟",604:"弛",605:"驰",606:"耻",607:"齿",608:"侈",609:"尺",610:"赤",611:"翅",612:"斥",613:"炽",614:"充",615:"冲",616:"虫",617:"崇",618:"宠",619:"抽",620:"酬",621:"畴",622:"踌",623:"稠",624:"愁",625:"筹",626:"仇",627:"绸",628:"瞅",629:"丑",630:"臭",631:"初",632:"出",633:"橱",634:"厨",635:"躇",636:"锄",637:"雏",638:"滁",639:"除",640:"楚",641:"础",642:"储",643:"矗",644:"搐",645:"触",646:"处",647:"揣",648:"川",649:"穿",650:"椽",651:"传",652:"船",653:"喘",654:"串",655:"疮",656:"窗",657:"幢",658:"床",659:"闯",660:"创",661:"吹",662:"炊",663:"捶",664:"锤",665:"垂",666:"春",667:"椿",668:"醇",669:"唇",670:"淳",671:"纯",672:"蠢",673:"戳",674:"绰",675:"疵",676:"茨",677:"磁",678:"雌",679:"辞",680:"慈",681:"瓷",682:"词",683:"此",684:"刺",685:"赐",686:"次",687:"聪",688:"葱",689:"囱",690:"匆",691:"从",692:"丛",693:"凑",694:"粗",695:"醋",696:"簇",697:"促",698:"蹿",699:"篡",700:"窜",701:"摧",702:"崔",703:"催",704:"脆",705:"瘁",706:"粹",707:"淬",708:"翠",709:"村",710:"存",711:"寸",712:"磋",713:"撮",714:"搓",715:"措",716:"挫",717:"错",718:"搭",719:"达",720:"答",721:"瘩",722:"打",723:"大",724:"呆",725:"歹",726:"傣",727:"戴",728:"带",729:"殆",730:"代",731:"贷",732:"袋",733:"待",734:"逮",735:"怠",736:"耽",737:"担",738:"丹",739:"单",740:"郸",741:"掸",742:"胆",743:"旦",744:"氮",745:"但",746:"惮",747:"淡",748:"诞",749:"弹",750:"蛋",751:"当",752:"挡",753:"党",754:"荡",755:"档",756:"刀",757:"捣",758:"蹈",759:"",760:"",761:"",762:"",763:"",764:"",765:"",766:"",767:"",768:"倒",769:"岛",770:"祷",771:"导",772:"到",773:"稻",774:"悼",775:"道",776:"盗",777:"德",778:"得",779:"的",780:"蹬",781:"灯",782:"登",783:"等",784:"瞪",785:"凳",786:"邓",787:"堤",788:"低",789:"滴",790:"迪",791:"敌",792:"笛",793:"狄",794:"涤",795:"翟",796:"嫡",797:"抵",798:"底",799:"地",800:"蒂",801:"第",802:"帝",803:"弟",804:"递",805:"缔",806:"颠",807:"掂",808:"滇",809:"碘",810:"点",811:"典",812:"靛",813:"垫",814:"电",815:"佃",816:"甸",817:"店",818:"惦",819:"奠",820:"淀",821:"殿",822:"碉",823:"叼",824:"雕",825:"凋",826:"刁",827:"掉",828:"吊",829:"钓",830:"调",831:"跌",832:"爹",833:"碟",834:"蝶",835:"迭",836:"谍",837:"叠",838:"丁",839:"盯",840:"叮",841:"钉",842:"顶",843:"鼎",844:"锭",845:"定",846:"订",847:"丢",848:"东",849:"冬",850:"董",851:"懂",852:"动",853:"栋",854:"侗",855:"恫",856:"冻",857:"洞",858:"兜",859:"抖",860:"斗",861:"陡",862:"豆",863:"逗",864:"痘",865:"都",866:"督",867:"毒",868:"犊",869:"独",870:"读",871:"堵",872:"睹",873:"赌",874:"杜",875:"镀",876:"肚",877:"度",878:"渡",879:"妒",880:"端",881:"短",882:"锻",883:"段",884:"断",885:"缎",886:"堆",887:"兑",888:"队",889:"对",890:"墩",891:"吨",892:"蹲",893:"敦",894:"顿",895:"囤",896:"钝",897:"盾",898:"遁",899:"掇",900:"哆",901:"多",902:"夺",903:"垛",904:"躲",905:"朵",906:"跺",907:"舵",908:"剁",909:"惰",910:"堕",911:"蛾",912:"峨",913:"鹅",914:"俄",915:"额",916:"讹",917:"娥",918:"恶",919:"厄",920:"扼",921:"遏",922:"鄂",923:"饿",924:"恩",925:"而",926:"儿",927:"耳",928:"尔",929:"饵",930:"洱",931:"二",932:"贰",933:"发",934:"罚",935:"筏",936:"伐",937:"乏",938:"阀",939:"法",940:"珐",941:"藩",942:"帆",943:"番",944:"翻",945:"樊",946:"矾",947:"钒",948:"繁",949:"凡",950:"烦",951:"反",952:"返",953:"范",954:"贩",955:"犯",956:"饭",957:"泛",958:"坊",959:"芳",960:"方",961:"肪",962:"房",963:"防",964:"妨",965:"仿",966:"访",967:"纺",968:"放",969:"菲",970:"非",971:"啡",972:"飞",973:"肥",974:"匪",975:"诽",976:"吠",977:"肺",978:"废",979:"沸",980:"费",981:"芬",982:"酚",983:"吩",984:"氛",985:"分",986:"纷",987:"坟",988:"焚",989:"汾",990:"粉",991:"奋",992:"份",993:"忿",994:"愤",995:"粪",996:"丰",997:"封",998:"枫",999:"蜂",1000:"峰",1001:"锋",1002:"风",1003:"疯",1004:"烽",1005:"逢",1006:"冯",1007:"缝",1008:"讽",1009:"奉",1010:"凤",1011:"佛",1012:"否",1013:"夫",1014:"敷",1015:"",1016:"",1017:"",1018:"",1019:"",1020:"",1021:"",1022:"",1023:"",1024:"肤",1025:"孵",1026:"扶",1027:"拂",1028:"辐",1029:"幅",1030:"氟",1031:"符",1032:"伏",1033:"俘",1034:"服",1035:"浮",1036:"涪",1037:"福",1038:"袱",1039:"弗",1040:"甫",1041:"抚",1042:"辅",1043:"俯",1044:"釜",1045:"斧",1046:"脯",1047:"腑",1048:"府",1049:"腐",1050:"赴",1051:"副",1052:"覆",1053:"赋",1054:"复",1055:"傅",1056:"付",1057:"阜",1058:"父",1059:"腹",1060:"负",1061:"富",1062:"讣",1063:"附",1064:"妇",1065:"缚",1066:"咐",1067:"噶",1068:"嘎",1069:"该",1070:"改",1071:"概",1072:"钙",1073:"盖",1074:"溉",1075:"干",1076:"甘",1077:"杆",1078:"柑",1079:"竿",1080:"肝",1081:"赶",1082:"感",1083:"秆",1084:"敢",1085:"赣",1086:"冈",1087:"刚",1088:"钢",1089:"缸",1090:"肛",1091:"纲",1092:"岗",1093:"港",1094:"杠",1095:"篙",1096:"皋",1097:"高",1098:"膏",1099:"羔",1100:"糕",1101:"搞",1102:"镐",1103:"稿",1104:"告",1105:"哥",1106:"歌",1107:"搁",1108:"戈",1109:"鸽",1110:"胳",1111:"疙",1112:"割",1113:"革",1114:"葛",1115:"格",1116:"蛤",1117:"阁",1118:"隔",1119:"铬",1120:"个",1121:"各",1122:"给",1123:"根",1124:"跟",1125:"耕",1126:"更",1127:"庚",1128:"羹",1129:"埂",1130:"耿",1131:"梗",1132:"工",1133:"攻",1134:"功",1135:"恭",1136:"龚",1137:"供",1138:"躬",1139:"公",1140:"宫",1141:"弓",1142:"巩",1143:"汞",1144:"拱",1145:"贡",1146:"共",1147:"钩",1148:"勾",1149:"沟",1150:"苟",1151:"狗",1152:"垢",1153:"构",1154:"购",1155:"够",1156:"辜",1157:"菇",1158:"咕",1159:"箍",1160:"估",1161:"沽",1162:"孤",1163:"姑",1164:"鼓",1165:"古",1166:"蛊",1167:"骨",1168:"谷",1169:"股",1170:"故",1171:"顾",1172:"固",1173:"雇",1174:"刮",1175:"瓜",1176:"剐",1177:"寡",1178:"挂",1179:"褂",1180:"乖",1181:"拐",1182:"怪",1183:"棺",1184:"关",1185:"官",1186:"冠",1187:"观",1188:"管",1189:"馆",1190:"罐",1191:"惯",1192:"灌",1193:"贯",1194:"光",1195:"广",1196:"逛",1197:"瑰",1198:"规",1199:"圭",1200:"硅",1201:"归",1202:"龟",1203:"闺",1204:"轨",1205:"鬼",1206:"诡",1207:"癸",1208:"桂",1209:"柜",1210:"跪",1211:"贵",1212:"刽",1213:"辊",1214:"滚",1215:"棍",1216:"锅",1217:"郭",1218:"国",1219:"果",1220:"裹",1221:"过",1222:"哈",1223:"骸",1224:"孩",1225:"海",1226:"氦",1227:"亥",1228:"害",1229:"骇",1230:"酣",1231:"憨",1232:"邯",1233:"韩",1234:"含",1235:"涵",1236:"寒",1237:"函",1238:"喊",1239:"罕",1240:"翰",1241:"撼",1242:"捍",1243:"旱",1244:"憾",1245:"悍",1246:"焊",1247:"汗",1248:"汉",1249:"夯",1250:"杭",1251:"航",1252:"壕",1253:"嚎",1254:"豪",1255:"毫",1256:"郝",1257:"好",1258:"耗",1259:"号",1260:"浩",1261:"呵",1262:"喝",1263:"荷",1264:"菏",1265:"核",1266:"禾",1267:"和",1268:"何",1269:"合",1270:"盒",1271:"",1272:"",1273:"",1274:"",1275:"",1276:"",1277:"",1278:"",1279:"",1280:"貉",1281:"阂",1282:"河",1283:"涸",1284:"赫",1285:"褐",1286:"鹤",1287:"贺",1288:"嘿",1289:"黑",1290:"痕",1291:"很",1292:"狠",1293:"恨",1294:"哼",1295:"亨",1296:"横",1297:"衡",1298:"恒",1299:"轰",1300:"哄",1301:"烘",1302:"虹",1303:"鸿",1304:"洪",1305:"宏",1306:"弘",1307:"红",1308:"喉",1309:"侯",1310:"猴",1311:"吼",1312:"厚",1313:"候",1314:"后",1315:"呼",1316:"乎",1317:"忽",1318:"瑚",1319:"壶",1320:"葫",1321:"胡",1322:"蝴",1323:"狐",1324:"糊",1325:"湖",1326:"弧",1327:"虎",1328:"唬",1329:"护",1330:"互",1331:"沪",1332:"户",1333:"花",1334:"哗",1335:"华",1336:"猾",1337:"滑",1338:"画",1339:"划",1340:"化",1341:"话",1342:"槐",1343:"徊",1344:"怀",1345:"淮",1346:"坏",1347:"欢",1348:"环",1349:"桓",1350:"还",1351:"缓",1352:"换",1353:"患",1354:"唤",1355:"痪",1356:"豢",1357:"焕",1358:"涣",1359:"宦",1360:"幻",1361:"荒",1362:"慌",1363:"黄",1364:"磺",1365:"蝗",1366:"簧",1367:"皇",1368:"凰",1369:"惶",1370:"煌",1371:"晃",1372:"幌",1373:"恍",1374:"谎",1375:"灰",1376:"挥",1377:"辉",1378:"徽",1379:"恢",1380:"蛔",1381:"回",1382:"毁",1383:"悔",1384:"慧",1385:"卉",1386:"惠",1387:"晦",1388:"贿",1389:"秽",1390:"会",1391:"烩",1392:"汇",1393:"讳",1394:"诲",1395:"绘",1396:"荤",1397:"昏",1398:"婚",1399:"魂",1400:"浑",1401:"混",1402:"豁",1403:"活",1404:"伙",1405:"火",1406:"获",1407:"或",1408:"惑",1409:"霍",1410:"货",1411:"祸",1412:"击",1413:"圾",1414:"基",1415:"机",1416:"畸",1417:"稽",1418:"积",1419:"箕",1420:"肌",1421:"饥",1422:"迹",1423:"激",1424:"讥",1425:"鸡",1426:"姬",1427:"绩",1428:"缉",1429:"吉",1430:"极",1431:"棘",1432:"辑",1433:"籍",1434:"集",1435:"及",1436:"急",1437:"疾",1438:"汲",1439:"即",1440:"嫉",1441:"级",1442:"挤",1443:"几",1444:"脊",1445:"己",1446:"蓟",1447:"技",1448:"冀",1449:"季",1450:"伎",1451:"祭",1452:"剂",1453:"悸",1454:"济",1455:"寄",1456:"寂",1457:"计",1458:"记",1459:"既",1460:"忌",1461:"际",1462:"妓",1463:"继",1464:"纪",1465:"嘉",1466:"枷",1467:"夹",1468:"佳",1469:"家",1470:"加",1471:"荚",1472:"颊",1473:"贾",1474:"甲",1475:"钾",1476:"假",1477:"稼",1478:"价",1479:"架",1480:"驾",1481:"嫁",1482:"歼",1483:"监",1484:"坚",1485:"尖",1486:"笺",1487:"间",1488:"煎",1489:"兼",1490:"肩",1491:"艰",1492:"奸",1493:"缄",1494:"茧",1495:"检",1496:"柬",1497:"碱",1498:"硷",1499:"拣",1500:"捡",1501:"简",1502:"俭",1503:"剪",1504:"减",1505:"荐",1506:"槛",1507:"鉴",1508:"践",1509:"贱",1510:"见",1511:"键",1512:"箭",1513:"件",1514:"健",1515:"舰",1516:"剑",1517:"饯",1518:"渐",1519:"溅",1520:"涧",1521:"建",1522:"僵",1523:"姜",1524:"将",1525:"浆",1526:"江",1527:"",1528:"",1529:"",1530:"",1531:"",1532:"",1533:"",1534:"",1535:"",1792:"疆",1793:"蒋",1794:"桨",1795:"奖",1796:"讲",1797:"匠",1798:"酱",1799:"降",1800:"蕉",1801:"椒",1802:"礁",1803:"焦",1804:"胶",1805:"交",1806:"郊",1807:"浇",1808:"骄",1809:"娇",1810:"嚼",1811:"搅",1812:"铰",1813:"矫",1814:"侥",1815:"脚",1816:"狡",1817:"角",1818:"饺",1819:"缴",1820:"绞",1821:"剿",1822:"教",1823:"酵",1824:"轿",1825:"较",1826:"叫",1827:"窖",1828:"揭",1829:"接",1830:"皆",1831:"秸",1832:"街",1833:"阶",1834:"截",1835:"劫",1836:"节",1837:"桔",1838:"杰",1839:"捷",1840:"睫",1841:"竭",1842:"洁",1843:"结",1844:"解",1845:"姐",1846:"戒",1847:"藉",1848:"芥",1849:"界",1850:"借",1851:"介",1852:"疥",1853:"诫",1854:"届",1855:"巾",1856:"筋",1857:"斤",1858:"金",1859:"今",1860:"津",1861:"襟",1862:"紧",1863:"锦",1864:"仅",1865:"谨",1866:"进",1867:"靳",1868:"晋",1869:"禁",1870:"近",1871:"烬",1872:"浸",1873:"尽",1874:"劲",1875:"荆",1876:"兢",1877:"茎",1878:"睛",1879:"晶",1880:"鲸",1881:"京",1882:"惊",1883:"精",1884:"粳",1885:"经",1886:"井",1887:"警",1888:"景",1889:"颈",1890:"静",1891:"境",1892:"敬",1893:"镜",1894:"径",1895:"痉",1896:"靖",1897:"竟",1898:"竞",1899:"净",1900:"炯",1901:"窘",1902:"揪",1903:"究",1904:"纠",1905:"玖",1906:"韭",1907:"久",1908:"灸",1909:"九",1910:"酒",1911:"厩",1912:"救",1913:"旧",1914:"臼",1915:"舅",1916:"咎",1917:"就",1918:"疚",1919:"鞠",1920:"拘",1921:"狙",1922:"疽",1923:"居",1924:"驹",1925:"菊",1926:"局",1927:"咀",1928:"矩",1929:"举",1930:"沮",1931:"聚",1932:"拒",1933:"据",1934:"巨",1935:"具",1936:"距",1937:"踞",1938:"锯",1939:"俱",1940:"句",1941:"惧",1942:"炬",1943:"剧",1944:"捐",1945:"鹃",1946:"娟",1947:"倦",1948:"眷",1949:"卷",1950:"绢",1951:"撅",1952:"攫",1953:"抉",1954:"掘",1955:"倔",1956:"爵",1957:"觉",1958:"决",1959:"诀",1960:"绝",1961:"均",1962:"菌",1963:"钧",1964:"军",1965:"君",1966:"峻",1967:"俊",1968:"竣",1969:"浚",1970:"郡",1971:"骏",1972:"喀",1973:"咖",1974:"卡",1975:"咯",1976:"开",1977:"揩",1978:"楷",1979:"凯",1980:"慨",1981:"刊",1982:"堪",1983:"勘",1984:"坎",1985:"砍",1986:"看",1987:"康",1988:"慷",1989:"糠",1990:"扛",1991:"抗",1992:"亢",1993:"炕",1994:"考",1995:"拷",1996:"烤",1997:"靠",1998:"坷",1999:"苛",2000:"柯",2001:"棵",2002:"磕",2003:"颗",2004:"科",2005:"壳",2006:"咳",2007:"可",2008:"渴",2009:"克",2010:"刻",2011:"客",2012:"课",2013:"肯",2014:"啃",2015:"垦",2016:"恳",2017:"坑",2018:"吭",2019:"空",2020:"恐",2021:"孔",2022:"控",2023:"抠",2024:"口",2025:"扣",2026:"寇",2027:"枯",2028:"哭",2029:"窟",2030:"苦",2031:"酷",2032:"库",2033:"裤",2034:"夸",2035:"垮",2036:"挎",2037:"跨",2038:"胯",2039:"",2040:"",2041:"",2042:"",2043:"",2044:"",2045:"",2046:"",2047:"",2048:"块",2049:"筷",2050:"侩",2051:"快",2052:"宽",2053:"款",2054:"匡",2055:"筐",2056:"狂",2057:"框",2058:"矿",2059:"眶",2060:"旷",2061:"况",2062:"亏",2063:"盔",2064:"岿",2065:"窥",2066:"葵",2067:"奎",2068:"魁",2069:"傀",2070:"馈",2071:"愧",2072:"溃",2073:"坤",2074:"昆",2075:"捆",2076:"困",2077:"括",2078:"扩",2079:"廓",2080:"阔",2081:"垃",2082:"拉",2083:"喇",2084:"蜡",2085:"腊",2086:"辣",2087:"啦",2088:"莱",2089:"来",2090:"赖",2091:"蓝",2092:"婪",2093:"栏",2094:"拦",2095:"篮",2096:"阑",2097:"兰",2098:"澜",2099:"谰",2100:"揽",2101:"览",2102:"懒",2103:"缆",2104:"烂",2105:"滥",2106:"琅",2107:"榔",2108:"狼",2109:"廊",2110:"郎",2111:"朗",2112:"浪",2113:"捞",2114:"劳",2115:"牢",2116:"老",2117:"佬",2118:"姥",2119:"酪",2120:"烙",2121:"涝",2122:"勒",2123:"乐",2124:"雷",2125:"镭",2126:"蕾",2127:"磊",2128:"累",2129:"儡",2130:"垒",2131:"擂",2132:"肋",2133:"类",2134:"泪",2135:"棱",2136:"楞",2137:"冷",2138:"厘",2139:"梨",2140:"犁",2141:"黎",2142:"篱",2143:"狸",2144:"离",2145:"漓",2146:"理",2147:"李",2148:"里",2149:"鲤",2150:"礼",2151:"莉",2152:"荔",2153:"吏",2154:"栗",2155:"丽",2156:"厉",2157:"励",2158:"砾",2159:"历",2160:"利",2161:"傈",2162:"例",2163:"俐",2164:"痢",2165:"立",2166:"粒",2167:"沥",2168:"隶",2169:"力",2170:"璃",2171:"哩",2172:"俩",2173:"联",2174:"莲",2175:"连",2176:"镰",2177:"廉",2178:"怜",2179:"涟",2180:"帘",2181:"敛",2182:"脸",2183:"链",2184:"恋",2185:"炼",2186:"练",2187:"粮",2188:"凉",2189:"梁",2190:"粱",2191:"良",2192:"两",2193:"辆",2194:"量",2195:"晾",2196:"亮",2197:"谅",2198:"撩",2199:"聊",2200:"僚",2201:"疗",2202:"燎",2203:"寥",2204:"辽",2205:"潦",2206:"了",2207:"撂",2208:"镣",2209:"廖",2210:"料",2211:"列",2212:"裂",2213:"烈",2214:"劣",2215:"猎",2216:"琳",2217:"林",2218:"磷",2219:"霖",2220:"临",2221:"邻",2222:"鳞",2223:"淋",2224:"凛",2225:"赁",2226:"吝",2227:"拎",2228:"玲",2229:"菱",2230:"零",2231:"龄",2232:"铃",2233:"伶",2234:"羚",2235:"凌",2236:"灵",2237:"陵",2238:"岭",2239:"领",2240:"另",2241:"令",2242:"溜",2243:"琉",2244:"榴",2245:"硫",2246:"馏",2247:"留",2248:"刘",2249:"瘤",2250:"流",2251:"柳",2252:"六",2253:"龙",2254:"聋",2255:"咙",2256:"笼",2257:"窿",2258:"隆",2259:"垄",2260:"拢",2261:"陇",2262:"楼",2263:"娄",2264:"搂",2265:"篓",2266:"漏",2267:"陋",2268:"芦",2269:"卢",2270:"颅",2271:"庐",2272:"炉",2273:"掳",2274:"卤",2275:"虏",2276:"鲁",2277:"麓",2278:"碌",2279:"露",2280:"路",2281:"赂",2282:"鹿",2283:"潞",2284:"禄",2285:"录",2286:"陆",2287:"戮",2288:"驴",2289:"吕",2290:"铝",2291:"侣",2292:"旅",2293:"履",2294:"屡",2295:"",2296:"",2297:"",2298:"",2299:"",2300:"",2301:"",2302:"",2303:"",2304:"缕",2305:"虑",2306:"氯",2307:"律",2308:"率",2309:"滤",2310:"绿",2311:"峦",2312:"挛",2313:"孪",2314:"滦",2315:"卵",2316:"乱",2317:"掠",2318:"略",2319:"抡",2320:"轮",2321:"伦",2322:"仑",2323:"沦",2324:"纶",2325:"论",2326:"萝",2327:"螺",2328:"罗",2329:"逻",2330:"锣",2331:"箩",2332:"骡",2333:"裸",2334:"落",2335:"洛",2336:"骆",2337:"络",2338:"妈",2339:"麻",2340:"玛",2341:"码",2342:"蚂",2343:"马",2344:"骂",2345:"嘛",2346:"吗",2347:"埋",2348:"买",2349:"麦",2350:"卖",2351:"迈",2352:"脉",2353:"瞒",2354:"馒",2355:"蛮",2356:"满",2357:"蔓",2358:"曼",2359:"慢",2360:"漫",2361:"谩",2362:"芒",2363:"茫",2364:"盲",2365:"氓",2366:"忙",2367:"莽",2368:"猫",2369:"茅",2370:"锚",2371:"毛",2372:"矛",2373:"铆",2374:"卯",2375:"茂",2376:"冒",2377:"帽",2378:"貌",2379:"贸",2380:"么",2381:"玫",2382:"枚",2383:"梅",2384:"酶",2385:"霉",2386:"煤",2387:"没",2388:"眉",2389:"媒",2390:"镁",2391:"每",2392:"美",2393:"昧",2394:"寐",2395:"妹",2396:"媚",2397:"门",2398:"闷",2399:"们",2400:"萌",2401:"蒙",2402:"檬",2403:"盟",2404:"锰",2405:"猛",2406:"梦",2407:"孟",2408:"眯",2409:"醚",2410:"靡",2411:"糜",2412:"迷",2413:"谜",2414:"弥",2415:"米",2416:"秘",2417:"觅",2418:"泌",2419:"蜜",2420:"密",2421:"幂",2422:"棉",2423:"眠",2424:"绵",2425:"冕",2426:"免",2427:"勉",2428:"娩",2429:"缅",2430:"面",2431:"苗",2432:"描",2433:"瞄",2434:"藐",2435:"秒",2436:"渺",2437:"庙",2438:"妙",2439:"蔑",2440:"灭",2441:"民",2442:"抿",2443:"皿",2444:"敏",2445:"悯",2446:"闽",2447:"明",2448:"螟",2449:"鸣",2450:"铭",2451:"名",2452:"命",2453:"谬",2454:"摸",2455:"摹",2456:"蘑",2457:"模",2458:"膜",2459:"磨",2460:"摩",2461:"魔",2462:"抹",2463:"末",2464:"莫",2465:"墨",2466:"默",2467:"沫",2468:"漠",2469:"寞",2470:"陌",2471:"谋",2472:"牟",2473:"某",2474:"拇",2475:"牡",2476:"亩",2477:"姆",2478:"母",2479:"墓",2480:"暮",2481:"幕",2482:"募",2483:"慕",2484:"木",2485:"目",2486:"睦",2487:"牧",2488:"穆",2489:"拿",2490:"哪",2491:"呐",2492:"钠",2493:"那",2494:"娜",2495:"纳",2496:"氖",2497:"乃",2498:"奶",2499:"耐",2500:"奈",2501:"南",2502:"男",2503:"难",2504:"囊",2505:"挠",2506:"脑",2507:"恼",2508:"闹",2509:"淖",2510:"呢",2511:"馁",2512:"内",2513:"嫩",2514:"能",2515:"妮",2516:"霓",2517:"倪",2518:"泥",2519:"尼",2520:"拟",2521:"你",2522:"匿",2523:"腻",2524:"逆",2525:"溺",2526:"蔫",2527:"拈",2528:"年",2529:"碾",2530:"撵",2531:"捻",2532:"念",2533:"娘",2534:"酿",2535:"鸟",2536:"尿",2537:"捏",2538:"聂",2539:"孽",2540:"啮",2541:"镊",2542:"镍",2543:"涅",2544:"您",2545:"柠",2546:"狞",2547:"凝",2548:"宁",2549:"拧",2550:"泞",2551:"",2552:"",2553:"",2554:"",2555:"",2556:"",2557:"",2558:"",2559:"",2560:"牛",2561:"扭",2562:"钮",2563:"纽",2564:"脓",2565:"浓",2566:"农",2567:"弄",2568:"奴",2569:"努",2570:"怒",2571:"女",2572:"暖",2573:"虐",2574:"疟",2575:"挪",2576:"懦",2577:"糯",2578:"诺",2579:"哦",2580:"欧",2581:"鸥",2582:"殴",2583:"藕",2584:"呕",2585:"偶",2586:"沤",2587:"啪",2588:"趴",2589:"爬",2590:"帕",2591:"怕",2592:"琶",2593:"拍",2594:"排",2595:"牌",2596:"徘",2597:"湃",2598:"派",2599:"攀",2600:"潘",2601:"盘",2602:"磐",2603:"盼",2604:"畔",2605:"判",2606:"叛",2607:"乓",2608:"庞",2609:"旁",2610:"耪",2611:"胖",2612:"抛",2613:"咆",2614:"刨",2615:"炮",2616:"袍",2617:"跑",2618:"泡",2619:"呸",2620:"胚",2621:"培",2622:"裴",2623:"赔",2624:"陪",2625:"配",2626:"佩",2627:"沛",2628:"喷",2629:"盆",2630:"砰",2631:"抨",2632:"烹",2633:"澎",2634:"彭",2635:"蓬",2636:"棚",2637:"椪",2638:"篷",2639:"膨",2640:"朋",2641:"鹏",2642:"捧",2643:"碰",2644:"坯",2645:"砒",2646:"霹",2647:"批",2648:"披",2649:"劈",2650:"琵",2651:"毗",2652:"啤",2653:"脾",2654:"疲",2655:"皮",2656:"匹",2657:"痞",2658:"僻",2659:"屁",2660:"譬",2661:"篇",2662:"偏",2663:"片",2664:"骗",2665:"飘",2666:"漂",2667:"瓢",2668:"票",2669:"撇",2670:"瞥",2671:"拼",2672:"频",2673:"贫",2674:"品",2675:"聘",2676:"乒",2677:"坪",2678:"苹",2679:"萍",2680:"平",2681:"凭",2682:"瓶",2683:"评",2684:"屏",2685:"坡",2686:"泼",2687:"颇",2688:"婆",2689:"破",2690:"魄",2691:"迫",2692:"粕",2693:"剖",2694:"扑",2695:"铺",2696:"仆",2697:"莆",2698:"葡",2699:"菩",2700:"蒲",2701:"埔",2702:"朴",2703:"圃",2704:"普",2705:"浦",2706:"谱",2707:"曝",2708:"瀑",2709:"期",2710:"欺",2711:"栖",2712:"戚",2713:"妻",2714:"七",2715:"凄",2716:"漆",2717:"柒",2718:"沏",2719:"其",2720:"棋",2721:"奇",2722:"歧",2723:"畦",2724:"崎",2725:"脐",2726:"齐",2727:"旗",2728:"祈",2729:"祁",2730:"骑",2731:"起",2732:"岂",2733:"乞",2734:"企",2735:"启",2736:"契",2737:"砌",2738:"器",2739:"气",2740:"迄",2741:"弃",2742:"汽",2743:"泣",2744:"讫",2745:"掐",2746:"恰",2747:"洽",2748:"牵",2749:"扦",2750:"钎",2751:"铅",2752:"千",2753:"迁",2754:"签",2755:"仟",2756:"谦",2757:"乾",2758:"黔",2759:"钱",2760:"钳",2761:"前",2762:"潜",2763:"遣",2764:"浅",2765:"谴",2766:"堑",2767:"嵌",2768:"欠",2769:"歉",2770:"枪",2771:"呛",2772:"腔",2773:"羌",2774:"墙",2775:"蔷",2776:"强",2777:"抢",2778:"橇",2779:"锹",2780:"敲",2781:"悄",2782:"桥",2783:"瞧",2784:"乔",2785:"侨",2786:"巧",2787:"鞘",2788:"撬",2789:"翘",2790:"峭",2791:"俏",2792:"窍",2793:"切",2794:"茄",2795:"且",2796:"怯",2797:"窃",2798:"钦",2799:"侵",2800:"亲",2801:"秦",2802:"琴",2803:"勤",2804:"芹",2805:"擒",2806:"禽",2807:"",2808:"",2809:"",2810:"",2811:"",2812:"",2813:"",2814:"",2815:"",2816:"寝",2817:"沁",2818:"青",2819:"轻",2820:"氢",2821:"倾",2822:"卿",2823:"清",2824:"擎",2825:"晴",2826:"氰",2827:"情",2828:"顷",2829:"请",2830:"庆",2831:"琼",2832:"穷",2833:"秋",2834:"丘",2835:"邱",2836:"球",2837:"求",2838:"囚",2839:"酋",2840:"泅",2841:"趋",2842:"区",2843:"蛆",2844:"曲",2845:"躯",2846:"屈",2847:"驱",2848:"渠",2849:"取",2850:"娶",2851:"龋",2852:"趣",2853:"去",2854:"圈",2855:"颧",2856:"权",2857:"醛",2858:"泉",2859:"全",2860:"痊",2861:"拳",2862:"犬",2863:"券",2864:"劝",2865:"缺",2866:"炔",2867:"瘸",2868:"却",2869:"鹊",2870:"榷",2871:"确",2872:"雀",2873:"裙",2874:"群",2875:"然",2876:"燃",2877:"冉",2878:"染",2879:"瓤",2880:"壤",2881:"攘",2882:"嚷",2883:"让",2884:"饶",2885:"扰",2886:"绕",2887:"惹",2888:"热",2889:"壬",2890:"仁",2891:"人",2892:"忍",2893:"韧",2894:"任",2895:"认",2896:"刃",2897:"妊",2898:"纫",2899:"扔",2900:"仍",2901:"日",2902:"戎",2903:"茸",2904:"蓉",2905:"荣",2906:"融",2907:"熔",2908:"溶",2909:"容",2910:"绒",2911:"冗",2912:"揉",2913:"柔",2914:"肉",2915:"茹",2916:"蠕",2917:"儒",2918:"孺",2919:"如",2920:"辱",2921:"乳",2922:"汝",2923:"入",2924:"褥",2925:"软",2926:"阮",2927:"蕊",2928:"瑞",2929:"锐",2930:"闰",2931:"润",2932:"若",2933:"弱",2934:"撒",2935:"洒",2936:"萨",2937:"腮",2938:"鳃",2939:"塞",2940:"赛",2941:"三",2942:"叁",2943:"伞",2944:"散",2945:"桑",2946:"嗓",2947:"丧",2948:"搔",2949:"骚",2950:"扫",2951:"嫂",2952:"瑟",2953:"色",2954:"涩",2955:"森",2956:"僧",2957:"莎",2958:"砂",2959:"杀",2960:"刹",2961:"沙",2962:"纱",2963:"傻",2964:"啥",2965:"煞",2966:"筛",2967:"晒",2968:"珊",2969:"苫",2970:"杉",2971:"山",2972:"删",2973:"煽",2974:"衫",2975:"闪",2976:"陕",2977:"擅",2978:"赡",2979:"膳",2980:"善",2981:"汕",2982:"扇",2983:"缮",2984:"墒",2985:"伤",2986:"商",2987:"赏",2988:"晌",2989:"上",2990:"尚",2991:"裳",2992:"梢",2993:"捎",2994:"稍",2995:"烧",2996:"芍",2997:"勺",2998:"韶",2999:"少",3000:"哨",3001:"邵",3002:"绍",3003:"奢",3004:"赊",3005:"蛇",3006:"舌",3007:"舍",3008:"赦",3009:"摄",3010:"射",3011:"慑",3012:"涉",3013:"社",3014:"设",3015:"砷",3016:"申",3017:"呻",3018:"伸",3019:"身",3020:"深",3021:"娠",3022:"绅",3023:"神",3024:"沈",3025:"审",3026:"婶",3027:"甚",3028:"肾",3029:"慎",3030:"渗",3031:"声",3032:"生",3033:"甥",3034:"牲",3035:"升",3036:"绳",3037:"省",3038:"盛",3039:"剩",3040:"胜",3041:"圣",3042:"师",3043:"失",3044:"狮",3045:"施",3046:"湿",3047:"诗",3048:"尸",3049:"虱",3050:"十",3051:"石",3052:"拾",3053:"时",3054:"什",3055:"食",3056:"蚀",3057:"实",3058:"识",3059:"史",3060:"矢",3061:"使",3062:"屎",3063:"",3064:"",3065:"",3066:"",3067:"",3068:"",3069:"",3070:"",3071:"",3072:"驶",3073:"始",3074:"式",3075:"示",3076:"士",3077:"世",3078:"柿",3079:"事",3080:"拭",3081:"誓",3082:"逝",3083:"势",3084:"是",3085:"嗜",3086:"噬",3087:"适",3088:"仕",3089:"侍",3090:"释",3091:"饰",3092:"氏",3093:"市",3094:"恃",3095:"室",3096:"视",3097:"试",3098:"收",3099:"手",3100:"首",3101:"守",3102:"寿",3103:"授",3104:"售",3105:"受",3106:"瘦",3107:"兽",3108:"蔬",3109:"枢",3110:"梳",3111:"殊",3112:"抒",3113:"输",3114:"叔",3115:"舒",3116:"淑",3117:"疏",3118:"书",3119:"赎",3120:"孰",3121:"熟",3122:"薯",3123:"暑",3124:"曙",3125:"署",3126:"蜀",3127:"黍",3128:"鼠",3129:"属",3130:"术",3131:"述",3132:"树",3133:"束",3134:"戍",3135:"竖",3136:"墅",3137:"庶",3138:"数",3139:"漱",3140:"恕",3141:"刷",3142:"耍",3143:"摔",3144:"衰",3145:"甩",3146:"帅",3147:"栓",3148:"拴",3149:"霜",3150:"双",3151:"爽",3152:"谁",3153:"水",3154:"睡",3155:"税",3156:"吮",3157:"瞬",3158:"顺",3159:"舜",3160:"说",3161:"硕",3162:"朔",3163:"烁",3164:"斯",3165:"撕",3166:"嘶",3167:"思",3168:"私",3169:"司",3170:"丝",3171:"死",3172:"肆",3173:"寺",3174:"嗣",3175:"四",3176:"伺",3177:"似",3178:"饲",3179:"巳",3180:"松",3181:"耸",3182:"怂",3183:"颂",3184:"送",3185:"宋",3186:"讼",3187:"诵",3188:"搜",3189:"艘",3190:"擞",3191:"嗽",3192:"苏",3193:"酥",3194:"俗",3195:"素",3196:"速",3197:"粟",3198:"僳",3199:"塑",3200:"溯",3201:"宿",3202:"诉",3203:"肃",3204:"酸",3205:"蒜",3206:"算",3207:"虽",3208:"隋",3209:"随",3210:"绥",3211:"髓",3212:"碎",3213:"岁",3214:"穗",3215:"遂",3216:"隧",3217:"祟",3218:"孙",3219:"损",3220:"笋",3221:"蓑",3222:"梭",3223:"唆",3224:"缩",3225:"琐",3226:"索",3227:"锁",3228:"所",3229:"塌",3230:"他",3231:"它",3232:"她",3233:"塔",3234:"獭",3235:"挞",3236:"蹋",3237:"踏",3238:"胎",3239:"苔",3240:"抬",3241:"台",3242:"泰",3243:"酞",3244:"太",3245:"态",3246:"汰",3247:"坍",3248:"摊",3249:"贪",3250:"瘫",3251:"滩",3252:"坛",3253:"檀",3254:"痰",3255:"潭",3256:"谭",3257:"谈",3258:"坦",3259:"毯",3260:"袒",3261:"碳",3262:"探",3263:"叹",3264:"炭",3265:"汤",3266:"塘",3267:"搪",3268:"堂",3269:"棠",3270:"膛",3271:"唐",3272:"糖",3273:"倘",3274:"躺",3275:"淌",3276:"趟",3277:"烫",3278:"掏",3279:"涛",3280:"滔",3281:"绦",3282:"萄",3283:"桃",3284:"逃",3285:"淘",3286:"陶",3287:"讨",3288:"套",3289:"特",3290:"藤",3291:"腾",3292:"疼",3293:"誊",3294:"梯",3295:"剔",3296:"踢",3297:"锑",3298:"提",3299:"题",3300:"蹄",3301:"啼",3302:"体",3303:"替",3304:"嚏",3305:"惕",3306:"涕",3307:"剃",3308:"屉",3309:"天",3310:"添",3311:"填",3312:"田",3313:"甜",3314:"恬",3315:"舔",3316:"腆",3317:"挑",3318:"条",3319:"",3320:"",3321:"",3322:"",3323:"",3324:"",3325:"",3326:"",3327:"",3328:"迢",3329:"眺",3330:"跳",3331:"贴",3332:"铁",3333:"帖",3334:"厅",3335:"听",3336:"烃",3337:"汀",3338:"廷",3339:"停",3340:"亭",3341:"庭",3342:"挺",3343:"艇",3344:"通",3345:"桐",3346:"酮",3347:"瞳",3348:"同",3349:"铜",3350:"彤",3351:"童",3352:"桶",3353:"捅",3354:"筒",3355:"统",3356:"痛",3357:"偷",3358:"投",3359:"头",3360:"透",3361:"凸",3362:"秃",3363:"突",3364:"图",3365:"徒",3366:"途",3367:"涂",3368:"屠",3369:"土",3370:"吐",3371:"兔",3372:"湍",3373:"团",3374:"推",3375:"颓",3376:"腿",3377:"蜕",3378:"褪",3379:"退",3380:"吞",3381:"屯",3382:"臀",3383:"拖",3384:"托",3385:"脱",3386:"鸵",3387:"陀",3388:"驮",3389:"驼",3390:"椭",3391:"妥",3392:"拓",3393:"唾",3394:"挖",3395:"哇",3396:"蛙",3397:"洼",3398:"娃",3399:"瓦",3400:"袜",3401:"歪",3402:"外",3403:"豌",3404:"弯",3405:"湾",3406:"玩",3407:"顽",3408:"丸",3409:"烷",3410:"完",3411:"碗",3412:"挽",3413:"晚",3414:"皖",3415:"惋",3416:"宛",3417:"婉",3418:"万",3419:"腕",3420:"汪",3421:"王",3422:"亡",3423:"枉",3424:"网",3425:"往",3426:"旺",3427:"望",3428:"忘",3429:"妄",3430:"威",3431:"巍",3432:"微",3433:"危",3434:"韦",3435:"违",3436:"桅",3437:"围",3438:"唯",3439:"惟",3440:"为",3441:"潍",3442:"维",3443:"苇",3444:"萎",3445:"委",3446:"伟",3447:"伪",3448:"尾",3449:"纬",3450:"未",3451:"蔚",3452:"味",3453:"畏",3454:"胃",3455:"喂",3456:"魏",3457:"位",3458:"渭",3459:"谓",3460:"尉",3461:"慰",3462:"卫",3463:"瘟",3464:"温",3465:"蚊",3466:"文",3467:"闻",3468:"纹",3469:"吻",3470:"稳",3471:"紊",3472:"问",3473:"嗡",3474:"翁",3475:"瓮",3476:"挝",3477:"蜗",3478:"涡",3479:"窝",3480:"我",3481:"斡",3482:"卧",3483:"握",3484:"沃",3485:"巫",3486:"呜",3487:"钨",3488:"乌",3489:"污",3490:"诬",3491:"屋",3492:"无",3493:"芜",3494:"梧",3495:"吾",3496:"吴",3497:"毋",3498:"武",3499:"五",3500:"捂",3501:"午",3502:"舞",3503:"伍",3504:"侮",3505:"坞",3506:"戊",3507:"雾",3508:"晤",3509:"物",3510:"勿",3511:"务",3512:"悟",3513:"误",3514:"昔",3515:"熙",3516:"析",3517:"西",3518:"硒",3519:"矽",3520:"晰",3521:"嘻",3522:"吸",3523:"锡",3524:"牺",3525:"稀",3526:"息",3527:"希",3528:"悉",3529:"膝",3530:"夕",3531:"惜",3532:"熄",3533:"烯",3534:"溪",3535:"汐",3536:"犀",3537:"檄",3538:"袭",3539:"席",3540:"习",3541:"媳",3542:"喜",3543:"铣",3544:"洗",3545:"系",3546:"隙",3547:"戏",3548:"细",3549:"瞎",3550:"虾",3551:"匣",3552:"霞",3553:"辖",3554:"暇",3555:"峡",3556:"侠",3557:"狭",3558:"下",3559:"厦",3560:"夏",3561:"吓",3562:"掀",3563:"锨",3564:"先",3565:"仙",3566:"鲜",3567:"纤",3568:"咸",3569:"贤",3570:"衔",3571:"舷",3572:"闲",3573:"涎",3574:"弦",3575:"",3576:"",3577:"",3578:"",3579:"",3580:"",3581:"",3582:"",3583:"",3584:"嫌",3585:"显",3586:"险",3587:"现",3588:"献",3589:"县",3590:"腺",3591:"馅",3592:"羡",3593:"宪",3594:"陷",3595:"限",3596:"线",3597:"相",3598:"厢",3599:"镶",3600:"香",3601:"箱",3602:"襄",3603:"湘",3604:"乡",3605:"翔",3606:"祥",3607:"详",3608:"想",3609:"响",3610:"享",3611:"项",3612:"巷",3613:"橡",3614:"像",3615:"向",3616:"象",3617:"萧",3618:"硝",3619:"霄",3620:"削",3621:"哮",3622:"嚣",3623:"销",3624:"消",3625:"宵",3626:"淆",3627:"晓",3628:"小",3629:"孝",3630:"校",3631:"肖",3632:"啸",3633:"笑",3634:"效",3635:"楔",3636:"些",3637:"歇",3638:"蝎",3639:"鞋",3640:"协",3641:"挟",3642:"携",3643:"邪",3644:"斜",3645:"胁",3646:"谐",3647:"写",3648:"械",3649:"卸",3650:"蟹",3651:"懈",3652:"泄",3653:"泻",3654:"谢",3655:"屑",3656:"薪",3657:"芯",3658:"锌",3659:"欣",3660:"辛",3661:"新",3662:"忻",3663:"心",3664:"信",3665:"衅",3666:"星",3667:"腥",3668:"猩",3669:"惺",3670:"兴",3671:"刑",3672:"型",3673:"形",3674:"邢",3675:"行",3676:"醒",3677:"幸",3678:"杏",3679:"性",3680:"姓",3681:"兄",3682:"凶",3683:"胸",3684:"匈",3685:"汹",3686:"雄",3687:"熊",3688:"休",3689:"修",3690:"羞",3691:"朽",3692:"嗅",3693:"锈",3694:"秀",3695:"袖",3696:"绣",3697:"墟",3698:"戌",3699:"需",3700:"虚",3701:"嘘",3702:"须",3703:"徐",3704:"许",3705:"蓄",3706:"酗",3707:"叙",3708:"旭",3709:"序",3710:"畜",3711:"恤",3712:"絮",3713:"婿",3714:"绪",3715:"续",3716:"轩",3717:"喧",3718:"宣",3719:"悬",3720:"旋",3721:"玄",3722:"选",3723:"癣",3724:"眩",3725:"绚",3726:"靴",3727:"薛",3728:"学",3729:"穴",3730:"雪",3731:"血",3732:"勋",3733:"熏",3734:"循",3735:"旬",3736:"询",3737:"寻",3738:"驯",3739:"巡",3740:"殉",3741:"汛",3742:"训",3743:"讯",3744:"逊",3745:"迅",3746:"压",3747:"押",3748:"鸦",3749:"鸭",3750:"呀",3751:"丫",3752:"芽",3753:"牙",3754:"蚜",3755:"崖",3756:"衙",3757:"涯",3758:"雅",3759:"哑",3760:"亚",3761:"讶",3762:"焉",3763:"咽",3764:"阉",3765:"烟",3766:"淹",3767:"盐",3768:"严",3769:"研",3770:"蜒",3771:"岩",3772:"延",3773:"言",3774:"颜",3775:"阎",3776:"炎",3777:"沿",3778:"奄",3779:"掩",3780:"眼",3781:"衍",3782:"演",3783:"艳",3784:"堰",3785:"燕",3786:"厌",3787:"砚",3788:"雁",3789:"唁",3790:"彦",3791:"焰",3792:"宴",3793:"谚",3794:"验",3795:"殃",3796:"央",3797:"鸯",3798:"秧",3799:"杨",3800:"扬",3801:"佯",3802:"疡",3803:"羊",3804:"洋",3805:"阳",3806:"氧",3807:"仰",3808:"痒",3809:"养",3810:"样",3811:"漾",3812:"邀",3813:"腰",3814:"妖",3815:"瑶",3816:"摇",3817:"尧",3818:"遥",3819:"窑",3820:"谣",3821:"姚",3822:"咬",3823:"舀",3824:"药",3825:"要",3826:"耀",3827:"椰",3828:"噎",3829:"耶",3830:"爷",3831:"",3832:"",3833:"",3834:"",3835:"",3836:"",3837:"",3838:"",3839:"",3840:"野",3841:"冶",3842:"也",3843:"页",3844:"掖",3845:"业",3846:"叶",3847:"曳",3848:"腋",3849:"夜",3850:"液",3851:"一",3852:"壹",3853:"医",3854:"揖",3855:"铱",3856:"依",3857:"伊",3858:"衣",3859:"颐",3860:"夷",3861:"遗",3862:"移",3863:"仪",3864:"胰",3865:"疑",3866:"沂",3867:"宜",3868:"姨",3869:"彝",3870:"椅",3871:"蚁",3872:"倚",3873:"已",3874:"乙",3875:"矣",3876:"以",3877:"艺",3878:"抑",3879:"易",3880:"邑",3881:"屹",3882:"亿",3883:"役",3884:"臆",3885:"逸",3886:"肄",3887:"疫",3888:"亦",3889:"裔",3890:"意",3891:"毅",3892:"忆",3893:"义",3894:"益",3895:"溢",3896:"诣",3897:"议",3898:"谊",3899:"译",3900:"异",3901:"翼",3902:"翌",3903:"绎",3904:"茵",3905:"荫",3906:"因",3907:"殷",3908:"音",3909:"阴",3910:"姻",3911:"吟",3912:"银",3913:"淫",3914:"寅",3915:"饮",3916:"尹",3917:"引",3918:"隐",3919:"印",3920:"英",3921:"樱",3922:"婴",3923:"鹰",3924:"应",3925:"缨",3926:"莹",3927:"萤",3928:"营",3929:"荧",3930:"蝇",3931:"迎",3932:"赢",3933:"盈",3934:"影",3935:"颖",3936:"硬",3937:"映",3938:"哟",3939:"拥",3940:"佣",3941:"臃",3942:"痈",3943:"庸",3944:"雍",3945:"踊",3946:"蛹",3947:"咏",3948:"泳",3949:"涌",3950:"永",3951:"恿",3952:"勇",3953:"用",3954:"幽",3955:"优",3956:"悠",3957:"忧",3958:"尤",3959:"由",3960:"邮",3961:"铀",3962:"犹",3963:"油",3964:"游",3965:"酉",3966:"有",3967:"友",3968:"右",3969:"佑",3970:"釉",3971:"诱",3972:"又",3973:"幼",3974:"迂",3975:"淤",3976:"于",3977:"盂",3978:"榆",3979:"虞",3980:"愚",3981:"舆",3982:"余",3983:"俞",3984:"逾",3985:"鱼",3986:"愉",3987:"渝",3988:"渔",3989:"隅",3990:"予",3991:"娱",3992:"雨",3993:"与",3994:"屿",3995:"禹",3996:"宇",3997:"语",3998:"羽",3999:"玉",4000:"域",4001:"芋",4002:"郁",4003:"吁",4004:"遇",4005:"喻",4006:"峪",4007:"御",4008:"愈",4009:"欲",4010:"狱",4011:"育",4012:"誉",4013:"浴",4014:"寓",4015:"裕",4016:"预",4017:"豫",4018:"驭",4019:"鸳",4020:"渊",4021:"冤",4022:"元",4023:"垣",4024:"袁",4025:"原",4026:"援",4027:"辕",4028:"园",4029:"员",4030:"圆",4031:"猿",4032:"源",4033:"缘",4034:"远",4035:"苑",4036:"愿",4037:"怨",4038:"院",4039:"曰",4040:"约",4041:"越",4042:"跃",4043:"钥",4044:"岳",4045:"粤",4046:"月",4047:"悦",4048:"阅",4049:"耘",4050:"云",4051:"郧",4052:"匀",4053:"陨",4054:"允",4055:"运",4056:"蕴",4057:"酝",4058:"晕",4059:"韵",4060:"孕",4061:"匝",4062:"砸",4063:"杂",4064:"栽",4065:"哉",4066:"灾",4067:"宰",4068:"载",4069:"再",4070:"在",4071:"咱",4072:"攒",4073:"暂",4074:"赞",4075:"赃",4076:"脏",4077:"葬",4078:"遭",4079:"糟",4080:"凿",4081:"藻",4082:"枣",4083:"早",4084:"澡",4085:"蚤",4086:"躁",4087:"",4088:"",4089:"",4090:"",4091:"",4092:"",4093:"",4094:"",4095:"",4096:"噪",4097:"造",4098:"皂",4099:"灶",4100:"燥",4101:"责",4102:"择",4103:"则",4104:"泽",4105:"贼",4106:"怎",4107:"增",4108:"憎",4109:"曾",4110:"赠",4111:"扎",4112:"喳",4113:"渣",4114:"札",4115:"轧",4116:"铡",4117:"闸",4118:"眨",4119:"栅",4120:"榨",4121:"咋",4122:"乍",4123:"炸",4124:"诈",4125:"摘",4126:"斋",4127:"宅",4128:"窄",4129:"债",4130:"寨",4131:"瞻",4132:"毡",4133:"詹",4134:"粘",4135:"沾",4136:"盏",4137:"斩",4138:"辗",4139:"崭",4140:"展",4141:"蘸",4142:"栈",4143:"占",4144:"战",4145:"站",4146:"湛",4147:"绽",4148:"樟",4149:"章",4150:"彰",4151:"漳",4152:"张",4153:"掌",4154:"涨",4155:"杖",4156:"丈",4157:"帐",4158:"账",4159:"仗",4160:"胀",4161:"瘴",4162:"障",4163:"招",4164:"昭",4165:"找",4166:"沼",4167:"赵",4168:"照",4169:"罩",4170:"兆",4171:"肇",4172:"召",4173:"遮",4174:"折",4175:"哲",4176:"蛰",4177:"辙",4178:"者",4179:"锗",4180:"蔗",4181:"这",4182:"浙",4183:"珍",4184:"斟",4185:"真",4186:"甄",4187:"砧",4188:"臻",4189:"贞",4190:"针",4191:"侦",4192:"枕",4193:"疹",4194:"诊",4195:"震",4196:"振",4197:"镇",4198:"阵",4199:"蒸",4200:"挣",4201:"睁",4202:"征",4203:"狰",4204:"争",4205:"怔",4206:"整",4207:"拯",4208:"正",4209:"政",4210:"帧",4211:"症",4212:"郑",4213:"证",4214:"芝",4215:"枝",4216:"支",4217:"吱",4218:"蜘",4219:"知",4220:"肢",4221:"脂",4222:"汁",4223:"之",4224:"织",4225:"职",4226:"直",4227:"植",4228:"殖",4229:"执",4230:"值",4231:"侄",4232:"址",4233:"指",4234:"止",4235:"趾",4236:"只",4237:"旨",4238:"纸",4239:"志",4240:"挚",4241:"掷",4242:"至",4243:"致",4244:"置",4245:"帜",4246:"峙",4247:"制",4248:"智",4249:"秩",4250:"稚",4251:"质",4252:"炙",4253:"痔",4254:"滞",4255:"治",4256:"窒",4257:"中",4258:"盅",4259:"忠",4260:"钟",4261:"衷",4262:"终",4263:"种",4264:"肿",4265:"重",4266:"仲",4267:"众",4268:"舟",4269:"周",4270:"州",4271:"洲",4272:"诌",4273:"粥",4274:"轴",4275:"肘",4276:"帚",4277:"咒",4278:"皱",4279:"宙",4280:"昼",4281:"骤",4282:"珠",4283:"株",4284:"蛛",4285:"朱",4286:"猪",4287:"诸",4288:"诛",4289:"逐",4290:"竹",4291:"烛",4292:"煮",4293:"拄",4294:"瞩",4295:"嘱",4296:"主",4297:"著",4298:"柱",4299:"助",4300:"蛀",4301:"贮",4302:"铸",4303:"筑",4304:"住",4305:"注",4306:"祝",4307:"驻",4308:"抓",4309:"爪",4310:"拽",4311:"专",4312:"砖",4313:"转",4314:"撰",4315:"赚",4316:"篆",4317:"桩",4318:"庄",4319:"装",4320:"妆",4321:"撞",4322:"壮",4323:"状",4324:"椎",4325:"锥",4326:"追",4327:"赘",4328:"坠",4329:"缀",4330:"谆",4331:"准",4332:"捉",4333:"拙",4334:"卓",4335:"桌",4336:"琢",4337:"茁",4338:"酌",4339:"啄",4340:"着",4341:"灼",4342:"浊",4343:"",4344:"",4345:"",4346:"",4347:"",4348:"",4349:"",4350:"",4351:"",4352:"兹",4353:"咨",4354:"资",4355:"姿",4356:"滋",4357:"淄",4358:"孜",4359:"紫",4360:"仔",4361:"籽",4362:"滓",4363:"子",4364:"自",4365:"渍",4366:"字",4367:"鬃",4368:"棕",4369:"踪",4370:"宗",4371:"综",4372:"总",4373:"纵",4374:"邹",4375:"走",4376:"奏",4377:"揍",4378:"租",4379:"足",4380:"卒",4381:"族",4382:"祖",4383:"诅",4384:"阻",4385:"组",4386:"钻",4387:"纂",4388:"嘴",4389:"醉",4390:"最",4391:"罪",4392:"尊",4393:"遵",4394:"昨",4395:"左",4396:"佐",4397:"柞",4398:"做",4399:"作",4400:"坐",4401:"座",4402:"亍",4403:"丌",4404:"兀",4405:"丐",4406:"廿",4407:"卅",4408:"丕",4409:"亘",4410:"丞",4411:"鬲",4412:"孬",4413:"噩",4414:"丨",4415:"禺",4416:"丿",4417:"匕",4418:"乇",4419:"夭",4420:"爻",4421:"卮",4422:"氐",4423:"囟",4424:"胤",4425:"馗",4426:"毓",4427:"睾",4428:"鼗",4429:"丶",4430:"亟",4431:"鼐",4432:"乜",4433:"乩",4434:"亓",4435:"芈",4436:"孛",4437:"啬",4438:"嘏",4439:"仄",4440:"厍",4441:"厝",4442:"厣",4443:"厥",4444:"厮",4445:"靥",4446:"赝",4447:"匚",4448:"叵",4449:"匦",4450:"匮",4451:"匾",4452:"赜",4453:"卦",4454:"卣",4455:"刂",4456:"刈",4457:"刎",4458:"刭",4459:"刳",4460:"刿",4461:"剀",4462:"剌",4463:"剞",4464:"剡",4465:"剜",4466:"蒯",4467:"剽",4468:"劂",4469:"劁",4470:"劐",4471:"劓",4472:"冂",4473:"罔",4474:"亻",4475:"仃",4476:"仉",4477:"仂",4478:"仨",4479:"仡",4480:"仫",4481:"仞",4482:"伛",4483:"仳",4484:"伢",4485:"佤",4486:"仵",4487:"伥",4488:"伧",4489:"伉",4490:"伫",4491:"佞",4492:"佧",4493:"攸",4494:"佚",4495:"佝",4496:"佟",4497:"佗",4498:"伲",4499:"伽",4500:"佶",4501:"佴",4502:"侑",4503:"侉",4504:"侃",4505:"侏",4506:"佾",4507:"佻",4508:"侪",4509:"佼",4510:"侬",4511:"侔",4512:"俦",4513:"俨",4514:"俪",4515:"俅",4516:"俚",4517:"俣",4518:"俜",4519:"俑",4520:"俟",4521:"俸",4522:"倩",4523:"偌",4524:"俳",4525:"倬",4526:"倏",4527:"倮",4528:"倭",4529:"俾",4530:"倜",4531:"倌",4532:"倥",4533:"倨",4534:"偾",4535:"偃",4536:"偕",4537:"偈",4538:"偎",4539:"偬",4540:"偻",4541:"傥",4542:"傧",4543:"傩",4544:"傺",4545:"僖",4546:"儆",4547:"僭",4548:"僬",4549:"僦",4550:"僮",4551:"儇",4552:"儋",4553:"仝",4554:"氽",4555:"佘",4556:"佥",4557:"俎",4558:"龠",4559:"汆",4560:"籴",4561:"兮",4562:"巽",4563:"黉",4564:"馘",4565:"冁",4566:"夔",4567:"勹",4568:"匍",4569:"訇",4570:"匐",4571:"凫",4572:"夙",4573:"兕",4574:"亠",4575:"兖",4576:"亳",4577:"衮",4578:"袤",4579:"亵",4580:"脔",4581:"裒",4582:"禀",4583:"嬴",4584:"蠃",4585:"羸",4586:"冫",4587:"冱",4588:"冽",4589:"冼",4590:"凇",4591:"冖",4592:"冢",4593:"冥",4594:"讠",4595:"讦",4596:"讧",4597:"讪",4598:"讴",4599:"",4600:"",4601:"",4602:"",4603:"",4604:"",4605:"",4606:"",4607:"",4608:"讵",4609:"讷",4610:"诂",4611:"诃",4612:"诋",4613:"诏",4614:"诎",4615:"诒",4616:"诓",4617:"诔",4618:"诖",4619:"诘",4620:"诙",4621:"诜",4622:"诟",4623:"诠",4624:"诤",4625:"诨",4626:"诩",4627:"诮",4628:"诰",4629:"诳",4630:"诶",4631:"诹",4632:"诼",4633:"诿",4634:"谀",4635:"谂",4636:"谄",4637:"谇",4638:"谌",4639:"谏",4640:"谑",4641:"谒",4642:"谔",4643:"谕",4644:"谖",4645:"谙",4646:"谛",4647:"谘",4648:"谝",4649:"谟",4650:"谠",4651:"谡",4652:"谥",4653:"谧",4654:"谪",4655:"谫",4656:"谮",4657:"谯",4658:"谲",4659:"谳",4660:"谵",4661:"谶",4662:"卩",4663:"卺",4664:"阝",4665:"阢",4666:"阡",4667:"阱",4668:"阪",4669:"阽",4670:"阼",4671:"陂",4672:"陉",4673:"陔",4674:"陟",4675:"陧",4676:"陬",4677:"陲",4678:"陴",4679:"隈",4680:"隍",4681:"隗",4682:"隰",4683:"邗",4684:"邛",4685:"邝",4686:"邙",4687:"邬",4688:"邡",4689:"邴",4690:"邳",4691:"邶",4692:"邺",4693:"邸",4694:"邰",4695:"郏",4696:"郅",4697:"邾",4698:"郐",4699:"郄",4700:"郇",4701:"郓",4702:"郦",4703:"郢",4704:"郜",4705:"郗",4706:"郛",4707:"郫",4708:"郯",4709:"郾",4710:"鄄",4711:"鄢",4712:"鄞",4713:"鄣",4714:"鄱",4715:"鄯",4716:"鄹",4717:"酃",4718:"酆",4719:"刍",4720:"奂",4721:"劢",4722:"劬",4723:"劭",4724:"劾",4725:"哿",4726:"勐",4727:"勖",4728:"勰",4729:"叟",4730:"燮",4731:"矍",4732:"廴",4733:"凵",4734:"凼",4735:"鬯",4736:"厶",4737:"弁",4738:"畚",4739:"巯",4740:"坌",4741:"垩",4742:"垡",4743:"塾",4744:"墼",4745:"壅",4746:"壑",4747:"圩",4748:"圬",4749:"圪",4750:"圳",4751:"圹",4752:"圮",4753:"圯",4754:"坜",4755:"圻",4756:"坂",4757:"坩",4758:"垅",4759:"坫",4760:"垆",4761:"坼",4762:"坻",4763:"坨",4764:"坭",4765:"坶",4766:"坳",4767:"垭",4768:"垤",4769:"垌",4770:"垲",4771:"埏",4772:"垧",4773:"垴",4774:"垓",4775:"垠",4776:"埕",4777:"埘",4778:"埚",4779:"埙",4780:"埒",4781:"垸",4782:"埴",4783:"埯",4784:"埸",4785:"埤",4786:"埝",4787:"堋",4788:"堍",4789:"埽",4790:"埭",4791:"堀",4792:"堞",4793:"堙",4794:"塄",4795:"堠",4796:"塥",4797:"塬",4798:"墁",4799:"墉",4800:"墚",4801:"墀",4802:"馨",4803:"鼙",4804:"懿",4805:"艹",4806:"艽",4807:"艿",4808:"芏",4809:"芊",4810:"芨",4811:"芄",4812:"芎",4813:"芑",4814:"芗",4815:"芙",4816:"芫",4817:"芸",4818:"芾",4819:"芰",4820:"苈",4821:"苊",4822:"苣",4823:"芘",4824:"芷",4825:"芮",4826:"苋",4827:"苌",4828:"苁",4829:"芩",4830:"芴",4831:"芡",4832:"芪",4833:"芟",4834:"苄",4835:"苎",4836:"芤",4837:"苡",4838:"茉",4839:"苷",4840:"苤",4841:"茏",4842:"茇",4843:"苜",4844:"苴",4845:"苒",4846:"苘",4847:"茌",4848:"苻",4849:"苓",4850:"茑",4851:"茚",4852:"茆",4853:"茔",4854:"茕",4855:"",4856:"",4857:"",4858:"",4859:"",4860:"",4861:"",4862:"",4863:"",4864:"苠",4865:"苕",4866:"茜",4867:"荑",4868:"荛",4869:"荜",4870:"茈",4871:"莒",4872:"茼",4873:"茴",4874:"茱",4875:"莛",4876:"荞",4877:"茯",4878:"荏",4879:"荇",4880:"荃",4881:"荟",4882:"荀",4883:"茗",4884:"荠",4885:"茭",4886:"茺",4887:"茳",4888:"荦",4889:"荥",4890:"荨",4891:"茛",4892:"荩",4893:"荬",4894:"荪",4895:"荭",4896:"荮",4897:"莰",4898:"荸",4899:"莳",4900:"莴",4901:"莠",4902:"莪",4903:"莓",4904:"莜",4905:"莅",4906:"荼",4907:"莶",4908:"莩",4909:"荽",4910:"莸",4911:"荻",4912:"莘",4913:"莞",4914:"莨",4915:"莺",4916:"莼",4917:"菁",4918:"萁",4919:"菥",4920:"菘",4921:"堇",4922:"萘",4923:"萋",4924:"菝",4925:"菽",4926:"菖",4927:"萜",4928:"萸",4929:"萑",4930:"萆",4931:"菔",4932:"菟",4933:"萏",4934:"萃",4935:"菸",4936:"菹",4937:"菪",4938:"菅",4939:"菀",4940:"萦",4941:"菰",4942:"菡",4943:"葜",4944:"葑",4945:"葚",4946:"葙",4947:"葳",4948:"蒇",4949:"蒈",4950:"葺",4951:"蒉",4952:"葸",4953:"萼",4954:"葆",4955:"葩",4956:"葶",4957:"蒌",4958:"蒎",4959:"萱",4960:"葭",4961:"蓁",4962:"蓍",4963:"蓐",4964:"蓦",4965:"蒽",4966:"蓓",4967:"蓊",4968:"蒿",4969:"蒺",4970:"蓠",4971:"蒡",4972:"蒹",4973:"蒴",4974:"蒗",4975:"蓥",4976:"蓣",4977:"蔌",4978:"甍",4979:"蔸",4980:"蓰",4981:"蔹",4982:"蔟",4983:"蔺",4984:"蕖",4985:"蔻",4986:"蓿",4987:"蓼",4988:"蕙",4989:"蕈",4990:"蕨",4991:"蕤",4992:"蕞",4993:"蕺",4994:"瞢",4995:"蕃",4996:"蕲",4997:"蕻",4998:"薤",4999:"薨",5000:"薇",5001:"薏",5002:"蕹",5003:"薮",5004:"薜",5005:"薅",5006:"薹",5007:"薷",5008:"薰",5009:"藓",5010:"藁",5011:"藜",5012:"藿",5013:"蘧",5014:"蘅",5015:"蘩",5016:"蘖",5017:"蘼",5018:"廾",5019:"弈",5020:"夼",5021:"奁",5022:"耷",5023:"奕",5024:"奚",5025:"奘",5026:"匏",5027:"尢",5028:"尥",5029:"尬",5030:"尴",5031:"扌",5032:"扪",5033:"抟",5034:"抻",5035:"拊",5036:"拚",5037:"拗",5038:"拮",5039:"挢",5040:"拶",5041:"挹",5042:"捋",5043:"捃",5044:"掭",5045:"揶",5046:"捱",5047:"捺",5048:"掎",5049:"掴",5050:"捭",5051:"掬",5052:"掊",5053:"捩",5054:"掮",5055:"掼",5056:"揲",5057:"揸",5058:"揠",5059:"揿",5060:"揄",5061:"揞",5062:"揎",5063:"摒",5064:"揆",5065:"掾",5066:"摅",5067:"摁",5068:"搋",5069:"搛",5070:"搠",5071:"搌",5072:"搦",5073:"搡",5074:"摞",5075:"撄",5076:"摭",5077:"撖",5078:"摺",5079:"撷",5080:"撸",5081:"撙",5082:"撺",5083:"擀",5084:"擐",5085:"擗",5086:"擤",5087:"擢",5088:"攉",5089:"攥",5090:"攮",5091:"弋",5092:"忒",5093:"甙",5094:"弑",5095:"卟",5096:"叱",5097:"叽",5098:"叩",5099:"叨",5100:"叻",5101:"吒",5102:"吖",5103:"吆",5104:"呋",5105:"呒",5106:"呓",5107:"呔",5108:"呖",5109:"呃",5110:"吡",5111:"",5112:"",5113:"",5114:"",5115:"",5116:"",5117:"",5118:"",5119:"",5120:"呗",5121:"呙",5122:"吣",5123:"吲",5124:"咂",5125:"咔",5126:"呷",5127:"呱",5128:"呤",5129:"咚",5130:"咛",5131:"咄",5132:"呶",5133:"呦",5134:"咝",5135:"哐",5136:"咭",5137:"哂",5138:"咴",5139:"哒",5140:"咧",5141:"咦",5142:"哓",5143:"哔",5144:"呲",5145:"咣",5146:"哕",5147:"咻",5148:"咿",5149:"哌",5150:"哙",5151:"哚",5152:"哜",5153:"咩",5154:"咪",5155:"咤",5156:"哝",5157:"哏",5158:"哞",5159:"唛",5160:"哧",5161:"唠",5162:"哽",5163:"唔",5164:"哳",5165:"唢",5166:"唣",5167:"唏",5168:"唑",5169:"唧",5170:"唪",5171:"啧",5172:"喏",5173:"喵",5174:"啉",5175:"啭",5176:"啁",5177:"啕",5178:"唿",5179:"啐",5180:"唼",5181:"唷",5182:"啖",5183:"啵",5184:"啶",5185:"啷",5186:"唳",5187:"唰",5188:"啜",5189:"喋",5190:"嗒",5191:"喃",5192:"喱",5193:"喹",5194:"喈",5195:"喁",5196:"喟",5197:"啾",5198:"嗖",5199:"喑",5200:"啻",5201:"嗟",5202:"喽",5203:"喾",5204:"喔",5205:"喙",5206:"嗪",5207:"嗷",5208:"嗉",5209:"嘟",5210:"嗑",5211:"嗫",5212:"嗬",5213:"嗔",5214:"嗦",5215:"嗝",5216:"嗄",5217:"嗯",5218:"嗥",5219:"嗲",5220:"嗳",5221:"嗌",5222:"嗍",5223:"嗨",5224:"嗵",5225:"嗤",5226:"辔",5227:"嘞",5228:"嘈",5229:"嘌",5230:"嘁",5231:"嘤",5232:"嘣",5233:"嗾",5234:"嘀",5235:"嘧",5236:"嘭",5237:"噘",5238:"嘹",5239:"噗",5240:"嘬",5241:"噍",5242:"噢",5243:"噙",5244:"噜",5245:"噌",5246:"噔",5247:"嚆",5248:"噤",5249:"噱",5250:"噫",5251:"噻",5252:"噼",5253:"嚅",5254:"嚓",5255:"嚯",5256:"囔",5257:"囗",5258:"囝",5259:"囡",5260:"囵",5261:"囫",5262:"囹",5263:"囿",5264:"圄",5265:"圊",5266:"圉",5267:"圜",5268:"帏",5269:"帙",5270:"帔",5271:"帑",5272:"帱",5273:"帻",5274:"帼",5275:"帷",5276:"幄",5277:"幔",5278:"幛",5279:"幞",5280:"幡",5281:"岌",5282:"屺",5283:"岍",5284:"岐",5285:"岖",5286:"岈",5287:"岘",5288:"岙",5289:"岑",5290:"岚",5291:"岜",5292:"岵",5293:"岢",5294:"岽",5295:"岬",5296:"岫",5297:"岱",5298:"岣",5299:"峁",5300:"岷",5301:"峄",5302:"峒",5303:"峤",5304:"峋",5305:"峥",5306:"崂",5307:"崃",5308:"崧",5309:"崦",5310:"崮",5311:"崤",5312:"崞",5313:"崆",5314:"崛",5315:"嵘",5316:"崾",5317:"崴",5318:"崽",5319:"嵬",5320:"嵛",5321:"嵯",5322:"嵝",5323:"嵫",5324:"嵋",5325:"嵊",5326:"嵩",5327:"嵴",5328:"嶂",5329:"嶙",5330:"嶝",5331:"豳",5332:"嶷",5333:"巅",5334:"彳",5335:"彷",5336:"徂",5337:"徇",5338:"徉",5339:"後",5340:"徕",5341:"徙",5342:"徜",5343:"徨",5344:"徭",5345:"徵",5346:"徼",5347:"衢",5348:"彡",5349:"犭",5350:"犰",5351:"犴",5352:"犷",5353:"犸",5354:"狃",5355:"狁",5356:"狎",5357:"狍",5358:"狒",5359:"狨",5360:"狯",5361:"狩",5362:"狲",5363:"狴",5364:"狷",5365:"猁",5366:"狳",5367:"",5368:"",5369:"",5370:"",5371:"",5372:"",5373:"",5374:"",5375:"",5376:"猃",5377:"狺",5378:"狻",5379:"猗",5380:"猓",5381:"猡",5382:"猊",5383:"猞",5384:"猝",5385:"猕",5386:"猢",5387:"猹",5388:"猥",5389:"猬",5390:"猸",5391:"猱",5392:"獐",5393:"獍",5394:"獗",5395:"獠",5396:"獬",5397:"獯",5398:"獾",5399:"舛",5400:"夥",5401:"飧",5402:"夤",5403:"夂",5404:"饣",5405:"饧",5406:"饨",5407:"饩",5408:"饪",5409:"饫",5410:"饬",5411:"饴",5412:"饷",5413:"饽",5414:"馀",5415:"馄",5416:"馇",5417:"馊",5418:"馍",5419:"馐",5420:"馑",5421:"馓",5422:"馔",5423:"馕",5424:"庀",5425:"庑",5426:"庋",5427:"庖",5428:"庥",5429:"庠",5430:"庹",5431:"庵",5432:"庾",5433:"庳",5434:"赓",5435:"廒",5436:"廑",5437:"廛",5438:"廨",5439:"廪",5440:"膺",5441:"忄",5442:"忉",5443:"忖",5444:"忏",5445:"怃",5446:"忮",5447:"怄",5448:"忡",5449:"忤",5450:"忾",5451:"怅",5452:"怆",5453:"忪",5454:"忭",5455:"忸",5456:"怙",5457:"怵",5458:"怦",5459:"怛",5460:"怏",5461:"怍",5462:"怩",5463:"怫",5464:"怊",5465:"怿",5466:"怡",5467:"恸",5468:"恹",5469:"恻",5470:"恺",5471:"恂",5472:"恪",5473:"恽",5474:"悖",5475:"悚",5476:"悭",5477:"悝",5478:"悃",5479:"悒",5480:"悌",5481:"悛",5482:"惬",5483:"悻",5484:"悱",5485:"惝",5486:"惘",5487:"惆",5488:"惚",5489:"悴",5490:"愠",5491:"愦",5492:"愕",5493:"愣",5494:"惴",5495:"愀",5496:"愎",5497:"愫",5498:"慊",5499:"慵",5500:"憬",5501:"憔",5502:"憧",5503:"憷",5504:"懔",5505:"懵",5506:"忝",5507:"隳",5508:"闩",5509:"闫",5510:"闱",5511:"闳",5512:"闵",5513:"闶",5514:"闼",5515:"闾",5516:"阃",5517:"阄",5518:"阆",5519:"阈",5520:"阊",5521:"阋",5522:"阌",5523:"阍",5524:"阏",5525:"阒",5526:"阕",5527:"阖",5528:"阗",5529:"阙",5530:"阚",5531:"丬",5532:"爿",5533:"戕",5534:"氵",5535:"汔",5536:"汜",5537:"汊",5538:"沣",5539:"沅",5540:"沐",5541:"沔",5542:"沌",5543:"汨",5544:"汩",5545:"汴",5546:"汶",5547:"沆",5548:"沩",5549:"泐",5550:"泔",5551:"沭",5552:"泷",5553:"泸",5554:"泱",5555:"泗",5556:"沲",5557:"泠",5558:"泖",5559:"泺",5560:"泫",5561:"泮",5562:"沱",5563:"泓",5564:"泯",5565:"泾",5566:"洹",5567:"洧",5568:"洌",5569:"浃",5570:"浈",5571:"洇",5572:"洄",5573:"洙",5574:"洎",5575:"洫",5576:"浍",5577:"洮",5578:"洵",5579:"洚",5580:"浏",5581:"浒",5582:"浔",5583:"洳",5584:"涑",5585:"浯",5586:"涞",5587:"涠",5588:"浞",5589:"涓",5590:"涔",5591:"浜",5592:"浠",5593:"浼",5594:"浣",5595:"渚",5596:"淇",5597:"淅",5598:"淞",5599:"渎",5600:"涿",5601:"淠",5602:"渑",5603:"淦",5604:"淝",5605:"淙",5606:"渖",5607:"涫",5608:"渌",5609:"涮",5610:"渫",5611:"湮",5612:"湎",5613:"湫",5614:"溲",5615:"湟",5616:"溆",5617:"湓",5618:"湔",5619:"渲",5620:"渥",5621:"湄",5622:"滟",5623:"",5624:"",5625:"",5626:"",5627:"",5628:"",5629:"",5630:"",5631:"",5632:"溱",5633:"溘",5634:"滠",5635:"漭",5636:"滢",5637:"溥",5638:"溧",5639:"溽",5640:"溻",5641:"溷",5642:"滗",5643:"溴",5644:"滏",5645:"溏",5646:"滂",5647:"溟",5648:"潢",5649:"潆",5650:"潇",5651:"漤",5652:"漕",5653:"滹",5654:"漯",5655:"漶",5656:"潋",5657:"潴",5658:"漪",5659:"漉",5660:"漩",5661:"澉",5662:"澍",5663:"澌",5664:"潸",5665:"潲",5666:"潼",5667:"潺",5668:"濑",5669:"濉",5670:"澧",5671:"澹",5672:"澶",5673:"濂",5674:"濡",5675:"濮",5676:"濞",5677:"濠",5678:"濯",5679:"瀚",5680:"瀣",5681:"瀛",5682:"瀹",5683:"瀵",5684:"灏",5685:"灞",5686:"宀",5687:"宄",5688:"宕",5689:"宓",5690:"宥",5691:"宸",5692:"甯",5693:"骞",5694:"搴",5695:"寤",5696:"寮",5697:"褰",5698:"寰",5699:"蹇",5700:"謇",5701:"辶",5702:"迓",5703:"迕",5704:"迥",5705:"迮",5706:"迤",5707:"迩",5708:"迦",5709:"迳",5710:"迨",5711:"逅",5712:"逄",5713:"逋",5714:"逦",5715:"逑",5716:"逍",5717:"逖",5718:"逡",5719:"逵",5720:"逶",5721:"逭",5722:"逯",5723:"遄",5724:"遑",5725:"遒",5726:"遐",5727:"遨",5728:"遘",5729:"遢",5730:"遛",5731:"暹",5732:"遴",5733:"遽",5734:"邂",5735:"邈",5736:"邃",5737:"邋",5738:"彐",5739:"彗",5740:"彖",5741:"彘",5742:"尻",5743:"咫",5744:"屐",5745:"屙",5746:"孱",5747:"屣",5748:"屦",5749:"羼",5750:"弪",5751:"弩",5752:"弭",5753:"艴",5754:"弼",5755:"鬻",5756:"屮",5757:"妁",5758:"妃",5759:"妍",5760:"妩",5761:"妪",5762:"妣",5763:"妗",5764:"姊",5765:"妫",5766:"妞",5767:"妤",5768:"姒",5769:"妲",5770:"妯",5771:"姗",5772:"妾",5773:"娅",5774:"娆",5775:"姝",5776:"娈",5777:"姣",5778:"姘",5779:"姹",5780:"娌",5781:"娉",5782:"娲",5783:"娴",5784:"娑",5785:"娣",5786:"娓",5787:"婀",5788:"婧",5789:"婊",5790:"婕",5791:"娼",5792:"婢",5793:"婵",5794:"胬",5795:"媪",5796:"媛",5797:"婷",5798:"婺",5799:"媾",5800:"嫫",5801:"媲",5802:"嫒",5803:"嫔",5804:"媸",5805:"嫠",5806:"嫣",5807:"嫱",5808:"嫖",5809:"嫦",5810:"嫘",5811:"嫜",5812:"嬉",5813:"嬗",5814:"嬖",5815:"嬲",5816:"嬷",5817:"孀",5818:"尕",5819:"尜",5820:"孚",5821:"孥",5822:"孳",5823:"孑",5824:"孓",5825:"孢",5826:"驵",5827:"驷",5828:"驸",5829:"驺",5830:"驿",5831:"驽",5832:"骀",5833:"骁",5834:"骅",5835:"骈",5836:"骊",5837:"骐",5838:"骒",5839:"骓",5840:"骖",5841:"骘",5842:"骛",5843:"骜",5844:"骝",5845:"骟",5846:"骠",5847:"骢",5848:"骣",5849:"骥",5850:"骧",5851:"纟",5852:"纡",5853:"纣",5854:"纥",5855:"纨",5856:"纩",5857:"纭",5858:"纰",5859:"纾",5860:"绀",5861:"绁",5862:"绂",5863:"绉",5864:"绋",5865:"绌",5866:"绐",5867:"绔",5868:"绗",5869:"绛",5870:"绠",5871:"绡",5872:"绨",5873:"绫",5874:"绮",5875:"绯",5876:"绱",5877:"绲",5878:"缍",5879:"",5880:"",5881:"",5882:"",5883:"",5884:"",5885:"",5886:"",5887:"",5888:"绶",5889:"绺",5890:"绻",5891:"绾",5892:"缁",5893:"缂",5894:"缃",5895:"缇",5896:"缈",5897:"缋",5898:"缌",5899:"缏",5900:"缑",5901:"缒",5902:"缗",5903:"缙",5904:"缜",5905:"缛",5906:"缟",5907:"缡",5908:"缢",5909:"缣",5910:"缤",5911:"缥",5912:"缦",5913:"缧",5914:"缪",5915:"缫",5916:"缬",5917:"缭",5918:"缯",5919:"缰",5920:"缱",5921:"缲",5922:"缳",5923:"缵",5924:"幺",5925:"畿",5926:"巛",5927:"甾",5928:"邕",5929:"玎",5930:"玑",5931:"玮",5932:"玢",5933:"玟",5934:"珏",5935:"珂",5936:"珑",5937:"玷",5938:"玳",5939:"珀",5940:"珉",5941:"珈",5942:"珥",5943:"珙",5944:"顼",5945:"琊",5946:"珩",5947:"珧",5948:"珞",5949:"玺",5950:"珲",5951:"琏",5952:"琪",5953:"瑛",5954:"琦",5955:"琥",5956:"琨",5957:"琰",5958:"琮",5959:"琬",5960:"琛",5961:"琚",5962:"瑁",5963:"瑜",5964:"瑗",5965:"瑕",5966:"瑙",5967:"瑷",5968:"瑭",5969:"瑾",5970:"璜",5971:"璎",5972:"璀",5973:"璁",5974:"璇",5975:"璋",5976:"璞",5977:"璨",5978:"璩",5979:"璐",5980:"璧",5981:"瓒",5982:"璺",5983:"韪",5984:"韫",5985:"韬",5986:"杌",5987:"杓",5988:"杞",5989:"杈",5990:"杩",5991:"枥",5992:"枇",5993:"杪",5994:"杳",5995:"枘",5996:"枧",5997:"杵",5998:"枨",5999:"枞",6000:"枭",6001:"枋",6002:"杷",6003:"杼",6004:"柰",6005:"栉",6006:"柘",6007:"栊",6008:"柩",6009:"枰",6010:"栌",6011:"柙",6012:"枵",6013:"柚",6014:"枳",6015:"柝",6016:"栀",6017:"柃",6018:"枸",6019:"柢",6020:"栎",6021:"柁",6022:"柽",6023:"栲",6024:"栳",6025:"桠",6026:"桡",6027:"桎",6028:"桢",6029:"桄",6030:"桤",6031:"梃",6032:"栝",6033:"桕",6034:"桦",6035:"桁",6036:"桧",6037:"桀",6038:"栾",6039:"桊",6040:"桉",6041:"栩",6042:"梵",6043:"梏",6044:"桴",6045:"桷",6046:"梓",6047:"桫",6048:"棂",6049:"楮",6050:"棼",6051:"椟",6052:"椠",6053:"棹",6054:"椤",6055:"棰",6056:"椋",6057:"椁",6058:"楗",6059:"棣",6060:"椐",6061:"楱",6062:"椹",6063:"楠",6064:"楂",6065:"楝",6066:"榄",6067:"楫",6068:"榀",6069:"榘",6070:"楸",6071:"椴",6072:"槌",6073:"榇",6074:"榈",6075:"槎",6076:"榉",6077:"楦",6078:"楣",6079:"楹",6080:"榛",6081:"榧",6082:"榻",6083:"榫",6084:"榭",6085:"槔",6086:"榱",6087:"槁",6088:"槊",6089:"槟",6090:"榕",6091:"槠",6092:"榍",6093:"槿",6094:"樯",6095:"槭",6096:"樗",6097:"樘",6098:"橥",6099:"槲",6100:"橄",6101:"樾",6102:"檠",6103:"橐",6104:"橛",6105:"樵",6106:"檎",6107:"橹",6108:"樽",6109:"樨",6110:"橘",6111:"橼",6112:"檑",6113:"檐",6114:"檩",6115:"檗",6116:"檫",6117:"猷",6118:"獒",6119:"殁",6120:"殂",6121:"殇",6122:"殄",6123:"殒",6124:"殓",6125:"殍",6126:"殚",6127:"殛",6128:"殡",6129:"殪",6130:"轫",6131:"轭",6132:"轱",6133:"轲",6134:"轳",6135:"",6136:"",6137:"",6138:"",6139:"",6140:"",6141:"",6142:"",6143:"",6144:"轵",6145:"轶",6146:"轸",6147:"轷",6148:"轹",6149:"轺",6150:"轼",6151:"轾",6152:"辁",6153:"辂",6154:"辄",6155:"辇",6156:"辋",6157:"辍",6158:"辎",6159:"辏",6160:"辘",6161:"辚",6162:"軎",6163:"戋",6164:"戗",6165:"戛",6166:"戟",6167:"戢",6168:"戡",6169:"戥",6170:"戤",6171:"戬",6172:"臧",6173:"瓯",6174:"瓴",6175:"瓿",6176:"甏",6177:"甑",6178:"甓",6179:"攴",6180:"旮",6181:"旯",6182:"旰",6183:"昊",6184:"昙",6185:"杲",6186:"昃",6187:"昕",6188:"昀",6189:"炅",6190:"曷",6191:"昝",6192:"昴",6193:"昱",6194:"昶",6195:"昵",6196:"耆",6197:"晟",6198:"晔",6199:"晁",6200:"晏",6201:"晖",6202:"晡",6203:"晗",6204:"晷",6205:"暄",6206:"暌",6207:"暧",6208:"暝",6209:"暾",6210:"曛",6211:"曜",6212:"曦",6213:"曩",6214:"贲",6215:"贳",6216:"贶",6217:"贻",6218:"贽",6219:"赀",6220:"赅",6221:"赆",6222:"赈",6223:"赉",6224:"赇",6225:"赍",6226:"赕",6227:"赙",6228:"觇",6229:"觊",6230:"觋",6231:"觌",6232:"觎",6233:"觏",6234:"觐",6235:"觑",6236:"牮",6237:"犟",6238:"牝",6239:"牦",6240:"牯",6241:"牾",6242:"牿",6243:"犄",6244:"犋",6245:"犍",6246:"犏",6247:"犒",6248:"挈",6249:"挲",6250:"掰",6251:"搿",6252:"擘",6253:"耄",6254:"毪",6255:"毳",6256:"毽",6257:"毵",6258:"毹",6259:"氅",6260:"氇",6261:"氆",6262:"氍",6263:"氕",6264:"氘",6265:"氙",6266:"氚",6267:"氡",6268:"氩",6269:"氤",6270:"氪",6271:"氲",6272:"攵",6273:"敕",6274:"敫",6275:"牍",6276:"牒",6277:"牖",6278:"爰",6279:"虢",6280:"刖",6281:"肟",6282:"肜",6283:"肓",6284:"肼",6285:"朊",6286:"肽",6287:"肱",6288:"肫",6289:"肭",6290:"肴",6291:"肷",6292:"胧",6293:"胨",6294:"胩",6295:"胪",6296:"胛",6297:"胂",6298:"胄",6299:"胙",6300:"胍",6301:"胗",6302:"朐",6303:"胝",6304:"胫",6305:"胱",6306:"胴",6307:"胭",6308:"脍",6309:"脎",6310:"胲",6311:"胼",6312:"朕",6313:"脒",6314:"豚",6315:"脶",6316:"脞",6317:"脬",6318:"脘",6319:"脲",6320:"腈",6321:"腌",6322:"腓",6323:"腴",6324:"腙",6325:"腚",6326:"腱",6327:"腠",6328:"腩",6329:"腼",6330:"腽",6331:"腭",6332:"腧",6333:"塍",6334:"媵",6335:"膈",6336:"膂",6337:"膑",6338:"滕",6339:"膣",6340:"膪",6341:"臌",6342:"朦",6343:"臊",6344:"膻",6345:"臁",6346:"膦",6347:"欤",6348:"欷",6349:"欹",6350:"歃",6351:"歆",6352:"歙",6353:"飑",6354:"飒",6355:"飓",6356:"飕",6357:"飙",6358:"飚",6359:"殳",6360:"彀",6361:"毂",6362:"觳",6363:"斐",6364:"齑",6365:"斓",6366:"於",6367:"旆",6368:"旄",6369:"旃",6370:"旌",6371:"旎",6372:"旒",6373:"旖",6374:"炀",6375:"炜",6376:"炖",6377:"炝",6378:"炻",6379:"烀",6380:"炷",6381:"炫",6382:"炱",6383:"烨",6384:"烊",6385:"焐",6386:"焓",6387:"焖",6388:"焯",6389:"焱",6390:"煳",6391:"",6392:"",6393:"",6394:"",6395:"",6396:"",6397:"",6398:"",6399:"",6400:"煜",6401:"煨",6402:"煅",6403:"煲",6404:"煊",6405:"煸",6406:"煺",6407:"熘",6408:"熳",6409:"熵",6410:"熨",6411:"熠",6412:"燠",6413:"燔",6414:"燧",6415:"燹",6416:"爝",6417:"爨",6418:"灬",6419:"焘",6420:"煦",6421:"熹",6422:"戾",6423:"戽",6424:"扃",6425:"扈",6426:"扉",6427:"礻",6428:"祀",6429:"祆",6430:"祉",6431:"祛",6432:"祜",6433:"祓",6434:"祚",6435:"祢",6436:"祗",6437:"祠",6438:"祯",6439:"祧",6440:"祺",6441:"禅",6442:"禊",6443:"禚",6444:"禧",6445:"禳",6446:"忑",6447:"忐",6448:"怼",6449:"恝",6450:"恚",6451:"恧",6452:"恁",6453:"恙",6454:"恣",6455:"悫",6456:"愆",6457:"愍",6458:"慝",6459:"憩",6460:"憝",6461:"懋",6462:"懑",6463:"戆",6464:"肀",6465:"聿",6466:"沓",6467:"泶",6468:"淼",6469:"矶",6470:"矸",6471:"砀",6472:"砉",6473:"砗",6474:"砘",6475:"砑",6476:"斫",6477:"砭",6478:"砜",6479:"砝",6480:"砹",6481:"砺",6482:"砻",6483:"砟",6484:"砼",6485:"砥",6486:"砬",6487:"砣",6488:"砩",6489:"硎",6490:"硭",6491:"硖",6492:"硗",6493:"砦",6494:"硐",6495:"硇",6496:"硌",6497:"硪",6498:"碛",6499:"碓",6500:"碚",6501:"碇",6502:"碜",6503:"碡",6504:"碣",6505:"碲",6506:"碹",6507:"碥",6508:"磔",6509:"磙",6510:"磉",6511:"磬",6512:"磲",6513:"礅",6514:"磴",6515:"礓",6516:"礤",6517:"礞",6518:"礴",6519:"龛",6520:"黹",6521:"黻",6522:"黼",6523:"盱",6524:"眄",6525:"眍",6526:"盹",6527:"眇",6528:"眈",6529:"眚",6530:"眢",6531:"眙",6532:"眭",6533:"眦",6534:"眵",6535:"眸",6536:"睐",6537:"睑",6538:"睇",6539:"睃",6540:"睚",6541:"睨",6542:"睢",6543:"睥",6544:"睿",6545:"瞍",6546:"睽",6547:"瞀",6548:"瞌",6549:"瞑",6550:"瞟",6551:"瞠",6552:"瞰",6553:"瞵",6554:"瞽",6555:"町",6556:"畀",6557:"畎",6558:"畋",6559:"畈",6560:"畛",6561:"畲",6562:"畹",6563:"疃",6564:"罘",6565:"罡",6566:"罟",6567:"詈",6568:"罨",6569:"罴",6570:"罱",6571:"罹",6572:"羁",6573:"罾",6574:"盍",6575:"盥",6576:"蠲",6577:"钅",6578:"钆",6579:"钇",6580:"钋",6581:"钊",6582:"钌",6583:"钍",6584:"钏",6585:"钐",6586:"钔",6587:"钗",6588:"钕",6589:"钚",6590:"钛",6591:"钜",6592:"钣",6593:"钤",6594:"钫",6595:"钪",6596:"钭",6597:"钬",6598:"钯",6599:"钰",6600:"钲",6601:"钴",6602:"钶",6603:"钷",6604:"钸",6605:"钹",6606:"钺",6607:"钼",6608:"钽",6609:"钿",6610:"铄",6611:"铈",6612:"铉",6613:"铊",6614:"铋",6615:"铌",6616:"铍",6617:"铎",6618:"铐",6619:"铑",6620:"铒",6621:"铕",6622:"铖",6623:"铗",6624:"铙",6625:"铘",6626:"铛",6627:"铞",6628:"铟",6629:"铠",6630:"铢",6631:"铤",6632:"铥",6633:"铧",6634:"铨",6635:"铪",6636:"铩",6637:"铫",6638:"铮",6639:"铯",6640:"铳",6641:"铴",6642:"铵",6643:"铷",6644:"铹",6645:"铼",6646:"铽",6647:"",6648:"",6649:"",6650:"",6651:"",6652:"",6653:"",6654:"",6655:"",6656:"铿",6657:"锃",6658:"锂",6659:"锆",6660:"锇",6661:"锉",6662:"锊",6663:"锍",6664:"锎",6665:"锏",6666:"锒",6667:"锓",6668:"锔",6669:"锕",6670:"锖",6671:"锘",6672:"锛",6673:"锝",6674:"锞",6675:"锟",6676:"锢",6677:"锪",6678:"锫",6679:"锩",6680:"锬",6681:"锱",6682:"锲",6683:"锴",6684:"锶",6685:"锷",6686:"锸",6687:"锼",6688:"锾",6689:"锿",6690:"镂",6691:"锵",6692:"镄",6693:"镅",6694:"镆",6695:"镉",6696:"镌",6697:"镎",6698:"镏",6699:"镒",6700:"镓",6701:"镔",6702:"镖",6703:"镗",6704:"镘",6705:"镙",6706:"镛",6707:"镞",6708:"镟",6709:"镝",6710:"镡",6711:"镢",6712:"镤",6713:"镥",6714:"镦",6715:"镧",6716:"镨",6717:"镩",6718:"镪",6719:"镫",6720:"镬",6721:"镯",6722:"镱",6723:"镲",6724:"镳",6725:"锺",6726:"矧",6727:"矬",6728:"雉",6729:"秕",6730:"秭",6731:"秣",6732:"秫",6733:"稆",6734:"嵇",6735:"稃",6736:"稂",6737:"稞",6738:"稔",6739:"稹",6740:"稷",6741:"穑",6742:"黏",6743:"馥",6744:"穰",6745:"皈",6746:"皎",6747:"皓",6748:"皙",6749:"皤",6750:"瓞",6751:"瓠",6752:"甬",6753:"鸠",6754:"鸢",6755:"鸨",6756:"鸩",6757:"鸪",6758:"鸫",6759:"鸬",6760:"鸲",6761:"鸱",6762:"鸶",6763:"鸸",6764:"鸷",6765:"鸹",6766:"鸺",6767:"鸾",6768:"鹁",6769:"鹂",6770:"鹄",6771:"鹆",6772:"鹇",6773:"鹈",6774:"鹉",6775:"鹋",6776:"鹌",6777:"鹎",6778:"鹑",6779:"鹕",6780:"鹗",6781:"鹚",6782:"鹛",6783:"鹜",6784:"鹞",6785:"鹣",6786:"鹦",6787:"鹧",6788:"鹨",6789:"鹩",6790:"鹪",6791:"鹫",6792:"鹬",6793:"鹱",6794:"鹭",6795:"鹳",6796:"疒",6797:"疔",6798:"疖",6799:"疠",6800:"疝",6801:"疬",6802:"疣",6803:"疳",6804:"疴",6805:"疸",6806:"痄",6807:"疱",6808:"疰",6809:"痃",6810:"痂",6811:"痖",6812:"痍",6813:"痣",6814:"痨",6815:"痦",6816:"痤",6817:"痫",6818:"痧",6819:"瘃",6820:"痱",6821:"痼",6822:"痿",6823:"瘐",6824:"瘀",6825:"瘅",6826:"瘌",6827:"瘗",6828:"瘊",6829:"瘥",6830:"瘘",6831:"瘕",6832:"瘙",6833:"瘛",6834:"瘼",6835:"瘢",6836:"瘠",6837:"癀",6838:"瘭",6839:"瘰",6840:"瘿",6841:"瘵",6842:"癃",6843:"瘾",6844:"瘳",6845:"癍",6846:"癞",6847:"癔",6848:"癜",6849:"癖",6850:"癫",6851:"癯",6852:"翊",6853:"竦",6854:"穸",6855:"穹",6856:"窀",6857:"窆",6858:"窈",6859:"窕",6860:"窦",6861:"窠",6862:"窬",6863:"窨",6864:"窭",6865:"窳",6866:"衤",6867:"衩",6868:"衲",6869:"衽",6870:"衿",6871:"袂",6872:"袢",6873:"裆",6874:"袷",6875:"袼",6876:"裉",6877:"裢",6878:"裎",6879:"裣",6880:"裥",6881:"裱",6882:"褚",6883:"裼",6884:"裨",6885:"裾",6886:"裰",6887:"褡",6888:"褙",6889:"褓",6890:"褛",6891:"褊",6892:"褴",6893:"褫",6894:"褶",6895:"襁",6896:"襦",6897:"襻",6898:"疋",6899:"胥",6900:"皲",6901:"皴",6902:"矜",6903:"",6904:"",6905:"",6906:"",6907:"",6908:"",6909:"",6910:"",6911:"",7168:"耒",7169:"耔",7170:"耖",7171:"耜",7172:"耠",7173:"耢",7174:"耥",7175:"耦",7176:"耧",7177:"耩",7178:"耨",7179:"耱",7180:"耋",7181:"耵",7182:"聃",7183:"聆",7184:"聍",7185:"聒",7186:"聩",7187:"聱",7188:"覃",7189:"顸",7190:"颀",7191:"颃",7192:"颉",7193:"颌",7194:"颍",7195:"颏",7196:"颔",7197:"颚",7198:"颛",7199:"颞",7200:"颟",7201:"颡",7202:"颢",7203:"颥",7204:"颦",7205:"虍",7206:"虔",7207:"虬",7208:"虮",7209:"虿",7210:"虺",7211:"虼",7212:"虻",7213:"蚨",7214:"蚍",7215:"蚋",7216:"蚬",7217:"蚝",7218:"蚧",7219:"蚣",7220:"蚪",7221:"蚓",7222:"蚩",7223:"蚶",7224:"蛄",7225:"蚵",7226:"蛎",7227:"蚰",7228:"蚺",7229:"蚱",7230:"蚯",7231:"蛉",7232:"蛏",7233:"蚴",7234:"蛩",7235:"蛱",7236:"蛲",7237:"蛭",7238:"蛳",7239:"蛐",7240:"蜓",7241:"蛞",7242:"蛴",7243:"蛟",7244:"蛘",7245:"蛑",7246:"蜃",7247:"蜇",7248:"蛸",7249:"蜈",7250:"蜊",7251:"蜍",7252:"蜉",7253:"蜣",7254:"蜻",7255:"蜞",7256:"蜥",7257:"蜮",7258:"蜚",7259:"蜾",7260:"蝈",7261:"蜴",7262:"蜱",7263:"蜩",7264:"蜷",7265:"蜿",7266:"螂",7267:"蜢",7268:"蝽",7269:"蝾",7270:"蝻",7271:"蝠",7272:"蝰",7273:"蝌",7274:"蝮",7275:"螋",7276:"蝓",7277:"蝣",7278:"蝼",7279:"蝤",7280:"蝙",7281:"蝥",7282:"螓",7283:"螯",7284:"螨",7285:"蟒",7286:"蟆",7287:"螈",7288:"螅",7289:"螭",7290:"螗",7291:"螃",7292:"螫",7293:"蟥",7294:"螬",7295:"螵",7296:"螳",7297:"蟋",7298:"蟓",7299:"螽",7300:"蟑",7301:"蟀",7302:"蟊",7303:"蟛",7304:"蟪",7305:"蟠",7306:"蟮",7307:"蠖",7308:"蠓",7309:"蟾",7310:"蠊",7311:"蠛",7312:"蠡",7313:"蠹",7314:"蠼",7315:"缶",7316:"罂",7317:"罄",7318:"罅",7319:"舐",7320:"竺",7321:"竽",7322:"笈",7323:"笃",7324:"笄",7325:"笕",7326:"笊",7327:"笫",7328:"笏",7329:"筇",7330:"笸",7331:"笪",7332:"笙",7333:"笮",7334:"笱",7335:"笠",7336:"笥",7337:"笤",7338:"笳",7339:"笾",7340:"笞",7341:"筘",7342:"筚",7343:"筅",7344:"筵",7345:"筌",7346:"筝",7347:"筠",7348:"筮",7349:"筻",7350:"筢",7351:"筲",7352:"筱",7353:"箐",7354:"箦",7355:"箧",7356:"箸",7357:"箬",7358:"箝",7359:"箨",7360:"箅",7361:"箪",7362:"箜",7363:"箢",7364:"箫",7365:"箴",7366:"篑",7367:"篁",7368:"篌",7369:"篝",7370:"篚",7371:"篥",7372:"篦",7373:"篪",7374:"簌",7375:"篾",7376:"篼",7377:"簏",7378:"簖",7379:"簋",7380:"簟",7381:"簪",7382:"簦",7383:"簸",7384:"籁",7385:"籀",7386:"臾",7387:"舁",7388:"舂",7389:"舄",7390:"臬",7391:"衄",7392:"舡",7393:"舢",7394:"舣",7395:"舭",7396:"舯",7397:"舨",7398:"舫",7399:"舸",7400:"舻",7401:"舳",7402:"舴",7403:"舾",7404:"艄",7405:"艉",7406:"艋",7407:"艏",7408:"艚",7409:"艟",7410:"艨",7411:"衾",7412:"袅",7413:"袈",7414:"裘",7415:"",7416:"",7417:"",7418:"",7419:"",7420:"",7421:"",7422:"",7423:"",7424:"裟",7425:"襞",7426:"羝",7427:"羟",7428:"羧",7429:"羯",7430:"羰",7431:"羲",7432:"籼",7433:"敉",7434:"粑",7435:"粝",7436:"粜",7437:"粞",7438:"粢",7439:"粲",7440:"粼",7441:"粽",7442:"糁",7443:"糇",7444:"糌",7445:"糍",7446:"糈",7447:"糅",7448:"糗",7449:"糨",7450:"艮",7451:"暨",7452:"羿",7453:"翎",7454:"翕",7455:"翥",7456:"翡",7457:"翦",7458:"翩",7459:"翮",7460:"翳",7461:"糸",7462:"絷",7463:"綦",7464:"綮",7465:"繇",7466:"纛",7467:"麸",7468:"麴",7469:"赳",7470:"趄",7471:"趔",7472:"趑",7473:"趱",7474:"赧",7475:"赭",7476:"豇",7477:"豉",7478:"酊",7479:"酐",7480:"酎",7481:"酏",7482:"酤",7483:"酢",7484:"酡",7485:"酰",7486:"酩",7487:"酯",7488:"酽",7489:"酾",7490:"酲",7491:"酴",7492:"酹",7493:"醌",7494:"醅",7495:"醐",7496:"醍",7497:"醑",7498:"醢",7499:"醣",7500:"醪",7501:"醭",7502:"醮",7503:"醯",7504:"醵",7505:"醴",7506:"醺",7507:"豕",7508:"鹾",7509:"趸",7510:"跫",7511:"踅",7512:"蹙",7513:"蹩",7514:"趵",7515:"趿",7516:"趼",7517:"趺",7518:"跄",7519:"跖",7520:"跗",7521:"跚",7522:"跞",7523:"跎",7524:"跏",7525:"跛",7526:"跆",7527:"跬",7528:"跷",7529:"跸",7530:"跣",7531:"跹",7532:"跻",7533:"跤",7534:"踉",7535:"跽",7536:"踔",7537:"踝",7538:"踟",7539:"踬",7540:"踮",7541:"踣",7542:"踯",7543:"踺",7544:"蹀",7545:"踹",7546:"踵",7547:"踽",7548:"踱",7549:"蹉",7550:"蹁",7551:"蹂",7552:"蹑",7553:"蹒",7554:"蹊",7555:"蹰",7556:"蹶",7557:"蹼",7558:"蹯",7559:"蹴",7560:"躅",7561:"躏",7562:"躔",7563:"躐",7564:"躜",7565:"躞",7566:"豸",7567:"貂",7568:"貊",7569:"貅",7570:"貘",7571:"貔",7572:"斛",7573:"觖",7574:"觞",7575:"觚",7576:"觜",7577:"觥",7578:"觫",7579:"觯",7580:"訾",7581:"謦",7582:"靓",7583:"雩",7584:"雳",7585:"雯",7586:"霆",7587:"霁",7588:"霈",7589:"霏",7590:"霎",7591:"霪",7592:"霭",7593:"霰",7594:"霾",7595:"龀",7596:"龃",7597:"龅",7598:"龆",7599:"龇",7600:"龈",7601:"龉",7602:"龊",7603:"龌",7604:"黾",7605:"鼋",7606:"鼍",7607:"隹",7608:"隼",7609:"隽",7610:"雎",7611:"雒",7612:"瞿",7613:"雠",7614:"銎",7615:"銮",7616:"鋈",7617:"錾",7618:"鍪",7619:"鏊",7620:"鎏",7621:"鐾",7622:"鑫",7623:"鱿",7624:"鲂",7625:"鲅",7626:"鲆",7627:"鲇",7628:"鲈",7629:"稣",7630:"鲋",7631:"鲎",7632:"鲐",7633:"鲑",7634:"鲒",7635:"鲔",7636:"鲕",7637:"鲚",7638:"鲛",7639:"鲞",7640:"鲟",7641:"鲠",7642:"鲡",7643:"鲢",7644:"鲣",7645:"鲥",7646:"鲦",7647:"鲧",7648:"鲨",7649:"鲩",7650:"鲫",7651:"鲭",7652:"鲮",7653:"鲰",7654:"鲱",7655:"鲲",7656:"鲳",7657:"鲴",7658:"鲵",7659:"鲶",7660:"鲷",7661:"鲺",7662:"鲻",7663:"鲼",7664:"鲽",7665:"鳄",7666:"鳅",7667:"鳆",7668:"鳇",7669:"鳊",7670:"鳋",7671:"",7672:"",7673:"",7674:"",7675:"",7676:"",7677:"",7678:"",7679:"",7680:"鳌",7681:"鳍",7682:"鳎",7683:"鳏",7684:"鳐",7685:"鳓",7686:"鳔",7687:"鳕",7688:"鳗",7689:"鳘",7690:"鳙",7691:"鳜",7692:"鳝",7693:"鳟",7694:"鳢",7695:"靼",7696:"鞅",7697:"鞑",7698:"鞒",7699:"鞔",7700:"鞯",7701:"鞫",7702:"鞣",7703:"鞲",7704:"鞴",7705:"骱",7706:"骰",7707:"骷",7708:"鹘",7709:"骶",7710:"骺",7711:"骼",7712:"髁",7713:"髀",7714:"髅",7715:"髂",7716:"髋",7717:"髌",7718:"髑",7719:"魅",7720:"魃",7721:"魇",7722:"魉",7723:"魈",7724:"魍",7725:"魑",7726:"飨",7727:"餍",7728:"餮",7729:"饕",7730:"饔",7731:"髟",7732:"髡",7733:"髦",7734:"髯",7735:"髫",7736:"髻",7737:"髭",7738:"髹",7739:"鬈",7740:"鬏",7741:"鬓",7742:"鬟",7743:"鬣",7744:"麽",7745:"麾",7746:"縻",7747:"麂",7748:"麇",7749:"麈",7750:"麋",7751:"麒",7752:"鏖",7753:"麝",7754:"麟",7755:"黛",7756:"黜",7757:"黝",7758:"黠",7759:"黟",7760:"黢",7761:"黩",7762:"黧",7763:"黥",7764:"黪",7765:"黯",7766:"鼢",7767:"鼬",7768:"鼯",7769:"鼹",7770:"鼷",7771:"鼽",7772:"鼾",7773:"齄",63955:"~"};
const HOME_EXP_TABLES={GROWTH_MEDIUM_FAST:[0,1,8,27,64,125,216,343,512,729,1000,1331,1728,2197,2744,3375,4096,4913,5832,6859,8000,9261,10648,12167,13824,15625,17576,19683,21952,24389,27000,29791,32768,35937,39304,42875,46656,50653,54872,59319,64000,68921,74088,79507,85184,91125,97336,103823,110592,117649,125000,132651,140608,148877,157464,166375,175616,185193,195112,205379,216000,226981,238328,250047,262144,274625,287496,300763,314432,328509,343000,357911,373248,389017,405224,421875,438976,456533,474552,493039,512000,531441,551368,571787,592704,614125,636056,658503,681472,704969,729000,753571,778688,804357,830584,857375,884736,912673,941192,970299,1000000],GROWTH_ERRATIC:[0,1,15,52,122,237,406,637,942,1326,1800,2369,3041,3822,4719,5737,6881,8155,9564,11111,12800,14632,16610,18737,21012,23437,26012,28737,31610,34632,37800,41111,44564,48155,51881,55737,59719,63822,68041,72369,76800,81326,85942,90637,95406,100237,105122,110052,115015,120001,125000,131324,137795,144410,151165,158056,165079,172229,179503,186894,194400,202013,209728,217540,225443,233431,241496,249633,257834,267406,276915,286567,296358,306286,316344,326531,336840,347269,357812,368464,379221,390077,401028,412067,423190,434391,445663,457001,468398,479848,491346,502883,514453,526049,537664,549291,560922,572550,584166,591882,600000],GROWTH_FLUCTUATING:[0,1,4,13,32,64,112,178,276,393,540,745,967,1230,1591,1957,2457,3046,3732,4526,5440,6482,7666,9003,10506,12187,14060,16140,18439,20974,23760,26811,30146,33780,37731,42017,46656,50652,55969,60505,66560,71677,78533,84277,91998,98414,107069,114205,123863,131766,142500,151222,163105,172697,185807,196322,210739,222231,238036,250562,267840,281456,300293,315059,335544,351520,373744,390991,415050,433631,459620,479600,507617,529063,559209,582187,614566,639146,673863,700115,737280,765275,804997,834809,877201,908904,954084,987754,1035837,1071552,1122660,1160499,1214753,1254796,1312322,1354652,1415577,1460276,1524731,1571884,1640000],GROWTH_MEDIUM_SLOW:[0,1,9,57,96,134,179,236,314,419,560,742,973,1261,1612,2034,2535,3120,3798,4575,5460,6458,7577,8825,10208,11734,13411,15244,17242,19411,21760,24294,27021,29949,33084,36434,40007,43808,47846,52127,56660,61450,66505,71833,77440,83334,89523,96012,102810,109923,117360,125126,133229,141677,150476,159634,169159,179056,189334,199999,211060,222522,234393,246681,259392,272534,286115,300140,314618,329555,344960,360838,377197,394045,411388,429234,447591,466464,485862,505791,526260,547274,568841,590969,613664,636934,660787,685228,710266,735907,762160,789030,816525,844653,873420,902834,932903,963632,995030,1027103,1059860],GROWTH_FAST:[0,1,6,21,51,100,172,274,409,583,800,1064,1382,1757,2195,2700,3276,3930,4665,5487,6400,7408,8518,9733,11059,12500,14060,15746,17561,19511,21600,23832,26214,28749,31443,34300,37324,40522,43897,47455,51200,55136,59270,63605,68147,72900,77868,83058,88473,94119,100000,106120,112486,119101,125971,133100,140492,148154,156089,164303,172800,181584,190662,200037,209715,219700,229996,240610,251545,262807,274400,286328,298598,311213,324179,337500,351180,365226,379641,394431,409600,425152,441094,457429,474163,491300,508844,526802,545177,563975,583200,602856,622950,643485,664467,685900,707788,730138,752953,776239,800000],GROWTH_SLOW:[0,1,10,33,80,156,270,428,640,911,1250,1663,2160,2746,3430,4218,5120,6141,7290,8573,10000,11576,13310,15208,17280,19531,21970,24603,27440,30486,33750,37238,40960,44921,49130,53593,58320,63316,68590,74148,80000,86151,92610,99383,106480,113906,121670,129778,138240,147061,156250,165813,175760,186096,196830,207968,219520,231491,243890,256723,270000,283726,297910,312558,327680,343281,359370,375953,393040,410636,428750,447388,466560,486271,506530,527343,548720,570666,593190,616298,640000,664301,689210,714733,740880,767656,795070,823128,851840,881211,911250,941963,973360,1005446,1038230,1071718,1105920,1140841,1176490,1212873,1250000]};
const HOME_SIG = 0x08012025;
const HOME_CHUNK_SIZES = [0xF24, 0xFF0, 0xFF0, 0xFF0, 0xD98, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0x450];
const HOME_BOX_N = 25, HOME_SLOT_N = 30, HOME_CP = 58, HOME_BOX_STEP = 0x6CC;
/* 每个盒子 (0 起) 所在区域与区域内偏移。mir = 扇区30+31 的原始数据区 (各 0xFF0) */
const HOME_BOX_ADDR = (() => {
  const a = [];
  for (let i = 0; i < 19; i++) a.push(["win", 4 + i * HOME_BOX_STEP]);
  a.push(["mir", 0xB0C], ["mir", 0x11D8], ["mir", 0x18A4]);
  a.push(["sb1", 0x1F08], ["sb1", 0x25D4]);
  a.push(["sb2", 0xB0]);
  return a;
})();
const HOME_ITEM_BY_ID = {};  D.items.forEach(it => HOME_ITEM_BY_ID[it.id] = it);
const HOME_GROWTH_MAP = { "较快": "GROWTH_MEDIUM_FAST", "略快": "GROWTH_FAST", "快": "GROWTH_FAST",
                          "较慢": "GROWTH_MEDIUM_SLOW", "略慢": "GROWTH_SLOW", "慢": "GROWTH_SLOW",
                          "不规则": "GROWTH_ERRATIC", "波动": "GROWTH_FLUCTUATING" };

function homeCnStr(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0xFF) break;
    const two = i + 1 < bytes.length ? HOMECN[(b << 8) | bytes[i + 1]] : undefined;
    if (two !== undefined) { out += two; i++; continue; }
    const one = HOMECN[b];
    out += one !== undefined ? one : "?";
  }
  return out;
}
/* 与 ROM CalculateSaveChecksum 一致: u32 字累加 → 单次折叠 → 低 16 位 */
function homeCalcChecksum(u8, off, size) {
  let s = 0;
  for (let i = 0; i < size; i += 4)
    s = (s + (u8[off + i] | u8[off + i + 1] << 8 | u8[off + i + 2] << 16 | u8[off + i + 3] << 24)) >>> 0;
  return (s + (s >>> 16)) & 0xFFFF;
}
/* 区域内偏移 → 文件偏移 (依赖 chunks 的扇区映射); 越界返回 -1 */
function homeMakeMapper(chunks) {
  return (region, off) => {
    if (region === "mir") {  // 扇区 30/31 位置固定, 不参与轮转
      if (off < 0xFF0) return 30 * 4096 + off;
      if (off < 0x1FE0) return 31 * 4096 + off - 0xFF0;
      return -1;
    }
    const range = region === "sb2" ? [0, 0] : region === "sb1" ? [1, 4] : [5, 13];
    let base = 0;
    for (let c = range[0]; c <= range[1]; c++) {
      if (off < base + HOME_CHUNK_SIZES[c]) return chunks[c].fileOff + off - base;
      base += HOME_CHUNK_SIZES[c];
    }
    return -1;
  };
}
/* 盒子格子的字节可能横跨两个 chunk (两扇区不连续), 必须逐字节走映射器,
   不能按文件连续地址切片, 否则会误读/误写扇区 footer */
function homeRegionRead(u8, map, region, off, len) {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const fo = map(region, off + i);
    if (fo < 0) return null;
    out[i] = u8[fo];
  }
  return out;
}
function homeRegionWrite(u8, map, region, off, bytes) {
  for (let i = 0; i < HOME_CP; i++) {
    const fo = map(region, off + i);
    if (fo < 0) continue;
    u8[fo] = bytes ? bytes[i] : 0;
  }
}
/* CompressedPokemon → 展示信息 */
function homeMonInfo(b) {
  if (!b || b.length < HOME_CP) return null;
  const sp = b[0x1C] | b[0x1D] << 8;
  if (!sp) return null;
  const pid = (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0;
  const otid = (b[4] | b[5] << 8 | b[6] << 16 | b[7] << 24) >>> 0;
  const ivs = (b[0x36] | b[0x37] << 8 | b[0x38] << 16 | b[0x39] << 24) >>> 0;
  const exp = (b[0x20] | b[0x21] << 8 | b[0x22] << 16 | b[0x23] << 24) >>> 0;
  const mv = ((b[0x27] | b[0x28] << 8 | b[0x29] << 16 | b[0x2A] << 24) >>> 0) + b[0x2B] * 0x100000000;
  const s = SPECIES_BY_ID[sp];
  const nick = homeCnStr(b.subarray(8, 18));
  const egg = (b[0x13] & 4) !== 0 || !!(ivs & 0x40000000);
  const shiny = ((pid >>> 16) ^ (pid & 0xFFFF) ^ (otid >>> 16) ^ (otid & 0xFFFF)) < 16;
  let gender = "";
  if (s && s.genderF >= 100) gender = "♀";
  else if (s && s.genderF >= 0) gender = ((pid & 0xFF) < Math.floor(s.genderF * 2.55)) ? "♀" : "♂";
  return {
    sp, s, pid, otid, exp, egg, shiny, gender,
    name: nick || (s ? speciesName(s) : "???"),
    nick, ot: homeCnStr(b.subarray(0x14, 0x1B)),
    lvl: egg ? null : homeLevelOf(exp, s),
    item: b[0x1E] | b[0x1F] << 8,
    ball: b[0x26],
    friend: b[0x25],
    moves: [0, 1, 2, 3].map(i => Math.floor(mv / Math.pow(2, 10 * i)) & 0x3FF),
    evs: [0, 1, 2, 3, 4, 5].map(i => b[0x2C + i]),  // 努力值 (顺序: HP/攻/防/速/特攻/特防)
    ivs: [0, 1, 2, 3, 4, 5].map(i => (ivs >>> (5 * i)) & 31),
    ha: (ivs >>> 31) === 1,
  };
}
function homeLevelOf(exp, s) {
  const t = HOME_EXP_TABLES[(s && HOME_GROWTH_MAP[s.growth]) || ""] || HOME_EXP_TABLES.GROWTH_MEDIUM_FAST;
  let lv = 1;
  while (lv < 100 && exp >= t[lv + 1]) lv++;
  return lv;
}
/* 解析整个存档 (不修改 buf); 返回 {err} 或完整结构 */
function homeParseSave(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8.length < 131072) return { err: "文件不足 128KiB，不是 GBA 存档" };
  const foot = [];
  for (let s = 0; s < 32; s++) {
    const b = s * 4096;
    foot[s] = {
      id: u8[b + 0xFF4] | u8[b + 0xFF5] << 8,
      chk: u8[b + 0xFF6] | u8[b + 0xFF7] << 8,
      sig: (u8[b + 0xFF8] | u8[b + 0xFF9] << 8 | u8[b + 0xFFA] << 16 | u8[b + 0xFFB] << 24) >>> 0,
      cnt: (u8[b + 0xFFC] | u8[b + 0xFFD] << 8 | u8[b + 0xFFE] << 16 | u8[b + 0xFFF] << 24) >>> 0,
      fileOff: b,
    };
  }
  let best = null;
  for (const slot of [0, 1]) {
    const byId = {};
    for (let s = slot * 14; s < slot * 14 + 14; s++) {
      if (foot[s].sig === HOME_SIG && foot[s].id < 14 && !(foot[s].id in byId)) byId[foot[s].id] = s;
    }
    if (Object.keys(byId).length !== 14) continue;
    let ok = true, maxCnt = 0;
    for (let c = 0; c < 14; c++) {
      if (homeCalcChecksum(u8, byId[c] * 4096, HOME_CHUNK_SIZES[c]) !== foot[byId[c]].chk) { ok = false; break; }
      maxCnt = Math.max(maxCnt, foot[byId[c]].cnt);
    }
    if (ok && (!best || maxCnt > best.cnt)) best = { slot, cnt: maxCnt, byId };
  }
  if (!best) return { err: "没找到校验通过的存档槽，请确认是本作（火红物语）导出的 .sav 文件" };
  const chunks = [];
  for (let c = 0; c < 14; c++) chunks.push({ fileOff: best.byId[c] * 4096, size: HOME_CHUNK_SIZES[c] });
  const map = homeMakeMapper(chunks);
  const sb2 = chunks[0].fileOff;
  const boxes = [], names = [];
  for (let i = 0; i < HOME_BOX_N; i++) {
    const [region, base] = HOME_BOX_ADDR[i];
    const mons = [];
    for (let j = 0; j < HOME_SLOT_N; j++) {
      const b = homeRegionRead(u8, map, region, base + j * HOME_CP, HOME_CP);
      mons.push(b && (b[0x1C] | b[0x1D] << 8) ? b : null);  // 物种 0 = 空位
    }
    boxes.push({ mons });
    const no = map("win", i < 14 ? 0x8344 + 9 * i : 0x8344 - 9 * (i - 13));
    const nm = no < 0 ? "" : homeCnStr(u8.subarray(no, no + 9)).trim();
    names.push(nm || `盒子${i + 1}`);
  }
  const party = [];
  for (let i = 0; i < 6; i++) {
    const off = map("sb1", 0x38 + i * 100);
    const sp = off < 0 ? 0 : u8[off + 0x20] | u8[off + 0x21] << 8;
    if (off < 0 || !sp) { party.push(null); continue; }
    const pid = (u8[off] | u8[off + 1] << 8 | u8[off + 2] << 16 | u8[off + 3] << 24) >>> 0;
    const ivs = (u8[off + 0x48] | u8[off + 0x49] << 8 | u8[off + 0x4A] << 16 | u8[off + 0x4B] << 24) >>> 0;
    party.push({
      sp, pid, otid: (u8[off + 4] | u8[off + 5] << 8 | u8[off + 6] << 16 | u8[off + 7] << 24) >>> 0,
      nick: homeCnStr(u8.subarray(off + 8, off + 18)),
      lvl: u8[off + 0x54], hp: u8[off + 0x56] | u8[off + 0x57] << 8,
      max: u8[off + 0x58] | u8[off + 0x59] << 8,
      status: (u8[off + 0x50] | u8[off + 0x51] << 8 | u8[off + 0x52] << 16 | u8[off + 0x53] << 24) >>> 0,
      item: u8[off + 0x22] | u8[off + 0x23] << 8,
      exp: (u8[off + 0x24] | u8[off + 0x25] << 8 | u8[off + 0x26] << 16 | u8[off + 0x27] << 24) >>> 0,
      ivs, ha: (ivs >>> 31) === 1,
    });
  }
  const tid = (u8[sb2 + 0x0A] | u8[sb2 + 0x0B] << 8 | u8[sb2 + 0x0C] << 16 | u8[sb2 + 0x0D] << 24) >>> 0;
  return {
    ok: true, slot: best.slot, cnt: best.cnt, chunks, boxes, names, party,
    player: { name: homeCnStr(u8.subarray(sb2, sb2 + 8)).trim(), gender: u8[sb2 + 8], tid },
  };
}
/* ---------------- HOME 本地存储 (localStorage, 会被「存档同步」一并备份) ---------------- */
const HOME_KEY = "pkdx_home_boxes";
function homeLoadBoxes() {
  try {
    const v = JSON.parse(localStorage.getItem(HOME_KEY) || "null");
    if (v && v.v === 1 && Array.isArray(v.boxes) && v.boxes.length === HOME_BOX_N)
      return v.boxes.map(b => Array.from({ length: HOME_SLOT_N }, (_, j) => typeof b[j] === "string" ? b[j] : null));
  } catch (e) {}
  return Array.from({ length: HOME_BOX_N }, () => Array(HOME_SLOT_N).fill(null));
}
function homePersist() { localStorage.setItem(HOME_KEY, JSON.stringify({ v: 1, boxes: homeBoxes })); }
const homeB64 = b => { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const homeUnb64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
/* ---------------- 读写宝可梦 (side: "game" | "home") ---------------- */
/* 状态用 var + 惰性初始化: 模块在文件末尾, 启动阶段的 route() 可能先于本节执行
   (PWA 刷新会直接落在 #/home 深链), var 无 TDZ, 渲染前补齐即可 */
var homeSave = null;   // { buf, pristine, fileName, chunks, slot, cnt, player, names, party, boxes, map, dirty }
var homeBoxes = null;  // [[b64|null ×30] ×25]
var homeUI = null;     // { gameBox, homeBox, sel, suppressClick }
function homeInitState() {
  if (!homeUI) homeUI = { gameBox: 0, homeBox: 0, sel: null, suppressClick: false };
  if (!homeBoxes) homeBoxes = homeLoadBoxes();
}
function homeGetMon(side, box, slot) {
  if (side === "home") { const b = homeBoxes[box][slot]; return b ? homeUnb64(b) : null; }
  if (!homeSave) return null;
  const [region, base] = HOME_BOX_ADDR[box];
  const b = homeRegionRead(new Uint8Array(homeSave.buf), homeSave.map, region, base + slot * HOME_CP, HOME_CP);
  return b && (b[0x1C] | b[0x1D] << 8) ? b : null;  // 物种 0 = 空位
}
function homeSetMon(side, box, slot, bytes) {
  if (side === "home") { homeBoxes[box][slot] = bytes ? homeB64(bytes) : null; homePersist(); return; }
  if (!homeSave) return;
  const [region, base] = HOME_BOX_ADDR[box];
  homeRegionWrite(new Uint8Array(homeSave.buf), homeSave.map, region, base + slot * HOME_CP, bytes);
  homeSave.dirty = true;
}
function homeDoTransfer(from, to) {
  const a = homeGetMon(from.side, from.box, from.slot);
  const b = homeGetMon(to.side, to.box, to.slot);
  homeSetMon(to.side, to.box, to.slot, a);
  homeSetMon(from.side, from.box, from.slot, b);
  renderPkHome();
}
function homeFindFree(side, preferBox) {
  if (side === "game" && !homeSave) return null;
  for (let j = 0; j < HOME_SLOT_N; j++) if (!homeGetMon(side, preferBox, j)) return { side, box: preferBox, slot: j };
  for (let i = 0; i < HOME_BOX_N; i++)
    for (let j = 0; j < HOME_SLOT_N; j++)
      if (!homeGetMon(side, i, j)) return { side, box: i, slot: j };
  return null;
}
/* ---------------- 交互 ---------------- */
window.homeClickCell = function (side, box, slot) {
  if (homeUI.suppressClick) { homeUI.suppressClick = false; return; }
  if (side === "game" && !homeSave) return;
  const sel = homeUI.sel;
  if (sel) {
    const same = sel.side === side && sel.box === box && sel.slot === slot;
    homeUI.sel = null;
    if (!same) homeDoTransfer(sel, { side, box, slot });  // 目标为空=移动, 有宝可梦=交换
    else renderPkHome();
    return;
  }
  if (!homeGetMon(side, box, slot)) return;
  homeUI.sel = { side, box, slot };
  renderPkHome();
};
window.homeNavBox = function (side, d) {
  const k = side === "game" ? "gameBox" : "homeBox";
  homeUI[k] = (homeUI[k] + d + HOME_BOX_N) % HOME_BOX_N;
  homeUI.sel = null;
  renderPkHome();
};
window.homeSendToHome = function () {
  const sel = homeUI.sel;
  if (!sel || sel.side !== "game") return;
  const to = homeFindFree("home", homeUI.homeBox);
  if (!to) return homeShowMsg("HOME 盒子已满", "err");
  homeUI.homeBox = to.box;
  homeUI.sel = null;
  homeDoTransfer(sel, to);
};
window.homeTakeToGame = function () {
  const sel = homeUI.sel;
  if (!sel || sel.side !== "home") return;
  if (!homeSave) return homeShowMsg("请先上传游戏存档", "err");
  const to = homeFindFree("game", homeUI.gameBox);
  if (!to) return homeShowMsg("游戏盒子已满", "err");
  homeUI.gameBox = to.box;
  homeUI.sel = null;
  homeDoTransfer(sel, to);
};
window.homeDeselect = function () { homeUI.sel = null; renderPkHome(); };
window.homeClearHomeAsk = function () {
  const n = homeBoxes.flat().filter(Boolean).length;
  if (!n) return homeShowMsg("HOME 盒子本来就是空的", "ok");
  showPopup(`<h2>清空 HOME 盒子</h2><div class="mv-desc">将删除浏览器里存放的 ${n} 只宝可梦，且无法恢复（除非先用「存档同步」导出过备份）。确定？</div>
    <div class="home-popup-actions"><button type="button" class="cm-btn" onclick="hidePopup()">取消</button>
    <button type="button" class="cm-btn ghost" onclick="homeClearHome()">确认清空</button></div>`);
};
window.homeClearHome = function () {
  homeBoxes = Array.from({ length: HOME_BOX_N }, () => Array(HOME_SLOT_N).fill(null));
  homePersist();
  hidePopup();
  renderPkHome();
  homeShowMsg("HOME 盒子已清空", "ok");
};
/* 删除 HOME 里的单只宝可梦 (仅 HOME 侧可选; 存档侧不动) */
window.homeDeleteAsk = function () {
  const sel = homeUI.sel;
  if (!sel || sel.side !== "home") return;
  const info = homeMonInfo(homeGetMon(sel.side, sel.box, sel.slot));
  if (!info) return;
  showPopup(`<h2>删除 HOME 宝可梦</h2><div class="mv-desc">将从 HOME 盒子 ${sel.box + 1} 第 ${sel.slot + 1} 格删除「${esc(info.name)}」，删除后无法恢复（除非先用「存档同步」备份过）。确定？</div>
    <div class="home-popup-actions"><button type="button" class="cm-btn" onclick="hidePopup()">取消</button>
    <button type="button" class="cm-btn ghost home-danger" onclick="homeDelete()">确认删除</button></div>`);
};
window.homeDelete = function () {
  const sel = homeUI.sel;
  if (!sel || sel.side !== "home") return;
  homeSetMon("home", sel.box, sel.slot, null);
  homeUI.sel = null;
  hidePopup();
  renderPkHome();
};
window.homeUploadFile = function (e) {
  const f = e.target.files[0];
  e.target.value = "";  // 允许重复选择同一文件
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const rep = homeParseSave(r.result);
    if (rep.err) return homeShowMsg("读取失败：" + rep.err, "err");
    homeSave = {
      buf: r.result, fileName: f.name,
      pristine: new Uint8Array(r.result).slice(),
      chunks: rep.chunks, slot: rep.slot, cnt: rep.cnt,
      player: rep.player, names: rep.names, party: rep.party, boxes: rep.boxes,
      map: homeMakeMapper(rep.chunks), dirty: false,
    };
    homeUI.gameBox = 0;
    homeUI.sel = null;
    renderPkHome();
    homeShowMsg(`已读取存档：${rep.player.name || "???"}（第 ${rep.slot + 1} 槽）`, "ok");
  };
  r.readAsArrayBuffer(f);
};
/* 导出: 全部 14 chunk 重算校验和 + 重新解析做一致性自检 (扇区 30/31 无校验, footer 保持 0) */
function homeExportSave() {
  const u8 = new Uint8Array(homeSave.buf);
  for (let c = 0; c < 14; c++) {
    const ch = homeSave.chunks[c];
    const chk = homeCalcChecksum(u8, ch.fileOff, ch.size);
    u8[ch.fileOff + 0xFF6] = chk & 0xFF;
    u8[ch.fileOff + 0xFF7] = chk >> 8 & 0xFF;
  }
  const rep = homeParseSave(homeSave.buf.slice(0));
  if (rep.err) return { err: rep.err };
  for (let i = 0; i < HOME_BOX_N; i++)
    for (let j = 0; j < HOME_SLOT_N; j++) {
      const a = homeGetMon("game", i, j), b = rep.boxes[i].mons[j];
      if ((!!a) !== (!!b) || (a && a.length === b.length && a.some((v, k) => v !== b[k])))
        return { err: "导出自检未通过（盒子内容与写回不一致），请重试或重新上传存档" };
    }
  return { blob: new Blob([homeSave.buf], { type: "application/octet-stream" }) };
}
window.homeDownload = function () {
  if (!homeSave) return;
  const res = homeExportSave();
  if (res.err) return homeShowMsg("导出失败：" + res.err, "err");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(res.blob);
  a.download = homeSave.fileName.replace(/\.(sav|srm|bin)$/i, "") + "_HOME.sav";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  homeShowMsg("已导出修改后的存档（校验和已重算，可直接放进模拟器读取）", "ok");
};
window.homeDiscard = function () {
  if (!homeSave || !homeSave.dirty) return;
  new Uint8Array(homeSave.buf).set(homeSave.pristine);
  homeSave.dirty = false;
  renderPkHome();
  homeShowMsg("已还原为刚上传时的内容", "ok");
};
function homeShowMsg(msg, type) {
  const el = $("#home-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = "sync-msg " + (type || "");
}
/* 拖拽 (pointer 事件, 桌面/触屏通用); 松手落在格子上即移动/交换, 没动则交给 click 选中 */
(function () {
  let from = null, sx = 0, sy = 0, ghost = null;
  document.addEventListener("pointerdown", e => {
    if (!document.querySelector(".home-page")) return;
    const cell = e.target.closest(".home-cell");
    if (!cell || cell.classList.contains("empty")) return;
    from = { side: cell.dataset.side, box: +cell.dataset.box, slot: +cell.dataset.slot };
    sx = e.clientX; sy = e.clientY;
  });
  document.addEventListener("pointermove", e => {
    if (!from) return;
    if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
    if (!ghost) {
      const info = homeMonInfo(homeGetMon(from.side, from.box, from.slot));
      ghost = document.createElement("div");
      ghost.className = "home-drag-ghost";
      ghost.textContent = info ? info.name : "";
      document.body.appendChild(ghost);
    }
    ghost.style.left = e.clientX + 14 + "px";
    ghost.style.top = e.clientY + 14 + "px";
  });
  document.addEventListener("pointerup", e => {
    if (!from) return;
    const src = from;
    from = null;
    if (ghost) { ghost.remove(); ghost = null; }
    const cell = e.target.closest && e.target.closest(".home-cell");
    if (!cell) return;  // 没拖到格子上: 当作点击 (选中)
    const to = { side: cell.dataset.side, box: +cell.dataset.box, slot: +cell.dataset.slot };
    if (to.side === src.side && to.box === src.box && to.slot === src.slot) return;
    homeUI.suppressClick = true;
    homeUI.sel = null;
    homeDoTransfer(src, to);
  });
})();
/* ---------------- 渲染 ---------------- */
function homeCellHtml(side, box, slot) {
  const info = homeMonInfo(homeGetMon(side, box, slot));
  const dis = side === "game" && !homeSave;
  const sel = homeUI.sel;
  const isSel = sel && sel.side === side && sel.box === box && sel.slot === slot;
  if (!info) return `<div class="home-cell empty${dis ? " off" : ""}" data-side="${side}" data-box="${box}" data-slot="${slot}"></div>`;
  const s = SPECIES_BY_ID[info.sp];
  const inner = s ? spriteCanvas("icon", s.id) : `<span class="home-q">?</span>`;
  return `<div class="home-cell${isSel ? " sel" : ""}${dis ? " off" : ""}" data-side="${side}" data-box="${box}" data-slot="${slot}"${dis ? "" : ` onclick="homeClickCell('${side}',${box},${slot})"`}>
    ${inner}${info.shiny ? `<span class="mark">✨</span>` : ""}${info.egg ? `<span class="mark">🥚</span>` : ""}
    ${info.lvl != null ? `<span class="lv">L${info.lvl}</span>` : ""}</div>`;
}
function homePanelHtml(side) {
  const isGame = side === "game";
  const cur = isGame ? homeUI.gameBox : homeUI.homeBox;
  const used = Array.from({ length: HOME_SLOT_N }, (_, j) => homeGetMon(side, cur, j)).filter(Boolean).length;
  const name = isGame ? (homeSave ? homeSave.names[cur] : "未读取存档") : `HOME 盒子`;
  return `<div class="home-panel${isGame && !homeSave ? " off" : ""}">
    <div class="home-panel-head">
      <span class="home-panel-title">${isGame ? "游戏盒子" : "HOME 盒子"}</span>
      <div class="home-box-nav">
        <button type="button" onclick="homeNavBox('${side}',-1)">‹</button>
        <span class="home-box-name">${esc(name)} ${cur + 1}/${HOME_BOX_N} · ${used}/${HOME_SLOT_N}</span>
        <button type="button" onclick="homeNavBox('${side}',1)">›</button>
      </div>
    </div>
    <div class="home-grid">${Array.from({ length: HOME_SLOT_N }, (_, j) => homeCellHtml(side, cur, j)).join("")}</div>
  </div>`;
}
const HOME_STATUS_ZH = st => st & 0x7 ? "睡眠" : st & 0x80 ? "剧毒" : st & 0x40 ? "麻痹" : st & 0x20 ? "冰冻" : st & 0x10 ? "灼伤" : st & 0x8 ? "中毒" : "";
function homeDetailHtml() {
  const sel = homeUI.sel;
  if (!sel) return `<div class="home-detail empty">点格子选中宝可梦，再点另一格即移动 / 交换（也支持拖拽）。放入 HOME 的宝可梦保存在此浏览器里，换设备请先用「存档同步」备份。</div>`;
  const info = homeMonInfo(homeGetMon(sel.side, sel.box, sel.slot));
  if (!info) return "";
  const s = info.s;
  const abIdx = (info.pid >>> 16) & 1;
  const abId = info.ha ? (s && s.hidden || [])[0] : (s && s.abilities || [])[abIdx] ?? (s && s.abilities || [])[0];
  const abil = s ? ABIL_BY_ID[abId] : null;
  const item = HOME_ITEM_BY_ID[info.item], ball = HOME_ITEM_BY_ID[info.ball];
  const nat = BREED_NATURES[info.pid % 25];
  const natZh = (nat.u || nat.d) ? esc(nat.zh) + " (+" + BREED_NAT_STAT_ZH[nat.u] + " -" + BREED_NAT_STAT_ZH[nat.d] + ")" : esc(nat.zh);
  const rows = [
    ["等级", info.egg ? "蛋" : "Lv." + info.lvl],
    ["性别", info.gender || "—"],
    ["性格", natZh],
    ["特性", abil ? esc(abil.zh) + (info.ha ? "（梦特）" : "") : "—"],
    ["道具", item ? esc(item.zh) : "无"],
    ["精灵球", ball ? esc(ball.zh) : "—"],
    ["亲密度", info.friend],
    ["个体值", info.ivs.join(" / ")],
    ["努力值", info.evs.join(" / ")],
    ["经验", info.exp],
    ["训练家", info.ot ? esc(info.ot) + " (" + (info.otid % 65536) + ")" : String(info.otid % 65536)],
  ];
  return `<div class="home-detail">
    <div class="home-detail-spr">${spriteCanvas(info.shiny ? "front_shiny" : "front", s ? s.id : info.sp)}
      ${info.shiny ? `<div class="home-shiny-tag">✨ 闪光</div>` : ""}</div>
    <div class="home-detail-main">
      <div class="home-detail-name">${esc(info.name)}${s && s.formLabel ? `<span class="pill small" style="background:#5a6b7d">${esc(s.formLabel)}</span>` : ""}
        ${s ? typePills(s.types, true) : ""}</div>
      <div class="home-detail-moves">${info.moves.filter(Boolean).map(id => { const m = MOVE_BY_ID[id]; return m ? `<a class="pill small mv" onclick="showMovePopup(${id})">${esc(m.zh)}</a>` : ""; }).join("")}</div>
      <dl class="home-detail-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("")}</dl>
      <div class="home-detail-actions">
        ${sel.side === "game" ? `<button type="button" class="cm-btn" onclick="homeSendToHome()">存入 HOME</button>` : ""}
        ${sel.side === "home" && homeSave ? `<button type="button" class="cm-btn" onclick="homeTakeToGame()">取出到游戏</button>` : ""}
        ${sel.side === "home" ? `<button type="button" class="cm-btn ghost home-danger" onclick="homeDeleteAsk()">🗑 删除</button>` : ""}
        <button type="button" class="cm-btn ghost" onclick="homeDeselect()">取消选择</button>
      </div>
    </div>
  </div>`;
}
function homePartyHtml() {
  if (!homeSave) return "";
  const cells = homeSave.party.map(m => {
    if (!m) return `<div class="home-pmon empty"></div>`;
    const s = SPECIES_BY_ID[m.sp];
    const st = HOME_STATUS_ZH(m.status);
    return `<div class="home-pmon" title="${esc(m.nick || (s ? speciesName(s) : "???"))}">
      ${s ? spriteCanvas("icon", s.id) : `<span class="home-q">?</span>`}
      <div class="pm-info"><div class="pm-name">${esc(m.nick || (s ? speciesName(s) : "???"))}</div>
      <div class="pm-lv">Lv.${m.lvl}${st ? ` · ${st}` : ""}${m.ha ? " · 梦特" : ""}</div>
      <div class="home-hp"><i style="width:${Math.max(0, Math.min(100, m.max ? m.hp / m.max * 100 : 0))}%"></i></div>
      <div class="pm-hp">${m.hp}/${m.max}</div></div></div>`;
  }).join("");
  return `<div class="home-section"><div class="home-section-title">随身队伍（只读）</div><div class="home-party">${cells}</div></div>`;
}
function renderPkHome() {
  homeInitState();
  const usedTotal = homeBoxes.flat().filter(Boolean).length;
  let saveLine = `<div class="home-save-line">尚未读取存档：请上传模拟器导出的 .sav（128 KiB）。<b>下载修改的存档前，请先自行备份原文件。</b></div>`;
  if (homeSave) {
    const p = homeSave.player;
    const gameUsed = homeSave.boxes.reduce((n, b) => n + b.mons.filter(m => m && (m[0x1C] | m[0x1D] << 8)).length, 0);
    saveLine = `<div class="home-save-line">训练家 <b>${esc(p.name || "???")}</b>${p.gender === 1 ? " ♀" : " ♂"} · ID ${p.tid.toString(16).toUpperCase().padStart(8, "0")}
      · 第 ${homeSave.slot + 1} 槽 · 游戏盒子已用 ${gameUsed}/${HOME_BOX_N * HOME_SLOT_N} 格 · HOME 已存 ${usedTotal} 只
      ${homeSave.dirty ? `· <span class="home-dirty">有未保存的修改</span>` : ""}</div>`;
  }
  app.innerHTML = `<div class="home-page">
    <div class="page-title">宝可梦HOME</div>
    <div class="page-sub">上传游戏存档，即可在 PC 盒子与浏览器 HOME 盒子之间自由传送宝可梦（25 盒 × 30 只）。HOME 数据保存在此浏览器里，「存档同步」会一并备份；游戏存档仅在本地内存中修改，不会上传服务器。</div>
    <div class="sync-section">
      <div class="sync-section-title">游戏存档</div>
      <div class="sync-actions">
        <label class="cm-btn" for="home-file-input">📁 选择 .sav 存档</label>
        <input id="home-file-input" type="file" accept=".sav,.srm,.bin" class="hidden" onchange="homeUploadFile(event)">
        ${homeSave ? `<button type="button" class="cm-btn${homeSave.dirty ? "" : " ghost"}" onclick="homeDownload()">⬇ 下载修改后的存档${homeSave.dirty ? " ●" : ""}</button>` : ""}
        ${homeSave && homeSave.dirty ? `<button type="button" class="cm-btn ghost" onclick="homeDiscard()">放弃修改</button>` : ""}
        <button type="button" class="cm-btn ghost" onclick="homeClearHomeAsk()">🗑 清空 HOME</button>
      </div>
      <div class="home-save-line">${saveLine}</div>
      <div id="home-msg" class="sync-msg"></div>
    </div>
    ${homePartyHtml()}
    <div class="home-panels">${homePanelHtml("game")}${homePanelHtml("home")}</div>
    ${homeDetailHtml()}
  </div>`;
  mountSprites(app);
}
window.renderPkHome = renderPkHome;

/* ---------------- 培养屋 (配置宝可梦 → 生成 CompressedPokemon → 送入 HOME → 经 HOME 传入存档) ----------------
   HOME 模块负责「解析/写回」, 本模块负责「正向生成」:
   - PID 按约束搜索: 性格 = pid%25; 常规特性槽 = (pid>>16)&1; 性别 = (pid&0xFF) 与性别阈值比较;
     闪光 = (pid>>16 ^ pid&0xFFFF ^ otid>>16 ^ otid&0xFFFF) < 16 —— 与训练家 ID 绑定, 必须先读取存档
   - 经验查 HOME_EXP_TABLES 成长曲线表 (与游戏同源); 昵称用 HOMECN 反查编码 (双字节大端, 0xFF 结尾)
   - metInfo/lang/otName 等直接抄本作存档里游戏写的值: metGame=4, lang=2, metLocation=88
   - 招式字段只有 10bit (≤1023): id≥1024 的新招式放不进 PC 盒子, 选项里一律过滤 */
const BREED_KEY = "pkdx_breed_form";
/* u/d = 上升/下降能力 (Gen3 标准表, 顺序 = pid%25 索引) */
const BREED_NATURES = [
  { zh: "勤奋", u: 0, d: 0 }, { zh: "怕寂寞", u: 1, d: 2 }, { zh: "勇敢", u: 1, d: 3 },
  { zh: "固执", u: 1, d: 4 }, { zh: "顽皮", u: 1, d: 5 }, { zh: "大胆", u: 2, d: 1 },
  { zh: "坦率", u: 0, d: 0 }, { zh: "悠闲", u: 2, d: 3 }, { zh: "淘气", u: 2, d: 4 },
  { zh: "乐天", u: 2, d: 5 }, { zh: "胆小", u: 3, d: 1 }, { zh: "急躁", u: 3, d: 2 },
  { zh: "认真", u: 0, d: 0 }, { zh: "爽朗", u: 3, d: 4 }, { zh: "天真", u: 3, d: 5 },
  { zh: "内敛", u: 4, d: 1 }, { zh: "慢吞吞", u: 4, d: 2 }, { zh: "冷静", u: 4, d: 3 },
  { zh: "害羞", u: 0, d: 0 }, { zh: "马虎", u: 4, d: 5 }, { zh: "温和", u: 5, d: 1 },
  { zh: "温顺", u: 5, d: 2 }, { zh: "自大", u: 5, d: 3 }, { zh: "慎重", u: 5, d: 4 },
  { zh: "浮躁", u: 0, d: 0 },
];
const BREED_NAT_STAT_ZH = { 1: "攻击", 2: "防御", 3: "速度", 4: "特攻", 5: "特防" };  // 性格表 u/d 编号 → 名称
const BREED_REV = (() => {  // 字符 → 最小码 (单字符表项; 优先单字节码)
  const m = new Map();
  Object.keys(HOMECN).map(Number).sort((a, b) => a - b).forEach(c => {
    const ch = HOMECN[c];
    if (ch.length === 1 && !m.has(ch)) m.set(ch, c);
  });
  return m;
})();
function breedEncodeName(str, maxBytes) {
  const out = [];
  for (const ch of String(str || "")) {
    const c = BREED_REV.get(ch);
    if (c === undefined) continue;
    const need = c <= 0xFF ? 1 : 2;
    if (out.length + need > maxBytes) break;  // 满 10 字节也可 (引擎 GetBoxMonData 按固定 10 字节读取再补 EOS), 未满用 0xFF 补尾
    if (c <= 0xFF) out.push(c); else out.push(c >> 8, c & 0xFF);
  }
  while (out.length < maxBytes) out.push(0xFF);
  return Uint8Array.from(out);
}
function breedCalcStats(s, lv, ivs, evs, nat) {
  const b = s.stats, st = {};
  const keys = ["hp", "atk", "def", "spe", "spa", "spd"];  // ivs/evs 数组顺序与此一致
  const base = k => {
    const i = keys.indexOf(k);
    return Math.floor((2 * b[k] + ivs[i] + Math.floor(evs[i] / 4)) * lv / 100);
  };
  st.hp = b.hp === 1 ? 1 : base("hp") + lv + 10;
  const nk = { atk: 1, def: 2, spe: 3, spa: 4, spd: 5 };  // 性格表 u/d 用这套数字编号
  ["atk", "def", "spe", "spa", "spd"].forEach(k => {
    const m = nk[k] === nat.u ? 1.1 : nk[k] === nat.d ? 0.9 : 1;
    st[k] = Math.floor((base(k) + 5) * m);
  });
  return st;
}
function breedSearchSp(q) {
  const raw = toHans(String(q || "").trim().toLowerCase());
  if (!raw) return [];
  return D.species.filter(x => x.isDefault && (          // 仅默认形态 (1025 只)
    toHans((x.zh || "").toLowerCase()).includes(raw) ||
    (x.en || "").toLowerCase().includes(raw) ||
    String(x.dex) === raw));
}
function breedLearnset(s) {
  const lvMap = {};
  (s.levelUp || []).forEach(e => { if (e[1] <= 1023 && (lvMap[e[1]] === undefined || e[0] < lvMap[e[1]])) lvMap[e[1]] = e[0]; });
  const pool = new Set(Object.keys(lvMap).map(Number));
  (s.tm || []).forEach(id => { if (id <= 1023 && MOVE_BY_ID[id]) pool.add(id); });
  (s.tutor || []).forEach(id => { if (id <= 1023 && MOVE_BY_ID[id]) pool.add(id); });
  (s.egg || []).forEach(id => { if (id <= 1023 && MOVE_BY_ID[id]) pool.add(id); });  // 蛋招式也要进可学池
  const eggSet = new Set((s.egg || []).filter(id => id <= 1023 && MOVE_BY_ID[id]));
  return { lvMap, pool, eggSet };
}
function breedDefaultMoves(s, lv) {
  const { lvMap } = breedLearnset(s);
  const byLv = Object.keys(lvMap).map(Number).filter(id => lvMap[id] <= lv).sort((a, b) => lvMap[a] - lvMap[b]);
  const picks = byLv.slice(-4);
  for (let i = 0; picks.length < 4 && i < byLv.length; i++) picks.unshift(byLv[i]);  // 招式不足 4 个时从头补
  return [picks[0] || 0, picks[1] || 0, picks[2] || 0, picks[3] || 0];
}
function breedDefaultForm(sp) {
  const s = SPECIES_BY_ID[sp];
  return { sp, lv: 50, nat: 0, ab: (s && s.hidden && s.hidden.length) ? "h" : "0", sex: "m",
           ivs: [31, 31, 31, 31, 31, 31], evs: [0, 0, 0, 0, 0, 0],
           moves: s ? breedDefaultMoves(s, 50) : [0, 0, 0, 0],
           item: 0, ball: 4, friend: (s && s.friendship) || 70, nick: "", shiny: false,
           editSrc: null, orig: null, pidDirty: false, nickDirty: false };
}
var breedForm = null;  // 与 HOME 状态同样用 var + 惰性初始化 (启动 route() 可能先执行)
function breedInitForm() {
  if (breedForm) return;
  try {
    const v = JSON.parse(localStorage.getItem(BREED_KEY) || "null");
    if (v && SPECIES_BY_ID[v.sp]) {
      if (!SPECIES_BY_ID[v.sp].isDefault) {  // 旧配置存过特殊形态: 映射回同图鉴号默认形态
        const d = D.species.find(x => x.isDefault && x.dex === SPECIES_BY_ID[v.sp].dex);
        if (d) v.sp = d.id;
      }
      v.ivs = (v.ivs || []).map(x => Math.max(0, Math.min(31, +x | 0)));
      v.evs = (v.evs || []).map(x => Math.max(0, Math.min(252, +x | 0)));
      v.moves = [0, 1, 2, 3].map(i => (v.moves || [])[i] <= 1023 && MOVE_BY_ID[v.moves[i]] ? v.moves[i] : 0);
      breedForm = v;
      return;
    }
  } catch (e) {}
  breedForm = breedDefaultForm(25);
}
function breedPersist() { localStorage.setItem(BREED_KEY, JSON.stringify(breedForm)); }
/* 生成 58 字节 CompressedPokemon; 无存档时 otid=0 / OT="HOME" (进游戏后视为交换来的宝可梦) */
function breedMakeMon(f) {
  const s = SPECIES_BY_ID[f.sp];
  const t = HOME_EXP_TABLES[HOME_GROWTH_MAP[s.growth] || ""] || HOME_EXP_TABLES.GROWTH_MEDIUM_FAST;
  const lv = Math.max(1, Math.min(100, f.lv | 0));
  const exp = t[lv] || 0;
  /* 编辑 HOME 宝可梦: 沿用原 otid/OT名; 性格/特性/性别/闪光没动就保留原 PID (闪光性别不变) */
  const editing = !!(f.editSrc && f.orig);
  const otid = editing ? f.orig.otid : (homeSave ? homeSave.player.tid : 0);
  const otName = editing
    ? homeUnb64(f.orig.otName)
    : homeSave
      ? new Uint8Array(homeSave.buf, homeSave.chunks[0].fileOff, 7).slice()
      : breedEncodeName("HOME", 7);
  const thr = s.genderF >= 100 ? 256 : s.genderF < 0 ? -1 : Math.floor(s.genderF * 2.55);
  const wantF = f.sex === "f";
  const wantAbSlot = f.ab === "h" ? null : (f.ab === "1" ? 1 : 0);
  let pid = 0;
  if (editing && !f.pidDirty) {
    pid = f.orig.pid;
  } else {
    for (let i = 0; i < 4000000; i++) {
      pid = (Math.random() * 4294967296) >>> 0;
      if (pid % 25 !== f.nat) continue;
      if (wantAbSlot !== null && ((pid >>> 16) & 1) !== wantAbSlot) continue;
      if (thr > 0 && thr < 256 && ((pid & 0xFF) < thr) !== wantF) continue;
      if (f.shiny && (((pid >>> 16) ^ (pid & 0xFFFF) ^ (otid >>> 16) ^ (otid & 0xFFFF)) >= 16)) continue;
      break;
    }
  }
  const b = new Uint8Array(58);
  const w8 = (o, v) => { b[o] = v & 0xFF; };
  const w16 = (o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >>> 8) & 0xFF; };
  const w32 = (o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >>> 8) & 0xFF; b[o + 2] = (v >>> 16) & 0xFF; b[o + 3] = (v >>> 24) & 0xFF; };
  w32(0, pid);
  w32(4, otid);
  b.set(editing && !f.nickDirty ? homeUnb64(f.orig.nickBytes) : breedEncodeName(f.nick, 10), 8);
  w8(0x12, 2);            // 语言: 本作一律写 2
  w8(0x13, 0x02);         // hasSpecies
  b.set(otName.subarray(0, 7), 0x14);
  w8(0x1B, 0);            // 标记
  w16(0x1C, f.sp);
  w16(0x1E, f.item || 0);
  w32(0x20, exp);
  w8(0x24, 0);            // PP 加成
  w8(0x25, Math.max(0, Math.min(255, f.friend | 0)));
  w8(0x26, f.ball || 4);
  let mv = 0;
  for (let i = 0; i < 4; i++) { const id = (f.moves[i] || 0) <= 1023 ? (f.moves[i] || 0) : 0; mv += id * Math.pow(2, 10 * i); }
  for (let i = 0; i < 5; i++) b[0x27 + i] = Math.floor(mv / Math.pow(2, 8 * i)) & 0xFF;
  for (let i = 0; i < 6; i++) w8(0x2C + i, Math.max(0, Math.min(252, f.evs[i] | 0)));
  w8(0x32, 0);            // 宝可病毒
  w8(0x33, 88);           // 相遇地点: 与游戏给初始宝可梦写的一致
  w16(0x34, (lv & 0x7F) | (4 << 7) | ((homeSave && homeSave.player.gender === 1 ? 1 : 0) << 15));
  let ivs32 = 0;
  for (let i = 0; i < 6; i++) ivs32 += Math.max(0, Math.min(31, f.ivs[i] | 0)) * Math.pow(2, 5 * i);
  if (f.ab === "h") ivs32 += 0x80000000;  // 隐藏能力位
  w32(0x36, ivs32);
  return b;
}
/* ---------------- 培养屋交互 ---------------- */
window.breedSpInput = function (v) {
  const list = $("#breed-sp-list");
  if (!list) return;
  const hits = breedSearchSp(v).slice(0, 12);
  list.innerHTML = hits.length ? hits.map(s => `
    <div class="breed-sp-item" onclick="breedSetSp(${s.id})">
      ${spriteCanvas("icon", s.id)}<span class="nm">${esc(speciesName(s))}</span>
      <span class="muted">#${s.dex}${s.formLabel ? " · " + esc(s.formLabel) : ""}</span>
    </div>`).join("") : `<div class="breed-sp-item muted">没有匹配的宝可梦</div>`;
  list.classList.toggle("hidden", !v);
  mountSprites(list);
};
window.breedSpPickerOpen = function () {
  const inp = $("#breed-sp-q");
  inp.value = "";
  $("#breed-sp-list").classList.add("hidden");
  $("#breed-sp-picker").classList.toggle("hidden");
  inp.focus();
};
window.breedSetSp = function (id) {
  breedForm = breedDefaultForm(+id);
  breedPersist();
  renderBreed();
};
window.breedSetField = function (k, v) {
  breedInitForm();
  if (k === "lv") breedForm.lv = Math.max(1, Math.min(100, +v || 1));
  else if (k === "nat") breedForm.nat = +v;
  else if (k === "ab") breedForm.ab = v;
  else if (k === "sex") breedForm.sex = v;
  else if (k === "item") breedForm.item = +v;
  else if (k === "friend") breedForm.friend = Math.max(0, Math.min(255, +v | 0));
  else if (k === "nick") { breedForm.nick = String(v); breedForm.nickDirty = true; }
  else if (k === "shiny") { breedForm.shiny = !!v; breedForm.pidDirty = true; }
  if (k === "nat" || k === "ab" || k === "sex") breedForm.pidDirty = true;  // 编辑模式: 动了性格/特性/性别才重搜 PID
  breedPersist();
  renderBreed();
};
window.breedSetStat = function (kind, i, v) {
  breedInitForm();
  const cap = kind === "iv" ? 31 : 252;
  breedForm[kind + "s"][i] = Math.max(0, Math.min(cap, +v | 0));
  breedPersist();
  renderBreed();
};
window.breedRandIvs = function (max) {
  breedInitForm();
  breedForm.ivs = max ? [31, 31, 31, 31, 31, 31] : Array.from({ length: 6 }, () => (Math.random() * 32) | 0);
  breedPersist();
  renderBreed();
};
window.breedSetMove = function (i, v) {
  breedInitForm();
  breedForm.moves[i] = +v || 0;
  breedPersist();
  renderBreed();
};
window.breedSend = function () {
  breedInitForm();
  homeInitState();
  if (breedForm.shiny && !homeSave && !breedForm.editSrc) return breedShowMsg("闪光与训练家 ID 绑定：请先到「HOME」页读取存档再生成闪光宝可梦", "err");
  const bytes = breedMakeMon(breedForm);
  if (breedForm.editSrc) {
    const { box, slot } = breedForm.editSrc;
    homeSetMon("home", box, slot, bytes);
    const info = homeMonInfo(bytes);
    return breedShowMsg(`「${info.name}」(${info.lvl != null ? "Lv." + info.lvl : "?"}) 已写回 HOME 盒子 ${box + 1} 第 ${slot + 1} 格`, "ok");
  }
  const to = homeFindFree("home", homeUI.homeBox);
  if (!to) return breedShowMsg("HOME 盒子已满，请先清理或传进存档", "err");
  homeUI.homeBox = to.box;
  homeSetMon("home", to.box, to.slot, bytes);
  const info = homeMonInfo(bytes);
  breedShowMsg(`「${info.name}」(${info.lvl != null ? "Lv." + info.lvl : "?"}) 已送入 HOME 盒子 ${to.box + 1} 第 ${to.slot + 1} 格 —— 到 <a href="#/home">HOME</a> 页即可传进游戏存档`, "ok");
};
/* 从 HOME 读取宝可梦到表单编辑 */
window.breedImportAsk = function () {
  breedInitForm();
  homeInitState();
  const rows = [];
  for (let i = 0; i < HOME_BOX_N; i++)
    for (let j = 0; j < HOME_SLOT_N; j++) {
      const m = homeMonInfo(homeGetMon("home", i, j));
      if (m) rows.push({ i, j, m });
    }
  if (!rows.length) return breedShowMsg("HOME 盒子是空的，没有可读取的宝可梦", "err");
  showPopup(`<h2>从 HOME 读取宝可梦</h2><div class="breed-import-list">${rows.map(r => `
    <div class="breed-sp-item" onclick="breedImportFrom(${r.i},${r.j})">${spriteCanvas("icon", r.m.s ? r.m.s.id : r.m.sp)}
      <span class="nm">${esc(r.m.name)}</span>
      <span class="muted">Lv.${r.m.lvl != null ? r.m.lvl : "?"} · 盒子${r.i + 1} 第${r.j + 1}格${r.m.shiny ? " · ✨" : ""}</span></div>`).join("")}</div>
    <div class="home-popup-actions"><button type="button" class="cm-btn ghost" onclick="hidePopup()">取消</button></div>`);
  mountSprites(popup);
};
window.breedImportFrom = function (i, j) {
  const b = homeGetMon("home", i, j);
  const info = homeMonInfo(b);
  if (!info || !info.s) return;
  const abSlot = String((info.pid >>> 16) & 1);
  breedForm = {
    sp: info.sp, lv: Math.max(1, Math.min(100, homeLevelOf(info.exp, info.s))),
    nat: info.pid % 25, ab: info.ha ? "h" : ((info.s.abilities || [])[1] ? abSlot : "0"),
    sex: info.s.genderF >= 100 ? "f" : ((info.pid & 0xFF) < Math.floor(Math.max(0, info.s.genderF) * 2.55) ? "f" : "m"),
    ivs: info.ivs.slice(), evs: info.evs.slice(),
    moves: [0, 1, 2, 3].map(k => info.moves[k] || 0),
    item: info.item, ball: info.ball, friend: info.friend, nick: info.nick, shiny: info.shiny,
    editSrc: { box: i, slot: j },
    orig: { pid: info.pid, otid: info.otid, nickBytes: homeB64(b.slice(8, 18)), otName: homeB64(b.slice(0x14, 0x1B)) },
    pidDirty: false, nickDirty: false,
  };
  breedPersist();
  hidePopup();
  renderBreed();
};
window.breedCancelEdit = function () {
  breedForm.editSrc = null;
  breedForm.orig = null;
  breedForm.pidDirty = false;
  breedForm.nickDirty = false;
  breedPersist();
  renderBreed();
};
function breedShowMsg(msg, type) {
  const el = $("#breed-msg");
  if (!el) return;
  el.innerHTML = msg;
  el.className = "sync-msg " + (type || "");
}
/* ---------------- 培养屋渲染 ----------------
   招式/道具/球用打字搜索选择器; 招式仅可学会 (升级/招式机/教学), 10bit 放不下的新招式已在池里过滤 */
function breedPickHtml(kind, idx, text, placeholder) {
  return `<div class="breed-pick" data-kind="${kind}" data-idx="${idx}">
    <input class="breed-input" value="${esc(text)}" placeholder="${esc(placeholder)}"
      oninput="breedPickInput(this)" onfocus="breedPickInput(this)" onblur="breedPickBlur(this)">
    <div class="breed-pick-list hidden"></div></div>`;
}
function breedMoveLabel(id, lvMap, eggSet) {
  const m = MOVE_BY_ID[id];
  if (!m) return "";
  if (lvMap[id] !== undefined) return m.zh + " (Lv." + lvMap[id] + ")";
  return m.zh + (eggSet && eggSet.has(id) ? " (蛋招式)" : "");
}
function breedPickInput(inp) {
  const wrap = inp.closest(".breed-pick");
  const kind = wrap.dataset.kind, idx = +wrap.dataset.idx;
  const q = toHans(inp.value.trim().toLowerCase());
  let hits = [];
  if (kind === "move") {
    const { lvMap, pool, eggSet } = breedLearnset(SPECIES_BY_ID[breedForm.sp]);
    hits = [...pool].map(id => ({ id, label: breedMoveLabel(id, lvMap, eggSet), zh: MOVE_BY_ID[id].zh }))
      .filter(x => !q || toHans(x.zh.toLowerCase()).includes(q) || String(x.id) === q)
      .sort((a, b) => (lvMap[a.id] || 999) - (lvMap[b.id] || 999) || a.id - b.id);
  } else {
    const pockets = [1, 3, 5];
    hits = D.items.filter(it => pockets.includes(it.pocket))
      .filter(it => !q || toHans(it.zh.toLowerCase()).includes(q) || String(it.id) === q)
      .sort((a, b) => a.id - b.id)
      .map(it => ({ id: it.id, label: it.zh }));
  }
  const list = wrap.querySelector(".breed-pick-list");
  list.innerHTML = hits.slice(0, 30).map(x =>
    `<div class="breed-sp-item" onmousedown="breedPickChoose('${kind}',${idx},${x.id})">${esc(x.label)}</div>`).join("")
    + (hits.length > 30 ? `<div class="breed-sp-item muted">共 ${hits.length} 条,继续输入可缩小范围</div>` : "")
    + (hits.length ? "" : `<div class="breed-sp-item muted">没有匹配</div>`);
  list.classList.remove("hidden");
}
window.breedPickChoose = function (kind, idx, id) {
  if (kind === "move") breedForm.moves[idx] = id;
  else if (kind === "item") breedForm.item = id;
  breedPersist();
  renderBreed();
};
window.breedPickBlur = function (inp) {
  /* 打了字没选中就还原当前值; 建议项用 onmousedown 选中 (先于 blur 触发), 不受影响 */
  const wrap = inp.closest(".breed-pick");
  const kind = wrap.dataset.kind, idx = +wrap.dataset.idx;
  const cur = kind === "move" ? (breedForm.moves[idx] ? MOVE_BY_ID[breedForm.moves[idx]].zh || "" : "")
    : kind === "item" ? (breedForm.item ? (HOME_ITEM_BY_ID[breedForm.item] || {}).zh || "" : "")
    : "";
  if (inp.value !== cur) inp.value = cur;
};
function breedSpRowHtml() {
  const s = SPECIES_BY_ID[breedForm.sp];
  return `<div class="breed-row"><label>宝可梦</label><div class="breed-sp">
    <div class="breed-sp-sel">${spriteCanvas("icon", s.id)}<b>${esc(speciesName(s))}</b>
      <span class="muted">#${s.dex}${s.formLabel ? " · " + esc(s.formLabel) : ""}</span>
      <button type="button" class="cm-btn ghost small" onclick="breedSpPickerOpen()">换一只</button>
      <button type="button" class="cm-btn ghost small" onclick="breedImportAsk()">📥 从 HOME 读取</button></div>
    <div id="breed-sp-picker" class="hidden">
      <input id="breed-sp-q" class="breed-input" placeholder="名字 / 编号 / 英文名…" oninput="breedSpInput(this.value)">
      <div id="breed-sp-list" class="breed-sp-list hidden"></div>
    </div>
  </div></div>`;
}
function breedFormHtml() {
  const f = breedForm, s = SPECIES_BY_ID[f.sp];
  const abOpts = [];
  (s.abilities || []).forEach((id, i) => { const a = ABIL_BY_ID[id]; if (a && i < 2) abOpts.push(`<option value="${i}"${f.ab === String(i) ? " selected" : ""}>${esc(a.zh)}</option>`); });
  const hasHa = s.hidden && s.hidden.length && ABIL_BY_ID[s.hidden[0]];
  const statRow = (kind, i, zh) => `<span class="breed-stat"><i>${zh}</i><input type="number" min="0" max="${kind === "iv" ? 31 : 252}" value="${breedForm[kind + "s"][i]}" onchange="breedSetStat('${kind}',${i},this.value)"></span>`;
  const genderCtl = s.genderF >= 100 ? `<span class="muted">固定 ♀</span>`
    : s.genderF < 0 ? `<span class="muted">无性别</span>`
    : `<select onchange="breedSetField('sex',this.value)"><option value="m"${f.sex !== "f" ? " selected" : ""}>♂</option><option value="f"${f.sex === "f" ? " selected" : ""}>♀</option></select>`;
  const evSum = f.evs.reduce((a, b) => a + b, 0);
  return `${breedForm.editSrc ? `<div class="breed-row"><label>编辑中</label><div class="breed-ctl">
    <span class="muted">HOME 盒子 ${breedForm.editSrc.box + 1} 第 ${breedForm.editSrc.slot + 1} 格 · 未改动的字段原样保留</span>
    <button type="button" class="cm-btn ghost small" onclick="breedCancelEdit()">取消编辑</button></div></div>` : ""}${breedSpRowHtml()}
  <div class="breed-row"><label>等级 / 性格</label><div class="breed-ctl">
    <input class="breed-input num" type="number" min="1" max="100" value="${f.lv}" onchange="breedSetField('lv',this.value)">
    <select onchange="breedSetField('nat',this.value)">${BREED_NATURES.map((n, i) => `<option value="${i}"${f.nat === i ? " selected" : ""}>${esc(n.zh)}</option>`).join("")}</select></div></div>
  <div class="breed-row"><label>特性 / 性别</label><div class="breed-ctl">
    <select onchange="breedSetField('ab',this.value)">${abOpts.join("")}${hasHa ? `<option value="h"${f.ab === "h" ? " selected" : ""}>梦特 · ${esc(hasHa.zh)}</option>` : ""}</select>
    ${genderCtl}</div></div>
  <div class="breed-row"><label>昵称</label><div class="breed-ctl">
    <input class="breed-input" value="${esc(f.nick)}" placeholder="留空则用 species 名" onchange="breedSetField('nick',this.value)">
    <span class="muted small">${(() => { const e = breedEncodeName(f.nick, 10); const i = e.indexOf(0xFF); return i < 0 ? 10 : i; })()}/10 字节 (双字节汉字最多 5 个)</span></div></div>
  <div class="breed-row"><label>闪光</label><div class="breed-ctl">
    <label class="breed-check"><input type="checkbox" ${f.shiny ? "checked" : ""} onchange="breedSetField('shiny',this.checked)"${homeSave || f.editSrc ? "" : " disabled"}> ✨ 闪光</label>
    ${homeSave || f.editSrc ? "" : `<span class="muted small">需先在 HOME 页读取存档 (闪光与训练家 ID 绑定)</span>`}</div></div>
  <div class="breed-row"><label>个体值</label><div class="breed-ctl wrap">
    ${[0, 1, 2, 3, 4, 5].map(i => statRow("iv", i, ["HP", "攻击", "防御", "速度", "特攻", "特防"][i])).join("")}
    <button type="button" class="cm-btn ghost small" onclick="breedRandIvs(0)">随机</button>
    <button type="button" class="cm-btn ghost small" onclick="breedRandIvs(1)">全满</button></div></div>
  <div class="breed-row"><label>努力值</label><div class="breed-ctl wrap">
    ${[0, 1, 2, 3, 4, 5].map(i => statRow("ev", i, ["HP", "攻击", "防御", "速度", "特攻", "特防"][i])).join("")}
    <span class="muted small${evSum > 510 ? " over" : ""}">合计 ${evSum}/510</span></div></div>
  <div class="breed-row"><label>招式</label><div class="breed-ctl col">
    ${[0, 1, 2, 3].map(i => breedPickHtml("move", i, f.moves[i] ? MOVE_BY_ID[f.moves[i]].zh || "" : "", "输入搜索可学会招式…")).join("")}
    <span class="muted small">仅可学会的招式 (升级 / 招式机 / 教学); id≥1024 的新招式放不进盒子, 已过滤</span></div></div>
  <div class="breed-row"><label>道具</label><div class="breed-ctl col">
    ${breedPickHtml("item", 0, f.item ? (HOME_ITEM_BY_ID[f.item] || {}).zh || "" : "", "输入搜索道具…")}</div></div>
  <div class="breed-row"><label>亲密度</label><div class="breed-ctl">
    <input class="breed-input num" type="number" min="0" max="255" value="${f.friend}" onchange="breedSetField('friend',this.value)"></div></div>`;
}
function breedPreviewHtml() {
  const f = breedForm, s = SPECIES_BY_ID[f.sp];
  const nat = BREED_NATURES[f.nat] || BREED_NATURES[0];
  const st = breedCalcStats(s, f.lv, f.ivs, f.evs, nat);
  const natZh = (nat.u || nat.d) ? `${esc(nat.zh)} (+${BREED_NAT_STAT_ZH[nat.u]} -${BREED_NAT_STAT_ZH[nat.d]})` : esc(nat.zh);
  const abZh = f.ab === "h" ? ABIL_BY_ID[(s.hidden || [])[0]] : ABIL_BY_ID[(s.abilities || [])[+f.ab] ?? (s.abilities || [])[0]];
  return `<div class="breed-preview">
    <div class="breed-preview-spr">${spriteCanvas(f.shiny ? "front_shiny" : "front", s.id)}${f.shiny ? `<div class="home-shiny-tag">✨ 闪光</div>` : ""}</div>
    <div class="breed-preview-main">
      <div class="home-detail-name">${esc(f.nick || speciesName(s))}${s ? typePills(s.types, true) : ""}</div>
      <div class="muted small">Lv.${f.lv} · ${natZh} · ${abZh ? esc(abZh.zh) + (f.ab === "h" ? " (梦特)" : "") : "—"}</div>
      <div class="breed-stats">${["hp", "atk", "def", "spa", "spd", "spe"].map(k => statBar(k, st[k])).join("")}</div>
      <div class="home-detail-moves">${f.moves.filter(Boolean).map(id => `<a class="pill small mv" onclick="showMovePopup(${id})">${esc(MOVE_BY_ID[id].zh)}</a>`).join("")}</div>
      <div class="muted small">个体 ${f.ivs.join("/")}${f.ab === "h" ? " · 梦特位" : ""} · 努力 ${f.evs.join("/")} · 亲密 ${f.friend}</div>
    </div>
  </div>`;
}
function renderBreed() {
  breedInitForm();
  homeInitState();
  const f = breedForm;
  app.innerHTML = `<div class="breed-page">
    <div class="page-title">培养屋</div>
    <div class="page-sub">按你的想法培养一只宝可梦，「送入 HOME」后会放进浏览器的 HOME 盒子，再到 <a href="#/home">HOME</a> 页即可传进游戏存档。数据同样只在本地生成。</div>
    <div class="breed-grid">
      <div class="breed-form">${breedFormHtml()}
        <div class="breed-send">
          <button type="button" class="cm-btn" onclick="breedSend()">${breedForm.editSrc ? "✏️ 写回 HOME" : "🎁 送入 HOME"}</button>
          <span class="muted small">HOME 已存 ${homeBoxes.flat().filter(Boolean).length} 只</span>
        </div>
        <div class="muted small" style="margin-top:6px">${breedForm.editSrc
          ? `编辑模式：改动性格/特性/性别/闪光会按这只宝可梦原来的训练家 ID 重新搜 PID，其余字段只改你想改的`
          : homeSave
          ? `培养的宝可梦将属于你：${esc(homeSave.player.name || "???")} (${homeSave.player.tid % 65536})，可生成闪光`
          : `尚未读取存档：宝可梦会以 HOME 的名义持有（进游戏后显示为交换获得）。先在 <a href="#/home">HOME</a> 页读取存档，宝可梦就会属于你，且可生成闪光`}</div>
        <div id="breed-msg" class="sync-msg"></div>
      </div>
      <div class="breed-side">${breedPreviewHtml()}</div>
    </div>
  </div>`;
  mountSprites(app);
}
window.renderBreed = renderBreed;
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
setTimeout(maybeShowDailyPopup, 600);  // 每天首次打开自动弹窗 (延迟一点等首屏渲染完)

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

/* ---------------- 猜猜我是谁 (Wordle 玩法) ----------------
   每天从有编号的默认形态中按日期种子随机抽一只作为答案, 玩家输入宝可梦名称,
   系统给出属性/编号/进化阶段/身高/体重/蛋组/特性多维线索反馈:
   绿色=完全命中, 黄色=部分命中, 灰色=未命中. 每天最多 6 次, localStorage 记录当天状态. */
const GUESS_KEY_PREFIX = "pkdx_guess_";
const GUESS_MAX = 6;
const GUESS_EVO_PARENT = new Map();
D.species.forEach(s => { (s.evolutions || []).forEach(e => GUESS_EVO_PARENT.set(e.to, s.id)); });
const GUESS_STAGE_ZH = ["未进化", "一阶", "二阶", "三阶", "四阶"];
function guessEvoStage(s) {
  let stage = 0, cur = s.id;
  while (GUESS_EVO_PARENT.has(cur)) { cur = GUESS_EVO_PARENT.get(cur); stage++; }
  return stage;
}
function guessDailyTarget() {
  const rng = dailyRand("guess-" + dailyDateKey());
  const pool = DEX_SEQ.filter(s => s.dex > 0 && s.isDefault);
  return pool[Math.floor(rng() * pool.length)];
}
function guessTypeCmp(guessTypes, answerTypes) {
  const result = Array(guessTypes.length).fill("gray");
  const usedA = Array(answerTypes.length).fill(false);
  for (let i = 0; i < guessTypes.length; i++) {
    if (i < answerTypes.length && guessTypes[i] === answerTypes[i]) {
      result[i] = "green"; usedA[i] = true;
    }
  }
  for (let i = 0; i < guessTypes.length; i++) {
    if (result[i] === "green") continue;
    for (let j = 0; j < answerTypes.length; j++) {
      if (!usedA[j] && guessTypes[i] === answerTypes[j]) { result[i] = "yellow"; usedA[j] = true; break; }
    }
  }
  return result;
}
function guessLoadState(dk) {
  try { return JSON.parse(localStorage.getItem(GUESS_KEY_PREFIX + dk) || '{"solved":false,"guesses":[]}'); }
  catch (e) { return { solved: false, guesses: [] }; }
}
function guessSaveState(dk, st) { localStorage.setItem(GUESS_KEY_PREFIX + dk, JSON.stringify(st)); }
let guessTarget = null, guessState = null;

function guessAbilNames(s) {
  return (s.abilities || []).concat(s.hidden || []).map(aid => { const a = D.abilities[aid]; return a ? a.zh : ""; }).filter(Boolean);
}
function guessRenderRow(sp, target) {
  const typeStatus = guessTypeCmp(sp.types, target.types);
  const typeCells = sp.types.map((tid, i) => {
    const t = TYPE_BY_ID[tid];
    return `<span class="guess-tile guess-${typeStatus[i]}" style="border-color:${t ? t.color : ""}">${esc(t ? t.zh : "?")}</span>`;
  }).join("");
  const typePadded = typeCells + (sp.types.length < 2 ? `<span class="guess-tile guess-empty">—</span>` : "");

  const dexHit = sp.dex === target.dex;
  const dexArrow = dexHit ? "✓" : (sp.dex < target.dex ? "↑" : "↓");
  const dexCls = dexHit ? "green" : "gray";

  const gStage = guessEvoStage(sp), tStage = guessEvoStage(target);
  const stageDiff = Math.abs(gStage - tStage);
  const stageCls = gStage === tStage ? "green" : (stageDiff === 1 ? "yellow" : "gray");
  const stageHint = gStage === tStage ? "" : (gStage < tStage ? ` (答案更高)` : ` (答案更低)`);

  const hHit = Math.abs(sp.height - target.height) < 0.01;
  const hArrow = hHit ? "✓" : (sp.height < target.height ? "↑" : "↓");
  const wHit = Math.abs(sp.weight - target.weight) < 0.01;
  const wArrow = wHit ? "✓" : (sp.weight < target.weight ? "↑" : "↓");

  const gEggs = sp.eggGroups || [], tEggs = target.eggGroups || [];
  const eggInter = gEggs.filter(g => tEggs.includes(g));
  const eggCls = eggInter.length === tEggs.length && eggInter.length === gEggs.length ? "green" : (eggInter.length ? "yellow" : "gray");

  const gAbils = (sp.abilities || []).concat(sp.hidden || []);
  const tAbils = (target.abilities || []).concat(target.hidden || []);
  const abilInter = gAbils.filter(a => tAbils.includes(a));
  const abilCls = abilInter.length === tAbils.length && abilInter.length === gAbils.length ? "green" : (abilInter.length ? "yellow" : "gray");
  const abilText = abilInter.length + "/" + tAbils.length;

  return `<div class="guess-row">
    <div class="guess-cell guess-name">${esc(sp.zh)}</div>
    <div class="guess-cell guess-types">${typePadded}</div>
    <div class="guess-cell guess-${dexCls}">${dexArrow} ${sp.dex}</div>
    <div class="guess-cell guess-${stageCls}">${GUESS_STAGE_ZH[gStage] || gStage}${stageHint}</div>
    <div class="guess-cell guess-${hHit ? "green" : "gray"}">${hArrow} ${sp.height}m</div>
    <div class="guess-cell guess-${wHit ? "green" : "gray"}">${wArrow} ${sp.weight}kg</div>
    <div class="guess-cell guess-${eggCls}">${esc(gEggs.join("/"))}</div>
    <div class="guess-cell guess-${abilCls}">${abilText}</div>
  </div>`;
}

function renderGuess() {
  const dk = dailyDateKey();
  guessTarget = guessDailyTarget();
  guessState = guessLoadState(dk);
  const t = guessTarget;
  const solved = guessState.solved;
  const failed = !solved && guessState.guesses.length >= GUESS_MAX;
  const gameOver = solved || failed;

  const rowsHtml = guessState.guesses.map(id => {
    const sp = SPECIES_BY_ID[id];
    return sp ? guessRenderRow(sp, t) : "";
  }).join("");

  let resultHtml = "";
  if (solved) {
    resultHtml = `<div class="guess-result win">
      <div class="guess-result-icon">🎉</div>
      <div class="guess-result-text">猜对了！今天的答案是 <b>${esc(t.zh)}</b>（第 ${guessState.guesses.length} 次猜中）</div>
      <a class="guess-result-link" href="#/p/${t.id}">查看图鉴 →</a>
    </div>`;
  } else if (failed) {
    resultHtml = `<div class="guess-result lose">
      <div class="guess-result-icon">😅</div>
      <div class="guess-result-text">机会用完了！今天的答案是 <b>${esc(t.zh)}</b></div>
      <a class="guess-result-link" href="#/p/${t.id}">查看图鉴 →</a>
    </div>`;
  }

  let inputHtml = "";
  if (!gameOver) {
    inputHtml = `<div class="guess-input-area">
      <div class="search-box guess-search">
        <span>🔍</span>
        <input id="guess-input" placeholder="输入宝可梦名称…" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button type="button" class="search-clear hidden" title="清除" onclick="clearSearch('guess-input')">✕</button>
      </div>
      <button id="guess-submit" class="guess-submit" type="button" onclick="guessSubmit()">猜！</button>
      <div id="guess-suggest" class="guess-suggest hidden"></div>
    </div>`;
  }

  const remain = GUESS_MAX - guessState.guesses.length;
  const remainText = gameOver ? "" : `<div class="guess-remain">剩余 <b>${remain}</b> 次机会</div>`;

  app.innerHTML = `<div class="guess-page">
    <div class="page-title">猜猜我是谁？</div>
    <div class="page-sub">每天一只神秘宝可梦，靠线索把它找出来！绿色=完全命中，黄色=部分命中，灰色=未命中。↑表示答案更大/更重/更高，↓表示更小/更轻/更矮。</div>
    ${resultHtml}
    ${remainText}
    ${inputHtml}
    <div class="guess-table-wrap">
      <div class="guess-table">
        <div class="guess-row guess-header">
          <div class="guess-cell">猜测</div>
          <div class="guess-cell">属性</div>
          <div class="guess-cell">编号</div>
          <div class="guess-cell">进化</div>
          <div class="guess-cell">身高</div>
          <div class="guess-cell">体重</div>
          <div class="guess-cell">蛋组</div>
          <div class="guess-cell">特性</div>
        </div>
        ${rowsHtml}
      </div>
    </div>
  </div>`;

  if (!gameOver) {
    const inp = $("#guess-input");
    inp.addEventListener("input", guessOnInput);
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); guessSubmit(); }
    });
    inp.focus();
  }
}

function guessOnInput(e) {
  const v = toHans(e.target.value.trim()).toLowerCase();
  const sug = $("#guess-suggest");
  if (!v) { sug.classList.add("hidden"); sug.innerHTML = ""; return; }
  const matches = [];
  for (const s of DEX_SEQ) {
    if (s.dex <= 0 || !s.isDefault) continue;
    if (s.zh.toLowerCase().includes(v) || String(s.dex) === v) {
      matches.push(s);
      if (matches.length >= 10) break;
    }
  }
  if (!matches.length) { sug.classList.add("hidden"); return; }
  sug.classList.remove("hidden");
  sug.innerHTML = matches.map(s => `<div class="guess-sug-item" onclick="guessPick(${s.id})">${esc(s.zh)} <span class="guess-sug-dex">#${s.dex}</span></div>`).join("");
}
window.guessPick = function (id) {
  const s = SPECIES_BY_ID[id];
  if (!s) return;
  const inp = $("#guess-input");
  if (!inp) return;
  inp.value = s.zh;
  $("#guess-suggest").classList.add("hidden");
  guessSubmit();
};
function guessSubmit() {
  const inp = $("#guess-input");
  if (!inp) return;
  const raw = toHans(inp.value.trim());
  if (!raw) return;
  let match = null;
  for (const s of D.species) {
    if (s.zh === raw && s.dex > 0) { match = s; if (s.isDefault) break; }
  }
  if (!match || guessState.guesses.includes(match.id)) {
    inp.classList.add("guess-input-error");
    setTimeout(() => inp.classList.remove("guess-input-error"), 600);
    return;
  }
  guessState.guesses.push(match.id);
  if (match.id === guessTarget.id) guessState.solved = true;
  guessSaveState(dailyDateKey(), guessState);
  renderGuess();
}
window.guessSubmit = guessSubmit;

/* ---------------- 抽卡模拟器 ----------------
   五阶稀有度: N(60%) R(30%) SR(8%) UR(1.5%) EX(0.5%), 每天免费 3 次.
   特性从该宝可梦特性随机选, 招式从招式池随机选最多 4 个 (超级进化宝可梦必出超级进化招式).
   抽到的卡牌带专属标识 "★ 抽卡获得 · 稀有度", 可下载图片, 存入收集册 localStorage.
   图鉴联动: 抽到钻石卡/彩卡的宝可梦在首页名字变钻石/彩虹字. */
const GACHA_FREE_DAILY = 10;
const GACHA_RARITIES = [
  { key: "N",  label: "N卡",  icon: "⚪", prob: 0.60,  style: "normal",  glow: null },
  { key: "R",  label: "R卡",  icon: "🔵", prob: 0.30,  style: "holo",    glow: "#3d7dca" },
  { key: "SR", label: "SR卡", icon: "🟡", prob: 0.08,  style: "gold",    glow: "#FFD700" },
  { key: "UR", label: "UR卡", icon: "🌈", prob: 0.015, style: "rainbow", glow: "rainbow" },
  { key: "EX", label: "EX卡", icon: "💎", prob: 0.005, style: "diamond", glow: "#ffffff" },
];
const GACHA_ALBUM_KEY = "pkdx_gacha_album";
let gachaCurrent = null;

function gachaRandomRarity() {
  const r = Math.random();
  let acc = 0;
  for (const rar of GACHA_RARITIES) { acc += rar.prob; if (r < acc) return rar; }
  return GACHA_RARITIES[0];
}
function gachaRarityForSpecies(s) {
  let maxBst = statTotal(s);
  for (const eid of (evoAdj[s.id] || [])) {
    const t = SPECIES_BY_ID[eid];
    if (t && (t.formKind === "mega" || t.formKind === "giga" || t.formKind === "awaken")) {
      const bst = statTotal(t);
      if (bst > maxBst) maxBst = bst;
    }
  }
  if (maxBst >= 680) return "EX";
  if (maxBst >= 580) return "UR";
  if (maxBst >= 480) return "SR";
  if (maxBst >= 380) return "R";
  return "N";
}
function gachaBestFormId(s) {
  let bestId = s.id, bestBst = statTotal(s);
  for (const eid of (evoAdj[s.id] || [])) {
    const t = SPECIES_BY_ID[eid];
    if (t && (t.formKind === "mega" || t.formKind === "giga" || t.formKind === "awaken")) {
      const bst = statTotal(t);
      if (bst > bestBst) { bestBst = bst; bestId = eid; }
    }
  }
  return bestId;
}
function gachaRandomSpecies() {
  const pool = DEX_SEQ.filter(s => s.dex > 0 && s.isDefault);
  return pool[Math.floor(Math.random() * pool.length)];
}
function gachaRandomAbility(s) {
  const all = s.abilities.concat(s.hidden);
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}
const GACHA_ABILITY_TYPE_EN = {
  OVERGROW: "GRASS", BLAZE: "FIRE", TORRENT: "WATER", SWARM: "BUG",
  DRIZZLE: "WATER", DROUGHT: "FIRE", SNOWWARNING: "ICE", SANDSTREAM: "ROCK",
  SWIFTSWIM: "WATER", CHLOROPHYLL: "GRASS", SLUSHRUSH: "ICE", SANDRUSH: "GROUND",
  WATERABSORB: "WATER", VOLTABSORB: "ELECTRIC", FLASHFIRE: "FIRE",
  AERILATE: "FLYING", PIXILATE: "FAIRY", GALVANIZE: "ELECTRIC", REFRIGERATE: "ICE",
  IRONFIST: "FIGHTING", SHARPNESS: "STEEL", POISONTOUCH: "POISON",
  LEAFGUARD: "GRASS", FLOWERGIFT: "GRASS",
};
const GACHA_MOVE_COMBOS = [
  [["SUNNYDAY", "RAINDANCE", "SANDSTORM", "HAIL", "CHILLYRECEPTION"], ["WEATHERBALL"]],
  [["HYPNOSIS", "SING", "SLEEPPOWDER", "SPORE", "YAWN"], ["SLEEPTALK", "SNORE", "DREAMEATER"]],
  [["SUBSTITUTE"], ["REVERSAL", "FLAIL", "FOCUSPUNCH"]],
  [["BELLYDRUM"], ["REVERSAL", "FLAIL", "SHELLSMASH"]],
  [["CURSE"], ["PAYBACK"]],
  [["STOCKPILE"], ["SPITOUT", "SWALLOW"]],
  [["TAILWIND"], ["ACROBATICS"]],
  [["TRICKROOM"], ["LOWKICK", "GRASSKNOT"]],
];
function gachaHasStab(s, moves) {
  return moves.some(mid => { const m = MOVE_BY_ID[mid]; return m && m.power > 1 && s.types.includes(m.type); });
}
function gachaHasAbilityCombo(s, moves, abilityId) {
  if (!abilityId) return false;
  const abil = ABIL_BY_ID[abilityId];
  if (!abil || !abil.en) return false;
  const typeEn = GACHA_ABILITY_TYPE_EN[abil.en];
  if (!typeEn) return false;
  const type = D.types.find(t => t.en === typeEn);
  if (!type) return false;
  return moves.some(mid => { const m = MOVE_BY_ID[mid]; return m && m.power > 1 && m.type === type.id; });
}
function gachaHasMoveCombo(moves) {
  const ens = new Set(moves.map(mid => MOVE_BY_ID[mid] && MOVE_BY_ID[mid].en).filter(Boolean));
  return GACHA_MOVE_COMBOS.some(([as, bs]) => ens.some(e => as.includes(e)) && ens.some(e => bs.includes(e)));
}
function gachaMovesOk(s, moves, abilityId) {
  return gachaHasStab(s, moves) || gachaHasAbilityCombo(s, moves, abilityId) || gachaHasMoveCombo(moves);
}
function gachaRandomMoves(s, abilityId) {
  const pool = cmMovepool(s);
  const megaMap = MEGA_MOVE_MAP[s.id] || {};
  const megaKeys = Object.keys(megaMap).map(Number);
  const moves = [];
  if (megaKeys.length) moves.push(megaKeys[Math.floor(Math.random() * megaKeys.length)]);
  const rest = pool.filter(p => !moves.includes(p.mid)).sort(() => Math.random() - 0.5);
  for (const p of rest) { if (moves.length >= 4) break; moves.push(p.mid); }
  if (!gachaMovesOk(s, moves, abilityId)) {
    for (const p of pool) {
      if (moves.includes(p.mid)) continue;
      const test = moves.slice(0, -1); test.push(p.mid);
      if (gachaMovesOk(s, test, abilityId)) { moves[moves.length - 1] = p.mid; break; }
    }
  }
  return moves;
}
function gachaDrawCount() { return parseInt(localStorage.getItem("pkdx_gacha_" + dailyDateKey()) || "0"); }
function gachaIncrDrawCount() { localStorage.setItem("pkdx_gacha_" + dailyDateKey(), String(gachaDrawCount() + 1)); }
function gachaLoadAlbum() { try { return JSON.parse(localStorage.getItem(GACHA_ALBUM_KEY) || "[]"); } catch (e) { return []; } }
function gachaSaveAlbum(a) { localStorage.setItem(GACHA_ALBUM_KEY, JSON.stringify(a)); }
const GACHA_REFUND = { N: 1, R: 1, SR: 1, UR: 3, EX: 5 };
function gachaAlbumMatchDex(id) {
  const sp = SPECIES_BY_ID[id], dex = sp ? sp.dex : -1;
  return gachaLoadAlbum().filter(c => { const cs = SPECIES_BY_ID[c.id]; return cs && cs.dex === dex; });
}
function gachaHasDiamond(id) { return gachaAlbumMatchDex(id).some(c => c.style === "diamond"); }
function gachaHasRainbow(id) { return gachaAlbumMatchDex(id).some(c => c.style === "rainbow"); }
function gachaBestRarity(id) {
  const cards = gachaAlbumMatchDex(id);
  if (!cards.length) return null;
  const order = { EX: 4, UR: 3, SR: 2, R: 1, N: 0 };
  let best = null;
  for (const c of cards) { if (!best || (order[c.rarity] || 0) > (order[best] || 0)) best = c.rarity; }
  return best;
}

function gachaDrawToCanvas(canvas, spId, style, label, abilityId, moveIds) {
  const saved = { sp: cardState.sp, ability: cardState.ability, moves: cardState.moves, shiny: cardState.shiny, style: cardState.style, label: cardState.label, customAbility: cardState.customAbility, customMoves: cardState.customMoves };
  cardState.sp = spId; cardState.ability = abilityId; cardState.moves = moveIds.slice(0, 4);
  cardState.shiny = false; cardState.customAbility = null; cardState.customMoves = [];
  cardState.style = style; cardState.label = label;
  const d = cmCardData();
  const ctx = canvas.getContext("2d");
  ctx.setTransform(CARD_SCALE, 0, 0, CARD_SCALE, 0, 0);
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  cmDrawBase(ctx, d, null);
  const p = cmLoadArt(spId).then(bmp => { if (bmp) cmDrawSprite(ctx, d, bmp); }).catch(() => {});
  Object.assign(cardState, saved);
  return p;
}

function gachaParticles(type) {
  const overlay = document.createElement("div");
  overlay.className = "gacha-particles";
  const cv = document.createElement("canvas");
  cv.width = innerWidth; cv.height = innerHeight;
  overlay.appendChild(cv);
  document.body.appendChild(overlay);
  const ctx = cv.getContext("2d");
  const colors = type === "ex" ? ["#e0f2fe", "#ffffff", "#94a3b8"] : ["#ff0080", "#ffa500", "#00ff00", "#0080ff", "#8000ff"];
  const particles = [];
  for (let i = 0; i < 80; i++) particles.push({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
    vy: 1 + Math.random() * 3, vx: (Math.random() - 0.5) * 2,
    size: 3 + Math.random() * 7, rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.1,
    color: colors[Math.floor(Math.random() * colors.length)],
  });
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    particles.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.rot += p.vrot;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    if (++frame < 180) requestAnimationFrame(tick); else overlay.remove();
  })();
}
function gachaLegendText(rarity) {
  const el = document.createElement("div");
  el.className = "gacha-legend-text " + rarity.toLowerCase();
  el.textContent = rarity === "EX" ? "✨ 钻石降临 ✨" : "✨ 传说降临 ✨";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function renderGacha() {
  const remain = GACHA_FREE_DAILY - gachaDrawCount();
  const c = gachaCurrent;
  const revealed = c && c.revealed;
  let stageHtml = "";
  if (c) {
    const rar = GACHA_RARITIES.find(r => r.key === c.rarity);
    const glow = rar.glow === "rainbow"
      ? "box-shadow: 0 0 30px #ff0080, 0 0 60px #00ff00, 0 0 90px #0080ff;"
      : rar.glow ? `box-shadow: 0 0 30px ${rar.glow};` : "";
    stageHtml = `<div class="gacha-stage">
      <div class="gacha-card-3d ${revealed ? "flipped" : ""}" ${revealed ? "" : 'onclick="gachaReveal()"'}>
        <div class="gacha-card-inner">
          <div class="gacha-face gacha-back" style="${glow}">
            <div class="gacha-ball"></div>
            <div class="gacha-back-hint">点击翻开</div>
          </div>
          <div class="gacha-face gacha-front">
            <canvas id="gacha-canvas" width="${CARD_W * CARD_SCALE}" height="${CARD_H * CARD_SCALE}"></canvas>
          </div>
        </div>
      </div>
    </div>`;
    if (revealed) stageHtml += `<div class="gacha-result-info">
      <span class="gacha-rarity gacha-rarity-${rar.key}">${rar.icon} ${rar.label}</span>
      <span class="gacha-mon-name">${esc(speciesName(SPECIES_BY_ID[c.spId]))}</span>
      <button type="button" class="cm-btn" onclick="gachaDownload()">⬇ 保存图片</button>
      <button type="button" class="cm-btn ghost" onclick="gachaViewInDex()">查看图鉴</button>
      ${remain > 0 ? '<button type="button" class="cm-btn" onclick="gachaAgain()">再抽一次</button>' : '<button type="button" class="cm-btn ghost" onclick="location.hash=\'#/album\'">查看卡包</button>'}
    </div>`;
  } else {
    stageHtml = `<div class="gacha-stage-idle">
      <div class="gacha-pack ${remain > 0 ? "" : "disabled"}" ${remain > 0 ? 'onclick="gachaDraw()"' : ""}>
        <div class="gacha-ball"></div>
        <div class="gacha-pack-label">${remain > 0 ? `单抽 (剩余 ${remain} 次)` : "今日次数已用完"}</div>
      </div>
    </div>`;
  }
  app.innerHTML = `<div class="gacha-page">
    <div class="page-title">抽卡模拟器</div>
    <div class="page-sub">每天 ${GACHA_FREE_DAILY} 次免费抽卡，稀有度按种族值判定：💎EX(≥680) 🌈UR(≥580或超进化/超极巨/觉醒) 🟡SR(≥480) 🔵R(≥380) ⚪N(&lt;380)。UR/EX触发全屏特效！</div>
    <div class="gacha-remain">今日剩余 <b>${Math.max(0, remain)}</b> 次 · <a href="#/album">我的卡包 (${gachaLoadAlbum().length})</a></div>
    ${stageHtml}
    ${remain <= 0 && !c ? '<div class="gacha-out">今天的机会用完了，明天再来吧！</div>' : ""}
  </div>`;
  if (c && revealed) {
    const cv = $("#gacha-canvas");
    if (cv) gachaDrawToCanvas(cv, c.spId, c.style, c.label, c.abilityId, c.moveIds);
  }
}
window.gachaDraw = function () {
  if (gachaDrawCount() >= GACHA_FREE_DAILY) return;
  const s = gachaRandomSpecies();
  const formId = gachaBestFormId(s);
  const formSp = SPECIES_BY_ID[formId];
  const rar = GACHA_RARITIES.find(r => r.key === gachaRarityForSpecies(s));
  const abilityId = gachaRandomAbility(formSp);
  gachaCurrent = { spId: formId, rarity: rar.key, style: rar.style, label: "★ 抽卡获得 · " + rar.label, abilityId, moveIds: gachaRandomMoves(formSp, abilityId), revealed: false };
  gachaIncrDrawCount();
  renderGacha();
};
window.gachaReveal = function () {
  if (!gachaCurrent || gachaCurrent.revealed) return;
  gachaCurrent.revealed = true;
  const rar = GACHA_RARITIES.find(r => r.key === gachaCurrent.rarity);
  const album = gachaLoadAlbum();
  album.push({ id: gachaCurrent.spId, rarity: gachaCurrent.rarity, style: gachaCurrent.style, ts: Date.now(), abilityId: gachaCurrent.abilityId, moveIds: gachaCurrent.moveIds });
  gachaSaveAlbum(album);
  renderGacha();
  if (rar.key === "UR" || rar.key === "EX") {
    gachaParticles(rar.key === "EX" ? "ex" : "ur");
    gachaLegendText(rar.key);
    if (navigator.vibrate) navigator.vibrate(rar.key === "EX" ? 200 : 100);
  }
};
window.gachaDownload = function () {
  if (!gachaCurrent) return;
  const c = gachaCurrent;
  const cv = document.createElement("canvas");
  cv.width = CARD_W * CARD_SCALE; cv.height = CARD_H * CARD_SCALE;
  gachaDrawToCanvas(cv, c.spId, c.style, c.label, c.abilityId, c.moveIds).then(() => {
    cv.toBlob(b => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${speciesName(SPECIES_BY_ID[c.spId])}_${c.rarity}卡.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  });
};
window.gachaViewInDex = function () { if (gachaCurrent) location.hash = "#/p/" + gachaCurrent.spId; };
window.gachaAgain = function () { gachaCurrent = null; renderGacha(); };
function gachaSeededRand(seed) {
  let s = seed % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function gachaCardAbility(s, stored) {
  if (stored != null) return stored;
  const rng = gachaSeededRand(s.id * 1000 + 3);
  const all = s.abilities.concat(s.hidden);
  return all.length ? all[Math.floor(rng() * all.length)] : null;
}
function gachaCardMoves(s, stored) {
  if (stored && stored.length) return stored;
  const rng = gachaSeededRand(s.id * 1000 + 7);
  const pool = cmMovepool(s);
  const megaMap = MEGA_MOVE_MAP[s.id] || {};
  const megaKeys = Object.keys(megaMap).map(Number);
  const moves = [];
  if (megaKeys.length) moves.push(megaKeys[Math.floor(rng() * megaKeys.length)]);
  const rest = pool.filter(p => !moves.includes(p.mid));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (const p of rest) { if (moves.length >= 4) break; moves.push(p.mid); }
  return moves;
}

function renderAlbum() {
  const album = gachaLoadAlbum();
  const grouped = {};
  album.forEach(c => { const k = c.id + "_" + c.style; grouped[k] = (grouped[k] || 0) + 1; });
  const rarityOrder = { EX: 0, UR: 1, SR: 2, R: 3, N: 4 };
  const items = Object.entries(grouped).map(([key, count]) => {
    const [idStr, style] = key.split("_");
    const s = SPECIES_BY_ID[parseInt(idStr)];
    if (!s) return null;
    const rar = GACHA_RARITIES.find(r => r.style === style);
    return { s, style, rarity: rar ? rar.key : "N", count, id: parseInt(idStr) };
  }).filter(Boolean).sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity] || a.s.dex - b.s.dex);
  const gridHtml = items.length ? items.map((it, i) => {
    const rar = GACHA_RARITIES.find(r => r.key === it.rarity);
    return `<div class="album-card album-${it.style}" onclick="gachaAlbumPopup(${it.id},'${it.style}','${it.rarity}')">
      <canvas id="album-cv-${i}" width="${CARD_W * CARD_SCALE}" height="${CARD_H * CARD_SCALE}"></canvas>
      <div class="album-rarity">${rar.icon} ${rar.label}${it.count > 1 ? ` ×${it.count}` : ""}</div>
    </div>`;
  }).join("") : '<div class="cm-empty">还没有抽到任何卡牌，去<a href="#/gacha">抽卡</a>吧！</div>';
  app.innerHTML = `<div class="gacha-page">
    <div class="page-title">我的卡包</div>
    <div class="page-sub">已收集 ${album.length} 张卡牌，${items.length} 种不同卡面 · 点击卡牌放大查看</div>
    <div class="album-grid">${gridHtml}</div>
  </div>`;
  items.forEach((it, i) => {
    const cv = $("#album-cv-" + i);
    if (!cv) return;
    const card = album.find(c => c.id === it.id && c.style === it.style);
    const abilityId = gachaCardAbility(it.s, card ? card.abilityId : null);
    const moveIds = gachaCardMoves(it.s, card ? card.moveIds : null);
    const rar = GACHA_RARITIES.find(r => r.key === it.rarity);
    gachaDrawToCanvas(cv, it.id, it.style, "★ 抽卡获得 · " + rar.label, abilityId, moveIds);
  });
}
window.gachaAlbumPopup = function (spId, style, rarity) {
  const s = SPECIES_BY_ID[spId];
  if (!s) return;
  const album = gachaLoadAlbum();
  const card = album.find(c => c.id === spId && c.style === style);
  const rar = GACHA_RARITIES.find(r => r.key === rarity);
  const abilityId = gachaCardAbility(s, card ? card.abilityId : null);
  const moveIds = gachaCardMoves(s, card ? card.moveIds : null);
  const label = "★ 抽卡获得 · " + rar.label;
  const mask = document.createElement("div");
  mask.className = "album-popup-mask";
  mask.innerHTML = `<div class="album-popup">
    <button class="album-popup-close" onclick="this.closest('.album-popup-mask').remove()">✕</button>
    <canvas id="album-popup-canvas" width="${CARD_W * CARD_SCALE}" height="${CARD_H * CARD_SCALE}"></canvas>
    <div class="album-popup-info">
      <span class="gacha-rarity gacha-rarity-${rarity}">${rar.icon} ${rar.label}</span>
      <button type="button" class="cm-btn" onclick="gachaAlbumDownload(${spId},'${style}','${rarity}')">⬇ 保存图片</button>
      <button type="button" class="cm-btn ghost" onclick="location.hash='#/p/${spId}'">查看图鉴</button>
      <button type="button" class="cm-btn ghost" style="color:#d9534f" onclick="gachaAlbumDelete(${spId},'${style}','${rarity}')">🗑 删除（返还 ${GACHA_REFUND[rarity] || 1} 次）</button>
    </div>
  </div>`;
  document.body.appendChild(mask);
  mask.addEventListener("click", e => { if (e.target === mask) mask.remove(); });
  gachaDrawToCanvas(mask.querySelector("#album-popup-canvas"), spId, style, label, abilityId, moveIds);
};
window.gachaAlbumDelete = function (spId, style, rarity) {
  const album = gachaLoadAlbum();
  const idx = album.findIndex(c => c.id === spId && c.style === style);
  if (idx < 0) return;
  album.splice(idx, 1);
  gachaSaveAlbum(album);
  const refund = GACHA_REFUND[rarity] || 1;
  const key = "pkdx_gacha_" + dailyDateKey();
  localStorage.setItem(key, String(Math.max(0, parseInt(localStorage.getItem(key) || "0") - refund)));
  const mask = document.querySelector(".album-popup-mask");
  if (mask) mask.remove();
  renderAlbum();
};
window.gachaAlbumDownload = function (spId, style, rarity) {
  const s = SPECIES_BY_ID[spId];
  if (!s) return;
  const album = gachaLoadAlbum();
  const card = album.find(c => c.id === spId && c.style === style);
  const rar = GACHA_RARITIES.find(r => r.key === rarity);
  const abilityId = gachaCardAbility(s, card ? card.abilityId : null);
  const moveIds = gachaCardMoves(s, card ? card.moveIds : null);
  const label = "★ 抽卡获得 · " + rar.label;
  const cv = document.createElement("canvas");
  cv.width = CARD_W * CARD_SCALE; cv.height = CARD_H * CARD_SCALE;
  gachaDrawToCanvas(cv, spId, style, label, abilityId, moveIds).then(() => {
    cv.toBlob(b => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${speciesName(s)}_${rarity}卡.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  });
};

/* ---------------- 存档导出/导入 ----------------
   收集所有 pkdx_ 前缀的 localStorage (收藏/主题/语言/图鉴视图/抽卡收集册/猜猜记录/每日弹窗等),
   导出为 Base64 文本或下载 .json, 导入时写回 localStorage 实现跨设备同步. */
function syncCollect() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SYNC_PREFIX)) data[k] = localStorage.getItem(k);
  }
  return data;
}
function syncExportB64() {
  const json = JSON.stringify({ v: 1, ts: Date.now(), data: syncCollect() });
  return btoa(unescape(encodeURIComponent(json)));
}
function syncImportB64(b64) {
  const json = decodeURIComponent(escape(atob(b64.trim())));
  const obj = JSON.parse(json);
  if (!obj || !obj.data || typeof obj.data !== "object") throw new Error("存档格式无效");
  let cnt = 0;
  for (const [k, v] of Object.entries(obj.data)) {
    if (k.startsWith(SYNC_PREFIX)) { localStorage.setItem(k, v); cnt++; }
  }
  return cnt;
}
function renderSync() {
  const data = syncCollect();
  const keys = Object.keys(data);
  const summary = [
    { k: "pkdx_favs", label: "收藏" },
    { k: "pkdx_gacha_album", label: "抽卡收集册" },
    { k: "pkdx_home_boxes", label: "HOME盒子" },
    { k: "pkdx_breed_form", label: "培养屋配置" },
    { k: "pkdx_theme", label: "主题" },
    { k: "pkdx_lang", label: "语言" },
    { k: "pkdx_dex_view", label: "图鉴视图" },
  ];
  const sumHtml = summary.map(s => {
    const v = data[s.k];
    let detail = "";
    if (s.k === "pkdx_favs" && v) detail = `${JSON.parse(v).length} 只`;
    else if (s.k === "pkdx_gacha_album" && v) detail = `${JSON.parse(v).length} 张卡`;
    else if (s.k === "pkdx_home_boxes" && v) detail = `${JSON.parse(v).boxes.flat().filter(Boolean).length} 只`;
    else if (s.k === "pkdx_breed_form" && v) detail = SPECIES_BY_ID[JSON.parse(v).sp] ? esc(speciesName(SPECIES_BY_ID[JSON.parse(v).sp])) : "已保存";
    else if (v) detail = v === "hant" ? "繁体" : v === "hans" ? "简体" : v;
    return `<div class="sync-item"><span class="sync-item-label">${s.label}</span><span class="sync-item-val">${detail || "未设置"}</span></div>`;
  }).join("");
  const guessKeys = keys.filter(k => k.startsWith("pkdx_guess_"));
  const gachaKeys = keys.filter(k => k.startsWith("pkdx_gacha_") && k !== "pkdx_gacha_album");
  app.innerHTML = `<div class="sync-page">
    <div class="page-title">存档同步</div>
    <div class="page-sub">导出收藏、抽卡收集册、主题等所有本地数据，发给朋友或在另一台设备导入即可同步。数据仅存于浏览器本地，不会上传服务器。</div>
    <div class="sync-section">
      <div class="sync-section-title">当前存档内容</div>
      <div class="sync-summary">${sumHtml}</div>
      <div class="sync-extra">猜猜记录: ${guessKeys.length} 天 · 抽卡次数记录: ${gachaKeys.length} 天 · 共 ${keys.length} 项</div>
    </div>
    <div class="sync-section">
      <div class="sync-section-title">导出存档</div>
      <div class="sync-actions">
        <button type="button" class="cm-btn" onclick="syncDownload()">⬇ 下载 .json 文件</button>
        <button type="button" class="cm-btn ghost" onclick="syncCopyB64()">📋 复制 Base64 码</button>
      </div>
      <textarea id="sync-export-box" class="sync-textarea" readonly rows="4" placeholder="点击上方按钮生成存档码…"></textarea>
    </div>
    <div class="sync-section">
      <div class="sync-section-title">导入存档</div>
      <div class="sync-actions">
        <label class="cm-btn ghost" for="sync-file-input">📁 选择 .json 文件</label>
        <input id="sync-file-input" type="file" accept=".json,application/json" class="hidden" onchange="syncUploadFile(event)">
        <button type="button" class="cm-btn" onclick="syncImportFromBox()">从文本框导入</button>
      </div>
      <textarea id="sync-import-box" class="sync-textarea" rows="4" placeholder="粘贴 Base64 存档码或 JSON 文本…"></textarea>
      <div id="sync-msg" class="sync-msg"></div>
    </div>
  </div>`;
}
window.syncDownload = function () {
  const payload = JSON.stringify({ v: 1, ts: Date.now(), data: syncCollect() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pokedex_save_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  syncShowMsg("已下载存档文件", "ok");
};
window.syncCopyB64 = function () {
  const b64 = syncExportB64();
  const box = $("#sync-export-box");
  if (box) box.value = b64;
  navigator.clipboard?.writeText(b64).then(() => syncShowMsg("已复制到剪贴板", "ok")).catch(() => syncShowMsg("已生成在文本框中，请手动复制", "ok"));
};
window.syncImportFromBox = function () {
  const box = $("#sync-import-box");
  if (!box || !box.value.trim()) return syncShowMsg("请先粘贴存档码", "err");
  try {
    const raw = box.value.trim();
    let cnt;
    if (raw.startsWith("{")) {
      const obj = JSON.parse(raw);
      if (!obj || !obj.data) throw new Error("格式无效");
      cnt = 0;
      for (const [k, v] of Object.entries(obj.data)) { if (k.startsWith(SYNC_PREFIX)) { localStorage.setItem(k, v); cnt++; } }
    } else {
      cnt = syncImportB64(raw);
    }
    syncShowMsg(`导入成功！已恢复 ${cnt} 项数据，刷新页面生效`, "ok");
  } catch (e) { syncShowMsg("导入失败：" + e.message, "err"); }
};
window.syncUploadFile = function (e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const box = $("#sync-import-box");
    if (box) box.value = r.result;
    try {
      const obj = JSON.parse(r.result);
      if (!obj || !obj.data) throw new Error("格式无效");
      let cnt = 0;
      for (const [k, v] of Object.entries(obj.data)) { if (k.startsWith(SYNC_PREFIX)) { localStorage.setItem(k, v); cnt++; } }
      syncShowMsg(`导入成功！已恢复 ${cnt} 项数据，刷新页面生效`, "ok");
    } catch (err) {
      try { const cnt = syncImportB64(r.result); syncShowMsg(`导入成功！已恢复 ${cnt} 项数据，刷新页面生效`, "ok"); }
      catch (e2) { syncShowMsg("文件格式无效：" + e2.message, "err"); }
    }
  };
  r.readAsText(f);
};
function syncShowMsg(msg, type) {
  const el = $("#sync-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = "sync-msg " + (type || "");
}
