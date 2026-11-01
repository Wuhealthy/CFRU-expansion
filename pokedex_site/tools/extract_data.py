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
abil_desc_by_name = {label[5:]: t for label, t in abil_descs.items() if label.startswith("DESC_")}

abil_list = []
for name, idx in sorted(abil_index.items(), key=lambda kv: kv[1]):
    abil_list.append({
        "id": idx,
        "en": name,
        "zh": abil_name_by_id.get(idx) or pretty_en(name, "ABILITY"),
        "desc": abil_desc_by_name.get(name, "").replace("\\n", ""),
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

# FROSTBITE 在 config.h 中已定义 → 取 #ifdef 分支
move_descs = parse_string_file(os.path.join(CFRU, "strings", "attack_descriptions.string"), macros={"FROSTBITE"})
move_desc_by_name = {label[5:]: t for label, t in move_descs.items() if label.startswith("DESC_")}

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
    move_list.append({
        "id": idx,
        "en": name,
        "zh": move_zh_comment.get(name) or pretty_en(name, "MOVE"),
        "type": type_id,
        "power": power,
        "acc": acc,
        "pp": num("pp"),
        "priority": num("priority"),
        "split": split,
        "target": TARGET_ZH.get(field("target"), ""),
        "desc": move_desc_by_name.get(name, "").replace("\\n", ""),
    })
print("moves:", len(move_list))

# ---------------------------------------------------------------- 物品

item_index = parse_defines(read(os.path.join(CFRU, "include", "constants", "items.h")), "ITEM_")

ITEM_ZH = {
    "NONE": "", "TM_NONE": "",
    "THUNDER_STONE": "雷之石", "FIRE_STONE": "火之石", "WATER_STONE": "水之石",
    "LEAF_STONE": "叶之石", "MOON_STONE": "月之石", "SUN_STONE": "日之石",
    "SHINY_STONE": "光之石", "DUSK_STONE": "暗之石", "DAWN_STONE": "觉醒之石",
    "ICE_STONE": "冰之石", "KINGS_ROCK": "王者之证", "METAL_COAT": "金属膜",
    "DRAGON_SCALE": "龙之鳞片", "DRAGON_FANG": "龙之牙", "UPGRADE": "升级数据",
    "DUBIOUS_DISC": "可疑修补数据", "PROTECTOR": "护具", "ELECTIRIZER": "电力增幅器",
    "MAGMARIZER": "熔岩增幅器", "RAZOR_CLAW": "锐利之爪", "RAZOR_FANG": "锐利之牙",
    "REAPER_CLOTH": "灵界之布", "DEEP_SEA_TOOTH": "深海之牙", "DEEP_SEA_SCALE": "深海鳞片",
    "PRISM_SCALE": "美丽鳞片", "WHIPPED_DREAM": "奶油糖果", "SACHET": "香包",
    "SACRED_ASH": "圣灰", "EVERSTONE": "不变之石", "OVAL_STONE": "圆形之石",
    "STRAWBERRY_SWEET": "草莓糖饰", "LOVE_SWEET": "爱心糖饰", "BERRY_SWEET": "野莓糖饰",
    "CLOVER_SWEET": "三叶草糖饰", "FLOWER_SWEET": "花朵糖饰", "STAR_SWEET": "星星糖饰",
    "RIBBON_SWEET": "蝴蝶结糖饰", "CRACKED_POT": "破裂的茶壶", "CHIPPED_POT": "缺损的茶壶",
    "GALARICA_CUFF": "伽勒豆蔻手环", "GALARICA_WREATH": "伽勒豆蔻花环",
    "AUSPICIOUS_ARMOR": "庆贺之铠", "MALICIOUS_ARMOR": "诅咒之铠",
    "LEADERS_CREST": "首领的证明", "SYRUPY_APPLE": "蜜露苹果",
    "SCROLL_OF_DARKNESS": "恶之挂轴", "SCROLL_OF_WATERS": "水之挂轴",
    "LINKING_CORD": "联系绳", "METAL_ALLOY": "复合金属", "MASTER_BALL": "大师球",
    "UP_GRADE": "升级数据",
    # 常见携带道具
    "AIR_BALLOON": "气球", "ABSORB_BULB": "吸水气球", "BERRY_JUICE": "树果汁",
    "BIG_MUSHROOM": "大蘑菇", "BIG_PEARL": "大珍珠", "BIG_ROOT": "大根茎",
    "BLACK_BELT": "黑带", "BLACK_GLASSES": "黑色眼镜", "BLACK_SLUDGE": "黑色淤泥",
    "BRIGHT_POWDER": "光粉", "CELL_BATTERY": "充电电池", "CHARCOAL": "木炭",
    "CLEANSE_TAG": "洁净护符", "ELECTRIC_SEED": "电气种子", "EXPERT_BELT": "达人带",
    "FLAME_ORB": "火焰宝珠", "GRASSY_SEED": "青草种子", "GRIP_CLAW": "紧缠钩爪",
    "HARD_STONE": "硬石头", "HEART_SCALE": "心之鳞片", "HONEY": "甜蜜",
    "IRON_BALL": "铁球", "LAGGING_TAIL": "后攻之尾", "LEEK": "大葱",
    "LEFTOVERS": "吃剩的东西", "LEPPA_BERRY": "苹野果", "LIFE_ORB": "生命宝珠",
    "LIGHT_BALL": "电气球", "LIGHT_CLAY": "光之黏土", "LUCKY_EGG": "幸运蛋",
    "LUCKY_PUNCH": "幸运拳套", "LUMINOUS_MOSS": "光苔", "LUM_BERRY": "木子果",
    "MAGNET": "磁铁", "MAX_REVIVE": "活力块", "MENTAL_HERB": "心灵香草",
    "METAL_POWDER": "金属粉", "METRONOME": "计数器", "MIRACLE_SEED": "奇迹种子",
    "MISTY_SEED": "薄雾种子", "MOOMOO_MILK": "哞哞鲜奶", "MYSTIC_WATER": "神秘水滴",
    "NEVER_MELT_ICE": "不融冰", "NUGGET": "金珠", "OCCA_BERRY": "卡卡果",
    "ORAN_BERRY": "橙橙果", "PEARL": "珍珠", "PECHA_BERRY": "桃桃果",
    "PERSIM_BERRY": "柿仔果", "POISON_BARB": "毒针", "POTION": "伤药",
    "POWER_HERB": "力量香草", "PRETTY_WING": "美丽羽毛", "PSYCHIC_SEED": "超能种子",
    "QUICK_CLAW": "先制之爪", "QUICK_POWDER": "快速粉", "RAWST_BERRY": "莓莓果",
    "REVIVE": "活力碎片", "SHARP_BEAK": "锐利鸟喙", "SHED_SHELL": "脱壳",
    "SILVER_POWDER": "银粉", "SITRUS_BERRY": "文柚果", "SMOKE_BALL": "烟雾球",
    "SNOWBALL": "雪球", "SOFT_SAND": "柔软沙子", "SPELL_TAG": "诅咒之符",
    "STARDUST": "星星沙子", "STAR_PIECE": "星星碎片", "STICKY_BARB": "粘着钩刺",
    "THICK_CLUB": "粗骨头", "TINY_MUSHROOM": "小蘑菇", "TWISTED_SPOON": "弯曲汤匙",
    "WACAN_BERRY": "瓦卡果", "WIDE_LENS": "广角镜",
    # 莓果 (一至三代, 官方译名)
    "CHERI_BERRY": "樱子果", "CHESTO_BERRY": "零余果", "ASPEAR_BERRY": "利木果",
    "SITRUS_BERRY": "文柚果",
}
# 超级进化石 (从 DPE include/items.h 的 MEGA 命名自动生成中文名)
for m in re.finditer(r"#define\s+ITEM_(\w*ITE\w*)\s+\d+", read(os.path.join(DPE, "include", "items.h"))):
    pass  # 英文回退即可，不强行翻译

def item_zh(expr):
    """ITEM_XXX 表达式 → 中文名"""
    expr = (expr or "").strip().rstrip(",").strip()
    m = re.match(r"ITEM_(\w+)$", expr)
    if not m:
        return ""
    name = m.group(1)
    if name in ITEM_ZH:
        return ITEM_ZH[name]
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
tms, tm_moves = [], []
blk = re.search(r"const u16 gTMHMMoves\[[^\]]*\]\s*=\s*\{(.*?)\n\s*\};", tm_text, re.S)
if blk:
    for i, line in enumerate(blk.group(1).splitlines()):
        mm = re.match(r"\s*MOVE_(\w+)\s*,?\s*(?://\s*(\d+)\s*(.*))?", line)
        if not mm or not mm.group(1):
            continue
        mid = move_index.get(mm.group(1), 0)
        tm_moves.append(mid)
        zh = (mm.group(3) or "").strip()
        if not zh and mid < len(move_list):
            zh = move_list[mid]["zh"]
        tms.append({"no": i + 1, "move": mid, "zh": zh})
print("TMs:", len(tms))

def parse_compat_dir(dpath):
    compat = {}
    if not os.path.isdir(dpath):
        return compat
    for fn in sorted(os.listdir(dpath)):
        if not fn.lower().endswith(".txt"):
            continue
        m = re.match(r"(\d+)", fn)
        if not m:
            continue
        no = int(m.group(1))
        sps = []
        for line in read(os.path.join(dpath, fn)).splitlines():
            s = line.strip()
            if not s or re.match(r"^(TM|TR|HM)\d*\s*[:\-]", s):
                continue
            if s.startswith("SPECIES_"):
                s = s[8:]
            sid = sp_id(s)
            if sid is not None:
                sps.append(sid)
        compat[no] = sps
    return compat

tm_compat = parse_compat_dir(os.path.join(DPE, "src", "tm_compatibility"))
tutor_compat = parse_compat_dir(os.path.join(DPE, "src", "tutor_compatibility"))

tutors, tutor_moves = [], []
blk = re.search(r"const u16 gMoveTutorMoves\[[^\]]*\]\s*=\s*\{(.*?)\n\s*\};", tm_text, re.S)
if blk:
    for i, line in enumerate(blk.group(1).splitlines()):
        mm = re.match(r"\s*MOVE_(\w+)\s*,?\s*(?://\s*(\d+)\s*(.*))?", line)
        if not mm or not mm.group(1):
            continue
        mid = move_index.get(mm.group(1), 0)
        tutor_moves.append(mid)
        tutors.append({"no": i + 1, "move": mid})
print("tutors:", len(tutors), "tm_compat:", len(tm_compat), "tutor_compat:", len(tutor_compat))

# ---------------------------------------------------------------- 进化

EVO_ZH = {
    "EVO_FRIENDSHIP": "亲密度足够时升级", "EVO_FRIENDSHIP_DAY": "白天亲密度足够时升级",
    "EVO_FRIENDSHIP_NIGHT": "夜晚亲密度足够时升级", "EVO_LEVEL": "等级提升",
    "EVO_TRADE": "通信交换", "EVO_TRADE_ITEM": "携带道具通信交换", "EVO_ITEM": "使用道具",
    "EVO_LEVEL_ATK_GT_DEF": "Lv.提升（攻击>防御）", "EVO_LEVEL_ATK_EQ_DEF": "Lv.提升（攻击=防御）",
    "EVO_LEVEL_ATK_LT_DEF": "Lv.提升（攻击<防御）", "EVO_LEVEL_SILCOON": "Lv.提升（性格值末位<5）",
    "EVO_LEVEL_CASCOON": "Lv.提升（性格值末位≥5）", "EVO_LEVEL_NINJASK": "等级提升",
    "EVO_LEVEL_SHEDINJA": "队伍有空位且有精灵球时升级", "EVO_BEAUTY": "美丽度足够时升级",
    "EVO_RAINY_FOGGY_OW": "下雨或起雾时升级", "EVO_MOVE_TYPE": "学会对应属性招式后升级",
    "EVO_TYPE_IN_PARTY": "队伍中有对应属性宝可梦时升级", "EVO_MAP": "在特定地点升级",
    "EVO_MALE_LEVEL": "雄性达到等级后升级", "EVO_FEMALE_LEVEL": "雌性达到等级后升级",
    "EVO_LEVEL_NIGHT": "夜晚升级", "EVO_LEVEL_DAY": "白天升级",
    "EVO_HOLD_ITEM_NIGHT": "夜晚携带道具升级", "EVO_HOLD_ITEM_DAY": "白天携带道具升级",
    "EVO_MOVE": "学会对应招式后升级", "EVO_OTHER_PARTY_MON": "队伍中有特定宝可梦时升级",
    "EVO_LEVEL_SPECIFIC_TIME_RANGE": "特定时段升级", "EVO_FLAG_SET": "满足特定条件后升级",
    "EVO_CRITICAL_HIT": "一场战斗中击中3次要害后升级", "EVO_NATURE_HIGH": "性格合适时升级",
    "EVO_NATURE_LOW": "性格合适时升级", "EVO_DAMAGE_LOCATION": "受伤49+后走到特定地点",
    "EVO_ITEM_LOCATION": "在特定地点使用道具", "EVO_LEVEL_HOLD_ITEM": "携带道具升到指定等级",
    "EVO_ITEM_HOLD_ITEM": "携带道具时使用指定道具", "EVO_MOVE_MALE": "雄性学会对应招式后升级",
    "EVO_MOVE_FEMALE": "雌性学会对应招式后升级", "EVO_ITEM_NIGHT": "夜晚使用道具",
    "EVO_COINS": "携带足够金币升级", "EVO_MAUSHOLD_THREE": "升级（性格值条件①）",
    "EVO_MAUSHOLD_FOUR": "升级（性格值条件②）",
    "EVO_GIGANTAMAX": "极巨化", "EVO_MEGA": "超级进化",
}
MEGA_VARIANT_ZH = {"MEGA_VARIANT_STANDARD": "", "MEGA_VARIANT_PRIMAL": "（原始回归）",
                   "MEGA_VARIANT_WISH": "（愿望）", "MEGA_VARIANT_ULTRA_BURST": "（究极爆发）"}

evolutions = {}
evo_text = read(os.path.join(DPE, "src", "Evolution Table.c"))
for name, body in iter_designated_blocks(evo_text, r"\[SPECIES_(\w+)\]\s*=\s*\{"):
    sp = sp_id(name)
    if sp is None:
        warn("evo 物种未知: " + name)
        continue
    evos = []
    for entry_m in re.finditer(r"\{([^{}]*)\}", body):
        parts = [p.strip() for p in entry_m.group(1).split(",")]
        if len(parts) < 3:
            continue
        method, p1, p2, p3 = parts[0], parts[1], parts[2], (parts[3] if len(parts) > 3 else "0")
        to_m = re.match(r"SPECIES_(\w+)$", p2)
        to_sp = sp_id(to_m.group(1)) if to_m else None
        zh = EVO_ZH.get(method, method)
        param = ""
        item_m = re.match(r"ITEM_(\w+)$", p1)
        if item_m:
            izh = item_zh(p1)
            if method in ("EVO_ITEM",):
                param = ("♂" if p3 == "MON_MALE" else "♀" if p3 == "MON_FEMALE" else "") + "使用" + izh
            elif method in ("EVO_ITEM_LOCATION", "EVO_ITEM_NIGHT"):
                param = "使用" + izh
            elif method == "EVO_MEGA":
                param = izh + MEGA_VARIANT_ZH.get(p3, "")
            elif method == "EVO_TRADE_ITEM":
                param = "携带" + izh
            else:
                param = "携带" + izh
        else:
            if p1.isdigit() and method not in ("EVO_GIGANTAMAX",):
                if method in ("EVO_LEVEL", "EVO_MALE_LEVEL", "EVO_FEMALE_LEVEL", "EVO_LEVEL_NIGHT",
                              "EVO_LEVEL_DAY", "EVO_LEVEL_ATK_GT_DEF", "EVO_LEVEL_ATK_EQ_DEF",
                              "EVO_LEVEL_ATK_LT_DEF", "EVO_LEVEL_SILCOON", "EVO_LEVEL_CASCOON",
                              "EVO_LEVEL_NINJASK", "EVO_LEVEL_SHEDINJA", "EVO_LEVEL_HOLD_ITEM",
                              "EVO_LEVEL_SPECIFIC_TIME_RANGE", "EVO_DAMAGE_LOCATION",
                              "EVO_CRITICAL_HIT", "EVO_NATURE_HIGH", "EVO_NATURE_LOW"):
                    param = "Lv." + p1
        mv = re.match(r"MOVE_(\w+)$", p1)
        if mv and mv.group(1) in move_index:
            param = "学会「%s」" % move_list[move_index[mv.group(1)]]["zh"]
        tm2 = re.match(r"TYPE_(\w+)$", p1)
        if method == "EVO_MOVE_TYPE" and tm2 and tm2.group(1) in type_index:
            param = "学会%s属性招式" % TYPE_ZH.get(type_index[tm2.group(1)], "")
        pm = re.match(r"SPECIES_(\w+)$", p1)
        if method == "EVO_OTHER_PARTY_MON" and pm:
            param = "队伍中有特定宝可梦"
        if method == "EVO_GIGANTAMAX":
            param = ""
        if to_sp is not None:
            evos.append({"to": to_sp, "method": method, "methodZh": zh, "param": param})
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

    tm_ids = []
    for no, sps in tm_compat.items():
        if sp in sps and 1 <= no <= len(tm_moves) and tm_moves[no - 1]:
            tm_ids.append(tm_moves[no - 1])
    tutor_ids = []
    for no, sps in tutor_compat.items():
        if sp in sps and 1 <= no <= len(tutor_moves) and tutor_moves[no - 1]:
            tutor_ids.append(tutor_moves[no - 1])

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
            evolutions[bsp].append({"to": msp, "method": "EVO_AWAKEN", "methodZh": "觉醒形态", "param": ""})
            form_kind[msp] = "awaken"
    else:
        evolutions[bsp].append({"to": msp, "method": "EVO_AWAKEN", "methodZh": "觉醒形态", "param": "♂"})
        evolutions[bsp].append({"to": fsp, "method": "EVO_AWAKEN", "methodZh": "觉醒形态", "param": "♀"})
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

# ---------------------------------------------------------------- 精灵图

front_dir = os.path.join(DPE, "graphics", "frontspr")
icon_dir = os.path.join(DPE, "graphics", "pokeicon")
front_map, icon_map = {}, {}

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
        if os.path.exists(os.path.join(png_dir, fn)):
            result[sp] = fn
    return result

front_map = symbol_pic_map(os.path.join(DPE, "src", "Front_Pic_Table.c"), r"(gFrontSprite\w+?)Tiles", front_dir)
icon_map = {}
for m in re.finditer(r"\[SPECIES_(\w+)\]\s*=\s*(gIconSprite\w+?)Tiles", read(os.path.join(DPE, "src", "Icon_Table.c"))):
    sp = sp_id(m.group(1))
    fn = m.group(2) + ".png"
    if sp is not None and os.path.exists(os.path.join(icon_dir, fn)):
        icon_map[sp] = fn
print("icons after icon-table:", len(icon_map))
print("symbol-mapped fronts: %d, icons: %d" % (len(front_map), len(icon_map)))

os.makedirs(os.path.join(OUT, "sprites", "front"), exist_ok=True)
os.makedirs(os.path.join(OUT, "sprites", "icon"), exist_ok=True)

def copy_png(src, dst, crop=None):
    """复制 PNG 并把调色板索引 0 设为透明(GBA 精灵透明色)"""
    try:
        from PIL import Image
    except ImportError:
        shutil.copyfile(src, dst)
        return
    im = Image.open(src)
    if im.mode != "P":
        im.convert("P").save(dst)
        return
    if crop and im.size[1] > crop[3]:
        im = im.crop(crop)
    im.save(dst, transparency=0)

for sid, fn in front_map.items():
    dst = os.path.join(OUT, "sprites", "front", "%d.png" % sid)
    if not os.path.exists(dst):
        copy_png(os.path.join(front_dir, fn), dst)
for sid, fn in icon_map.items():
    dst = os.path.join(OUT, "sprites", "icon", "%d.png" % sid)
    if not os.path.exists(dst):
        copy_png(os.path.join(icon_dir, fn), dst, crop=(0, 0, 32, 32))
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

# ---------------------------------------------------------------- 输出

data = {
    "meta": {"game": "火红 横版物语", "numSpecies": NUM_SPECIES},
    "types": type_list,
    "typeChart": type_chart,
    "abilities": abil_list,
    "moves": move_list,
    "tms": tms,
    "tutors": tutors,
    "species": species_list,
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

with open(os.path.join(OUT, "data", "report.txt"), "w", encoding="utf-8") as f:
    f.write("== 提取警告 ==\n" + "\n".join(WARN))
    f.write("\n\n== 无正面图(%d) ==\n%s\n" % (len(no_front), no_front))
    f.write("\n== 无图标(%d) ==\n%s\n" % (len(no_icon), no_icon))
    f.write("\n== 无中文名(%d) ==\n%s\n" % (len(no_name), no_name))
    f.write("\n== 无图鉴描述(%d) ==\n%s\n" % (len(no_desc), no_desc))
print("done →", OUT)
