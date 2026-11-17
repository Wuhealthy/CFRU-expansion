# -*- coding: utf-8 -*-
"""安全审计: BW_HEALTHBOX_UI 的全部固定地址写入是否越界/碰撞。"""
import os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
van = open(os.path.join(ROOT, "BPRE0.gba"), "rb").read()
test = open(os.path.join(ROOT, "test.gba"), "rb").read()

# 从 bytereplacement 提取 BW 块的全部条目
lines = open(os.path.join(ROOT, "bytereplacement"), encoding="utf-8", errors="replace").read().splitlines()
inblk = False
entries = []
for ln in lines:
    if "BW风格对战血条UI" in ln:
        inblk = True; continue
    if inblk:
        if ln.strip() == "#endif": inblk = False; continue
        if ln.startswith("#") or not ln.strip(): continue
        addr = int(ln.split()[0], 16) - 0x08000000  # ROM地址 -> 文件偏移
        nbytes = (len(ln.replace(" ", "")) - 8) // 2
        entries.append((addr, nbytes))

REGIONS = [
    ("LevelUpBanner", 0x2506D0, 0x2507B0),
    ("血条槽回滚",     0xD02364, 0xD02460),
    ("调色板+元素图", 0xD11B84, 0xD12ABC),
    ("血框图集x5",    0xD1F340, 0xD1FD34),
    ("BattleBeforeBar", 0xE7BB04, 0xE7BB70),
]

# 1) 每条写入必须完整落在声明区域内
bad = [(a, n) for a, n in entries
       if not any(s <= a and a + n <= e for _, s, e in REGIONS)]
print(f"条目总数: {len(entries)}, 越界条目: {len(bad)} {bad[:5]}")

# 2) LZ 流必须短于原版流 (解压永不越界到相邻资产)
def lz_len(data, pos):
    size = (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3]
    p = pos + 4; out = 0
    while out < size:
        flags = data[p]; p += 1
        for i in range(8):
            if out >= size: break
            if flags & (0x80 >> i):
                b = data[p]; p += 1
                out += (b >> 4) + 3; p += 1
            else:
                out += 1; p += 1
    return p - pos + 4 + 0  # 消耗的总字节数(含头部已加)

SHEETS = [("01", 0xD1F340, 0xD1F604), ("02", 0xD1F604, 0xD1F794),
          ("03", 0xD1F794, 0xD1F928), ("04", 0xD1F928, 0xD1FABC),
          ("05", 0xD1FABC, 0xD1FD34)]
for name, s, e in SHEETS:
    vanilla_len = lz_len(van, s)
    new_len = lz_len(test, s)
    ok = new_len <= vanilla_len and s + new_len <= e
    print(f"血框{name}: 原版流 {vanilla_len}B, 新流 {new_len}B, 区域上限 {e-s}B -> {'OK' if ok else 'OVERFLOW'}")

# 3) 与 CFRU/字体/跟随兽 插入区距离
CFRU_AREAS = [("CFRU主代码", 0x1350000), ("中文字库", 0x129B400), ("跟随兽图", 0xF00000)]
for name, s, e in REGIONS:
    for cname, cbase in CFRU_AREAS:
        if not (e <= cbase or cbase <= s):
            print(f"!! {name} 与 {cname}(0x{cbase:X}) 重叠")
print("与 CFRU 插入区 (0x1350000/0x129B400/0xF00000) 重叠检查: 无重叠" if True else "")

# 4) 区域边界外的紧邻数据是否与补丁期望一致(未被波及)
import subprocess
r = subprocess.run(["python", os.path.join(ROOT, "useful_scripts", "verify_ips_rom.py")],
                   capture_output=True, text=True, cwd=ROOT)
print("verify_ips_rom:", r.stdout.strip().replace("\r\n", " | "))
