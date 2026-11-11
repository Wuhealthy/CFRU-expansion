import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'graphics', 'Backgrounds', 'Battle_backgrounds')
DST = os.path.join(ROOT, 'pokedex_site', 'data', 'bg')
os.makedirs(DST, exist_ok=True)

NAMES = {
    'BG_Cave': '洞窟', 'BG_Cave_Scalding': '沸热洞窟', 'BG_Cave_Torma': '托玛洞窟',
    'BG_Cave_TormaDepths': '托玛深处', 'BG_Desert': '沙漠', 'BG_Forest': '森林',
    'BG_Forest_Peradon': '佩拉顿森林', 'BG_Grass': '草地', 'BG_Gym': '道馆',
    'BG_Indoor': '室内', 'BG_LongGrass': '长草地', 'BG_Mountain': '山岳',
    'BG_Pond': '池塘', 'BG_Sand': '沙地', 'BG_Snow': '雪地',
    'BG_Spooky': '幽灵', 'BG_Water': '水域',
}

out = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    key = f[:-4]
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    w, h = im.size
    top = im.crop((0, 0, 256, 112))
    name = key.lower()
    top.save(os.path.join(DST, name + '.png'), optimize=True)
    out.append((name, NAMES.get(key, key)))

print('转换', len(out), '张背景图 →', DST)
for n, zh in out:
    print(f'  {n}: {zh}')
