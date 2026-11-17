# -*- coding: utf-8 -*-
"""最终校验: test.gba 的血条 UI 区域是否与 IPS 补丁期望逐字节一致。"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "对战血条XY-Styled Battle Boxes, HP Bars and Battle Textbox")
van = open(os.path.join(ROOT, "BPRE0.gba"), "rb").read()
test = open(os.path.join(ROOT, "test.gba"), "rb").read()

def parse_ips(path):
    data = open(path, "rb").read(); recs = []; pos = 5
    while pos < len(data) and data[pos:pos+3] != b"EOF":
        off = int.from_bytes(data[pos:pos+3], "big"); pos += 3
        size = int.from_bytes(data[pos:pos+2], "big"); pos += 2
        if size == 0:
            b = data[pos]; pos += 1
            recs.append((off, bytes([b]) * int.from_bytes(data[pos:pos+2], "big"))); pos += 2
        else:
            recs.append((off, data[pos:pos+size])); pos += size
    return recs

m = {}; order = []
for off, p in parse_ips(os.path.join(BASE, "Patches", "BPRE_English.ips")) + \
              parse_ips(os.path.join(BASE, "Bugfix", "Bugfix.ips")):
    if off not in m: order.append(off)
    m[off] = p
recs = [(o, m[o]) for o in order]
recs = [(o, p) for o, p in recs if not (0xD00000 <= o < 0xD01000)]

REGIONS = [
    ("LevelUpBanner", 0x2506D0, 0x2507B0),
    ("palettes+gfx",  0xD11B84, 0xD12ABC),
    ("sheets",        0xD1F340, 0xD1FD34),
    ("barslot-revert",0xD02364, 0xD02460),
    ("before-bar",    0xE7BB04, 0xE7BB70),
]

# 与 convert_ips_healthbox.py 相同的 BTB 配色重映射
import struct
RECOLOR = True
BOX_PAL_MAP = {1: 0x7BDE, 2: 0x1063, 3: 0x0421, 4: 0x1063, 5: 0x0842, 6: 0x0842, 7: 0x0842, 8: 0x0421, 9: 0x1063}
BAR_PAL_MAP = {1: 0x7BDE, 2: 0x1063, 5: 0x0C63, 6: 0x0842, 7: 0x0842, 8: 0x0421}
def apply_recolor(buf, base=0):
    out = bytearray(buf)
    for pal_off, m in ((0xD11B84, BOX_PAL_MAP), (0xD11BA4, BAR_PAL_MAP)):
        if base <= pal_off < base + len(buf):
            for idx, val in m.items():
                struct.pack_into("<H", out, pal_off - base + idx * 2, val)
    return bytes(out)

allok = True
for name, s, e in REGIONS:
    buf = bytearray(van[s:e])
    for off, p in recs:
        if s <= off < e:
            i = off - s
            buf[i:i+len(p)] = p
    expected = apply_recolor(bytes(buf), s) if not name.startswith("barslot") else bytes(buf)
    ok = expected == test[s:e]
    allok &= ok
    print(f"{name}: {'OK' if ok else 'MISMATCH'}")
print("ALL OK" if allok else "FAILED")
