# -*- coding: utf-8 -*-
"""分析 IPS 补丁调色板各索引在血框图集/元素图集中的用途，为配色映射做准备。"""
import os, struct
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "对战血条XY-Styled Battle Boxes, HP Bars and Battle Textbox")
van = open(os.path.join(ROOT, "BPRE0.gba"), "rb").read()

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
recs = [(o, m[o]) for o in order if not (0xD00000 <= o < 0xD01000)]

def patch_region(start, end):
    buf = bytearray(van[start:end].ljust(end - start, b"\x00"))
    for off, p in recs:
        if start <= off < end:
            i = off - start
            buf[i:i+len(p)] = p
    return bytes(buf)

def lz_decomp(data, pos):
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

pal_box = patch_region(0xD11B84, 0xD11BA4)
pal_bar = patch_region(0xD11BA4, 0xD11BC4)
def desc(w):
    r, g, b = w & 31, (w >> 5) & 31, (w >> 10) & 31
    return f"0x{w:04X} RGB({r*8:3d},{g*8:3d},{b*8:3d})"

print("=== 血框调色板 (D11B84) ===")
for i in range(16):
    w = struct.unpack_from("<H", pal_box, i*2)[0]
    v = struct.unpack_from("<H", van[0xD11B84:0xD11BC4], i*2)[0]
    print(f"  [{i:2d}] {desc(w)}   原版: {desc(v)}{'  (补丁保留原版)' if w == v else ''}")
print("=== 血条调色板 (D11BA4) ===")
for i in range(16):
    w = struct.unpack_from("<H", pal_bar, i*2)[0]
    v = struct.unpack_from("<H", van[0xD11BA4:0xD11BC4], i*2)[0]
    print(f"  [{i:2d}] {desc(w)}   原版: {desc(v)}{'  (补丁保留原版)' if w == v else ''}")

# 各索引在图集中的使用统计
def usage(tiles, label):
    cnt = Counter()
    for t in range(len(tiles)//32):
        for b in tiles[t*32:(t+1)*32]:
            lo, hi = b & 0xF, b >> 4
            if lo: cnt[lo] += 1
            if hi: cnt[hi] += 1
    print(f"{label}: " + "  ".join(f"{i}:{cnt[i]}" for i in range(1, 16) if cnt[i]))

sheets = [("01我方", 0xD1F340, 0xD1F604), ("02敌方", 0xD1F604, 0xD1F794),
          ("03双我", 0xD1F794, 0xD1F928), ("04双敌", 0xD1F928, 0xD1FABC),
          ("05Safari", 0xD1FABC, 0xD1FD34)]
for name, s, e in sheets:
    stream = van[s:s+4] + patch_region(s+4, e)
    tiles = lz_decomp(stream, 0)[: (e - s - 4) * 2]
    usage(tiles[:4096 if (e-s) > 1000 else 2048], f"框图{name}")

elems = patch_region(0xD11BC4, 0xD12ABC)
usage(elems, "元素图集")

# 元素图集: 每个索引出现在哪些瓦片
tile_users = {}
for t in range(120):
    idxs = set()
    for b in elems[t*32:(t+1)*32]:
        lo, hi = b & 0xF, b >> 4
        if lo: idxs.add(lo)
        if hi: idxs.add(hi)
    for i in idxs:
        tile_users.setdefault(i, []).append(t)
for i in sorted(tile_users):
    if i in (1, 2, 3): continue
    print(f"元素图集索引 {i}: 瓦片 {tile_users[i][:25]}{'...' if len(tile_users[i])>25 else ''}")
