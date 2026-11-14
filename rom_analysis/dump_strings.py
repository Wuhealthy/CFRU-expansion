# Dump decodable Chinese/ASCII strings from a GBA ROM using the project charmap (dict-lookup fast version)
import sys, os

onebyte = {}   # int byte -> char
pairbyte = {}  # (int,int) -> char
for line in open(os.path.join(os.path.dirname(__file__), '..', 'charmap.tbl'), encoding='utf-8-sig'):
    line = line.rstrip('\n')
    if '=' not in line: continue
    k, v = line.split('=', 1)
    if v == '\\e': v = '\x1b'
    try:
        b = bytes.fromhex(k)
    except ValueError:
        continue
    if len(b) == 1:
        onebyte[b[0]] = v
    elif len(b) == 2:
        pairbyte[(b[0], b[1])] = v

rom = open(sys.argv[1], 'rb').read()
min_cjk = int(sys.argv[2]) if len(sys.argv) > 2 else 2
out = open(sys.argv[3], 'w', encoding='utf-8')

def is_cjk(c):
    return len(c) >= 1 and ord(c[0]) > 0x2E00

n = len(rom)
i = 0
results = []
getpair = pairbyte.get
getone = onebyte.get
while i < n:
    # Prune: only start a string where a CJK pair decodes right here
    c0 = getpair((rom[i], rom[i+1])) if i+1 < n else None
    if c0 is None or not is_cjk(c0):
        i += 1
        continue
    chars = []
    cjk = 0
    j = i
    while j < n:
        c = getpair((rom[j], rom[j+1])) if j+1 < n else None
        if c is not None:
            chars.append(c)
            if is_cjk(c): cjk += 1
            j += 2
            continue
        c = getone(rom[j])
        if c is not None:
            chars.append(c)
            j += 1
            continue
        break
    if j < n and rom[j] == 0xFF and cjk >= min_cjk and len(chars) >= min_cjk:
        results.append((i, ''.join(chars)))
        i = j + 1
    else:
        i += 1

for addr, s in results:
    out.write(f'{addr:08X}\t{s}\n')
out.close()
print('done', len(results))
