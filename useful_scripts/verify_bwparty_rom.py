# -*- coding: utf-8 -*-
"""校验 test.gba: BW派对区域 == 成品ROM done6, 基底侧改动未被覆盖, CFRU钩子/血条区域完好"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
us = open(os.path.join(ROOT, "Pokemon Fire Red Version(US).gba"), "rb").read()
base = open(os.path.join(ROOT, "BPRE0.gba"), "rb").read()
done6 = open(os.path.join(ROOT, "BW Patch Collection FR", "6. BW Party Screen.gba"), "rb").read()
test = open(os.path.join(ROOT, "test.gba"), "rb").read()

n = len(us)
runs = []
i = 0
while i < n:
    if us[i] != done6[i]:
        j = i
        while j < n and us[j] != done6[j]:
            j += 1
        if runs and i - runs[-1][1] <= 16:
            runs[-1][1] = j
        else:
            runs.append([i, j])
        i = j
    else:
        i += 1

# 分类: 与生成器一致
party_segs, base_side, conflict = [], [], []
for s, e in runs:
    if base[s:e] == done6[s:e]:
        continue
    if base[s:e] == us[s:e]:
        party_segs.append((s, e))
    elif done6[s:e] == us[s:e]:
        base_side.append((s, e))
    else:
        conflict.append((s, e))

allok = True
for s, e in party_segs:
    t, d = test[s:e], done6[s:e]
    if s <= 0x1200F8 < e:  # CFRU Hook 桩, 期望被钩子覆盖
        k = 0x1200F8 - s
        t = t[:k] + b"\x00" * 8 + t[k + 8:]
        d = d[:k] + b"\x00" * 8 + d[k + 8:]
    if t != d:
        allok = False
        print(f"!! {s:08X}-{e-1:08X} 与 done6 不一致")
print(f"bw派对区域({len(party_segs)}段, 钩子除外): ALL OK" if allok else "BW派对区域: FAILED")

# 基底侧/冲突段: 期望保持基底值 (不被 done6 覆盖)
kept = all(test[s:e] == base[s:e] for s, e in base_side + conflict)
print(f"基底侧改动({len(base_side)}段)+冲突段({len(conflict)}段)保持基底值: OK" if kept else "!! 基底侧改动被意外覆盖")

# CFRU 钩子保留检查
hook = test[0x1200F8:0x120100].hex()
print(f"0x1200F8 钩子字节: {hook} {'OK(CFRU钩子保留)' if hook == '004a104799fe4009' else '异常!'}")

# 函数重写桩检查: BW_PARTY_SCREEN_UI 开启时两个派对输入函数不应有 CFRU 桩
stub4 = bytes([0x10, 0xB5, 0x03, 0x4C])
clean = test[0x11FB28:0x11FB2C] != stub4 and test[0x11FEFC:0x11FF00] != stub4
print("派对输入函数无CFRU替换桩(BW界面生效): OK" if clean else "!! 派对输入函数仍有CFRU替换桩")

# 血条区域回归校验 (barslot-revert 区与基底一致即正确, 其余应 != 基底)
REGIONS_APPLY = [(0x2506D0, 0x2507B0), (0xD11B84, 0xD12ABC), (0xD1F340, 0xD1FD34), (0xE7BB04, 0xE7BB70)]
ok2 = all(test[s:e] != base[s:e] for s, e in REGIONS_APPLY)
print("血条区域条目仍在应用: OK" if ok2 else "血条区域: FAILED")
