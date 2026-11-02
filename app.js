/* 火红物语图鉴 - 静态图鉴 (数据: data.js → window.PKDX) */
"use strict";
const D = window.PKDX;

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
      s.src = "sprites/" + kind + "/" + id + ".js";
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
function spriteCanvas(kind, id, cls) {
  return `<canvas class="${cls || ""}" data-spr="${kind}" data-id="${id}"></canvas>`;
}
const sprIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    sprIO.unobserve(en.target);
    drawSpriteCanvas(en.target);
  });
}, { rootMargin: "300px" });
function drawSpriteCanvas(cv) {
  const kind = cv.dataset.spr, id = +cv.dataset.id;
  loadSprite(kind, id).then(bmp => {
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
  showPopup(`
    <h2>${esc(m.zh)}</h2>
    <div class="mv-meta">${typePill(t)}${splitBadge(m.split)}
      <span class="pill small" style="background:#5a6b7d">威力 ${m.power || "—"}</span>
      <span class="pill small" style="background:#5a6b7d">命中 ${m.acc || "—"}</span>
      <span class="pill small" style="background:#5a6b7d">PP ${m.pp}</span>
      <span class="pill small" style="background:#5a6b7d">优先度 ${m.priority > 0 ? "+" + m.priority : m.priority}</span>
    </div>
    <div class="mv-desc">${m.desc ? esc(m.desc) : "<i>暂无详细描述</i>"}</div>
    <dl class="kv">
      ${m.target ? `<dt>目标</dt><dd>${esc(m.target)}</dd>` : ""}
    </dl>`);
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
let homeState = { q: "", types: new Set(), form: "" };

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

/* ---------------- 首页 ---------------- */
function monCard(s) {
  return `<div class="mon-card" onclick="location.hash='#/p/${s.id}'">
    ${spriteCanvas("front", s.id)}
    <div class="no">${fmtDex(s.dex)}</div>
    <div class="nm">${esc(s.zh)}</div>
    <div class="types">${typePills(s.types, true)}</div>
    ${s.formLabel ? `<div class="form-badge">${esc(s.formLabel)}</div>` : ""}
  </div>`;
}
window.monCard = monCard;

function renderHome() {
  const chips = TYPES_SHOWN.map(t =>
    `<span class="pill${homeState.types.has(t.id) ? " on" : ""}" style="background:${t.color}"
      onclick="toggleType(${t.id})">${esc(t.zh)}</span>`).join("");
  const formChips = [["", "仅默认形态"], ["all", "全部形态"]]
    .concat(Object.keys(FORM_FILTER).map(k => [k, FORM_KIND_ZH[k]]))
    .map(([v, label]) =>
      `<span class="pill form-chip${homeState.form === v ? " on" : ""}" onclick="setForm('${v}')">${label}</span>`).join("");
  app.innerHTML = `
    <div class="page-title">宝可梦图鉴</div>
    <div class="page-sub">默认形态 ${N_DEFAULT} 只 · 含特殊/地区形态共 ${D.species.length} 只 · 点击卡片查看详情</div>
    <div class="toolbar">
      ${searchBox("q", "搜索名称 / 编号 / 形态，如 阿罗拉、超级进化", homeState.q)}
      <div class="type-chips">${formChips}</div>
      <div class="type-chips">${chips}</div>
      <span class="count-hint" id="cnt"></span>
    </div>
    <div id="dex-area"></div>`;

  $("#q").addEventListener("input", e => { homeState.q = e.target.value.trim(); renderDexArea(); });
  renderDexArea();
}

function matchSpecies(s) {
  const q = homeState.q.toLowerCase();
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
      || (s.tags && s.tags.includes(homeState.q));
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
  const hasDex = list.filter(s => s.dex > 0)
    .sort((a, b) => a.dex - b.dex || (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.id - b.id);
  const others = list.filter(s => !(s.dex > 0)).sort((a, b) => a.id - b.id);
  let html = "";
  if (hasDex.length) {
    html += `<div class="group-h">图鉴宝可梦</div><div class="dex-grid">${hasDex.map(monCard).join("")}</div>`;
  }
  if (others.length) {
    html += `<div class="group-h">其他形态</div><div class="dex-grid">${others.map(monCard).join("")}</div>`;
  }
  if (!html) html = `<div style="text-align:center;color:var(--muted);padding:60px 0">没有找到符合条件的宝可梦</div>`;
  $("#dex-area").innerHTML = html;
  mountSprites($("#dex-area"));
}
window.toggleType = function (tid) {
  if (homeState.types.has(tid)) homeState.types.delete(tid);
  else homeState.types.add(tid);
  document.querySelectorAll(".type-chips .pill:not(.form-chip)").forEach(el => {
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
  // 它的所有走向 (主链进化在前, 超级进化/超极巨化/觉醒形态等在后), 箭头下写方式, 再下一行写条件/道具
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
  const node = (id, ref) => {
    const sp = SPECIES_BY_ID[id];
    return `<div class="evo-node${id === s.id && !ref ? " cur" : ""}" onclick="location.hash='#/p/${id}'">
      ${spriteCanvas("front", id)}
      <div class="nm">${esc(sp.zh)}</div><div class="no">${fmtDex(sp.dex)}</div></div>`;
  };
  const arrow = e => {
    let label = e.methodZh, sub = e.param || "", v;
    if (EVO_MAIN_SKIP[e.method]) {
      if ((v = /^(.*)（(.+)）$/.exec(sub))) { label = v[2]; sub = v[1]; }  // 原始回归/究极爆发写在道具名后的括号里
    } else if ((v = /^([♂♀]?)(使用|携带)(.+)$/.exec(sub)) && label.includes(v[2] + "道具")) {
      label = v[1] + label.replace(v[2] + "道具", v[2] + v[3]);   // 使用道具 + 使用水之石 → 使用水之石
      sub = "";
    } else if ((v = /^学会(.+)$/.exec(sub)) && /学会对应(属性)?招式/.test(label)) {
      label = label.replace(/学会对应(属性)?招式/, "学会" + v[1]);   // → 学会妖精属性招式后升级
      sub = "";
    } else if (sub && label.includes(sub)) {
      sub = "";
    }
    return `<div class="evo-arrow"><span class="arr">→</span>${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</div>`;
  };
  const seen = new Set();
  const branch = id => {
    seen.add(id);
    const kids = (children[id] || []).filter(k => !seen.has(k));
    const rows = kids.map(k => `<div class="evo-row">${arrow(inEdge[k])}${branch(k)}</div>`)
      .concat((leaves[id] || []).map(x => `<div class="evo-row">${arrow(x.e)}<div class="evo-branch">${node(x.to, true)}</div></div>`));
    return `<div class="evo-branch">${node(id)}${rows.length ? `<div class="evo-kids">${rows.join("")}</div>` : ""}</div>`;
  };
  return `<div class="evo-chain">${mainNodes.filter(id => !inEdge[id]).map(branch).join("")}</div>`;
}

function moveRow(mid, lv, tmNo) {
  const m = MOVE_BY_ID[mid];
  if (!m) return "";
  const t = TYPE_BY_ID[m.type] || { zh: "?", color: "#999" };
  return `<tr onclick="showMovePopup(${mid})">
    <td>${lv != null ? `<span class="lv">${lv === 0 ? "进化" : "Lv." + lv}</span>` : (tmNo != null ? `<span class="tm-col-no">${tmNo}</span>` : "")}</td>
    <td class="mv-name">${esc(m.zh)}</td>
    <td>${typePill(t, true)}</td>
    <td>${splitBadge(m.split)}</td>
    <td class="num">${m.power || "—"}</td>
    <td class="num">${m.acc || "—"}</td>
    <td class="num">${m.pp}</td>
  </tr>`;
}

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

  const lvSorted = [...s.levelUp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const tmRows = s.tm.map(mid => moveRow(mid, null, null));
  const tmNames = {};
  D.tms.forEach(t => tmNames[t.move] = tmNames[t.move] || t.label);
  const tutorRows = s.tutor.map(mid => moveRow(mid, null, null));
  const eggRows = s.egg.map(mid => moveRow(mid, null, null));

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
          <table class="move-table"><thead><tr><th>等级</th><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
          <tbody>${lvSorted.map(([lv, mid]) => moveRow(mid, lv, null)).join("") || "<tr><td colspan=7>—</td></tr>"}</tbody></table>
        </div>
        <div id="tab-tm" class="hidden">
          <table class="move-table"><thead><tr><th>编号</th><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
          <tbody>${s.tm.map(mid => moveRow(mid, null, tmNames[mid] || null)).join("") || "<tr><td colspan=7>—</td></tr>"}</tbody></table>
        </div>
        <div id="tab-tutor" class="hidden">
          <table class="move-table"><thead><tr><th></th><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
          <tbody>${tutorRows.join("") || "<tr><td colspan=7>—</td></tr>"}</tbody></table>
        </div>
        <div id="tab-egg" class="hidden">
          <table class="move-table"><thead><tr><th></th><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
          <tbody>${eggRows.join("") || "<tr><td colspan=7>—</td></tr>"}</tbody></table>
        </div>
      </section>
    </div>`;
  mountSprites(app);
}
window.switchTab = function (btn) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b === btn));
  ["lv", "tm", "tutor", "egg"].forEach(k => $("#tab-" + k).classList.toggle("hidden", k !== btn.dataset.tab));
};

/* ---------------- 招式页 ---------------- */
let moveFilter = { q: "", type: "", split: "" };
function renderMoves() {
  const typeOpts = TYPES_SHOWN.map(t => `<option value="${t.id}">${esc(t.zh)}</option>`).join("");
  app.innerHTML = `
    <div class="page-title">招式图鉴</div>
    <div class="page-sub">共 ${D.moves.length} 个招式 · 点击行查看详情</div>
    <div class="toolbar">
      ${searchBox("mq", "搜索招式名…", moveFilter.q)}
      <select id="mtype" class="search-box" style="flex:0 0 140px">
        <option value="">全部属性</option>${typeOpts}
      </select>
      <select id="msplit" class="search-box" style="flex:0 0 120px">
        <option value="">全部分类</option><option>物理</option><option>特殊</option><option>变化</option>
      </select>
      <span class="count-hint" id="mcnt"></span>
    </div>
    <div class="card" style="overflow:auto">
      <table class="list-table">
        <thead><tr><th>招式</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th><th>优先度</th></tr></thead>
        <tbody id="mrows"></tbody>
      </table>
    </div>`;
  $("#mtype").value = moveFilter.type;
  $("#msplit").value = moveFilter.split;
  $("#mq").addEventListener("input", e => { moveFilter.q = e.target.value.trim(); renderMoveRows(); });
  $("#mtype").addEventListener("change", e => { moveFilter.type = e.target.value; renderMoveRows(); });
  $("#msplit").addEventListener("change", e => { moveFilter.split = e.target.value; renderMoveRows(); });
  renderMoveRows();
}
function renderMoveRows() {
  const q = moveFilter.q.toLowerCase();
  const rows = D.moves.filter(m => {
    if (!m.id) return false;
    if (q && !m.zh.toLowerCase().includes(q)) return false;
    if (moveFilter.type !== "" && String(m.type) !== moveFilter.type) return false;
    if (moveFilter.split && m.split !== moveFilter.split) return false;
    return true;
  });
  $("#mcnt").textContent = `${rows.length} 个招式`;
  $("#mrows").innerHTML = rows.map(m => `<tr onclick="showMovePopup(${m.id})">
      <td class="mv-name">${esc(m.zh)}</td>
      <td>${typePill(TYPE_BY_ID[m.type] || { zh: "?", color: "#999" }, true)}</td>
      <td>${splitBadge(m.split)}</td>
      <td class="num">${m.power || "—"}</td>
      <td class="num">${m.acc || "—"}</td>
      <td class="num">${m.pp}</td>
      <td class="num">${m.priority > 0 ? "+" + m.priority : m.priority}</td>
    </tr>`).join("");
}

/* ---------------- 特性页 ---------------- */
let abilFilter = "";
function renderAbilities() {
  app.innerHTML = `
    <div class="page-title">特性图鉴</div>
    <div class="page-sub">共 ${D.abilities.length} 个特性 · 点击查看持有该特性的宝可梦</div>
    <div class="toolbar">
      ${searchBox("aq", "搜索特性名…", abilFilter)}
      <span class="count-hint" id="acnt"></span>
    </div>
    <div class="card" style="overflow:auto">
      <table class="list-table">
        <thead><tr><th style="width:170px">特性</th><th>效果</th></tr></thead>
        <tbody id="arows"></tbody>
      </table>
    </div>`;
  $("#aq").addEventListener("input", e => { abilFilter = e.target.value.trim(); renderAbilRows(); });
  renderAbilRows();
}
function renderAbilRows() {
  const list = D.abilities.filter(a => a.id && (!abilFilter || a.zh.toLowerCase().includes(abilFilter.toLowerCase())));
  $("#acnt").textContent = `${list.length} 个特性`;
  $("#arows").innerHTML = list.map(a => `<tr onclick="showAbilityPopup(${a.id})">
      <td class="mv-name">${esc(a.zh)}</td>
      <td style="color:var(--muted)">${esc(a.desc || "")}</td>
    </tr>`).join("");
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
  route();
} catch (err) {
  app.innerHTML = `<div class="page-title">页面渲染出错</div><pre style="white-space:pre-wrap">${esc(err.stack || err)}</pre>`;
}
