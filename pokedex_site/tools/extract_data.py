# -*- coding: utf-8 -*-
"""
火红 横版物语 图鉴数据提取器
从 CFRU-expansion 与 Dynamic-Pokemon-Expansion-Gen-9 两个仓库的源码
提取宝可梦/招式/特性/属性等数据，生成 pokedex_site/data/data.js 与精灵图
"""
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # CFRU-expansion
DPE = os.path.normpath(os.path.join(ROOT, "..", "Dynamic-Pokemon-Expansion-Gen-9"))
OUT = os.path.join(ROOT, "pokedex_site")
CFRU = ROOT

WARN = []
def warn(msg):
    WARN.append(msg)
    print("[warn]", msg)

# ---------------------------------------------------------------- 基础工具

def read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()

def parse_defines(text, prefix):
    """#define PREFIX_NAME 0xNN / 123 → {NAME: int}"""
    table = {}
    for m in re.finditer(r"#define\s+%s(\w+)\s+(0x[0-9A-Fa-f]+|\d+)\b" % prefix, text):
        table[m.group(1)] = int(m.group(2), 0)
    return table

def parse_hybrid_constants(text, prefix):
    """
    混合结构常量表: #define X 0xNN / enum 内 X = 0xNN, / X, // 0xNN
    prefix 需带下划线, 如 "SPECIES_"
    """
    table = {}
    for m in re.finditer(
        r"(?:#\s*define\s+%s(\w+)\s+(0x[0-9A-Fa-f]+|\d+)\b)"
        r"|(?:^\s*%s(\w+)\s*=\s*(0x[0-9A-Fa-f]+|\d+)\s*,)"
        r"|(?:^\s*%s(\w+),\s*//\s*(?:0x([0-9A-Fa-f]+)|(\d+))\b[^\n]*)$"
        % (prefix, prefix, prefix), text, re.M):
        if m.group(1):
            table[m.group(1)] = int(m.group(2), 0)
        elif m.group(3):
            table[m.group(3)] = int(m.group(4), 0)
        else:
            table[m.group(5)] = int(m.group(6) or m.group(7), 0 if not m.group(6) else 16)
    return table

def pretty_en(const_name, prefix):
    """SPECIES_VENUSAUR_MEGA -> Venusaur Mega（无前缀时原样处理）"""
    if const_name.startswith(prefix):
        const_name = const_name[len(prefix):]
    words = const_name
    out = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", words)
    out = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", out)
    return out.strip()

def balanced_block(text, brace_start):
    """从 '{' 起做花括号配平，返回内部内容与结束位置"""
    depth = 0
    for i in range(brace_start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[brace_start + 1:i], i
    return text[brace_start + 1:], len(text) - 1

def iter_designated_blocks(text, key_re):
    """yield (key, body) for [KEY] = { ... } 块（配平花括号）"""
    for m in re.finditer(key_re, text):
        b = text.index("{", m.end() - 1)
        body, _end = balanced_block(text, b)
        yield m.group(1), body

# ---------------------------------------------------------------- .string 解析

def parse_string_file(path, macros=()):
    """
    解析 .string 文件: #org @LABEL 后跟内容行(直到空行)
    #ifdef X ... [#else ...] #endif 按 macros 是否定义选择分支
    """
    result = {}
    label = None
    buf = []
    scopes = []  # 每层 ifdef 的 keep 标志

    def flush():
        nonlocal label, buf
        if label is not None:
            result.setdefault(label, "".join(buf))
        label, buf = None, []

    for raw in read(path).splitlines():
        line = raw.strip()
        if line.startswith("#ifdef"):
            parts = line.split()
            scopes.append(parts[1] in macros if len(parts) > 1 else False)
            continue
        if line.startswith("#ifndef"):
            parts = line.split()
            scopes.append(parts[1] not in macros if len(parts) > 1 else True)
            continue
        if line.startswith("#else"):
            if scopes:
                scopes[-1] = not scopes[-1]
            continue
        if line.startswith("#endif"):
            if scopes:
                scopes.pop()
            continue
        if line.startswith("#org"):
            flush()
            m = re.match(r"#org\s+@(\w+)", line)
            label = m.group(1) if m else None
            buf = []
            continue
        if not line:
            flush()
            continue
        if line.startswith("#include") or line.startswith("MAX_LENGTH") or line.startswith("FILL_FF"):
            continue
        if label is None or not all(scopes):
            continue
        buf.append(line)
    flush()
    return result

# ---------------------------------------------------------------- 物种常量

cfru_species_h = read(os.path.join(CFRU, "include", "constants", "species.h"))
dpe_species_h = read(os.path.join(DPE, "include", "species.h"))

species_index = parse_hybrid_constants(cfru_species_h, "SPECIES_")
dpe_species_index = parse_defines(dpe_species_h, "SPECIES_")
print("species: CFRU=%d DPE=%d" % (len(species_index), len(dpe_species_index)))
diffs = [n for n in species_index if n in dpe_species_index and species_index[n] != dpe_species_index[n]]
if diffs:
    warn("CFRU/DPE 物种序号不一致(以CFRU为准): %s" % diffs[:8])

def sp_id(name, prefer_dpe=False):
    """物种常量名 → 序号"""
    if prefer_dpe and name in dpe_species_index:
        return dpe_species_index[name]
    if name in species_index:
        return species_index[name]
    if name in dpe_species_index:
        return dpe_species_index[name]
    return None

NUM_SPECIES = max(max(species_index.values()), max(dpe_species_index.values())) + 1
print("NUM_SPECIES =", NUM_SPECIES)

# ---------------------------------------------------------------- 属性

cfru_pokemon_h = read(os.path.join(CFRU, "include", "constants", "pokemon.h"))
type_index = {}
for m in re.finditer(r"#define\s+TYPE_(\w+)\s+(0x[0-9A-Fa-f]+|\d+)\b", cfru_pokemon_h):
    if m.group(1) == "NAME_LENGTH":  # 杂项宏，非属性
        continue
    type_index[m.group(1)] = int(m.group(2), 0)

type_names = parse_string_file(os.path.join(CFRU, "strings", "type_names.string"))
TYPE_LABEL_FALLBACK = {"PSYCHIC": "NAME_PSYCHC", "MYSTERY": "NAME_TYPELESS"}
TYPE_COLOR = {
    "NORMAL": "#9299A1", "FIGHTING": "#CE4069", "FLYING": "#8FA9DE", "POISON": "#AB6AC8",
    "GROUND": "#D97845", "ROCK": "#C5B78C", "BUG": "#90C12D", "GHOST": "#5269AD",
    "STEEL": "#5A8EA2", "FIRE": "#FF9D55", "WATER": "#4D90D5", "GRASS": "#63BC5A",
    "ELECTRIC": "#F4D23C", "PSYCHIC": "#FA7179", "ICE": "#73CEC0", "DRAGON": "#0B6DC3",
    "DARK": "#5A5465", "FAIRY": "#EC8FE6", "MYSTERY": "#68A090", "STELLAR": "#40B5A5",
}
type_list = []
for name, idx in sorted(type_index.items(), key=lambda kv: kv[1]):
    type_list.append({
        "id": idx,
        "en": name,
        "zh": type_names.get(TYPE_LABEL_FALLBACK.get(name, "NAME_" + name)) or type_names.get("NAME_" + name) or pretty_en(name, "TYPE"),
        "color": TYPE_COLOR.get(name, "#8A8A8A"),
        "pseudo": name in ("ROOSTLESS", "BLANK"),
    })
TYPE_ZH = {t["id"]: t["zh"] for t in type_list}
print("types:", len(type_list))

# 属性克制表
mul_map = {"TYPE_MUL_NO_DATA": 0, "TYPE_MUL_NO_EFFECT": 0.0, "TYPE_MUL_NOT_EFFECTIVE": 0.5,
           "TYPE_MUL_NORMAL": 1.0, "TYPE_MUL_SUPER_EFFECTIVE": 2.0}
type_chart = {}
atk_id = None
for line in read(os.path.join(CFRU, "src", "Tables", "type_tables.h")).splitlines():
    s = line.strip()
    m = re.match(r"\[TYPE_(\w+)\]\s*=\s*$", s)
    if m and m.group(1) in type_index:
        atk_id = type_index[m.group(1)]
        type_chart.setdefault(str(atk_id), {})
        continue
    m = re.match(r"\[TYPE_(\w+)\]\s*=\s*(TYPE_MUL_\w+)\s*,", s)
    if m and atk_id is not None and m.group(1) in type_index:
        type_chart[str(atk_id)][str(type_index[m.group(1)])] = mul_map.get(m.group(2), 1.0)

# ---------------------------------------------------------------- 特性

abil_index = parse_hybrid_constants(read(os.path.join(CFRU, "include", "constants", "abilities.h")), "ABILITY_")
abil_names = parse_string_file(os.path.join(CFRU, "strings", "ability_name_table.string"))
abil_name_by_id = {}
for label, text in abil_names.items():
    m = re.match(r"NAME_ABILITY_(\d+)_", label)
    if m:
        abil_name_by_id[int(m.group(1))] = text
abil_descs = parse_string_file(os.path.join(CFRU, "strings", "ability_descriptions.string"))
# 描述按指针表 gAbilityDescriptions (assembly/data/ability_description_table.s) 位置对应特性编号:
# 第 i 项是特性 i 的描述 (每行注释都带常量名, 但部分标签是缩写, 不能按名字匹配)
abil_desc_tbl = read(os.path.join(CFRU, "assembly", "data", "ability_description_table.s"))
# 「连续 #org 无内容」是别名写法: 空标签与文件里下一个有内容的标签共用文本
# (如 DESC_RECEIVER → DESC_POWEROFALCHEMY, DESC_STALWART → DESC_PROPELLERTAIL)
_order = [l for l in abil_descs]
_alias = {}
for i, l in enumerate(_order):
    if not abil_descs.get(l):
        nxt = next((n for n in _order[i + 1:] if abil_descs.get(n)), None)
        if nxt:
            _alias[l] = abil_descs[nxt]
abil_desc_resolved = {l: abil_descs[l] or _alias.get(l, "") for l in abil_descs}
abil_desc_by_id = {}
for i, label in enumerate(re.findall(r"^\s*\.word\s+(\w+)", abil_desc_tbl[abil_desc_tbl.index("gAbilityDescriptions:"):], re.M)):
    abil_desc_by_id[i] = abil_desc_resolved.get(label, "")
    if label not in abil_descs:
        warn("特性描述指针 %s (特性 %d) 在 ability_descriptions.string 里找不到" % (label, i))

abil_list = []
for name, idx in sorted(abil_index.items(), key=lambda kv: kv[1]):
    abil_list.append({
        "id": idx,
        "en": name,
        "zh": abil_name_by_id.get(idx) or pretty_en(name, "ABILITY"),
        "desc": abil_desc_by_id.get(idx, "").replace("\\n", ""),
    })
# 名称表里可能还有超出 defines 的保留编号
if abil_list:
    known = {a["id"] for a in abil_list}
    for idx in sorted(abil_name_by_id):
        if idx not in known:
            abil_list.append({"id": idx, "en": "", "zh": abil_name_by_id[idx], "desc": ""})
abil_list.sort(key=lambda a: a["id"])
print("abilities:", len(abil_list))

# ---------------------------------------------------------------- 招式

moves_h = read(os.path.join(CFRU, "include", "constants", "moves.h"))
move_index = {}
move_zh_comment = {}
for m in re.finditer(r"#define\s+MOVE_(\w+)\s+(0x[0-9A-Fa-f]+|\d+)\b([^\n]*)", moves_h):
    name, tail = m.group(1), m.group(3).strip()
    if name == "NAME_LENGTH":  # 杂项宏，非招式
        continue
    move_index[name] = int(m.group(2), 0)
    if tail.startswith("//"):
        move_zh_comment[name] = tail[2:].strip()

bm_text = read(os.path.join(CFRU, "src", "Tables", "battle_moves.c"))
move_blocks = {k[len("MOVE_"):]: v for k, v in iter_designated_blocks(bm_text, r"\[(MOVE_\w+)\]\s*=\s*\{")}

# 游戏实际招式名: attack_name_table.string 按位置对应招式编号 (标签多为缩写, 不能按名字匹配);
# Z 招式位置上是占位文字, 实际名字由 z_move_name_table.s 按编号偏移指向 z_move_names.string;
# 极巨/超极巨招式在战斗文本中显示为「极巨X」「超极巨X」(general_battle_strings.string)
move_name_entries = [(label, t) for label, t in parse_string_file(os.path.join(CFRU, "strings", "attack_name_table.string")).items()
                     if label != "gMoveNames"]
move_name_tbl = [t for _, t in move_name_entries]
z_move_names = parse_string_file(os.path.join(CFRU, "strings", "z_move_names.string"))
z_move_labels = re.findall(r"\.word\s+(\w+)", read(os.path.join(CFRU, "assembly", "data", "z_move_name_table.s")))
move_bounds = {m.group(1): move_index.get(m.group(2))
               for m in re.finditer(r"#define\s+((?:FIRST|LAST)_\w+_MOVE)\s+MOVE_(\w+)", moves_h)}
const_by_move_id = {}
for k, v in move_index.items():
    const_by_move_id.setdefault(v, k)
print("招式名表位置校验: %d/%d 标签与常量一致(忽略下划线, 其余为缩写/Z招式占位)" % (
    sum(1 for i, (label, _) in enumerate(move_name_entries)
        if const_by_move_id.get(i, "").replace("_", "") == label[5:].replace("_", "")), len(move_name_entries)))

def move_game_name(idx):
    """游戏中实际显示的招式名 (取不到返回空串)"""
    if move_bounds["FIRST_Z_MOVE"] <= idx <= move_bounds["LAST_Z_MOVE"]:
        k = idx - move_bounds["FIRST_Z_MOVE"]
        return z_move_names.get(z_move_labels[k], "") if k < len(z_move_labels) else ""
    text = move_name_tbl[idx] if idx < len(move_name_tbl) else ""
    if text in ("", "-"):
        return ""
    if move_bounds["FIRST_G_MAX_MOVE"] <= idx <= move_bounds["LAST_G_MAX_MOVE"]:
        return "超极巨" + text
    if move_bounds["FIRST_MAX_MOVE"] <= idx <= move_bounds["LAST_MAX_MOVE"]:
        return "极巨" + text
    return text

# FROSTBITE 在 config.h 中已定义 → 取 #ifdef 分支
move_descs = parse_string_file(os.path.join(CFRU, "strings", "attack_descriptions.string"), macros={"FROSTBITE"})
# 描述按指针表 gMoveDescriptions (assembly/data/attack_description_table.s) 的位置对应招式编号:
# 第 i 项是 招式 i+1 的描述 (标签常是缩写, 如 DESC_TRIPLE_ARROWS 对应 MOVE_TRIPLEARROWS, 不能按名字匹配)
desc_tbl = read(os.path.join(CFRU, "assembly", "data", "attack_description_table.s"))
desc_labels = re.findall(r"^\s*\.word\s+(\w+)", desc_tbl[desc_tbl.index("gMoveDescriptions:"):], re.M)
move_desc_by_id = {i + 1: move_descs.get(label, "") for i, label in enumerate(desc_labels)}
for i, label in enumerate(desc_labels):
    if label not in move_descs:
        warn("招式描述指针 %s (招式 %d) 在 attack_descriptions.string 里找不到" % (label, i + 1))

SPLIT_ZH = {"SPLIT_PHYSICAL": "物理", "SPLIT_SPECIAL": "特殊", "SPLIT_STATUS": "变化"}
TARGET_ZH = {
    "MOVE_TARGET_SELECTED": "选择一个对手", "MOVE_TARGET_DEPENDS": "视招式而定",
    "MOVE_TARGET_USER": "自身", "MOVE_TARGET_RANDOM": "随机对手",
    "MOVE_TARGET_BOTH": "对方全体", "MOVE_TARGET_USER_OR_ALLY": "自己或同伴",
    "MOVE_TARGET_FOES_AND_ALLY": "场上全体", "MOVE_TARGET_OPPONENTS_FIELD": "对方场地",
    "MOVE_TARGET_USER_ALLY": "自己与同伴", "MOVE_TARGET_ALLY": "同伴",
}

move_list = []
for name, idx in sorted(move_index.items(), key=lambda kv: kv[1]):
    block = move_blocks.get(name, "")

    def field(fname, block=block):
        m = re.search(r"\.\s*%s\s*=\s*([^,\n]+)" % fname, block)
        return m.group(1).strip() if m else ""

    def num(fname, default=0, block=block):
        v = field(fname)
        try:
            return int(v, 0)
        except (ValueError, TypeError):
            return default

    type_const = field("type").replace("TYPE_", "")
    type_id = type_index.get(type_const, 0)
    split = SPLIT_ZH.get(field("split"), "变化")
    power = num("power")
    if power > 250:
        power = 0
    acc = num("accuracy")
    if acc > 100:
        acc = 0
    evo_flags = set(re.findall(r"FLAG_(\w+)", field("flags")))
    priority = num("priority")
    if priority > 127:  # 结构体里是 s8, 源码写成无符号 (250 = -6, 255 = -1)
        priority -= 256
    move_list.append({
        "id": idx,
        "en": name,
        "zh": move_game_name(idx) or move_zh_comment.get(name) or pretty_en(name, "MOVE"),
        "type": type_id,
        "power": power,
        "acc": acc,
        "pp": num("pp"),
        "priority": priority,
        "split": split,
        "target": TARGET_ZH.get(field("target"), ""),
        "desc": move_desc_by_id.get(idx, "").replace("\\n", ""),
        "sec": num("secondaryEffectChance"),
        "fl": evo_flags,
    })
print("moves:", len(move_list))
no_desc_moves = [m["en"] for m in move_list if m["id"] and not m["desc"]]
if no_desc_moves:
    warn("招式缺描述 %d 个: %s" % (len(no_desc_moves), no_desc_moves[:8]))

# ---------------------------------------------------------------- 招式世代 (对照 52poke 招式列表)
# tools/move_gen_52poke.json 是 52poke「招式列表」各世代表格 (编号/中文名/英文名), 52poke 有 Cloudflare 防护,
# 无法在提取时联网, 故存档在仓库。按英文名匹配 (Z/极巨招式的 _P/_S 两个版本对应同一官方招式),
# 对不上再按中文名; 超极巨招式不在列表里(无全国编号), 归第八世代; 其余对不上的是原创招式 (gen 10)
move_gen_src = json.load(open(os.path.join(OUT, "tools", "move_gen_52poke.json"), encoding="utf-8"))["moves"]
norm_en = lambda s: re.sub(r"[^A-Z0-9]", "", s.upper())
official_by_en, official_by_zh = {}, {}
for gen, no, zh, en in move_gen_src:
    official_by_en.setdefault(norm_en(en), (gen, no))
    official_by_zh.setdefault(zh, (gen, no))
GEN_MAX_NO = 10000  # 超极巨招式排在第八世代末尾
for m in move_list:
    hit = official_by_en.get(norm_en(re.sub(r"_[PS]$", "", m["en"]))) or official_by_zh.get(m["zh"])
    if hit:
        m["gen"], m["no"] = hit
    elif m["en"].startswith("G_MAX_"):
        m["gen"], m["no"] = 8, GEN_MAX_NO + m["id"]
    else:
        m["gen"], m["no"] = 10, m["id"]
original_moves = [m["zh"] for m in move_list if m["id"] and m["gen"] == 10]
print("招式世代: 原创 %d 个 %s" % (len(original_moves), original_moves))

# ---------------------------------------------------------------- 特性世代 (对照 52poke 特性列表, 同上)
# 特性从第三世代开始; 按英文名匹配, 对不上再按中文名 (人马一体/面影辉映的形态变体), 其余为原创特性 (gen 10)
abil_gen_src = json.load(open(os.path.join(OUT, "tools", "ability_gen_52poke.json"), encoding="utf-8"))["abilities"]
ABIL_GEN_OVERRIDE = {"AIRLOCK": (3, 76)}  # 52poke 表格里「气闸」一行结构特殊, 抓取时漏掉
abil_official_by_en, abil_official_by_zh = {}, {}
for gen, no, zh, en in abil_gen_src:
    abil_official_by_en.setdefault(norm_en(en), (gen, no))
    abil_official_by_zh.setdefault(zh, (gen, no))
for a in abil_list:
    hit = (abil_official_by_en.get(norm_en(a["en"])) or abil_official_by_zh.get(a["zh"])
           or ABIL_GEN_OVERRIDE.get(a["en"]))
    a["gen"], a["no"] = hit if hit else (10, a["id"])
original_abils = [a["zh"] for a in abil_list if a["id"] and a["gen"] == 10]
print("特性世代: 原创 %d 个" % len(original_abils))

# ---------------------------------------------------------------- 招式性质与分类 (assembly/data/move_tables.json)
# 性质: 接触/守住/魔法反射/抢先/鹦鹉学舌 取 battle_moves.c 的 flags;
# 王者之证按引擎实际判定 (item_battle_effects.c): 造成伤害 且 不自带畏缩几率;
# 分类标签: 属于什么类型的招式, 括号里写受哪些特性/道具影响
try:
    special_flags = json.load(open(os.path.join(CFRU, "assembly", "data", "move_tables.json"), encoding="utf-8"))
except (OSError, ValueError) as e:
    special_flags = {}
    warn("读取 move_tables.json 失败: %s" % e)

def abil_zh(const):
    """ABILITY_XXX → 游戏内特性名 (abil_index 的键不带 ABILITY_ 前缀)"""
    key = const[8:] if const.startswith("ABILITY_") else const
    i = abil_index.get(key)
    if i is None or not abil_name_by_id.get(i):
        warn("招式分类引用的特性不存在: %s" % const)
        return key
    return abil_name_by_id[i]

MOVE_CAT_DEFS = [
    # 名称与官方(宝可梦百科)招式类别一致; "@开头"为从招式数据直接推导的伪表; 顺序即弹窗显示顺序
    ("@priority", "先制招式", "优先度为正，通常先于对手出手"),
    ("gPunchingMoves", "拳击类招式", "受%s影响（威力提升20%%）、拳击手套（威力提升10%%且变为非接触）" % abil_zh("ABILITY_IRONFIST")),
    ("gBitingMoves", "啃咬类招式", "受%s影响（威力提升50%%）" % abil_zh("ABILITY_STRONGJAW")),
    ("gPulseAuraMoves", "波动／波导类招式", "受%s影响（威力提升50%%）" % abil_zh("ABILITY_MEGALAUNCHER")),
    ("gSoundMoves", "声音类招式", "受%s免疫，%s使全部招式变为声音类" % (abil_zh("ABILITY_SOUNDPROOF"), abil_zh("ABILITY_SONILATE"))),
    ("gPowderMoves", "粉末类招式", "受防尘特性／草属性／安全眼镜免疫"),
    ("gBallBombMoves", "球弹类招式", "受%s免疫" % abil_zh("ABILITY_BULLETPROOF")),
    ("gDanceMoves", "舞蹈类招式", "受%s影响（连锁发动）" % abil_zh("ABILITY_DANCER")),
    ("gWindMoves", "风类招式", "受%s免疫并提升能力，%s变为蓄电状态" % (abil_zh("ABILITY_WINDRIDER"), abil_zh("ABILITY_WINDPOWER"))),
    ("gSlicingMoves", "斩击类招式", "受%s影响（威力提升50%%）" % abil_zh("ABILITY_SHARPNESS")),
    ("gMultihitmoves", "连续招式", "多次攻击，受%s影响（每次都判定）" % abil_zh("ABILITY_SKILLLINK")),
    ("gTwoStrikesMoves", "连续招式", "连续攻击2次，受%s影响" % abil_zh("ABILITY_SKILLLINK")),
    ("gTwoToFiveStrikesMoves", "连续招式", "连续攻击2～5次，受%s影响" % abil_zh("ABILITY_SKILLLINK")),
    ("gPercent25RecoilMoves", "反作用力类招式", "受%s影响（威力提升20%%），自己也会受到反作用力伤害" % abil_zh("ABILITY_RECKLESS")),
    ("gPercent33RecoilMoves", "反作用力类招式", "受%s影响（威力提升20%%），自己也会受到反作用力伤害" % abil_zh("ABILITY_RECKLESS")),
    ("gPercent50RecoilMoves", "反作用力类招式", "受%s影响（威力提升20%%），自己也会受到反作用力伤害" % abil_zh("ABILITY_RECKLESS")),
    ("gHalfMaxHealthRecoilMoves", "反作用力类招式", "自己会损失相当于最大HP一半的体力"),
    ("gChargingMoves", "蓄力类招式", "第一回合蓄力、第二回合攻击"),
    ("gHighCriticalChanceMoves", "易中要害类招式", "更容易击中要害"),
    ("gAlwaysCriticalMoves", "必中要害类招式", "必定击中要害"),
    ("gFlinchChanceMoves", "畏缩类招式", "有几率使目标畏缩"),
    ("gMovesThatCallOtherMoves", "使出其他招式", "会随机呼叫其他招式发动"),
    ("@sec", "存在追加效果", "除伤害外还带有附加效果"),
    ("gMoldBreakerMoves", "无视特性招式", "无视防守方的特性"),
    ("gIgnoreStatChangesMoves", "无视能力变化招式", "计算伤害时无视目标的能力变化"),
    ("gSubstituteBypassMoves", "穿透替身招式", "可以影响替身后的目标"),
    ("gTypeChangeExceptionMoves", "属性固定招式", "太晶化后属性不发生改变"),
    ("gDynamaxBannedMoves", "极巨化受限招式", "极巨化后威力不随体重变化"),
    ("@z", "Z招式", "需要携带Z纯晶并蓄满Z力量才能使用"),
    ("@max", "极巨招式", "极巨化后使用的招式"),
    ("gTailMoves", "尾巴类招式", ""),
    ("gHammerMoves", "锤类招式", "受%s影响（威力提升20%%）" % abil_zh("ABILITY_HEAVYHAMMER")),
    ("gDrillMoves", "钻类招式", ""),
]
# 「存在追加效果」与强力加成表(gSheerForceBoostedMoves)是同一批招式, 合并展示:
# 三种说明变体 — 仅追加效果 / 追加效果+受强行影响 / 仅受强行影响 (效果写在引擎里、secondaryEffectChance=0 的招式)
SHEER_NOTE = "受%s影响（威力提升30%%，附加效果不发动）" % abil_zh("ABILITY_SHEERFORCE")
move_cats = [{"n": n, "d": d} for _, n, d in MOVE_CAT_DEFS]
move_cats.append({"n": "存在追加效果", "d": "除伤害外还带有附加效果；" + SHEER_NOTE})
move_cats.append({"n": "存在追加效果", "d": SHEER_NOTE})
SEC_SHEER_BOTH, SEC_SHEER_ONLY = len(move_cats) - 2, len(move_cats) - 1
sheer_set = set(special_flags.get("gSheerForceBoostedMoves", []))
for m in move_list:
    fl = m.pop("fl")
    sec = m.pop("sec")
    m["f"] = [("MAKES_CONTACT" in fl), ("PROTECT_AFFECTED" in fl), ("MAGIC_COAT_AFFECTED" in fl),
              ("SNATCH_AFFECTED" in fl), ("MIRROR_MOVE_AFFECTED" in fl),
              m["split"] != "变化" and "MOVE_" + m["en"] not in special_flags.get("gFlinchChanceMoves", [])]
    cats = []
    is_z = move_bounds["FIRST_Z_MOVE"] <= m["id"] <= move_bounds["LAST_Z_MOVE"]
    is_max = move_bounds["FIRST_MAX_MOVE"] <= m["id"] <= move_bounds["LAST_G_MAX_MOVE"]
    has_sec = sec > 0 and not is_z and not is_max  # Z/极巨招式的 chance 是极巨效果本身
    sheer = "MOVE_" + m["en"] in sheer_set and not is_z and not is_max
    for i, (key, label, note) in enumerate(MOVE_CAT_DEFS):
        if key == "@sec":
            if has_sec:
                cats.append(SEC_SHEER_BOTH if sheer else i)
            elif sheer:
                cats.append(SEC_SHEER_ONLY)
            continue
        hit = ((key == "@priority" and m["priority"] > 0)
               or (key == "@z" and is_z)
               or (key == "@max" and is_max)
               or (key in special_flags and "MOVE_" + m["en"] in special_flags[key]))
        if hit and label not in [move_cats[c]["n"] for c in cats]:  # 反作用力/连续多表合并
            cats.append(i)
    m["c"] = cats
print("招式分类标签 %d 项, 有分类 %d 个, 先制 %d, 存在追加效果 %d (含强行说明 %d), Z %d, 极巨 %d, 王者之证 %d, 接触 %d" % (
    len(move_cats),
    sum(1 for m in move_list if m["c"]), sum(1 for m in move_list if m["priority"] > 0),
    sum(1 for m in move_list if any(move_cats[i]["n"] == "存在追加效果" for i in m["c"])),
    sum(1 for m in move_list if any(move_cats[i]["d"].find("强行") >= 0 for i in m["c"])),
    sum(1 for m in move_list if any(move_cats[i]["n"] == "Z招式" for i in m["c"])),
    sum(1 for m in move_list if any(move_cats[i]["n"] == "极巨招式" for i in m["c"])),
    sum(m["f"][5] for m in move_list), sum(m["f"][0] for m in move_list)))

# ---------------------------------------------------------------- 物品

item_index = parse_defines(read(os.path.join(CFRU, "include", "constants", "items.h")), "ITEM_")

ITEM_ZH = {
    "NONE": "", "TM_NONE": "",
    "THUNDER_STONE": "雷之石", "FIRE_STONE": "火之石", "WATER_STONE": "水之石",
    "LEAF_STONE": "叶之石", "MOON_STONE": "月之石", "SUN_STONE": "日之石",
    "SHINY_STONE": "光之石", "DUSK_STONE": "暗之石", "DAWN_STONE": "觉醒之石",
    "ICE_STONE": "冰之石", "KINGS_ROCK": "王者之证", "METAL_COAT": "金属膜",
    "DRAGON_SCALE": "龙之鳞片", "DRAGON_FANG": "龙之牙", "UPGRADE": "升级数据",
    "DUBIOUS_DISC": "可疑补丁", "PROTECTOR": "护具", "ELECTIRIZER": "电力增幅器",
    "MAGMARIZER": "熔岩增幅器", "RAZOR_CLAW": "锐利之爪", "RAZOR_FANG": "锐利之牙",
    "REAPER_CLOTH": "灵界之布", "DEEP_SEA_TOOTH": "深海之牙", "DEEP_SEA_SCALE": "深海鳞片",
    "PRISM_SCALE": "美丽鳞片", "WHIPPED_DREAM": "泡沫黄油", "SACHET": "香袋",
    "SACRED_ASH": "圣灰", "EVERSTONE": "不变之石", "OVAL_STONE": "浑圆之石",
    "STRAWBERRY_SWEET": "草莓糖饰", "LOVE_SWEET": "爱心糖饰", "BERRY_SWEET": "野莓糖饰",
    "CLOVER_SWEET": "幸运草糖饰", "FLOWER_SWEET": "花朵糖饰", "STAR_SWEET": "星星糖饰",
    "RIBBON_SWEET": "蝴蝶结糖饰", "CRACKED_POT": "破裂的茶壶", "CHIPPED_POT": "缺损的茶壶",
    "GALARICA_CUFF": "伽勒豆蔻手环", "GALARICA_WREATH": "伽勒豆蔻花圈",
    "AUSPICIOUS_ARMOR": "庆祝之铠", "MALICIOUS_ARMOR": "咒术之铠",
    "LEADERS_CREST": "头领凭证", "SYRUPY_APPLE": "蜜汁苹果",
    "SCROLL_OF_DARKNESS": "恶之挂轴", "SCROLL_OF_WATERS": "水之挂轴",
    "LINKING_CORD": "联系绳", "METAL_ALLOY": "复合金属", "MASTER_BALL": "大师球",
    "UP_GRADE": "升级数据",
    # 常见携带道具
    "AIR_BALLOON": "气球", "ABSORB_BULB": "球根", "BERRY_JUICE": "树果汁",
    "BIG_MUSHROOM": "大蘑菇", "BIG_PEARL": "大珍珠", "BIG_ROOT": "大根茎",
    "BLACK_BELT": "黑带", "BLACK_GLASSES": "黑色眼镜", "BLACK_SLUDGE": "黑色污泥",
    "BRIGHT_POWDER": "光粉", "CELL_BATTERY": "充电电池", "CHARCOAL": "木炭",
    "CLEANSE_TAG": "洁净之符", "ELECTRIC_SEED": "电气种子", "EXPERT_BELT": "达人带",
    "FLAME_ORB": "火焰宝珠", "GRASSY_SEED": "青草种子", "GRIP_CLAW": "紧缠钩爪",
    "HARD_STONE": "硬石头", "HEART_SCALE": "心之鳞片", "HONEY": "甜甜蜜",
    "IRON_BALL": "黑色铁球", "LAGGING_TAIL": "后攻之尾", "LEEK": "大葱",
    "LEFTOVERS": "吃剩的东西", "LEPPA_BERRY": "苹野果", "LIFE_ORB": "生命宝珠",
    "LIGHT_BALL": "电气球", "LIGHT_CLAY": "光之黏土", "LUCKY_EGG": "幸运蛋",
    "LUCKY_PUNCH": "吉利拳", "LUMINOUS_MOSS": "光苔", "LUM_BERRY": "木子果",
    "MAGNET": "磁铁", "MAX_REVIVE": "活力块", "MENTAL_HERB": "心灵香草",
    "METAL_POWDER": "金属粉", "METRONOME": "节拍器", "MIRACLE_SEED": "奇迹种子",
    "MISTY_SEED": "薄雾种子", "MOOMOO_MILK": "哞哞鲜奶", "MYSTIC_WATER": "神秘水滴",
    "NEVER_MELT_ICE": "不融冰", "NUGGET": "金珠", "OCCA_BERRY": "巧可果",
    "ORAN_BERRY": "橙橙果", "PEARL": "珍珠", "PECHA_BERRY": "桃桃果",
    "PERSIM_BERRY": "柿仔果", "POISON_BARB": "毒针", "POTION": "伤药",
    "POWER_HERB": "强力香草", "PRETTY_WING": "美丽之羽", "PSYCHIC_SEED": "精神种子",
    "QUICK_CLAW": "先制之爪", "QUICK_POWDER": "速度粉", "RAWST_BERRY": "莓莓果",
    "REVIVE": "活力碎片", "SHARP_BEAK": "锐利鸟嘴", "SHED_SHELL": "美丽空壳",
    "SILVER_POWDER": "银粉", "SITRUS_BERRY": "文柚果", "SMOKE_BALL": "烟雾球",
    "SNOWBALL": "雪球", "SOFT_SAND": "柔软沙子", "SPELL_TAG": "诅咒之符",
    "STARDUST": "星星沙子", "STAR_PIECE": "星星碎片", "STICKY_BARB": "附着针",
    "THICK_CLUB": "粗骨头", "TINY_MUSHROOM": "小蘑菇", "TWISTED_SPOON": "弯曲的汤匙",
    "WACAN_BERRY": "烛木果", "WIDE_LENS": "广角镜",
    # 莓果 (一至三代, 官方译名)
    "CHERI_BERRY": "樱子果", "CHESTO_BERRY": "零余果", "ASPEAR_BERRY": "利木果",
    "SITRUS_BERRY": "文柚果",
}
# 游戏实际道具名: gItemData (src/Tables/item_tables.c) 替换了原版道具表, .name 为
# 字母宏 (_A/_SPACE…, include/easy_text.h) 或字库字节 (中文为双字节, charmap.tbl)
charmap_1, charmap_2 = {}, {}
for line in read(os.path.join(CFRU, "charmap.tbl")).lstrip("\ufeff").splitlines():
    k, sep, v = line.partition("=")
    if sep and len(k) == 2:
        charmap_1[int(k, 16)] = v
    elif sep and len(k) == 4:
        charmap_2[int(k, 16)] = v
CHAR_LEADS = {k >> 8 for k in charmap_2}
TEXT_MACRO = {m.group(1): int(m.group(2), 0) for m in
              re.finditer(r"#define\s+(_\w+)\s+(0x[0-9A-Fa-f]+|\d+)", read(os.path.join(CFRU, "include", "easy_text.h")))}

def decode_game_text(body):
    """{_L, _i, ...} 或 {0x02, 0xD3, ...} → 文本; 字母宏一律单字节, 只有字节写法才拼双字节中文"""
    toks = [t.strip() for t in body.split(",") if t.strip()]
    out, i = [], 0
    while i < len(toks):
        t = toks[i]
        if t in TEXT_MACRO:
            if TEXT_MACRO[t] == 0xFF:
                break
            out.append(charmap_1.get(TEXT_MACRO[t], ""))
            i += 1
            continue
        try:
            b = int(t, 0)
        except ValueError:
            i += 1
            continue
        if b == 0xFF:
            break
        if b in CHAR_LEADS and i + 1 < len(toks) and re.match(r"(0x[0-9A-Fa-f]+|\d+)$", toks[i + 1]):
            pair = (b << 8) | int(toks[i + 1], 0)
            if pair in charmap_2:
                out.append(charmap_2[pair])
                i += 2
                continue
        out.append(charmap_1.get(b, ""))
        i += 1
    return "".join(out).strip()

item_src = read(os.path.join(CFRU, "src", "Tables", "item_tables.c"))
item_src = re.sub(r"//[^\n]*", "", re.sub(r"/\*.*?\*/", "", item_src, flags=re.S))  # 部分 .name 行尾注释是过期的复制粘贴
item_game_name = {}
for m in re.finditer(r'\.name\s*=\s*CN\("([^"]+)"[^)]*\)\s*,\s*\.itemId\s*=\s*ITEM_(\w+)', item_src):  # 道具名直接写中文: .name = CN("大师球")（可带第二参数）
    item_game_name.setdefault(m.group(2), m.group(1))
for m in re.finditer(r"\.name\s*=\s*\{([^}]*)\}\s*,\s*\.itemId\s*=\s*ITEM_(\w+)", item_src):
    item_game_name.setdefault(m.group(2), decode_game_text(m.group(1)))
print("游戏道具名:", len(item_game_name))
HAS_CJK = re.compile(r"[\u4e00-\u9fff]")

def read_xlsx_rows(path):
    """标准库读取 .xlsx 第一个工作表 → [{列字母: 文本}] (不依赖 openpyxl)"""
    import zipfile
    import xml.etree.ElementTree as ET
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            shared = ["".join(t.text or "" for t in si.iter(M + "t"))
                      for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(M + "si")]
        rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        target = rels[next(ET.fromstring(z.read("xl/workbook.xml")).iter(M + "sheet")).get(R + "id")]
        sheet = ET.fromstring(z.read(target.lstrip("/") if target.startswith("/") else "xl/" + target))
    rows = []
    for row in sheet.iter(M + "row"):
        cells = {}
        for c in row.iter(M + "c"):
            v = c.find(M + "v")
            if c.get("t") == "s" and v is not None:
                text = shared[int(v.text)]
            elif c.get("t") == "inlineStr":
                text = "".join(t.text or "" for t in c.iter(M + "t"))
            else:
                text = v.text if v is not None else ""
            cells[re.match(r"[A-Z]+", c.get("r")).group()] = (text or "").strip()
        rows.append(cells)
    return rows

# 道具名中英对照 (仓库根目录 道具名称_英-中.xlsx,「原文 | 译文」, 忽略大小写): 游戏道具表里的英文名按此翻译
ITEM_DICT_PATH = os.path.join(CFRU, "道具名称_英-中.xlsx")
item_dict = {}
if os.path.exists(ITEM_DICT_PATH):
    dict_rows = read_xlsx_rows(ITEM_DICT_PATH)
    start = next((i + 1 for i, r in enumerate(dict_rows) if r.get("A") == "原文"), 0)
    for r in dict_rows[start:]:
        if r.get("A") and r.get("B"):
            item_dict.setdefault(r["A"].lower(), r["B"])
    print("道具中英对照:", len(item_dict))
else:
    warn("缺少道具中英对照表 %s, 英文道具名回退 ITEM_ZH" % ITEM_DICT_PATH)
item_untranslated = set()  # 最终仍显示非中文名的道具 (写入 report)

def item_zh(expr):
    """ITEM_XXX 表达式 → 显示名: 游戏内中文名 > 中英对照表译名 > ITEM_ZH > 游戏内实际名字(英文照原样)"""
    expr = (expr or "").strip().rstrip(",").strip()
    m = re.match(r"ITEM_(\w+)$", expr)
    if not m:
        return ""
    name = m.group(1)
    game = item_game_name.get(name, "")
    if HAS_CJK.search(game):
        return game
    if game.lower() in item_dict:
        return item_dict[game.lower()]
    if name in ITEM_ZH:
        return ITEM_ZH[name]
    item_untranslated.add(name)
    if game.strip("?"):
        return game
    return pretty_en(name, "")

# ---------------------------------------------------------------- 升级招式表 / 蛇招式 / TM / 教学

ls_text = read(os.path.join(DPE, "src", "Learnsets.c"))
level_sets = {}
for m in re.finditer(r"static const struct LevelUpMove s(\w+)LevelUpLearnset\[\]\s*=\s*\{(.*?)\n\s*\};", ls_text, re.S):
    moves = []
    for lv_m in re.finditer(r"LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*MOVE_(\w+)\)", m.group(2)):
        moves.append([int(lv_m.group(1)), move_index.get(lv_m.group(2), 0)])
    level_sets[m.group(1)] = moves

learnsets = {}
for m in re.finditer(r"\[SPECIES_(\w+)\]\s*=\s*s(\w+)LevelUpLearnset", ls_text):
    sp = sp_id(m.group(1))
    if sp is None:
        warn("learnset 物种未知: " + m.group(1))
        continue
    learnsets[sp] = level_sets.get(m.group(2), [])
print("learnsets:", len(learnsets))

egg_text = read(os.path.join(DPE, "src", "Egg_Moves.c"))
egg_moves = {}
for m in re.finditer(r"egg_moves\((\w+),(.*?)\)\s*,", egg_text, re.S):
    if m.group(1) == "species":  # 宏定义本身
        continue
    sp = sp_id(m.group(1))
    if sp is None:
        warn("egg 物种未知: " + m.group(1))
        continue
    egg_moves[sp] = [move_index[x] for x in re.findall(r"MOVE_(\w+)", m.group(2)) if x in move_index]
print("egg_moves:", len(egg_moves))

tm_text = read(os.path.join(DPE, "src", "TM_Tutor_Tables.c"))
m_tms = re.search(r"#define\s+NUM_TMS\s+(\d+)", read(os.path.join(CFRU, "src", "config.h")))
NUM_TMS = int(m_tms.group(1)) if m_tms else 120  # gTMHMMoves 前 NUM_TMS 项是 TM, 其后是 HM

def parse_move_table(name):
    """TM_Tutor_Tables.c 的 const u16 name[] = { MOVE_X, ... } → 招式编号列表 (下标+1 即 TM/教学编号)"""
    blk = re.search(r"const u16 %s\[[^\]]*\]\s*=\s*\{(.*?)\n\s*\};" % name, tm_text, re.S)
    return [move_index.get(n, 0) for n in re.findall(r"^\s*MOVE_(\w+)", blk.group(1), re.M)] if blk else []

tm_moves = parse_move_table("gTMHMMoves")
tms = [{"no": i + 1, "move": mid, "label": "TM%02d" % (i + 1) if i < NUM_TMS else "HM%02d" % (i + 1 - NUM_TMS)}
       for i, mid in enumerate(tm_moves)]
print("TMs:", len(tms))

def parse_compat_dir(dpath, moves, kind):
    """tm_compatibility / tutor_compatibility: 每个「编号 - 招式英文名.txt」列出可学的物种;
    文件名里的招式须与 TM_Tutor_Tables.c 对应位置一致, 不一致写入警告"""
    compat = {}
    if not os.path.isdir(dpath):
        warn("缺少目录 " + dpath)
        return compat
    for fn in os.listdir(dpath):
        m = re.match(r"(\d+)\s*-?\s*(.*?)\.txt$", fn, re.I)
        if not m:
            continue
        no = int(m.group(1))
        file_move = re.sub(r"[^a-z]", "", m.group(2).lower())
        table_move = re.sub(r"[^a-z]", "", const_by_move_id.get(moves[no - 1], "").lower()) if 1 <= no <= len(moves) else ""
        if file_move != table_move:
            warn("%s %d: 文件名招式 %s 与 TM_Tutor_Tables.c 的 %s 不一致" % (kind, no, m.group(2), table_move or "(越界)"))
        sps = set()
        for line in read(os.path.join(dpath, fn)).splitlines():
            s = line.strip()
            if not s or re.match(r"^(TM|TR|HM)\d*\s*[:\-]", s):
                continue
            if s.startswith("SPECIES_"):
                s = s[8:]
            sid = sp_id(s)
            if sid is not None:
                sps.add(sid)
        compat[no] = sps
    return compat

tutor_moves = parse_move_table("gMoveTutorMoves")
tutors = [{"no": i + 1, "move": mid} for i, mid in enumerate(tutor_moves)]
tm_compat = parse_compat_dir(os.path.join(DPE, "src", "tm_compatibility"), tm_moves, "招式学习器")
tutor_compat = parse_compat_dir(os.path.join(DPE, "src", "tutor_compatibility"), tutor_moves, "教学招式")
print("tutors:", len(tutors), "tm_compat:", len(tm_compat), "tutor_compat:", len(tutor_compat))

# ---------------------------------------------------------------- 进化
# 先保留原始参数 p1/p3, 进化条件文字在物种名/道具名都就绪后统一生成 (见「进化条件文字」)

evolutions = {}
evo_text = read(os.path.join(DPE, "src", "Evolution Table.c"))
for name, body in iter_designated_blocks(evo_text, r"\[SPECIES_(\w+)\]\s*=\s*\{"):
    sp = sp_id(name)
    if sp is None:
        warn("evo 物种未知: " + name)
        continue
    evos = []
    for entry_m in re.finditer(r"\{([^{}]*)\}", body):
        parts = [p.strip() for p in re.split(r",(?![^(]*\))", entry_m.group(1))]  # TIME_RANGE(17, 20) 内的逗号不切
        if len(parts) < 3:
            continue
        method, p1, p2, p3 = parts[0], parts[1], parts[2], (parts[3] if len(parts) > 3 else "0")
        # 反向冗余边(MEGA 不带进化石/招式 / GIGA 为 FALSE)指向基础形态, 丢弃,
        # 否则无普通进化链的基础形态(三神鸟/拉普拉斯/烈空坐等)会被误标为特殊形态
        if method == "EVO_MEGA" and p1 in ("ITEM_NONE", "MOVE_NONE"):
            continue
        if method == "EVO_GIGANTAMAX" and p1 == "FALSE":
            continue
        to_m = re.match(r"SPECIES_(\w+)$", p2)
        to_sp = sp_id(to_m.group(1)) if to_m else None
        if to_sp is not None:
            evos.append({"to": to_sp, "method": method, "p1": p1, "p3": p3})
    if evos:
        evolutions[sp] = evos
print("evolutions:", len(evolutions))

# ---------------------------------------------------------------- 图鉴条目

pokedex_h = read(os.path.join(DPE, "include", "pokedex.h"))
national_dex_index = parse_defines(pokedex_h, "NATIONAL_DEX_")

dex_data = {}
for name, body in iter_designated_blocks(read(os.path.join(DPE, "src", "Pokedex_Data_Table.c")), r"\[NATIONAL_DEX_(\w+)\]\s*=\s*\{"):
    nd = national_dex_index.get(name)
    if nd is None:
        continue
    h = re.search(r"\.height\s*=\s*(\d+)", body)
    w = re.search(r"\.weight\s*=\s*(\d+)", body)
    d = re.search(r"\.description\s*=\s*DEX_ENTRY_(\w+)", body)
    dex_data[nd] = {
        "height": int(h.group(1)) if h else 0,
        "weight": int(w.group(1)) if w else 0,
        "descLabel": d.group(1) if d else None,
    }

species_to_dex = {}
for m in re.finditer(r"\[SPECIES_(\w+)\s*-\s*1\]\s*=\s*NATIONAL_DEX_(\w+)", read(os.path.join(DPE, "src", "Species_To_Pokdex_Table.c"))):
    sp = sp_id(m.group(1))
    nd = national_dex_index.get(m.group(2))
    if sp is not None and nd is not None:
        species_to_dex[sp] = nd
print("dex_data:", len(dex_data), "species_to_dex:", len(species_to_dex))

dex_flavor = {}
for label, text in parse_string_file(os.path.join(DPE, "strings", "Pokedex_Data.string")).items():
    if label.startswith("DEX_ENTRY_"):
        dex_flavor[label[10:]] = text.replace("\\n", "")

# ---------------------------------------------------------------- 种族值 → 物种记录

EGG_GROUP_ZH = {"MONSTER": "怪兽", "WATER1": "水中1", "BUG": "虫", "FLYING": "飞行",
                "FIELD": "陆上", "FAIRY": "妖精", "GRASS": "植物", "HUMAN_LIKE": "人形",
                "WATER3": "水中3", "MINERAL": "矿物", "AMORPHOUS": "不定形", "WATER2": "水中2",
                "DITTO": "百变怪", "DRAGON": "龙", "UNDISCOVERED": "未发现"}
GROWTH_ZH = {"MEDIUM_FAST": "较快", "SLIGHTLY_FAST": "略快", "FAST": "快",
             "MEDIUM_SLOW": "较慢", "SLIGHTLY_SLOW": "略慢", "SLOW": "慢",
             "ERRATIC": "不规则", "FLUCTUATING": "波动"}

pokemon_names = parse_string_file(os.path.join(DPE, "strings", "Pokemon_Name_Table.string"))

# 名称表是位置索引表: 跳过表头 @gSpeciesNames 后第 i 个标签 = 物种 i
name_entries = [(k, v) for k, v in pokemon_names.items() if k != "gSpeciesNames"]
name_by_position = {}
pos_match = pos_total = 0
for pos, (label, text) in enumerate(name_entries):
    name_by_position[pos] = text
    cand = label[5:] if label.startswith("NAME_") else label
    cand = re.sub(r"^SPECIES_", "", cand)
    # 标签拼写可能与常量不同(无下划线等): 双向去下划线比对
    for const in species_index:
        if const == cand or const.replace("_", "") == cand.replace("_", ""):
            pos_total += 1
            if species_index[const] == pos:
                pos_match += 1
            break
print("名称表位置校验: %d/%d 标签能对应常量且序号一致" % (pos_match, pos_total))

species_list = []
base_text = read(os.path.join(DPE, "src", "Base_Stats.c"))
for name, body in iter_designated_blocks(base_text, r"\[SPECIES_(\w+)\]\s*=\s*\{"):
    if name in ("NONE", "EGG"):  # 占位物种(?????? / 坏蛋), 不是宝可梦
        continue
    sp = sp_id(name)
    if sp is None:
        warn("Base_Stats 物种未知: " + name)
        continue

    def fnum(fname, default=0, body=body):
        mm = re.search(r"\.\s*%s\s*=\s*([^,\n]+)" % fname, body)
        if not mm:
            return default
        v = mm.group(1).strip().rstrip(",")
        try:
            return int(v, 0)
        except ValueError:
            pm = re.search(r"PERCENT_FEMALE\(([\d.]+)\)", v)
            return float(pm.group(1)) if pm else default

    types = []
    for tf in ("type1", "type2"):
        mm = re.search(r"\.\s*%s\s*=\s*TYPE_(\w+)" % tf, body)
        if mm and mm.group(1) in type_index:
            t = type_index[mm.group(1)]
            if t not in types:
                types.append(t)
    abilities = []
    for af in ("ability1", "ability2"):
        mm = re.search(r"\.\s*%s\s*=\s*ABILITY_(\w+)" % af, body)
        if mm and mm.group(1) != "NONE" and mm.group(1) in abil_index:
            a = abil_index[mm.group(1)]
            if a not in abilities:
                abilities.append(a)
    mm = re.search(r"\.\s*hiddenAbility\s*=\s*ABILITY_(\w+)", body)
    hidden = [abil_index[mm.group(1)]] if mm and mm.group(1) != "NONE" else []
    hidden = [h for h in hidden if h not in abilities]  # 与普通特性重复则不显示

    egg_groups = []
    for ef in ("eggGroup1", "eggGroup2"):
        mm = re.search(r"\.\s*%s\s*=\s*EGG_GROUP_(\w+)" % ef, body)
        if mm and mm.group(1) != "NONE" and mm.group(1) in EGG_GROUP_ZH:
            g = EGG_GROUP_ZH[mm.group(1)]
            if g not in egg_groups:
                egg_groups.append(g)
    mm = re.search(r"\.\s*growthRate\s*=\s*GROWTH_(\w+)", body)
    growth = GROWTH_ZH.get(mm.group(1), mm.group(1)) if mm else ""

    mm = re.search(r"\.\s*genderRatio\s*=\s*([^,\n]+)", body)
    gender_f = None
    if mm:
        v = mm.group(1).strip()
        pm = re.search(r"PERCENT_FEMALE\(([\d.]+)\)", v)
        if pm:
            gender_f = float(pm.group(1))
        elif v.startswith("MON_FEMALE"):
            gender_f = 100.0
        elif v.startswith("MON_GENDERLESS"):
            gender_f = -1
        else:
            try:
                gender_f = round(int(v, 0) / 255.0 * 100, 1)
            except ValueError:
                gender_f = None

    held = []
    for itf in ("item1", "item2"):
        mm = re.search(r"\.\s*%s\s*=\s*(ITEM_\w+)" % itf, body)
        if mm and mm.group(1) != "ITEM_NONE":
            izh = item_zh(mm.group(1))
            if izh:
                held.append(izh)

    nd = species_to_dex.get(sp)
    dd = dex_data.get(nd, {}) if nd is not None else {}
    flavor = dex_flavor.get(dd.get("descLabel") or "", "")

    # 按 TM / 教学编号排序 (同一招式只列一次)
    tm_ids = list(dict.fromkeys(tm_moves[no - 1] for no in sorted(tm_compat)
                                if sp in tm_compat[no] and 1 <= no <= len(tm_moves) and tm_moves[no - 1]))
    tutor_ids = list(dict.fromkeys(tutor_moves[no - 1] for no in sorted(tutor_compat)
                                   if sp in tutor_compat[no] and 1 <= no <= len(tutor_moves) and tutor_moves[no - 1]))

    zh_name = name_by_position.get(sp) or pokemon_names.get("NAME_" + name) or pokemon_names.get("NAME_SPECIES_" + name)
    rec = {
        "id": sp,
        "en": pretty_en(name, "SPECIES"),
        "constName": name,
        "zh": zh_name or pretty_en(name, "SPECIES"),
        "nameMissing": zh_name is None,
        "dex": nd,
        "types": types,
        "stats": {"hp": fnum("baseHP"), "atk": fnum("baseAttack"), "def": fnum("baseDefense"),
                  "spe": fnum("baseSpeed"), "spa": fnum("baseSpAttack"), "spd": fnum("baseSpDefense")},
        "evYield": [int(fnum("evYield_HP")), int(fnum("evYield_Attack")), int(fnum("evYield_Defense")),
                    int(fnum("evYield_Speed")), int(fnum("evYield_SpAttack")), int(fnum("evYield_SpDefense"))],
        "abilities": abilities,
        "hidden": hidden,
        "catchRate": fnum("catchRate"),
        "expYield": fnum("expYield"),
        "genderF": gender_f,
        "eggCycles": fnum("eggCycles"),
        "friendship": fnum("friendship"),
        "growth": growth,
        "eggGroups": egg_groups,
        "heldItems": held,
        "height": (dd.get("height") or 0) / 10.0,
        "weight": (dd.get("weight") or 0) / 10.0,
        "flavor": flavor,
        "levelUp": learnsets.get(sp, []),
        "egg": egg_moves.get(sp, []),
        "tm": tm_ids,
        "tutor": tutor_ids,
        "evolutions": evolutions.get(sp, []),
    }
    rec["total"] = sum(rec["stats"].values())
    species_list.append(rec)

species_list.sort(key=lambda r: r["id"])
print("species parsed:", len(species_list))

# ---------------------------------------------------------------- 觉醒形态 (mega.c gAwakeningFormTable)
# 觉醒: 学会觉醒力量或携带觉醒徽章时在对战中变身, 男女可不同形态; 归入图鉴进化链的特殊形态
awaken_rows = []
mega_c = read(os.path.join(CFRU, "src", "mega.c"))
tbl = re.search(r"const struct AwakeningForm gAwakeningFormTable\[\]\s*=\s*\{(.*?)\n\s*\};", mega_c, re.S)
if tbl:
    for m in re.finditer(r"\{\s*SPECIES_(\w+)\s*,\s*SPECIES_(\w+)\s*,\s*SPECIES_(\w+)\s*\}", tbl.group(1)):
        if m.group(1) != "NONE":
            awaken_rows.append((m.group(1), m.group(2), m.group(3)))
print("awakening forms:", len(awaken_rows))

form_kind = {}  # species_id -> "awaken"/"mega"/"giga"/"primal"
primal_to = set()  # MEGA_VARIANT_PRIMAL 正向边的目标(原始回归形态)
for name, body in iter_designated_blocks(evo_text, r"\[SPECIES_(\w+)\]\s*=\s*\{"):
    sp = sp_id(name)
    if sp is None:
        continue
    for entry_m in re.finditer(r"\{([^{}]*)\}", body):
        parts = [p.strip() for p in entry_m.group(1).split(",")]
        if len(parts) >= 3 and re.match(r"SPECIES_(\w+)$", parts[2]):
            if parts[1] == "ITEM_NONE":  # 原始回归等反向边, 目标是常规物种
                continue
            to_sp = sp_id(parts[2][8:])
            if to_sp is not None and parts[0] == "EVO_MEGA" and len(parts) > 3 and parts[3] == "MEGA_VARIANT_PRIMAL":
                primal_to.add(to_sp)

species_by_id = {r["id"]: r for r in species_list}
for base, male, female in awaken_rows:
    bsp, msp, fsp = sp_id(base), sp_id(male), sp_id(female)
    if bsp is None:
        warn("觉醒表物种未知: " + base)
        continue
    evolutions.setdefault(bsp, [])
    # 觉醒目标若同时存在于超级进化边(同目标), 以觉醒形态为准
    evolutions[bsp] = [e for e in evolutions[bsp] if e["to"] not in (msp, fsp)]
    if msp == fsp or msp is None or fsp is None:
        if msp is not None:
            evolutions[bsp].append({"to": msp, "method": "EVO_AWAKEN", "p1": "", "p3": "0"})
            form_kind[msp] = "awaken"
    else:
        evolutions[bsp].append({"to": msp, "method": "EVO_AWAKEN", "p1": "", "p3": "MON_MALE"})
        evolutions[bsp].append({"to": fsp, "method": "EVO_AWAKEN", "p1": "", "p3": "MON_FEMALE"})
        form_kind[msp] = "awaken"
        form_kind[fsp] = "awaken"
for r in species_list:
    e = evolutions.get(r["id"], [])
    if e and not r["evolutions"]:
        r["evolutions"] = e
    elif e:
        r["evolutions"] = e  # 觉醒边与已有边合并(以觉醒表+进化表并集为准)

# formKind 统一判定: 只有不在主链上的物种才是"特殊形态"
# (进化表 MEGA/GIGA 边双向冗余存储, 反向边的目标是基础形态, 须排除)
main_nodes = set()
for sp0, evs in evolutions.items():
    for e in evs:
        if e["method"] not in ("EVO_MEGA", "EVO_GIGANTAMAX", "EVO_AWAKEN"):
            main_nodes.add(sp0)
            main_nodes.add(e["to"])
for sp0, evs in evolutions.items():
    for e in evs:
        if e["method"] == "EVO_AWAKEN" or e["to"] in main_nodes:
            continue
        if e["to"] in primal_to:
            form_kind[e["to"]] = "primal"
        elif e["method"] == "EVO_MEGA":
            form_kind[e["to"]] = "mega"
        elif e["method"] == "EVO_GIGANTAMAX":
            form_kind[e["to"]] = "giga"
for r in species_list:
    r["formKind"] = form_kind.get(r["id"], "")

# ---------------------------------------------------------------- 默认形态判定
# 图鉴主页每个编号只显示默认形态: constName 是组内(同图鉴编号)其他成员前缀者优先,
# 已判定为超级进化/超极巨化/觉醒/原始回归的物种不参与; 无唯一前缀候选时回退最小物种 id。
# 剩余非默认物种按后缀归类地区形态(_A/_G/_H/_P), 其余归入 alt(特殊形态), 并生成搜索 tags
# (只含中文: 「地区形态/特殊形态」+ 具体形态名, 搜索按子串匹配, 「阿罗拉」「极巨化」「觉醒」也能命中)。
SPECIES_REGION_ZH = {"A": "阿罗拉形态", "G": "伽勒尔形态", "H": "洗翠形态", "P": "帕底亚形态"}
# _P 后缀歧义排除(并非帕底亚地区形态): 花舞鸟风格 / 玛机雅娜原色
REGION_EXCLUDE = {"ORICORIO_P", "MAGEARNA_P"}
FORM_LABEL_ZH = {"mega": "超级进化", "giga": "超极巨化", "awaken": "觉醒形态", "primal": "原始回归"}

dex_groups = {}
for r in species_list:
    if r["dex"] is not None and r["dex"] > 0:
        dex_groups.setdefault(r["dex"], []).append(r)
default_report = []
for dex, group in dex_groups.items():
    group.sort(key=lambda r: r["id"])
    cands = [r for r in group if not r["formKind"]]
    pref = [r for r in cands
            if any(o is not r and o["constName"].startswith(r["constName"]) for o in group)]
    # 排除自身也是其他候选扩展名的候选(如 X 与 X_Y 同时为候选时取 X)
    pref = [r for r in pref
            if not any(o is not r and r["constName"].startswith(o["constName"])
                       and o["constName"] != r["constName"] for o in pref)]
    base = pref[0] if len(pref) == 1 else (cands[0] if cands else group[0])
    base["isDefault"] = True
    if len(group) > 1:
        default_report.append("#%d %s ← %s" % (dex, base["constName"],
                                               " ".join(g["constName"] for g in group if g is not base)))

default_ids = {r["id"] for r in species_list if r.get("isDefault")}
for r in species_list:
    if r["id"] in default_ids:
        r["formKind"] = ""
        r["formLabel"] = ""
        r["tags"] = ""
        continue
    fk = r["formKind"]
    suffix = r["constName"].rsplit("_", 1)[1] if "_" in r["constName"] else ""
    if not fk and suffix in SPECIES_REGION_ZH and not r["constName"].startswith("UNOWN") and r["constName"] not in REGION_EXCLUDE:
        r["formKind"] = "regional"
        r["formLabel"] = SPECIES_REGION_ZH[suffix]
    else:
        if not fk:
            r["formKind"] = "alt"
        r["formLabel"] = FORM_LABEL_ZH.get(r["formKind"], "特殊形态")
    group_zh = "地区形态" if r["formKind"] == "regional" else "特殊形态"
    r["tags"] = group_zh if r["formLabel"] == group_zh else group_zh + " " + r["formLabel"]
n_forms = sum(1 for r in species_list if not r.get("isDefault"))
print("默认形态 %d 种, 特殊/地区形态 %d 个" % (len(default_ids), n_forms))

# ---------------------------------------------------------------- 特殊形态沿用本体的招式学习器/教学招式/蛋招式
# 超级进化/超极巨化/觉醒形态/原始回归只在对战中变身出现, 一律用同编号默认形态(本体)的表;
# 其他特殊形态是独立物种, DPE 里有自己的表就照实际, 表为空时才用本体的 (地区形态不受影响)
default_by_dex = {r["dex"]: r for r in species_list if r.get("isDefault")}
filled = {"tm": 0, "tutor": 0, "egg": 0}
for r in species_list:
    base = default_by_dex.get(r["dex"])
    if r.get("isDefault") or r["formKind"] in ("", "regional") or base is None:
        continue
    for k in filled:
        if (r["formKind"] != "alt" or not r[k]) and r[k] != base[k]:
            r[k] = base[k]
            filled[k] += 1
print("特殊形态沿用本体: 招式学习器 %d / 教学招式 %d / 蛋招式 %d 个" % (filled["tm"], filled["tutor"], filled["egg"]))

# ---------------------------------------------------------------- 超级进化 X/Y/Z 形态名
# 超级石带 X/Y/Z 的 (如 喷火龙石X), 对应形态名后也带同一字母 (喷火龙X); 原始回归/究极爆发不算
for evs in evolutions.values():
    for e in evs:
        if e["method"] == "EVO_MEGA" and e["p3"] == "MEGA_VARIANT_STANDARD" and e["p1"].startswith("ITEM_"):
            m_xyz = re.search(r"([XYZ])$", item_zh(e["p1"]))
            r = species_by_id.get(e["to"])
            if m_xyz and r and not r["zh"].endswith(m_xyz.group(1)):
                r["zh"] += m_xyz.group(1)

# ---------------------------------------------------------------- 进化条件文字
# 按 CFRU src/evolution.c 的判定逻辑, 把原始参数写成官方图鉴式的「主条件」+「（补充）」;
# 地点编号按本作(火红) region_map_sections.h 的 #ifndef UNBOUND 部分解释 (DPE 里写的是 Unbound 地名)
DPE_MAPSEC = {k: int(v, 0) for k, v in
              re.findall(r"#define\s+(MAPSEC_\w+)\s+(0x[0-9A-Fa-f]+|\d+)", read(os.path.join(DPE, "include", "evolution.h")))}
rms_fr = re.search(r"#ifndef UNBOUND(.*?)#(?:else|endif)",
                   read(os.path.join(CFRU, "include", "constants", "region_map_sections.h")), re.S).group(1)
FR_MAPSEC = {int(v, 0): k[7:] for k, v in re.findall(r"#define\s+(MAPSEC_\w+)\s+(0x[0-9A-Fa-f]+|\d+)", rms_fr)}
MAPSEC_ZH = {"LAVENDER_TOWN": "紫苑镇", "ROUTE_8": "8号道路", "UNDERGROUND_PATH_2": "地下通道",
             "ROCK_TUNNEL": "岩山隧道", "BOND_BRIDGE": "羁绊桥"}
TILE_ZH = {"MB_SHALLOW_WATER": "浅水处"}
GENDER_NOTE = {"MON_MALE": "（仅雄性）", "MON_FEMALE": "（仅雌性）"}
move_zh_by_id = {m["id"]: m["zh"] for m in move_list}

def mapsec_zh(expr):
    v = DPE_MAPSEC.get(expr, int(expr, 0) if re.match(r"(0x[0-9A-Fa-f]+|\d+)$", expr) else None)
    zh = MAPSEC_ZH.get(FR_MAPSEC.get(v))
    if not zh:
        warn("进化地点未翻译: %s (本作地点 %s)" % (expr, FR_MAPSEC.get(v)))
    return zh or "特定地点"

def const_zh(expr):
    """ITEM_/MOVE_/TYPE_/SPECIES_ 常量 → 中文名"""
    if expr.startswith("ITEM_"):
        return item_zh(expr)
    if expr.startswith("MOVE_"):
        return move_zh_by_id.get(move_index.get(expr[5:]), "")
    if expr.startswith("TYPE_"):
        return TYPE_ZH.get(type_index.get(expr[5:]), "")
    if expr.startswith("SPECIES_"):
        r = species_by_id.get(sp_id(expr[8:]))
        return r["zh"] if r else ""
    return ""

def describe_evo(e):
    m, p1, p3 = e["method"], e["p1"], e["p3"]
    lv = "等级%s以上" % p1 if p1.isdigit() else "升级"
    x1, x3 = const_zh(p1), const_zh(p3)
    level_note = {
        "EVO_LEVEL": "", "EVO_LEVEL_NINJASK": "",
        "EVO_LEVEL_ATK_GT_DEF": "（攻击＞防御）", "EVO_LEVEL_ATK_EQ_DEF": "（攻击＝防御）",
        "EVO_LEVEL_ATK_LT_DEF": "（攻击＜防御）",
        "EVO_LEVEL_SILCOON": "（性格值末位为0～4）", "EVO_LEVEL_CASCOON": "（性格值末位为5～9）",
        "EVO_LEVEL_SHEDINJA": "（队伍有空位且背包有精灵球）",
        "EVO_LEVEL_DAY": "（白天）", "EVO_LEVEL_NIGHT": "（夜晚）",
        "EVO_MALE_LEVEL": "（仅雄性）", "EVO_FEMALE_LEVEL": "（仅雌性）",
        "EVO_TYPE_IN_PARTY": "（与%s属性宝可梦同行）" % x3,
        "EVO_RAINY_FOGGY_OW": "（下雨或起雾时）",
        "EVO_NATURE_HIGH": "（高调型性格）", "EVO_NATURE_LOW": "（低调型性格）",
        "EVO_LEVEL_HOLD_ITEM": "（携带%s）" % x3,
        "EVO_MAUSHOLD_THREE": "（1%概率，三只家族）", "EVO_MAUSHOLD_FOUR": "（99%概率，四只家族）",
    }
    if m in level_note:
        return lv, level_note[m]
    if m == "EVO_LEVEL_SPECIFIC_TIME_RANGE":
        t = re.match(r"TIME_RANGE\((\d+),\s*(\d+)\)", p3)
        start, end = (int(t.group(1)), int(t.group(2))) if t else (int(p3, 0) >> 8, int(p3, 0) & 0xFF)
        return lv, "（%d:00～%d:00）" % (start, end)
    if m in ("EVO_FRIENDSHIP", "EVO_FRIENDSHIP_DAY", "EVO_FRIENDSHIP_NIGHT"):
        return "亲密度高时升级", {"EVO_FRIENDSHIP_DAY": "（白天）", "EVO_FRIENDSHIP_NIGHT": "（夜晚）"}.get(m, "")
    if m == "EVO_MOVE_TYPE":
        return "学会%s属性招式后升级" % x1, "（亲密度高）" if p3 not in ("0", "FALSE") else ""
    if m in ("EVO_MOVE", "EVO_MOVE_MALE", "EVO_MOVE_FEMALE"):
        return "学会%s后升级" % x1, {"EVO_MOVE_MALE": "（仅雄性）", "EVO_MOVE_FEMALE": "（仅雌性）"}.get(m, "")
    if m == "EVO_OTHER_PARTY_MON":
        return "与%s同行时升级" % x1, ""
    if m == "EVO_MAP":
        maps = e.get("maps") or [mapsec_zh(p1)]
        return "在%s升级" % ("、".join(maps[:-1]) + "或" + maps[-1] if len(maps) > 1 else maps[0]), ""
    if m == "EVO_BEAUTY":
        return "美丽度%s以上时升级" % p1, ""
    if m == "EVO_COINS":
        return "升级", "（代币盒里有%s枚以上代币）" % p1
    if m == "EVO_ITEM":
        return "使用%s" % x1, GENDER_NOTE.get(p3, "")
    if m == "EVO_ITEM_LOCATION":
        return "使用%s" % x1, "（站在%s）" % TILE_ZH.get(p3, "特定地形上")
    if m == "EVO_ITEM_NIGHT":
        return "使用%s" % x1, "（夜晚）"
    if m == "EVO_ITEM_HOLD_ITEM":
        return "使用%s" % x1, "（携带%s）" % x3
    if m in ("EVO_HOLD_ITEM_DAY", "EVO_HOLD_ITEM_NIGHT"):
        return "携带%s升级" % x1, "（白天）" if m == "EVO_HOLD_ITEM_DAY" else "（夜晚）"
    if m == "EVO_TRADE":
        return "通信交换", ""
    if m == "EVO_TRADE_ITEM":
        return "携带%s通信交换" % x1, ""
    if m == "EVO_CRITICAL_HIT":
        return "一场对战中击中要害3次", ""
    if m == "EVO_DAMAGE_LOCATION":
        return "受到%s以上伤害后" % p1, "（不濒死，再走到特定地点）"
    if m == "EVO_MEGA":
        kind = {"MEGA_VARIANT_PRIMAL": "原始回归", "MEGA_VARIANT_ULTRA_BURST": "究极爆发"}.get(p3, "超级进化")
        return kind, ("（学会%s）" if p1.startswith("MOVE_") else "（携带%s）") % x1 if x1 else ""
    if m == "EVO_GIGANTAMAX":
        return "超极巨化", ""
    if m == "EVO_AWAKEN":
        return "觉醒形态", GENDER_NOTE.get(p3, "")
    warn("未知进化方式: %s" % m)
    return "满足特定条件后升级", ""

for evs in evolutions.values():
    merged = []
    for e in evs:  # 同一来源到同一目标的多条地点进化合并成一条 (如好胜蟹: 四个地点任选)
        same = next((x for x in merged if e["method"] == "EVO_MAP" == x["method"] and x["to"] == e["to"]), None)
        if same:
            same["maps"].append(mapsec_zh(e["p1"]))
            continue
        if e["method"] == "EVO_MAP":
            e["maps"] = [mapsec_zh(e["p1"])]
        merged.append(e)
    evs[:] = merged  # 原地替换, 物种记录引用的是同一列表
    for e in evs:
        e["text"], e["note"] = describe_evo(e)
for evs in evolutions.values():
    for e in evs:
        for k in ("p1", "p3", "maps"):
            e.pop(k, None)

# ---------------------------------------------------------------- 蛋招式沿用进化链最初形态
# 同一进化链都用最初形态的蛋招式表 (妙蛙草/妙蛙花/超级妙蛙花都用妙蛙种子的); 沿进化关系往前追:
# 普通进化的来源优先, 特殊形态取同图鉴编号的基础形态; 最初形态没有表时沿链往后取第一个有表的
SPECIAL_EVO = ("EVO_MEGA", "EVO_GIGANTAMAX", "EVO_AWAKEN")
dex_of = {r["id"]: r["dex"] for r in species_list}
parents_main, parents_special = {}, {}
for src in sorted(evolutions):
    for e in evolutions[src]:
        if e["to"] is not None and e["to"] != src:
            (parents_special if e["method"] in SPECIAL_EVO else parents_main).setdefault(e["to"], []).append(src)

def evo_parent(x):
    if x in parents_main:
        return parents_main[x][0]
    cand = parents_special.get(x, [])
    same_dex = [p for p in cand if dex_of.get(p) == dex_of.get(x)]
    return (same_dex or cand or [None])[0]

egg_inherited = 0
for r in species_list:
    path = [r["id"]]
    while True:
        p = evo_parent(path[-1])
        if p is None or p in path:
            break
        path.append(p)
    src = next((x for x in reversed(path) if egg_moves.get(x)), None)
    r["egg"] = egg_moves.get(src, []) if src is not None else []
    egg_inherited += src is not None and src != r["id"]
print("蛋招式沿用进化链最初形态: %d 个物种" % egg_inherited)

# ---------------------------------------------------------------- 精灵图

front_dir = os.path.join(DPE, "graphics", "frontspr")
icon_dir = os.path.join(DPE, "graphics", "pokeicon")
front_map, icon_map = {}, {}

# 精灵图 png 可能在 graphics 下的其他子目录 (如飘浮泡泡在 graphics/castform), 建立 文件名 → 路径 索引
gfx_png = {}
for root_dir, _, files in os.walk(os.path.join(DPE, "graphics")):
    for fn in files:
        if fn.endswith(".png"):
            gfx_png.setdefault(fn, os.path.join(root_dir, fn))

def symbol_pic_map(table_path, symbol_re, png_dir):
    """以 Front_Pic_Table/Icon_Table 的 [SPECIES_X] = {gSymbol, ...} 为准映射精灵图"""
    result = {}
    for name, body in iter_designated_blocks(read(table_path), r"\[SPECIES_(\w+)\]\s*=\s*\{"):
        sp = sp_id(name)
        if sp is None:
            continue
        m = re.search(symbol_re, body)
        if not m:
            continue
        fn = m.group(1) + ".png"
        if fn in gfx_png:
            result[sp] = fn
    return result

front_map = symbol_pic_map(os.path.join(DPE, "src", "Front_Pic_Table.c"), r"(gFrontSprite\w+?)Tiles", front_dir)
icon_map = {}
for m in re.finditer(r"\[SPECIES_(\w+)\]\s*=\s*(gIconSprite\w+?)Tiles", read(os.path.join(DPE, "src", "Icon_Table.c"))):
    sp = sp_id(m.group(1))
    fn = m.group(2) + ".png"
    if sp is not None and fn in gfx_png:
        icon_map[sp] = fn
print("icons after icon-table:", len(icon_map))
print("symbol-mapped fronts: %d, icons: %d" % (len(front_map), len(icon_map)))

os.makedirs(os.path.join(OUT, "sprites", "front"), exist_ok=True)
os.makedirs(os.path.join(OUT, "sprites", "icon"), exist_ok=True)

def copy_png(src, dst, crop=None):
    """复制 PNG 并把调色板索引 0 设为透明(GBA 精灵透明色)。
    正面图 64 宽且高度为 64 整数倍时是同一图形的多套色板帧竖向堆叠 (如飘浮泡泡 64x256), 取第一帧"""
    try:
        from PIL import Image
    except ImportError:
        shutil.copyfile(src, dst)
        return
    im = Image.open(src)
    if crop is None and im.size[0] == 64 and im.size[1] > 64 and im.size[1] % 64 == 0:
        im = im.crop((0, 0, 64, 64))
    if im.mode != "P":
        im.convert("P").save(dst)
        return
    if crop and im.size[1] > crop[3]:
        im = im.crop(crop)
    im.save(dst, transparency=0)

for sid, fn in front_map.items():
    dst = os.path.join(OUT, "sprites", "front", "%d.png" % sid)
    if not os.path.exists(dst):
        copy_png(gfx_png[fn], dst)
for sid, fn in icon_map.items():
    dst = os.path.join(OUT, "sprites", "icon", "%d.png" % sid)
    if not os.path.exists(dst):
        copy_png(gfx_png[fn], dst, crop=(0, 0, 32, 32))
print("front: %d, icons: %d" % (len(front_map), len(icon_map)))

# ---------------------------------------------------------------- 精灵图加密
# PNG → XOR 混淆 → base64 → sprites/{front,icon}/NNN.js (页面动态加载后 canvas 解密绘制)
# 明文 PNG 随即删除, 直接抓取文件得到乱码 (密钥与 app.js 的 SPR_KEY 一致)
import base64
import sys
KEEP_PNG = "--keep-png" in sys.argv
SPR_KEY = bytes([0x5A, 0xC3, 0x11, 0x9E, 0x37, 0x6B, 0xD2, 0x84,
                 0x1F, 0xA6, 0x48, 0xE0, 0x73, 0xCB, 0x95, 0x2D])

def encrypt_sprite_dir(pdir, kind, kind_id):
    n = 0
    for fn in os.listdir(pdir):
        if not fn.endswith(".png"):
            continue
        sid = int(fn[:-4])
        with open(os.path.join(pdir, fn), "rb") as f:
            raw = f.read()
        seed = (sid * 31 + kind_id * 7) & 0xFF
        enc = bytes(b ^ SPR_KEY[(i + seed) % len(SPR_KEY)] for i, b in enumerate(raw))
        b64 = base64.b64encode(enc).decode()
        with open(os.path.join(pdir, "%d.js" % sid), "w") as f:
            f.write('__sprData("%s",%d,"%s");' % (kind, sid, b64))
        if not KEEP_PNG:
            os.remove(os.path.join(pdir, fn))
        n += 1
    return n

n1 = encrypt_sprite_dir(os.path.join(OUT, "sprites", "front"), "front", 0)
n2 = encrypt_sprite_dir(os.path.join(OUT, "sprites", "icon"), "icon", 1)
print("加密精灵图: front %d, icon %d%s" % (n1, n2, " (保留明文PNG)" if KEEP_PNG else ", 明文PNG已删除"))

# ---------------------------------------------------------------- 繁体中文 (OpenCC 简→台湾繁体)
# 页面在浏览器端按需把简体转成繁体, 这里只打包网站语料(数据 + 页面文字)实际用到的单字和词组。
# 词典取自 tools/opencc (OpenCC, Apache-2.0): 词组最长匹配 → 单字 → 台湾用字; 下面两张表修正专有名词
HANT_POST_FIX = {"巖": "岩"}  # OpenCC 通用繁体用「巖」, 台湾标准与官方译名用「岩」(隆隆岩/大岩蛇…)
HANT_WORD_FIX = {"尼多后": "尼多后", "焰后蜥": "焰后蜥",  # 后 = 皇后
                 "振翼发": "振翼髮", "超极巨万雷轰顶": "超極巨萬雷轟頂"}

def load_opencc(name):
    d = {}
    for line in read(os.path.join(OUT, "tools", "opencc", name + ".txt")).splitlines():
        if line and not line.startswith("#"):
            k, _, v = line.partition("\t")
            if v:
                d[k] = v.split(" ")
    return d

oc_stc, oc_stp, oc_twv, oc_tsc = (load_opencc(n) for n in ("STCharacters", "STPhrases", "TWVariants", "TSCharacters"))

def tw_final(t):
    """OpenCC 繁体 → 台湾用字 → 专有名词修正"""
    return "".join(HANT_POST_FIX.get(c, c) for c in "".join(oc_twv.get(c, [c])[0] for c in t))

def oc_char(c):
    return tw_final(oc_stc[c][0]) if c in oc_stc else c

oc_phrases = {k: tw_final(v[0]) for k, v in oc_stp.items()}
oc_phrases.update(HANT_WORD_FIX)
oc_maxlen = max(len(k) for k in oc_phrases)

def to_hant(text, phrases, maxlen, char_of, used=None):
    out, i = [], 0
    while i < len(text):
        for n in range(min(maxlen, len(text) - i), 1, -1):
            seg = text[i:i + n]
            if seg in phrases:
                out.append(phrases[seg])
                if used is not None:
                    used[seg] = phrases[seg]
                i += n
                break
        else:
            out.append(char_of(text[i]))
            i += 1
    return "".join(out)

hant_corpus = set()
for r in species_list:
    hant_corpus.update([r["zh"], r["flavor"], r["formLabel"], r["growth"]] + r["heldItems"] + r["eggGroups"])
    for e in r["evolutions"]:
        hant_corpus.update([e["text"], e["note"]])
for m in move_list:
    hant_corpus.update([m["zh"], m["desc"], m["target"], m["split"]])
for a in abil_list:
    hant_corpus.update([a["zh"], a["desc"]])
for c in move_cats:
    hant_corpus.update([c["n"], c["d"]])
hant_corpus.update(t["zh"] for t in type_list)
for fn in ("app.js", "index.html"):
    hant_corpus.update(re.findall(r"[\u4e00-\u9fff][\u4e00-\u9fff\u3000-\u303f\uff00-\uffef0-9A-Za-z·、，。：；！？（）「」\s]*",
                                  read(os.path.join(OUT, fn))))
hant_corpus.discard("")
hant_used = {}
hant_full = {s: to_hant(s, oc_phrases, oc_maxlen, oc_char, hant_used) for s in hant_corpus}
corpus_chars = {c for s in hant_corpus for c in s if "\u4e00" <= c <= "\u9fff"}
hant_chars = {c: oc_char(c) for c in corpus_chars if oc_char(c) != c}
hant_maxlen = max((len(k) for k in hant_used), default=1)
# 浏览器端只用精简表: 逐条复核结果与完整词典一致
hant_bad = [s for s in hant_corpus if to_hant(s, hant_used, hant_maxlen, lambda c: hant_chars.get(c, c)) != hant_full[s]]
if hant_bad:
    warn("繁体精简词典复核不一致 %d 条: %s" % (len(hant_bad), hant_bad[:3]))
# 繁→简 (搜索用): 语料里每个简体字的各种繁体写法都映射回它; 本身就是语料简体字的不映射, 免得改坏简体输入
hant_t2s = {}
for c in corpus_chars:
    for t in oc_stc.get(c, []) + [oc_char(c)]:
        for v in {t, tw_final(t)}:
            if v != c and v not in corpus_chars:
                hant_t2s.setdefault(v, c)
for t, v in oc_tsc.items():
    if len(t) == 1 and v[0] in corpus_chars and t not in corpus_chars:
        hant_t2s.setdefault(t, v[0])
hant = {"chars": hant_chars, "phrases": hant_used, "maxLen": hant_maxlen, "t2s": hant_t2s}
print("繁体词典: 单字 %d / 词组 %d / 繁→简 %d, 复核不一致 %d" % (len(hant_chars), len(hant_used), len(hant_t2s), len(hant_bad)))

# ---------------------------------------------------------------- 输出

data = {
    "meta": {"game": "火红物语", "numSpecies": NUM_SPECIES},
    "types": type_list,
    "typeChart": type_chart,
    "abilities": abil_list,
    "moves": move_list,
    "moveCats": move_cats,
    "tms": tms,
    "tutors": tutors,
    "species": species_list,
    "hant": hant,
}

os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
with open(os.path.join(OUT, "data", "data.js"), "w", encoding="utf-8") as f:
    f.write("window.PKDX = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")
print("data.js: %.2f MB" % (os.path.getsize(os.path.join(OUT, "data", "data.js")) / 1048576))

no_front = [r["id"] for r in species_list if r["id"] not in front_map]
no_icon = [r["id"] for r in species_list if r["id"] not in icon_map]
no_name = [r["constName"] for r in species_list if r["nameMissing"]]
no_desc = [r["constName"] for r in species_list if r["dex"] and not r["flavor"] and r["dex"] <= 905]
no_flav_ok = [r["constName"] for r in species_list if not r["dex"]]
print("无正面图: %d %s" % (len(no_front), no_front[:12]))
print("无图标: %d %s" % (len(no_icon), no_icon[:12]))
print("无中文名: %d %s" % (len(no_name), no_name[:12]))
print("无图鉴描述: %d %s" % (len(no_desc), no_desc[:12]))
print("无图鉴编号: %d" % len(no_flav_ok))

# 页面上显示的名字里不应再出现常量名 (VENOMOTH_MEGA / PASSHO_BERRY 这类)
CONST_LIKE = re.compile(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]*\b|\b[A-Z]{4,}\b")
shown_names = [(r["constName"], v) for r in species_list
               for v in [r["zh"]] + r["heldItems"] + [e["text"] for e in r["evolutions"]] + [e["note"] for e in r["evolutions"]]]
shown_names += [(m["en"], m["zh"]) for m in move_list if m["id"]] + [(a["en"], a["zh"]) for a in abil_list if a["id"]]
const_left = sorted({"%s: %s" % (k, v) for k, v in shown_names if v and CONST_LIKE.search(v)})
print("常量式名称残留: %d %s" % (len(const_left), const_left[:8]))
print("道具名未翻译: %d %s" % (len(item_untranslated), sorted(item_untranslated)[:8]))

with open(os.path.join(OUT, "data", "report.txt"), "w", encoding="utf-8") as f:
    f.write("== 提取警告 ==\n" + "\n".join(WARN))
    f.write("\n\n== 无正面图(%d) ==\n%s\n" % (len(no_front), no_front))
    f.write("\n== 无图标(%d) ==\n%s\n" % (len(no_icon), no_icon))
    f.write("\n== 无中文名(%d) ==\n%s\n" % (len(no_name), no_name))
    f.write("\n== 无图鉴描述(%d) ==\n%s\n" % (len(no_desc), no_desc))
    f.write("\n== 常量式名称残留(%d) ==\n%s\n" % (len(const_left), "\n".join(const_left)))
    f.write("\n== 道具名未翻译(%d, 可补进 道具名称_英-中.xlsx) ==\n%s\n" % (
        len(item_untranslated), "\n".join(sorted(item_untranslated))))
    f.write("\n== 多形态编号的默认形态判定(%d) ==\n%s\n" % (len(default_report), "\n".join(default_report)))
print("done →", OUT)
