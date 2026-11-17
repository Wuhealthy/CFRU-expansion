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
allok = True
for name, s, e in REGIONS:
    buf = bytearray(van[s:e])
    for off, p in recs:
        if s <= off < e:
            i = off - s
            buf[i:i+len(p)] = p
    ok = bytes(buf) == test[s:e]
    allok &= ok
    print(f"{name}: {'OK' if ok else 'MISMATCH'}")
print("ALL OK" if allok else "FAILED")
