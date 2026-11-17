# -*- coding: utf-8 -*-
"""按原 IPS 补丁 (BPRE_English.ips + Bugfix.ips) 逐字节移植 XY 风格对战血条 UI。

来源: 对战血条XY-Styled Battle Boxes, HP Bars and Battle Textbox/
策略: 数据原样移植 (调色板/元素图集/血框图集/升级横幅/转场条),
      排除战斗文本框区 (D00000-D00FFF, 与 CFRU NEW_BATTLE_TEXTBOX 冲突)。
IPS 偏移均为文件偏移; bytereplacement 条目偏移 = 文件偏移 + 0x08000000。
幂等: 重复运行只替换 bytereplacement 中同一个标记块。
"""
import os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "对战血条XY-Styled Battle Boxes, HP Bars and Battle Textbox")
BR = os.path.join(ROOT, "bytereplacement")
MARK = "##BW风格对战血条UI"
van = open(os.path.join(ROOT, "BPRE0.gba"), "rb").read()

# ---------------------------------------------------------------- parse ips
def parse_ips(path):
    data = open(path, "rb").read()
    assert data[:5] == b"PATCH"
    recs = []; pos = 5
    while pos < len(data) and data[pos:pos+3] != b"EOF":
        off = int.from_bytes(data[pos:pos+3], "big"); pos += 3
        size = int.from_bytes(data[pos:pos+2], "big"); pos += 2
        if size == 0:
            b = data[pos]; pos += 1
            recs.append((off, bytes([b]) * int.from_bytes(data[pos:pos+2], "big"))); pos += 2
        else:
            recs.append((off, data[pos:pos+size])); pos += size
    return recs

def merge(base, fix):
    m = {}; order = []
    for off, p in base + fix:
        if off not in m: order.append(off)
        m[off] = p
    return [(o, m[o]) for o in order]

recs = merge(parse_ips(os.path.join(BASE, "Patches", "BPRE_English.ips")),
             parse_ips(os.path.join(BASE, "Bugfix", "Bugfix.ips")))
print(f"ips merged: {len(recs)} records")

# 排除战斗文本框 (CFRU NEW_BATTLE_TEXTBOX 已覆盖)
recs = [(o, p) for o, p in recs if not (0xD00000 <= o < 0xD01000)]
print(f"after textbox exclusion: {len(recs)} records")

def patch_region(start, end):
    """原版数据 + 补丁记录 = 补丁 ROM 在该区的期望内容"""
    buf = bytearray(van[start:end].ljust(end - start, b"\x00"))
    for off, p in recs:
        if start <= off < end:
            i = off - start
            assert i + len(p) <= len(buf), (hex(off), hex(start))
            buf[i:i+len(p)] = p
    return bytes(buf)

# ---------------------------------------------------------------- 移植区域
# 每个区域: (名字, 文件偏移起, 文件偏移止, 是否用原版数据回滚)
REGIONS = [
    ("LevelUpBanner(调色板+图集)", 0x2506D0, 0x2507B0, False),
    ("对战调色板+元素图集",        0xD11B84, 0xD12ABC, False),
    ("血框图集x5(LZ payload)",     0xD1F340, 0xD1FD34, False),
    ("血条槽初始图集(回滚原版)",   0xD02364, 0xD02460, True),   # 补丁未改, 撤销我们的旧替换
    ("BattleBeforeBar(转场条)",    0xE7BB04, 0xE7BB70, False),
]

# ---------------------------------------------------------------- 调色板重映射: 匹配 NEW_BATTLE_TEXTBOX 主题
# BTB 主题色 (src/battle_textbox_data.h):
#   面板填充 0x1063 RGB(24,24,32) 深藏青 / 描边 0x7BDE 银白 / 阴影 0x0421 RGB(8,8,8)
RECOLOR = True
BOX_PAL_MAP = {  # 血框调色板 D11B84 (框图仅用索引1,2,3,6; 10/11为HP数字动态色保留)
    1: 0x7BDE,  # 白边框+昵称文字 -> BTB 银白描边
    2: 0x1063,  # 框体橄榄色 -> BTB 面板深藏青
    3: 0x0421,  # 黑描边/文字阴影 -> BTB 阴影
    4: 0x1063,  # (框图未用) 统一
    5: 0x0842,  # (框图未用) 藏青暗部
    6: 0x0842,  # 框体暗部渐变 -> 藏青暗部
    7: 0x0842,  # (未用)
    8: 0x0421,  # (未用)
    9: 0x1063,  # (未用)
}
BAR_PAL_MAP = {  # 血条调色板 D11BA4 (绿10/11 黄12/13 红14/15 语义色保留)
    1: 0x7BDE,  # 血条底白 -> 银白 (与框边框一致)
    2: 0x1063,  # 条槽轨道灰/HP数字色 -> 深藏青 (数字变藏青, 同文本框文字风格)
    5: 0x0C63,  # 中灰(条状态暗部/球图标灰) -> 藏青暗部
    6: 0x0842,  # 深灰 -> 藏青更暗部
    7: 0x0842,  # 深灰 -> 藏青暗部
    8: 0x0421,  # 深灰 -> BTB 阴影
}

def apply_recolor(buf, base=0):
    """对缓冲区应用调色板重映射; base = 缓冲区首字节对应的 ROM 文件偏移"""
    if not RECOLOR:
        return bytes(buf)
    out = bytearray(buf)
    for pal_off, m in ((0xD11B84, BOX_PAL_MAP), (0xD11BA4, BAR_PAL_MAP)):
        if not (base <= pal_off < base + len(buf)):
            continue
        for idx, val in m.items():
            i = pal_off - base + idx * 2
            struct.pack_into("<H", out, i, val)
    return bytes(out)

entries = []
test = open(os.path.join(ROOT, "test.gba"), "rb").read()
for name, s, e, revert in REGIONS:
    expected = van[s:e] if revert else patch_region(s, e)
    if not revert:
        expected = apply_recolor(expected, s)
    n = 0
    for i in range(0, e - s, 16):
        chunk = expected[i:i+16]
        base_chunk = van[s+i:s+i+len(chunk)]
        cur_chunk = test[s+i:s+i+len(chunk)]
        # 与原版一致且当前 ROM 也一致 -> 无需条目; 否则写入(覆盖旧数据/恢复原版)
        if chunk == base_chunk and cur_chunk == chunk:
            continue
        entries.append("%08X %s" % (0x08000000 + s + i,
                                    " ".join("%02X" % b for b in chunk)))
        n += 1
    print(f"{name}: {n} 条目 ({e-s} 字节区)")

# ---------------------------------------------------------------- 写入 bytereplacement
text = "#" * 60 + "\n"
text += MARK + " (XY Styled Battle Boxes, HP Bars and Battle Textbox)\n"
text += "##数据逐字节取自原 IPS 补丁 (BPRE_English + Bugfix), 由 useful_scripts/convert_ips_healthbox.py 生成\n"
text += "##排除战斗文本框区 D00000-D00FFF (使用 CFRU NEW_BATTLE_TEXTBOX)\n"
text += "##开关: src/config.h BW_HEALTHBOX_UI; IPS/Offsets 偏移为文件偏移, 条目已加 0x08000000 基址\n"
text += "#" * 60 + "\n"
text += "#ifdef BW_HEALTHBOX_UI\n"
text += "\n".join(entries) + "\n"
text += "#endif\n"

lines = open(BR, encoding="utf-8", errors="replace").read().splitlines()
start = None
for i, ln in enumerate(lines):
    if MARK in ln:
        j = i
        while j > 0 and set(lines[j-1].strip()) == {"#"}:
            j -= 1
        start = j
        break
if start is not None:
    end = None
    for i in range(len(lines) - 1, start, -1):
        if lines[i].strip() == "#endif":
            end = i
            break
    assert end is not None
    lines = lines[:start] + lines[end+1:]
    br = "\n".join(lines).rstrip("\n") + "\n\n"
else:
    br = open(BR, encoding="utf-8", errors="replace").read().rstrip("\n") + "\n\n"
open(BR, "w", encoding="utf-8", newline="\n").write(br + text)
print(f"bytereplacement updated: {len(entries)} entries, block lines={len(text.splitlines())}")

# ---------------------------------------------------------------- 自校验
# 模拟补丁应用结果, 确认每个区域与补丁 ROM 期望一致 (含重映射)
sim = bytearray(van)
for off, p in recs:
    sim[off:off+len(p)] = p
sim = apply_recolor(bytes(sim), 0)
for name, s, e, revert in REGIONS:
    exp = van[s:e] if revert else apply_recolor(patch_region(s, e), s)
    assert bytes(sim[s:e]) == exp, name
print("patch simulation check: OK")

# ---------------------------------------------------------------- 配色预览
def _lz_decomp(data, pos):
    size = (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3]
    out = bytearray(); p = pos + 4
    while len(out) < size:
        flags = data[p]; p += 1
        for i in range(8):
            if len(out) >= size: break
            if flags & (0x80 >> i):
                b = data[p]; p += 1
                ln = (b >> 4) + 3
                disp = ((b & 0xF) << 8) + data[p] + 1; p += 1
                for _ in range(ln): out.append(out[-disp])
            else:
                out.append(data[p]); p += 1
    return bytes(out)

from PIL import Image

def render(tiles, pal, tw, th, path, scale=3):
    rgb = [((w & 31)*8, ((w >> 5) & 31)*8, ((w >> 10) & 31)*8)
           for w in struct.unpack("<%dH" % (len(pal)//2), pal)]
    img = Image.new("RGB", (tw*8*scale, th*8*scale), (96, 160, 96))
    px = img.load()
    for y in range(th*8):
        for x in range(tw*8):
            t = (y//8)*tw + (x//8)
            val = tiles[t*32 + (y % 8)*4 + ((x % 8) >> 1)]
            c = (val >> (4*(x % 2))) & 0xF
            if c: px[x, y] = rgb[c]
    if scale != 1:
        img = img.resize((tw*8*scale, th*8*scale), Image.NEAREST)
    img.save(path)

new_pal = apply_recolor(patch_region(0xD11B84, 0xD11BC4), 0xD11B84)
pal_box, pal_bar = new_pal[:32], new_pal[32:64]
sim_b = bytes(sim)
tiles01 = _lz_decomp(sim_b[0xD1F340:0xD1F604], 0)[:4096]
tiles02 = _lz_decomp(sim_b[0xD1F604:0xD1F794], 0)[:2048]
render(tiles01, pal_box, 8, 16, os.path.join(ROOT, "useful_scripts", "recolor_01_player.png"))
render(tiles02, pal_box, 8, 8, os.path.join(ROOT, "useful_scripts", "recolor_02_enemy.png"))
render(sim_b[0xD11BC4:0xD12ABC], pal_bar, 59, 2,
       os.path.join(ROOT, "useful_scripts", "recolor_iface.png"), 2)
print("recolor previews written")

