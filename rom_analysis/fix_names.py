# Replace frontier trainer name string values with Chinese names (1:1 with the .h tables)
import re

MALE = ['小豪','小凯','阿健','大介','海斗','疾风','小陆','铁平','晓东','阿杰',
        '壮壮','阿武','小澈','凯文','阿博','大卫','小峰','阿隆','志明','小德',
        '永强','阿福','小岛','凉介','大辉','阿南','小川','天马','阿庆','小岭',
        '健太','阿聪','小波','力也','阿鹏','小郑','浩然','阿虎','小关','文太',
        '阿锐','小楼','北斗','阿飞','小汪','大河','小卫','阿刚','小谷','翔太',
        '阿胜','小代','悠斗','阿雷','小泉','万里','阿德','小柴','庆介','阿蒙',
        '小星','大佑','阿坚','小森','拓海','隆之','关吉','阿佑','小洋','大志',
        '正树','英树','幸雄','彻','学','勉','丰','毅','猛','连',
        '一真','二郎','三平','四乃','五郎','六太','七海','八重','九吾','十郎',
        '京介','左京','右京','早人','光人','风人','雷人','月人','日人','星人']

FEMALE = ['小雅','小玲','小樱','小惠','阿珠','小蕾','彩香','小露','芳芳','小婷',
          '小静','阿美','小桃','梨花','露娜','阿香','小芸','真白','小枫','阿蓝',
          '小葵','结衣','阿宁','小黛','千夏','阿绿','小茜','琉璃','小蕊','黛儿',
          '小玫','安娜','小茉','茉莉','小翠','阿绮','小杏','美月','桃子','阿雪',
          '小凰','百合','阿绘','小棠','红叶','小薇','小蓝','水莲','阿铃','小舞',
          '真纪','由纪','麻衣','早纪','千惠','千寻','千鹤','美纪','美咲','美绪',
          '加奈','花恋','春香','夏树','秋穗','冬雪','月音','风花','星光','阳菜',
          '杏子','和子','京子','代子','悦子','圭子','惠子','景子','庆子','敬子',
          '亚衣','亚美','亚矢','郁美','郁惠','香织','香穗','直美','直子','奈绪',
          '理惠','理沙','梨纱','凛','凛子','铃菜','零','玲奈','泠','绫乃']

h = open('src/Tables/frontier_trainer_names.h', encoding='utf-8').read()
male_list, female_list = [], []
in_m = in_f = False
for line in h.splitlines():
    if 'gMaleFrontierNamesTable[]' in line:
        in_m, in_f = True, False
        continue
    if 'gFemaleFrontierNamesTable[]' in line:
        in_m, in_f = False, True
        continue
    if in_m and 'sTrainerName_' in line:
        male_list.append(line.strip().rstrip(',').replace('sTrainerName_', ''))
    if in_f and 'sTrainerName_' in line:
        female_list.append(line.strip().rstrip(',').replace('sTrainerName_', ''))

print('table counts: male', len(male_list), 'female', len(female_list))
assert len(set(MALE)) >= len(male_list), 'male pool too small'
assert len(set(FEMALE)) >= len(female_list), 'female pool too small'
assert len(set(MALE[:len(male_list)])) == len(male_list), 'male dupes'
assert len(set(FEMALE[:len(female_list)])) == len(female_list), 'female dupes'

mapping = {}
for k, n in enumerate(male_list):
    mapping[n] = MALE[k]
for k, n in enumerate(female_list):
    mapping[n] = FEMALE[k]

lines = open('strings/frontier_trainer_names.string', encoding='utf-8').read().splitlines()
out = []
cur = None
replaced = 0
for line in lines:
    mm = re.match(r'#org @sTrainerName_(\w+)', line.strip())
    if mm:
        cur = mm.group(1)
        out.append(line)
        continue
    if cur is not None and line.strip() and not line.strip().startswith('#'):
        val = mapping.get(cur)
        if val is not None:
            out.append(val)
            replaced += 1
        else:
            out.append(line)
        cur = None
        continue
    out.append(line)

open('strings/frontier_trainer_names.string', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('replaced:', replaced)
