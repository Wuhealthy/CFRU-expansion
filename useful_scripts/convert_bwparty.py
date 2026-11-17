# -*- coding: utf-8 -*-
"""
BW Party Screen 移植生成器
数据来源: BW Patch Collection FR/6. BW Party Screen.gba (打好补丁的成品ROM) 与 US 原版的逐字节 diff。
权威改动集 = {done6 != US 且 base == US} 的段 (补丁6的纯新增内容, 25段/3656字节)。
不移植:
  - base != US 且 done6 == US 的段 = 基底自己的功能改动 (如 0x120BE4 等扩展表格指针, 指回原版表会导致战斗卡死)
  - base != US 且 done6 != US 的段 = 三方冲突 (如 0x11F456 = CFRU LAST_TOTAL_TUTOR_NUM)
冲突调和: 0x1200F8-FF 处 CFRU Hook 桩由 insert.py 在 bytereplacement 之后自动重写, 无需排除。
幂等: 重复运行会按标记替换旧块。块插入在血条块标记之前, 不影响 convert_ips_healthbox.py 的拼接逻辑。
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
US = os.path.join(ROOT, "Pokemon Fire Red Version(US).gba")
BASE = os.path.join(ROOT, "BPRE0.gba")
DONE6 = os.path.join(ROOT, "BW Patch Collection FR", "6. BW Party Screen.gba")
BR = os.path.join(ROOT, "bytereplacement")
MARKER = "##BW派对界面UI(BW Patch Collection FR 补丁6 移植, 数据=成品ROM与US原版diff)"
GAP = 16  # 相邻差异间距 <=16B 合并为一段

us = open(US, "rb").read()
base = open(BASE, "rb").read()
done6 = open(DONE6, "rb").read()
assert len(us) == len(done6), "US与成品大小不一致?"
n = len(us)

# 段级 diff (以 US vs done6 为准 = 补丁6的真实改动)
runs = []
i = 0
while i < n:
    if us[i] != done6[i]:
        j = i
        while j < n and us[j] != done6[j]:
            j += 1
        if runs and i - runs[-1][1] <= GAP:
            runs[-1][1] = j
        else:
            runs.append([i, j])
        i = j
    else:
        i += 1

pure = []      # base == US: 补丁6纯新增, 移植
base_side = [] # done6 == US: 基底自己的改动, 不动
conflict = []  # 三方互异: 冲突, 不动
for s, e in runs:
    if base[s:e] == done6[s:e]:
        continue  # 基底已包含
    if base[s:e] == us[s:e]:
        pure.append((s, e))
    elif done6[s:e] == us[s:e]:
        base_side.append((s, e))
    else:
        conflict.append((s, e))

total = sum(e - s for s, e in pure)
print(f"US vs done6 共 {len(runs)} 段; 基底已含 {len(runs)-len(pure)-len(base_side)-len(conflict)} 段; "
      f"待移植 {len(pure)} 段/{total}B; 基底侧改动 {len(base_side)} 段不动; 三方冲突 {len(conflict)} 段不动")
if conflict:
    for s, e in conflict:
        print(f"  冲突: {s:08X}-{e-1:08X}  base: {base[s:e].hex()}  done6: {done6[s:e].hex()}")

# 生成条目 (16字节一行)
lines = []
for s, e in pure:
    for off in range(s, e, 16):
        chunk = done6[off:off + 16]
        lines.append("%08X %s" % (0x08000000 + off, " ".join("%02X" % b for b in chunk)))

block_lines = ["####"]
block_lines.append(MARKER)
block_lines.append("#ifdef BW_PARTY_SCREEN_UI")
block_lines += lines
block_lines.append("#endif")
block_lines.append("")
text = "\n".join(block_lines)

# 幂等拼接: 删除旧 BW_PARTY 块 (标记..其后第一个#endif), 再插入到血条块标记之前
old = open(BR, encoding="utf-8", errors="replace").read()
ls = old.splitlines()
start = None
for i, ln in enumerate(ls):
    if "##BW派对界面UI" in ln:
        j = i
        while j > 0 and set(ls[j - 1].strip()) == {"#"}:
            j -= 1
        start = j
        break
if start is not None:
    end = None
    for i in range(start, len(ls)):  # 旧块的 #endif 是 start 之后第一个, 不能从文件尾找
        if ls[i].strip() == "#endif":
            end = i
            break
    assert end is not None, "找不到旧块 #endif"
    ls = ls[:start] + ls[end + 1:]

# 找血条块标记, 插到其分隔线之前
hpos = None
for i, ln in enumerate(ls):
    if ("BW_HEALTHBOX_UI" in ln) or ("血条UI" in ln):
        hpos = i
        break
assert hpos is not None, "找不到血条块标记"
while hpos > 0 and set(ls[hpos - 1].strip()) == {"#"}:
    hpos -= 1

ls = ls[:hpos] + block_lines + ls[hpos:]
open(BR, "w", encoding="utf-8", newline="\n").write("\n".join(ls).rstrip("\n") + "\n")
print(f"bytereplacement 已更新: 新增 {len(lines)} 条目, 插入位置行 {hpos}")
