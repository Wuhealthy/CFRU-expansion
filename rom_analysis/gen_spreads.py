# Generate Battle Tower spreads for the #else gFrontierSpreads pool.
# Data sources (all from this project / its DPE repo, matching the built ROM):
#   include/constants/species.h            -> species list
#   dpe_src/src/Base_Stats.c               -> base stats + types
#   src/Tables/level_up_learnsets.c        -> learnsets (project-authoritative)
#   src/Tables/battle_moves.c              -> move power/type/split
# Output: C block appended into battle_tower_spreads.h #else gFrontierSpreads[]
import re

ROOT = r'C:\Users\Administrator\Documents\GitHub\CFRU-expansion'
DPE = r'C:\Users\Administrator\Documents\GitHub\dpe_src'

TARGET_NEW_SPREADS = 230

# ---------- parse species ----------
species_ids = {}  # name -> id
for line in open(ROOT + r'\include\constants\species.h', encoding='utf-8', errors='replace'):
    m = re.match(r'#define\s+(SPECIES_\w+)\s+(0x[0-9A-Fa-f]+|\d+)', line)
    if m:
        species_ids[m.group(1)] = int(m.group(2), 0)

# ---------- parse base stats ----------
base_stats = {}  # name -> dict
cur = None
for line in open(DPE + r'\src\Base_Stats.c', encoding='utf-8', errors='replace'):
    m = re.match(r'\s*\[(SPECIES_\w+)\]\s*=', line)
    if m:
        cur = m.group(1)
        base_stats[cur] = {}
        continue
    if cur:
        for field in ('baseHP', 'baseAttack', 'baseDefense', 'baseSpAttack', 'baseSpDefense', 'baseSpeed'):
            m = re.search(r'\.' + field + r'\s*=\s*(\d+)', line)
            if m:
                base_stats[cur][field] = int(m.group(1))
        m = re.search(r'\.type1\s*=\s*(TYPE_\w+)', line)
        if m: base_stats[cur]['type1'] = m.group(1)
        m = re.search(r'\.type2\s*=\s*(TYPE_\w+)', line)
        if m: base_stats[cur]['type2'] = m.group(1)

# ---------- parse learnsets ----------
learn_text = open(ROOT + r'\src\Tables\level_up_learnsets.c', encoding='utf-8', errors='replace').read()
species_to_learnset = {}  # species -> symbol
for m in re.finditer(r'\[(SPECIES_\w+)\]\s*=\s*(s\w+LevelUpLearnset)', learn_text):
    species_to_learnset[m.group(1)] = m.group(2)

learnsets = {}  # symbol -> [move names]
for m in re.finditer(r'static const struct LevelUpMove (s\w+LevelUpLearnset)\[\]\s*=\s*\{(.*?)\};', learn_text, re.S):
    moves = re.findall(r'LEVEL_UP_MOVE\(\s*\d+\s*,\s*(MOVE_\w+)\)', m.group(2))
    learnsets[m.group(1)] = moves

# ---------- parse battle moves ----------
mv_text = open(ROOT + r'\src\Tables\battle_moves.c', encoding='utf-8', errors='replace').read()
move_data = {}  # name -> (power, type, split)
for m in re.finditer(r'\[(MOVE_\w+)\]\s*=\s*\{([^{}]*?)\}\s*,', mv_text):
    body = m.group(2)
    if '.split' not in body:
        continue  # dynamax power table entries have no .split
    name = m.group(1)
    if name in move_data:
        continue  # keep first (real) entry
    p = re.search(r'\.power\s*=\s*(\d+)', body)
    t = re.search(r'\.type\s*=\s*(TYPE_\w+)', body)
    s = re.search(r'\.split\s*=\s*(SPLIT_\w+)', body)
    if p and t and s:
        move_data[name] = (int(p.group(1)), t.group(1), s.group(1))

# ---------- eligibility ----------
FORM_EXCLUDE = re.compile(r'(_MEGA|_GIGA|_ALOLA|_GALAR|_HISUI|_ETERNAMAX|_PRIMAL|_TERASTAL|_STELLAR|_MASK|_TOTEM|_LOW_KEY|_PIA|_CLEAN|_NOICE|_HANGRY|_ETERNATUS|_ASH|_10|_COMPLETE|_POWER|_SPEED|_ATTACK|_DEFENSE|_SPLASH|_RED_STRIPED|_BLUE_STRIPED|_YELLOW_STRIPED|_FROST|_FAN|_MOW|_HEAT|_WASH|_ORIGINAL|_CONFINED|_CROWNED|_ICE_FACE|_NOICE)'
)
# keep a few famous usable forms
FORM_ALLOW = {'SPECIES_ROTOM_WASH', 'SPECIES_HOOPA_UNBOUND'}

def bst(n):
    s = base_stats.get(n)
    if not s or len(s) < 8:
        return 0
    return s['baseHP'] + s['baseAttack'] + s['baseDefense'] + s['baseSpAttack'] + s['baseSpDefense'] + s['baseSpeed']

candidates = []
for name in species_ids:
    if name == 'SPECIES_NONE' or name in FORM_ALLOW:
        pass
    elif FORM_EXCLUDE.search(name):
        continue
    if name not in base_stats or len(base_stats[name]) < 8:
        continue
    lsym = species_to_learnset.get(name)
    if not lsym:
        continue
    lm = learnsets.get(lsym, [])
    usable = [mv for mv in lm if mv in move_data and move_data[mv][0] >= 40]
    if len(usable) < 3:
        continue
    candidates.append((name, bst(name)))

candidates = [c for c in candidates if c[1] >= 400]
# blacklist classic mid-evolutions that slip past the BST filter
MID_BLACKLIST = {
    'SPECIES_IVYSAUR','SPECIES_CHARMELEON','SPECIES_WARTORTLE','SPECIES_GOLBAT',
    'SPECIES_HAUNTER','SPECIES_DRAGONAIR','SPECIES_MACHOKE','SPECIES_GRAVELER',
    'SPECIES_PONYTA','SPECIES_SEADRA','SPECIES_GLOOM','SPECIES_PARASECT',
    'SPECIES_KADABRA','SPECIES_MAGNETON','SPECIES_MURKROW','SPECIES_KIRLIA',
    'SPECIES_VIBRAVA','SPECIES_VIBRADA','SPECIES_SHELGON','SPECIES_METANG',
    'SPECIES_LAIRON','SPECIES_MARSHTOMP','SPECIES_COMBUSKEN','SPECIES_GROVYLE',
    'SPECIES_PRINPLUP','SPECIES_MONFERNO','SPECIES_GROTLE','SPECIES_LUCARIO_MID',
    'SPECIES_FRAXURE','SPECIES_SHELGON','SPECIES_FLAAFFY','SPECIES_BAYLEEF',
    'SPECIES_QUILAVA','SPECIES_CROCONAW','SPECIES_FURRET','SPECIES_SKARMORY_MID',
}
candidates = [c for c in candidates if c[0] not in MID_BLACKLIST]
print('eligible species:', len(candidates))

# Prefer spreading across BST ranges so the engine's streak difficulty ramp
# (IsPokemonBannedBasedOnStreak: <520 early, <540 mid, <570 late) has material
# at every stage. Band proportions: 55% sub-520, 25% 520-570, 20% 570+.
import random
random.seed(0x8421)
band_low = [c for c in candidates if c[1] < 520]
band_mid = [c for c in candidates if 520 <= c[1] < 570]
band_high = [c for c in candidates if c[1] >= 570]
print('bands: low %d mid %d high %d' % (len(band_low), len(band_mid), len(band_high)))

def take_band(band, want):
    if len(band) <= want:
        return list(band)
    # deterministic sample spread across the band (sorted then stride-sample)
    band = sorted(band, key=lambda t: (t[1], t[0]))
    step = len(band) / want
    return [band[int(i * step)] for i in range(want)]

n_low = TARGET_NEW_SPREADS * 55 // 100
n_mid = TARGET_NEW_SPREADS * 25 // 100
n_high = TARGET_NEW_SPREADS - n_low - n_mid
selected = take_band(band_low, n_low) + take_band(band_mid, n_mid) + take_band(band_high, n_high)
random.shuffle(selected)  # mix bands so no sorted runs in the table
selected.sort(key=lambda t: t[0])  # deterministic final order by name
print('selected:', len(selected), 'BST range:', min(c[1] for c in selected), '-', max(c[1] for c in selected))

# ---------- spread synthesis ----------
SETUP_MOVES = {'MOVE_SWORDSDANCE','MOVE_DRAGONDANCE','MOVE_NASTYPLOT','MOVE_CALMMIND',
               'MOVE_BULKUP','MOVE_AGILITY','MOVE_IRONDEFENSE','MOVE_CALMMIND'}
RECOVERY_MOVES = {'MOVE_RECOVER','MOVE_ROOST','MOVE_SYNTHESIS','MOVE_SLACKOFF',
                  'MOVE_SOFTBOILED','MOVE_MILKDRINK','MOVE_MOONLIGHT','MOVE_MORNINGSUN',
                  'MOVE_HEALORDER','MOVE_SHOREUP','MOVE_REST'}
STATUS_MOVES = ['MOVE_THUNDERWAVE','MOVE_TOXIC','MOVE_WILLOWISP','MOVE_SLEEPPOWDER','MOVE_HYPNOSIS','MOVE_THUNDERWAVE','MOVE_SPINDLESLEEP']
PHYS_ITEMS = ['ITEM_LEFTOVERS','ITEM_MUSCLE_BAND','ITEM_LUM_BERRY','ITEM_FOCUS_SASH','ITEM_CHOICE_BAND','ITEM_SITRUS_BERRY','ITEM_EXPERT_BELT']
SPEC_ITEMS = ['ITEM_LEFTOVERS','ITEM_WISE_GLASSES','ITEM_LUM_BERRY','ITEM_FOCUS_SASH','ITEM_CHOICE_SPECS','ITEM_SITRUS_BERRY','ITEM_EXPERT_BELT']
NATURES = {
    ('phys','fast'): 'NATURE_JOLLY', ('spec','fast'): 'NATURE_TIMID',
    ('phys','slow'): 'NATURE_ADAMANT', ('spec','slow'): 'NATURE_MODEST',
}

def pick_moves(name, stats, role):
    types = {stats['type1']}
    if 'type2' in stats:
        types.add(stats['type2'])
    lsym = species_to_learnset[name]
    lm = learnsets[lsym]
    split = 'SPLIT_PHYSICAL' if role == 'phys' else 'SPLIT_SPECIAL'
    offense = []
    for mv in lm:
        d = move_data.get(mv)
        if not d: continue
        power, mtype, msplit = d
        if msplit != split or power < 55:
            continue
        offense.append((mv, power, mtype in types))
    offense.sort(key=lambda t: (-int(t[2]), -t[1]))
    moves = []
    stab_types = set()
    # STAB 1 & 2 (different types)
    for mv, power, is_stab in offense:
        if len(moves) >= 2: break
        mt = move_data[mv][1]
        if is_stab and mt not in stab_types:
            moves.append(mv); stab_types.add(mt)
    # coverage
    for mv, power, is_stab in offense:
        if len(moves) >= 4: break
        if mv in moves: continue
        if move_data[mv][1] not in types and move_data[mv][0] >= 70:
            moves.append(mv)
            break
    # utility for defensive / stall-ish mons, else second coverage / 3rd stab
    defensive = stats['baseHP'] >= 80 or stats['baseDefense'] >= 80 or stats['baseSpDefense'] >= 90
    utility = None
    if defensive:
        phys_setup = {'MOVE_SWORDSDANCE', 'MOVE_DRAGONDANCE', 'MOVE_BULKUP'}
        spec_setup = {'MOVE_NASTYPLOT', 'MOVE_CALMMIND'}
        setup_pool = (SETUP_MOVES - spec_setup) if role == 'phys' else (SETUP_MOVES - phys_setup)
        avail_setup = [m2 for m2 in lm if m2 in setup_pool]
        avail_rec = [m2 for m2 in lm if m2 in RECOVERY_MOVES]
        avail_status = [m2 for m2 in lm if m2 in STATUS_MOVES]
        if avail_rec: utility = avail_rec[0]
        elif avail_setup: utility = avail_setup[0]
        elif avail_status: utility = avail_status[0]
    if utility and utility not in moves:
        moves.append(utility)
    # fill rest
    for mv, power, is_stab in offense:
        if len(moves) >= 4: break
        if mv in moves: continue
        if move_data[mv][1] not in stab_types and power >= 65:
            moves.append(mv)
    for mv in lm:
        if len(moves) >= 4: break
        d = move_data.get(mv)
        if d and mv not in moves and d[0] >= 55:
            moves.append(mv)
    if len(moves) < 4:
        return None
    return moves[:4]

lines = []
count = 0
for name, b in selected:
    stats = base_stats[name]
    role = 'phys' if stats['baseAttack'] >= stats['baseSpAttack'] else 'spec'
    fast = stats['baseSpeed'] >= 80
    nature = NATURES[(role, 'fast' if fast else 'slow')]
    moves = pick_moves(name, stats, role)
    if not moves:
        continue
    if role == 'phys':
        ivs = 'hpIv = 31, .atkIv = 31, .defIv = 31, .spAtkIv = 0, .spDefIv = 31, .spdIv = 31'
    else:
        ivs = 'hpIv = 31, .atkIv = 0, .defIv = 31, .spAtkIv = 31, .spDefIv = 31, .spdIv = 31'
    if fast:
        evs = ('atkEv = 252, .spdEv = 252, .hpEv = 4' if role == 'phys'
               else 'spAtkEv = 252, .spdEv = 252, .hpEv = 4')
    else:
        sec = 'defEv' if stats['baseDefense'] >= stats['baseSpDefense'] else 'spDefEv'
        evs = ('atkEv = 252, .hpEv = 252, .' + sec + ' = 4' if role == 'phys'
               else 'spAtkEv = 252, .hpEv = 252, .' + sec + ' = 4')
    item = (PHYS_ITEMS[count % len(PHYS_ITEMS)] if role == 'phys' else SPEC_ITEMS[count % len(SPEC_ITEMS)])
    ability = 'FRONTIER_ABILITY_1' if (count % 4) != 3 else 'FRONTIER_ABILITY_HIDDEN'
    lines.append('\t{\n'
                 '\t\t.species = %s,\n'
                 '\t\t.nature = %s,\n'
                 '\t\t.%s,\n'
                 '\t\t.%s,\n'
                 '\t\t.ability = %s,\n'
                 '\t\t.item = %s,\n'
                 '\t\t.moves = {%s},\n'
                 '\t\t.ball = BALL_TYPE_RANDOM,\n'
                 '\t\t.forSingles = TRUE, .forDoubles = TRUE, .modifyMovesDoubles = TRUE,\n'
                 '\t},\n' % (name, nature, ivs, evs, ability, item, ', '.join(moves)))
    count += 1

print('generated spreads:', count)

# ---------- splice into battle_tower_spreads.h ----------
path = ROOT + r'\src\Tables\battle_tower_spreads.h'
text = open(path, encoding='utf-8', errors='replace').read()
marker = '\t.ball = BALL_TYPE_RANDOM,\n\t\t.forSingles = TRUE, .forDoubles = TRUE, .modifyMovesDoubles = TRUE,\n\t},\n};\n\nconst struct BattleTowerSpread gMiddleCupSpreads[] ='
idx = text.find(marker, text.find('#else'))
assert idx > 0, 'splice marker not found'
insert_at = idx + len('\t.ball = BALL_TYPE_RANDOM,\n\t\t.forSingles = TRUE, .forDoubles = TRUE, .modifyMovesDoubles = TRUE,\n\t},\n')
block = ('\n\t//==== 对战塔扩充池 (脚本生成 rom_analysis/gen_spreads.py): '
         + str(count) + ' 套, BST ' + str(selected[0][1]) + '-' + str(selected[-1][1]) + ' 覆盖连胜难度曲线 ====\n'
         + ''.join(lines))
new_text = text[:insert_at] + block + text[insert_at:]
open(path, 'w', encoding='utf-8', newline='\n').write(new_text)
print('spliced into battle_tower_spreads.h')
