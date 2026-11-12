# 一次性生成海报用站点二维码 assets/qr.png (站点 URL 固定, 换域名时重跑本脚本)
# 纯手写 QR 编码: byte mode, version 3 (29x29), ECC L (单块 52 data + 18 EC), 固定 mask 0
import os
import struct, zlib
from PIL import Image

URL = "https://wuhealthy.github.io/CFRU-expansion/"
VERSION, N = 3, 29
DATA_CW, EC_CW = 52, 18        # v3-L 单块
FORMAT_BITS = None             # 由 BCH 计算得出

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "qr.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# ---- GF(256), 本原多项式 0x11D ----
EXP = [0] * 512
LOG = [0] * 256
x = 1
for i in range(255):
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if x & 0x100:
        x ^= 0x11D
for i in range(255, 512):
    EXP[i] = EXP[i - 255]

def gmul(a, b):
    if a == 0 or b == 0:
        return 0
    return EXP[LOG[a] + LOG[b]]

def rs_gen(nsym):
    g = [1]
    for i in range(nsym):
        ng = [0] * (len(g) + 1)
        for j, c in enumerate(g):
            ng[j] ^= gmul(c, EXP[i])
            ng[j + 1] ^= c
        g = ng
    inv = EXP[255 - LOG[g[0]]]          # 归一化首一多项式
    return [gmul(c, inv) for c in g]

def rs_encode(data, nsym):
    g = rs_gen(nsym)
    res = [0] * nsym
    for b in data:
        f = b ^ res[0]
        res = res[1:] + [0]
        for i in range(nsym):
            res[i] ^= gmul(g[i + 1], f)
    return res

def tobits(v, n):
    return [(v >> (n - 1 - i)) & 1 for i in range(n)]

# ---- 数据编码 ----
payload = URL.encode("utf-8")
assert len(payload) <= 42 + 8, "URL 过长需升 version"
bits = tobits(4, 4) + tobits(len(payload), 8)          # byte mode + 8bit 计数 (v1-9)
for b in payload:
    bits += tobits(b, 8)
cap = DATA_CW * 8
bits += [0] * min(4, cap - len(bits))                  # terminator
bits += [0] * ((8 - len(bits) % 8) % 8)                # 对齐字节
i = 0
while len(bits) < cap:                                  # pad EC/11 交替
    bits += tobits((0xEC, 0x11)[i % 2], 8)
    i += 1
cw = []
for k in range(0, cap, 8):
    v = 0
    for j in range(8):
        v = (v << 1) | bits[k + j]
    cw.append(v)
seq = cw + rs_encode(cw, EC_CW)

# ---- 矩阵: 功能图案 ----
m = [[None] * N for _ in range(N)]

def setfinder(r0, c0):
    for dr in range(-1, 8):
        for dc in range(-1, 8):
            rr, cc = r0 + dr, c0 + dc
            if 0 <= rr < N and 0 <= cc < N:
                m[rr][cc] = (0 <= dr <= 6 and 0 <= dc <= 6) and \
                    (dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4))

setfinder(0, 0)
setfinder(0, N - 7)
setfinder(N - 7, 0)
for dr in range(-2, 3):                                 # alignment (22,22)
    for dc in range(-2, 3):
        m[22 + dr][22 + dc] = max(abs(dr), abs(dc)) != 1
for i in range(N):                                      # timing
    if m[6][i] is None:
        m[6][i] = i % 2 == 0
    if m[i][6] is None:
        m[i][6] = i % 2 == 0
m[N - 8][8] = True                                      # dark module

# ---- 数据放置 (zigzag, 记录数据格) ----
stream = []
for b in seq:
    stream += tobits(b, 8)
data_cells = []
bi = 0
col = N - 1
while col > 0:
    if col == 6:
        col -= 1
    for vert in range(N):
        upward = ((col + 1) & 2) == 0
        r = (N - 1 - vert) if upward else vert
        for c in (col, col - 1):
            if m[r][c] is None:
                dark = bi < len(stream) and stream[bi] == 1
                bi += 1
                m[r][c] = dark
                data_cells.append((r, c))
    col -= 2

# ---- mask 0: (r+c)%2==0 翻转数据格 ----
for r, c in data_cells:
    if (r + c) % 2 == 0:
        m[r][c] = not m[r][c]

# ---- 格式信息 (ECC L=01, mask 0=000), BCH(15,5) + 掩码 0x5412 ----
data = (1 << 3) | 0
rem = data
for _ in range(10):
    rem = (rem << 1) ^ ((rem >> 9) * 0x537)
fbits_int = ((data << 10) | rem) ^ 0x5412
fbits = [(fbits_int >> i) & 1 for i in range(15)]       # LSB 对应 (col8,row0)

def fm(r, c, v):
    m[r][c] = bool(v)

for i in range(6):
    fm(i, 8, fbits[i])
fm(7, 8, fbits[6])
fm(8, 8, fbits[7])
fm(8, 7, fbits[8])
for i in range(9, 15):
    fm(8, 14 - i, fbits[i])
for i in range(8):
    fm(8, N - 1 - i, fbits[i])
for i in range(8, 15):
    fm(N - 15 + i, 8, fbits[i])

# ---- 出图 ----
SCALE, QUIET = 12, 4
size = (N + QUIET * 2) * SCALE
img = Image.new("RGB", (size, size), (255, 255, 255))
px = img.load()
ink = (17, 17, 17)
for r in range(N):
    for c in range(N):
        if m[r][c]:
            for dr in range(SCALE):
                for dc in range(SCALE):
                    px[(c + QUIET) * SCALE + dc, (r + QUIET) * SCALE + dr] = ink
img.save(OUT)
print("qr.png OK,", size, "x", size, "format_bits=0x%04x" % fbits_int)
