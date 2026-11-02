#include "defines.h"
#include "defines_battle.h"
#include "../include/random.h"
#include "../include/event_data.h"
#include "../include/constants/flags.h"
#include "../include/constants/trainer_classes.h"
#include "../include/new/battle_rule_roulette.h"
#include "../include/new/text.h"

/*
battle_rule_roulette.c
	对战规则轮盘:训练家对战随机抽取特殊规则
	A层规则 = Battle Circus 规则旗,写入 gBattleCircusFlags 由战斗引擎原生消费
	B/C层规则 = 本模块规则位(gBattleRouletteRules),由各战斗单点消费
*/

extern const struct Trainer gTrainers[];

extern const u8 gText_RouletteElectricTerrain[];
extern const u8 gText_RouletteGrassyTerrain[];
extern const u8 gText_RouletteMistyTerrain[];
extern const u8 gText_RoulettePsychicTerrain[];
extern const u8 gText_RouletteRain[];
extern const u8 gText_RouletteSun[];
extern const u8 gText_RouletteSandstorm[];
extern const u8 gText_RouletteHail[];
extern const u8 gText_RouletteDeltaStream[];
extern const u8 gText_RouletteTrickRoom[];
extern const u8 gText_RouletteMagicRoom[];
extern const u8 gText_RouletteWonderRoom[];
extern const u8 gText_RouletteGravity[];
extern const u8 gText_RouletteFairyLock[];
extern const u8 gText_RouletteMagnetRise[];
extern const u8 gText_RouletteMist[];
extern const u8 gText_RouletteSafeguard[];
extern const u8 gText_RouletteSeaOfFire[];
extern const u8 gText_RouletteRainbow[];
extern const u8 gText_RouletteConfused[];
extern const u8 gText_RouletteTaunt[];
extern const u8 gText_RouletteTorment[];
extern const u8 gText_RouletteHealBlock[];
extern const u8 gText_RouletteThroatChop[];
extern const u8 gText_RouletteAlwaysCrit[];
extern const u8 gText_RouletteNoCrits[];
extern const u8 gText_RouletteAbilitySuppression[];
extern const u8 gText_RouletteDynamax[];
extern const u8 gText_RouletteTradeMon[];
extern const u8 gText_RouletteDouble[];
extern const u8 gText_RouletteInverse[];
extern const u8 gText_RouletteMegaBrawl[];
extern const u8 gText_RouletteNoItems[];
extern const u8 gText_RouletteNoPriority[];
extern const u8 gText_RouletteRingBan[];
extern const u8 gText_RouletteUnknown[];

u32 gBattleRouletteRules = 0;

static u8 sRouletteBannedTypes[3]; //属性封招:禁用的属性ID(战斗初始化时拷入 gNewBS->ringChallengeBannedTypes)
static const u8* sRuleAnnouncements[8];
static u8 sRuleAnnounceCount;
static u8 sRuleAnnounceIndex;

struct RoulettePoolEntry
{
	u32 value;
	bool8 isCircusFlag; //TRUE=B层入 gBattleCircusFlags 的马戏团旗,FALSE=B/C层规则位
};

//A层规则池:Battle Circus 规则旗(战斗引擎原生消费)
static const struct RoulettePoolEntry sRouletteCircusPool[] =
{
	{BATTLE_CIRCUS_ELECTRIC_TERRAIN, TRUE},
	{BATTLE_CIRCUS_GRASSY_TERRAIN, TRUE},
	{BATTLE_CIRCUS_MISTY_TERRAIN, TRUE},
	{BATTLE_CIRCUS_PSYCHIC_TERRAIN, TRUE},
	{BATTLE_CIRCUS_RAIN, TRUE},
	{BATTLE_CIRCUS_SUN, TRUE},
	{BATTLE_CIRCUS_SANDSTORM, TRUE},
	{BATTLE_CIRCUS_HAIL, TRUE},
	{BATTLE_CIRCUS_DELTA_STREAM, TRUE},
	{BATTLE_CIRCUS_TRICK_ROOM, TRUE},
	{BATTLE_CIRCUS_MAGIC_ROOM, TRUE},
	{BATTLE_CIRCUS_WONDER_ROOM, TRUE},
	{BATTLE_CIRCUS_GRAVITY, TRUE},
	{BATTLE_CIRCUS_FAIRY_LOCK, TRUE},
	{BATTLE_CIRCUS_MAGNET_RISE, TRUE},
	{BATTLE_CIRCUS_MIST, TRUE},
	{BATTLE_CIRCUS_SAFEGUARD, TRUE},
	{BATTLE_CIRCUS_SEA_OF_FIRE, TRUE},
	{BATTLE_CIRCUS_RAINBOW, TRUE},
	{BATTLE_CIRCUS_CONFUSED, TRUE},
	{BATTLE_CIRCUS_TAUNT, TRUE},
	{BATTLE_CIRCUS_TORMENT, TRUE},
	{BATTLE_CIRCUS_HEAL_BLOCK, TRUE},
	{BATTLE_CIRCUS_THROAT_CHOP, TRUE},
	{BATTLE_CIRCUS_ALWAYS_CRIT, TRUE},
	{BATTLE_CIRCUS_NO_CRITS, TRUE},
	{BATTLE_CIRCUS_ABILITY_SUPPRESSION, TRUE},
	{BATTLE_CIRCUS_DYNAMAX, TRUE},
	{BATTLE_CIRCUS_TRADE_MON, TRUE},
};

#define ROULETTE_POOL_EXTRA 6
#define ROULETTE_CIRCUS_POOL_SIZE NELEMS(sRouletteCircusPool)

//常规18属性(跳过 MYSTERY/ROOSTLESS/BLANK 等特殊属性)
static const u8 sBannableTypes[] =
{
	TYPE_NORMAL, TYPE_FIGHTING, TYPE_FLYING, TYPE_POISON, TYPE_GROUND,
	TYPE_ROCK, TYPE_BUG, TYPE_GHOST, TYPE_STEEL, TYPE_FIRE, TYPE_WATER,
	TYPE_GRASS, TYPE_ELECTRIC, TYPE_PSYCHIC, TYPE_ICE, TYPE_DRAGON,
	TYPE_DARK, TYPE_FAIRY,
};

static const u8* GetCircusRuleName(u32 flag)
{
	switch (flag) {
		case BATTLE_CIRCUS_ELECTRIC_TERRAIN: return gText_RouletteElectricTerrain;
		case BATTLE_CIRCUS_GRASSY_TERRAIN: return gText_RouletteGrassyTerrain;
		case BATTLE_CIRCUS_MISTY_TERRAIN: return gText_RouletteMistyTerrain;
		case BATTLE_CIRCUS_PSYCHIC_TERRAIN: return gText_RoulettePsychicTerrain;
		case BATTLE_CIRCUS_RAIN: return gText_RouletteRain;
		case BATTLE_CIRCUS_SUN: return gText_RouletteSun;
		case BATTLE_CIRCUS_SANDSTORM: return gText_RouletteSandstorm;
		case BATTLE_CIRCUS_HAIL: return gText_RouletteHail;
		case BATTLE_CIRCUS_DELTA_STREAM: return gText_RouletteDeltaStream;
		case BATTLE_CIRCUS_TRICK_ROOM: return gText_RouletteTrickRoom;
		case BATTLE_CIRCUS_MAGIC_ROOM: return gText_RouletteMagicRoom;
		case BATTLE_CIRCUS_WONDER_ROOM: return gText_RouletteWonderRoom;
		case BATTLE_CIRCUS_GRAVITY: return gText_RouletteGravity;
		case BATTLE_CIRCUS_FAIRY_LOCK: return gText_RouletteFairyLock;
		case BATTLE_CIRCUS_MAGNET_RISE: return gText_RouletteMagnetRise;
		case BATTLE_CIRCUS_MIST: return gText_RouletteMist;
		case BATTLE_CIRCUS_SAFEGUARD: return gText_RouletteSafeguard;
		case BATTLE_CIRCUS_SEA_OF_FIRE: return gText_RouletteSeaOfFire;
		case BATTLE_CIRCUS_RAINBOW: return gText_RouletteRainbow;
		case BATTLE_CIRCUS_CONFUSED: return gText_RouletteConfused;
		case BATTLE_CIRCUS_TAUNT: return gText_RouletteTaunt;
		case BATTLE_CIRCUS_TORMENT: return gText_RouletteTorment;
		case BATTLE_CIRCUS_HEAL_BLOCK: return gText_RouletteHealBlock;
		case BATTLE_CIRCUS_THROAT_CHOP: return gText_RouletteThroatChop;
		case BATTLE_CIRCUS_ALWAYS_CRIT: return gText_RouletteAlwaysCrit;
		case BATTLE_CIRCUS_NO_CRITS: return gText_RouletteNoCrits;
		case BATTLE_CIRCUS_ABILITY_SUPPRESSION: return gText_RouletteAbilitySuppression;
		case BATTLE_CIRCUS_DYNAMAX: return gText_RouletteDynamax;
		case BATTLE_CIRCUS_TRADE_MON: return gText_RouletteTradeMon;
	}

	return gText_RouletteUnknown;
}

//抽规则条数:冠军5;道馆馆主/四天王3;8徽章后3;其余1~3随机
static u8 GetRuleCount(void)
{
	u8 trainerClass = gTrainers[gTrainerBattleOpponent_A].trainerClass;

	if (trainerClass == CLASS_CHAMPION)
		return 5;
	if (trainerClass == CLASS_LEADER || trainerClass == CLASS_ELITE_FOUR)
		return 3;
	if (FlagGet(FLAG_BADGE08_GET))
		return 3;

	return 1 + Random() % 3;
}

void RollTrainerBattleRules(void)
{
	gBattleRouletteRules = 0;
	sRuleAnnounceCount = 0;
	sRuleAnnounceIndex = 0;

	if (VarGet(VAR_BATTLE_RULE_ROULETTE) != 1)
		return;
	if (gBattleTypeFlags & (BATTLE_TYPE_BATTLE_CIRCUS | BATTLE_TYPE_RING_CHALLENGE))
		return; //对战马戏团/Ring Challenge 自带规则,不叠加轮盘

	struct RoulettePoolEntry pool[ROULETTE_CIRCUS_POOL_SIZE + ROULETTE_POOL_EXTRA];
	u8 poolSize = 0;

	for (u8 i = 0; i < ROULETTE_CIRCUS_POOL_SIZE; ++i)
		pool[poolSize++] = sRouletteCircusPool[i];

	if (VarGet(VAR_INVERSE_BATTLE) != 1) //逆属性独立设置已开则不抽
		pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_INVERSE, FALSE};
	pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_MEGA_BRAWL, FALSE};
	pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_NO_ITEMS, FALSE};
	pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_NO_PRIORITY, FALSE};
	pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_RING_BAN, FALSE};
	if (VarGet(VAR_DOUBLE_BATTLE) != 1 //双打独立设置已开则不抽
	&& !gTrainers[gTrainerBattleOpponent_A].doubleBattle //训练家本身就是双打则无需抽
	&& gTrainers[gTrainerBattleOpponent_A].partySize >= 2) //单只训练家无法打双打
		pool[poolSize++] = (struct RoulettePoolEntry){ROULETTE_RULE_DOUBLE, FALSE};

	u8 count = GetRuleCount();
	u8 picked = 0;

	while (picked < count && poolSize > 0)
	{
		u8 idx = Random() % poolSize;
		struct RoulettePoolEntry entry = pool[idx];

		if (entry.isCircusFlag)
		{
			//天气/场地/会心组内互斥:已抽中同组时直接丢弃本条
			if ((entry.value & BATTLE_CIRCUS_WEATHER) && (gBattleCircusFlags & BATTLE_CIRCUS_WEATHER))
			{
				pool[idx] = pool[poolSize - 1];
				poolSize--;
				continue;
			}
			if ((entry.value & BATTLE_CIRCUS_TERRAIN) && (gBattleCircusFlags & BATTLE_CIRCUS_TERRAIN))
			{
				pool[idx] = pool[poolSize - 1];
				poolSize--;
				continue;
			}
			if ((entry.value & BATTLE_CIRCUS_CRIT_EFFECT) && (gBattleCircusFlags & BATTLE_CIRCUS_CRIT_EFFECT))
			{
				pool[idx] = pool[poolSize - 1];
				poolSize--;
				continue;
			}

			gBattleCircusFlags |= entry.value;

			if (entry.value == BATTLE_CIRCUS_DYNAMAX)
				gBattleTypeFlags |= BATTLE_TYPE_DYNAMAX; //极巨化规则需要类型旗配合
		}
		else
		{
			gBattleRouletteRules |= entry.value;

			switch (entry.value) {
				case ROULETTE_RULE_DOUBLE:
					gBattleTypeFlags |= BATTLE_TYPE_DOUBLE;
					break;
				case ROULETTE_RULE_MEGA_BRAWL:
					gBattleTypeFlags |= BATTLE_TYPE_MEGA_BRAWL;
					break;
				case ROULETTE_RULE_INVERSE:
					gBattleCircusFlags |= BATTLE_CIRCUS_INVERSE; //逆属性走马戏团旗消费端
					break;
			}
		}

		pool[idx] = pool[poolSize - 1];
		poolSize--;
		picked++;
	}

	if (gBattleRouletteRules == 0 && !(gBattleTypeFlags & BATTLE_TYPE_ROULETTE))
	{
		//一条都没抽中(理论不可能,池子远大于条数):不置轮盘旗
		if (gBattleCircusFlags == 0)
			return;
	}

	gBattleTypeFlags |= BATTLE_TYPE_ROULETTE;

	//生成播报列表
	for (u8 i = 0; i < ROULETTE_CIRCUS_POOL_SIZE; ++i)
	{
		if (gBattleCircusFlags & sRouletteCircusPool[i].value)
		{
			if (sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
				sRuleAnnouncements[sRuleAnnounceCount++] = GetCircusRuleName(sRouletteCircusPool[i].value);
		}
	}
	if (gBattleRouletteRules & ROULETTE_RULE_DOUBLE && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteDouble;
	if (gBattleRouletteRules & ROULETTE_RULE_INVERSE && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteInverse;
	if (gBattleRouletteRules & ROULETTE_RULE_MEGA_BRAWL && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteMegaBrawl;
	if (gBattleRouletteRules & ROULETTE_RULE_NO_ITEMS && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteNoItems;
	if (gBattleRouletteRules & ROULETTE_RULE_NO_PRIORITY && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteNoPriority;
	if (gBattleRouletteRules & ROULETTE_RULE_RING_BAN && sRuleAnnounceCount < NELEMS(sRuleAnnouncements))
		sRuleAnnouncements[sRuleAnnounceCount++] = gText_RouletteRingBan;

	//属性封招:现在抽好禁用属性,战斗初始化时拷入 gNewBS
	if (gBattleRouletteRules & ROULETTE_RULE_RING_BAN)
	{
		sRouletteBannedTypes[0] = 0;
		sRouletteBannedTypes[1] = 0;
		sRouletteBannedTypes[2] = 0;
		u8 bannedCount = 1 + Random() % 3; //禁1~3个属性

		for (u8 i = 0; i < bannedCount; ++i)
		{
			u8 type;
			bool8 dupe;
			do {
				type = sBannableTypes[Random() % NELEMS(sBannableTypes)];
				dupe = FALSE;
				for (u8 j = 0; j < i; ++j)
				{
					if (sRouletteBannedTypes[j] == type)
					{
						dupe = TRUE;
						break;
					}
				}
			} while (dupe);
			sRouletteBannedTypes[i] = type;
		}
	}
}

void ApplyTrainerBattleRulesAtBattleStart(void)
{
	if (!(gBattleTypeFlags & BATTLE_TYPE_ROULETTE))
		return;

	//属性封招:拷入 gNewBS 供 Ring Challenge 消费端读取
	if (gBattleRouletteRules & ROULETTE_RULE_RING_BAN)
	{
		gNewBS->ringChallengeBannedTypes[0] = sRouletteBannedTypes[0];
		gNewBS->ringChallengeBannedTypes[1] = sRouletteBannedTypes[1];
		gNewBS->ringChallengeBannedTypes[2] = sRouletteBannedTypes[2];
	}

	//裸装上阵:清空战斗副本中的道具(队伍里的道具不受影响,战后原样);Mega石也没了自然不能Mega
	if (gBattleRouletteRules & ROULETTE_RULE_NO_ITEMS)
	{
		for (u8 i = 0; i < gBattlersCount; ++i)
			gBattleMons[i].item = 0;
	}
}

const u8* GetNextRouletteRuleAnnouncement(void)
{
	if (sRuleAnnounceIndex >= sRuleAnnounceCount)
		return NULL;

	return sRuleAnnouncements[sRuleAnnounceIndex++]; //逐条推进,取完返回NULL由调用方复位
}

void ResetRouletteRuleAnnouncement(void)
{
	sRuleAnnounceIndex = 0;
}

void ClearBattleRuleRoulette(void)
{
	gBattleRouletteRules = 0;
	sRuleAnnounceCount = 0;
	sRuleAnnounceIndex = 0;
}
