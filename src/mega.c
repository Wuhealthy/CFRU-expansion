#include "defines.h"
#include "defines_battle.h"
#include "../include/link.h"
#include "../include/string_util.h"
#include "../include/constants/items.h"
#include "../include/constants/trainer_classes.h"

#include "../include/new/ability_tables.h"
#include "../include/new/battle_util.h"
#include "../include/new/build_pokemon.h"
#include "../include/new/util.h"
#include "../include/new/form_change.h"
#include "../include/new/frontier.h"
#include "../include/new/item.h"
#include "../include/new/mega.h"
#include "../include/new/mega_battle_scripts.h"
#include "../include/new/move_menu.h"
#include "../include/new/set_z_effect.h"

/*
mega.c
	functions that support mega evolution logic and execution
*/

#define TRAINER_ITEM_COUNT 4

//This file's functions:
static bool8 IsItemKeystone(u16 item);
static item_t FindTrainerKeystone(u16 trainerId);
static item_t FindPlayerKeystone(void);
static item_t FindBankKeystone(u8 bank);
extern u8 CalcMonHiddenPowerType(struct Pokemon* mon);
extern bool8 SpeciesHasHiddenPowerPhysicality(u16 species);

static const item_t sKeystoneTable[] =
{
	ITEM_MEGA_RING,

#ifdef UNBOUND
	ITEM_MEGA_BRACELET,
	ITEM_MEGA_CUFF,
	ITEM_MEGA_CHARM,
	ITEM_MEGA_BONNET,
	ITEM_MEGA_EARING,
	ITEM_MEGA_ANKLET,
	ITEM_MEGA_PENDANT,
#endif
};

const struct Evolution* CanMegaEvolve(unusedArg u8 bank, unusedArg bool8 CheckUBInstead)
{
	#ifndef MEGA_EVOLUTION_FEATURE
		return NULL;
	#else

	if (!CheckUBInstead && !MegaEvolutionEnabled(bank)) //Ultra Burst doesn't need Mega Ring
		return NULL;

	if (IsMegaZMoveBannedBattle()
	|| (!(gBattleTypeFlags & BATTLE_TYPE_TRAINER) && SIDE(bank) == B_SIDE_OPPONENT)) //Wild mons (like Rayquaza) can't Mega Evolve
		return NULL;

	pokemon_t* mon = GetBankPartyData(bank);
	const struct Evolution* evolutions = gEvolutionTable[mon->species];
	int i, j;

	for (i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if (evolutions[i].method == EVO_MEGA)
		{
			//Ignore reversion information
			if (evolutions[i].param == 0) continue;

			//Check for held item
			if ((!CheckUBInstead && evolutions[i].unknown == MEGA_VARIANT_STANDARD) || (CheckUBInstead && evolutions[i].unknown == MEGA_VARIANT_ULTRA_BURST))
			{
				if (evolutions[i].param == mon->item)
					return &evolutions[i];
			}
			else if (evolutions[i].unknown == MEGA_VARIANT_WISH && !CheckUBInstead
			&& !IsZCrystal(mon->item)) //If Mega Rayquaza holds a Z-Crystal it can't Mega Evolve
			{
				if (!(gBattleTypeFlags & BATTLE_TYPE_FRONTIER)
				|| RayquazaCanMegaEvolveInFrontierBattle())
				{
					//Check learned moves
					for (j = 0; j < MAX_MON_MOVES; ++j)
					{
						if (evolutions[i].param == mon->moves[j])
							return &evolutions[i];
					}
				}
			}
		}
	}

	return NULL;
	#endif
}

//Assumes Wish Evolution isn't important
species_t GetMegaSpecies(unusedArg u16 species, unusedArg u16 item, unusedArg const u16* moves)
{
	#ifndef MEGA_EVOLUTION_FEATURE
		return SPECIES_NONE;
	#else

	const struct Evolution* evolutions = gEvolutionTable[species];
	u32 i, j;

	for (i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if (evolutions[i].method == EVO_MEGA)
		{
			//Ignore reversion information
			if (evolutions[i].param == 0) continue;

			//Check for held item
			if (evolutions[i].unknown == MEGA_VARIANT_STANDARD || evolutions[i].unknown == MEGA_VARIANT_ULTRA_BURST)
			{
				if (evolutions[i].param == item)
					return evolutions[i].targetSpecies;
			}
			else if (evolutions[i].unknown == MEGA_VARIANT_WISH && moves != NULL)
			{
				for (j = 0; j < MAX_MON_MOVES; ++j)
				{
					if (evolutions[i].param == moves[j])
						return evolutions[i].targetSpecies;
				}
			}
		}
	}

	return SPECIES_NONE;
	#endif
}

species_t GetPrimalSpecies(unusedArg u16 species, unusedArg u16 item)
{
	#ifndef MEGA_EVOLUTION_FEATURE
		return SPECIES_NONE;
	#else

	u32 i;
	const struct Evolution* evolutions = gEvolutionTable[species];

	for (i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if ((evolutions[i].method == MEGA_EVOLUTION && evolutions[i].unknown == MEGA_VARIANT_PRIMAL && evolutions[i].param == item)) //Can Primal Evolve
			return evolutions[i].targetSpecies;
	}

	return SPECIES_NONE;
	#endif
}

ability_t GetBankMegaFormAbility(u8 megaBank, u8 foe)
{
	ability_t ability = ABILITY_NONE;
	const struct Evolution* evos;

	if (!IsAbilitySuppressed(megaBank))
	{
		evos = CanMegaEvolve(megaBank, FALSE);
		if (evos != NULL)
			ability = GetAbility1(evos->targetSpecies); //Megas can only have 1 ability
		else
		{
			//Check Ultra Burst
			evos = CanMegaEvolve(megaBank, TRUE);
			if (evos != NULL)
				ability = GetAbility1(evos->targetSpecies); //Ultra Necrozma only has 1 ability
		}

		if (ability == ABILITY_TRACE && IS_SINGLE_BATTLE)
		{
			ability_t foeAbility = *GetAbilityLocation(foe);
			if (!gSpecialAbilityFlags[foeAbility].gTraceBannedAbilities)
				ability = foeAbility; //What the Ability will become
		}
	}

	return ability;
}

//Mega进化时招式替换表：{Mega形态, 原招式, 替换后招式}
const struct MegaMoveChange gMegaMoveChanges[] =
{
	{SPECIES_ZYGARDE_MEGA, MOVE_COREENFORCER, MOVE_NIHILLIGHT},
	{SPECIES_ZYGARDE50_MEGA, MOVE_LANDSWRATH, MOVE_UNIVERSALRADIANCE},
	{SPECIES_BLAZIKEN_MEGA, MOVE_BLAZEKICK, MOVE_SUPERBURN},
	{SPECIES_MEDICHAM_MEGA, MOVE_FORCEPALM, MOVE_CHAKRAFIST},
	{SPECIES_GRENINJA_MEGA_Z, MOVE_WATERSHURIKEN, MOVE_AQUABLADE},
	{SPECIES_VENUSAUR_MEGA, MOVE_PETALBLIZZARD, MOVE_DESPERATEBLOOM},
	{SPECIES_CHARIZARD_MEGA_X, MOVE_FIREFANG, MOVE_FRENZYBLAZE},
	{SPECIES_CHARIZARD_MEGA_Y, MOVE_AIRSLASH, MOVE_CRIMSONSKY},
};

const u8* DoMegaEvolution(u8 bank)
{
	struct Pokemon* mon = GetBankPartyData(bank);
	const struct Evolution* evolutions = CanMegaEvolve(bank, FALSE);

	if (evolutions == NULL) //Check Ultra Burst if no Mega
		evolutions = CanMegaEvolve(bank, TRUE);

	if (evolutions != NULL)
	{
		gNewBS->backupAbility = ABILITY(bank); //So Abilities like Delta Stream & Neutralizing Gas are removed properly

		DoFormChange(bank, evolutions->targetSpecies, TRUE, TRUE, TRUE);

		TryMegaMoveChange(mon, evolutions->targetSpecies, bank);

		gBattleScripting.bank = bank;
		gLastUsedItem = mon->item;

		//[BUFFER][00]'s [LAST_ITEM]\nis reacting to [PLAYER_NAME]'s [BUFFER][01]!
		PREPARE_MON_NICK_BUFFER(gBattleTextBuff1, bank, gBattlerPartyIndexes[bank]);
		PREPARE_ITEM_BUFFER(gBattleTextBuff2, FindBankKeystone(bank));
		PREPARE_SPECIES_BUFFER(gBattleTextBuff3, SPECIES(bank));

		if (evolutions->unknown == MEGA_VARIANT_WISH)
			return BattleScript_MegaWish;
		else if (evolutions->unknown == MEGA_VARIANT_ULTRA_BURST)
			return BattleScript_UltraBurst;
		else
			return BattleScript_MegaEvolution;
	}
	else
		return NULL;
}

//Mega进化成功后，按 gMegaMoveChanges 表替换对应招式（队伍数据 + 战斗内数据）
void TryMegaMoveChange(struct Pokemon* mon, u16 species, u8 bank)
{
	for (u8 i = 0; i < MAX_MON_MOVES; ++i)
	{
		for (u8 j = 0; j < NELEMS(gMegaMoveChanges); ++j)
		{
			if (species == gMegaMoveChanges[j].species && mon->moves[i] == gMegaMoveChanges[j].oldMove)
			{
				u16 newMove = gMegaMoveChanges[j].newMove;
				SetMonData(mon, MON_DATA_MOVE1 + i, &newMove);
				if (bank < MAX_BATTLERS_COUNT && gBattleMons[bank].moves[i] == gMegaMoveChanges[j].oldMove)
					gBattleMons[bank].moves[i] = newMove;
				break;
			}
		}
	}
}

//战斗结束还原形态时，把替换过的招式还原回去
void RevertMegaMoveChange(struct Pokemon* mon)
{
	for (u8 i = 0; i < MAX_MON_MOVES; ++i)
	{
		for (u8 j = 0; j < NELEMS(gMegaMoveChanges); ++j)
		{
			if (mon->species == gMegaMoveChanges[j].species && mon->moves[i] == gMegaMoveChanges[j].newMove)
			{
				u16 oldMove = gMegaMoveChanges[j].oldMove;
				SetMonData(mon, MON_DATA_MOVE1 + i, &oldMove);
				break;
			}
		}
	}
}


const u8* DoPrimalReversion(u8 bank, u8 caseId)
{
	pokemon_t* mon = GetBankPartyData(bank);
	const struct Evolution* evolutions = gEvolutionTable[mon->species];
	u16 item = mon->item;

	if (item != ITEM_NONE)
	{
		for (u8 i = 0; i < EVOS_PER_MON; ++i)
		{
			if (evolutions[i].method == EVO_MEGA && evolutions[i].unknown == MEGA_VARIANT_PRIMAL && evolutions[i].param == item)
			{
				DoFormChange(bank, evolutions[i].targetSpecies, TRUE, TRUE, TRUE);

				switch (caseId) {
					case 0:
						return BattleScript_Primal;
					default:
						return BattleScript_PrimalSub;
				}
			}
		}
	}

	return NULL;
}

//觉醒(Primal Instinct)形态表：{基础形态, 觉醒后形态(公), 觉醒后形态(母)}；公母同形时两项一致
//随机野生遭遇等功能也依赖此表识别觉醒形态物种，新增觉醒形态时只需在此加一行
const struct AwakeningForm gAwakeningFormTable[] =
{
	{SPECIES_BANETTE,		SPECIES_BANETTE_M,		SPECIES_BANETTE_F},
	{SPECIES_KINGDRA,		SPECIES_KINGDRA_MEGA,	SPECIES_KINGDRAY_MEGA},
	{SPECIES_EEVEE,			SPECIES_EEVEE_HERO,		SPECIES_EEVEE_HERO},
	{SPECIES_GALVANTULA,	SPECIES_GALVANTULA_A,	SPECIES_GALVANTULA_A},
	{SPECIES_LEDIAN,		SPECIES_LEDIAN_G,		SPECIES_LEDIAN_G},
	{SPECIES_FEAROW,		SPECIES_FEAROW_MEGA,	SPECIES_FEAROW_MEGA},
	{SPECIES_CLOYSTER,		SPECIES_CLOYSTER_MEGA,	SPECIES_CLOYSTER_MEGA},
	{SPECIES_MR_MIME,		SPECIES_MR_MIME_MEGA,	SPECIES_MR_MIME_MEGA},
	{SPECIES_CARBINK,		SPECIES_CARBINK_MEGA,	SPECIES_CARBINK_MEGA},
	{SPECIES_CRYOGONAL,		SPECIES_CRYOGONAL_J,	SPECIES_CRYOGONAL_J},
	{SPECIES_AMOONGUSS,		SPECIES_AMOONGUSS_J,	SPECIES_AMOONGUSS_J},
	{SPECIES_CRUSTLE,		SPECIES_CRUSTLE_J,		SPECIES_CRUSTLE_J},
	{SPECIES_SUNFLORA,		SPECIES_SUNFLORA_J,		SPECIES_SUNFLORA_J},
	{SPECIES_CHERRIM,		SPECIES_CHERRIM_J,		SPECIES_CHERRIM_J},
	{SPECIES_PALOSSAND,		SPECIES_PALOSSAND_J,	SPECIES_PALOSSAND_J},
	{SPECIES_SWELLOW,		SPECIES_SWELLOW_J,		SPECIES_SWELLOW_J},
	{SPECIES_LOKIX,			SPECIES_LOKIX_J,		SPECIES_LOKIX_J},
	{SPECIES_WEAVILE,		SPECIES_WEAVILE_J,		SPECIES_WEAVILE_J},
	{SPECIES_SINISTCHA,		SPECIES_SINISTCHA_J,	SPECIES_SINISTCHA_J},
	{SPECIES_PANGORO,		SPECIES_PANGORO_J,		SPECIES_PANGORO_J},
	{SPECIES_EXEGGUTOR,		SPECIES_EXEGGUTOR_J,	SPECIES_EXEGGUTOR_J},
	{SPECIES_SPIRITOMB,		SPECIES_SPIRITOMB_J,	SPECIES_SPIRITOMB_J},
	{SPECIES_HAXORUS,		SPECIES_HAXORUS_MEGA,	SPECIES_HAXORUS_MEGA},
	{SPECIES_LANTURN,		SPECIES_LANTURN_MEGA,	SPECIES_LANTURN_MEGA},
	{SPECIES_ARCANINE,		SPECIES_GOLEM_MEGA,		SPECIES_GOLEM_MEGA},
	{SPECIES_RAPIDASH,		SPECIES_RAPIDASH_MEGA,	SPECIES_RAPIDASH_MEGA},
	{SPECIES_DODRIO,		SPECIES_DODRIO_MEGA,	SPECIES_DODRIO_MEGA},
	{SPECIES_HYPNO,			SPECIES_HYPNO_MEGA,		SPECIES_HYPNO_MEGA},
	{SPECIES_ELECTRODE,		SPECIES_ELECTRODE_MEGA,	SPECIES_ELECTRODE_MEGA},
	{SPECIES_MAROWAK,		SPECIES_MAROWAK_MEGA,	SPECIES_MAROWAK_MEGA},
	{SPECIES_JYNX,			SPECIES_JYNX_MEGA,		SPECIES_JYNX_MEGA},
	{SPECIES_TAUROS,		SPECIES_TAUROS_MEGA,	SPECIES_TAUROS_MEGA},
	{SPECIES_CROBAT,		SPECIES_CROBAT_MEGA,	SPECIES_CROBAT_MEGA},
	{SPECIES_JUMPLUFF,		SPECIES_JUMPLUFF_MEGA,	SPECIES_JUMPLUFF_MEGA},
	{SPECIES_DONPHAN,		SPECIES_DONPHAN_MEGA,	SPECIES_DONPHAN_MEGA},
	{SPECIES_TORKOAL,		SPECIES_TORKOAL_MEGA,	SPECIES_TORKOAL_MEGA},
	{SPECIES_FLYGON,		SPECIES_FLYGON_MEGA,	SPECIES_FLYGON_MEGA},
	{SPECIES_GRANBULL,		SPECIES_GRANBULL_MEGA,	SPECIES_GRANBULL_MEGA},
	{SPECIES_TYRANTRUM,		SPECIES_TYRANTRUM_MEGA,	SPECIES_TYRANTRUM_MEGA},
	{SPECIES_AURORUS,		SPECIES_AURORUS_MEGA,	SPECIES_AURORUS_MEGA},
	{SPECIES_WEEZING,		SPECIES_WEEZING_MEGA,	SPECIES_WEEZING_MEGA},
	{SPECIES_SHIFTRY,		SPECIES_SHIFTRY_MEGA,	SPECIES_SHIFTRY_MEGA},
	{SPECIES_CRAWDAUNT,		SPECIES_CRAWDAUNT_MEGA,	SPECIES_CRAWDAUNT_MEGA},
	{SPECIES_NINETALES,		SPECIES_NINETALES_MEGA,	SPECIES_NINETALES_MEGA},
	{SPECIES_WIGGLYTUFF,	SPECIES_WIGGLYTUFF_MEGA,SPECIES_WIGGLYTUFF_MEGA},
	{SPECIES_PYUKUMUKU,		SPECIES_PYUKUMUKU_MEGA,	SPECIES_PYUKUMUKU_MEGA},
	{SPECIES_PERSIAN,		SPECIES_VENOMOTH_MEGA,	SPECIES_VENOMOTH_MEGA},
	{SPECIES_POLIWRATH,		SPECIES_POLIWRATH_MEGA,	SPECIES_POLIWRATH_MEGA},
	{SPECIES_WYRDEER,		SPECIES_WYRDEER_MEGA,	SPECIES_WYRDEER_MEGA},
	{SPECIES_ARBOK,			SPECIES_ARBOK_MEGA,		SPECIES_ARBOK_MEGA},
	{SPECIES_SANDSLASH,		SPECIES_SANDSLASH_MEGA,	SPECIES_SANDSLASH_MEGA},
	{SPECIES_NIDOQUEEN,		SPECIES_NIDOQUEEN_MEGA,	SPECIES_NIDOQUEEN_MEGA},
	{SPECIES_NIDOKING,		SPECIES_NIDOKING_MEGA,	SPECIES_NIDOKING_MEGA},
	{SPECIES_TINKATON,		SPECIES_TINKATON_MEGA,	SPECIES_TINKATON_MEGA},
	{SPECIES_MILOTIC,		SPECIES_MILOTIC_MEGA,	SPECIES_MILOTIC_MEGA},
	{SPECIES_TROPIUS,		SPECIES_TROPIUS_MEGA,	SPECIES_TROPIUS_MEGA},
	{SPECIES_LUXRAY,		SPECIES_LUXRAY_MEGA,	SPECIES_LUXRAY_MEGA},
	{SPECIES_ROSERADE,		SPECIES_ROSERADE_MEGA,	SPECIES_ROSERADE_MEGA},
	{SPECIES_MISMAGIUS,		SPECIES_MISMAGIUS_MEGA,SPECIES_MISMAGIUS_MEGA},
	{SPECIES_ARIADOS,		SPECIES_RATICATE_MEGA,	SPECIES_RATICATE_MEGA},
	{SPECIES_MAGNEZONE,		SPECIES_MAGNEZONE_MEGA,	SPECIES_MAGNEZONE_MEGA},
	{SPECIES_RHYPERIOR,		SPECIES_RHYPERIOR_MEGA,	SPECIES_RHYPERIOR_MEGA},
	{SPECIES_ELECTIVIRE,	SPECIES_ELECTIVIRE_MEGA,SPECIES_ELECTIVIRE_MEGA},
	{SPECIES_MAGMORTAR,		SPECIES_MAGMORTAR_MEGA,	SPECIES_MAGMORTAR_MEGA},
	{SPECIES_PORYGON_Z,		SPECIES_PORYGONZ_MEGA,	SPECIES_PORYGONZ_MEGA},
	{SPECIES_DUSKNOIR,		SPECIES_DUSKNOIR_MEGA,	SPECIES_DUSKNOIR_MEGA},
	{SPECIES_NONE,			SPECIES_NONE,			SPECIES_NONE},
};

const u8* DoPrimalInstinct(u8 bank, u8 caseId)
{
    struct Pokemon* mon = GetBankPartyData(bank);
    u16 species = SPECIES(bank);
    u8 gender = GetMonGender(mon);
    u16 targetSpecies = SPECIES_NONE;
    
    // 检查是否拥有觉醒力量，或携带觉醒徽章
    if (!MoveInMoveset(MOVE_HIDDENPOWER, bank) && mon->item != ITEM_AWAKEN_CHARM)
        return NULL;
    
    // === 按物种和性别选择目标形态 ===
    u32 i;

    for (i = 0; gAwakeningFormTable[i].baseSpecies != SPECIES_NONE; ++i)
    {
        if (gAwakeningFormTable[i].baseSpecies != species)
            continue;

        targetSpecies = (gender == MON_MALE) ? gAwakeningFormTable[i].maleSpecies : gAwakeningFormTable[i].femaleSpecies;
        break;
    }

    
    if (targetSpecies == SPECIES_NONE)
        return NULL;
    
    // 保存旧 HP 用于比例计算
    u16 oldMaxHP = gBattleMons[bank].maxHP;
    u16 oldHP = gBattleMons[bank].hp;
    
    // 计算 Hidden Power 属性
    u8 monType = CalcMonHiddenPowerType(mon);
    
    // 执行形态变化
    DoFormChange(bank, targetSpecies, TRUE, TRUE, TRUE);
    
    // 更新最大 HP
    u16 newMaxHP = GetMonData(mon, MON_DATA_MAX_HP, NULL);
    gBattleMons[bank].maxHP = newMaxHP;
    
    // 按比例保留 HP
    u32 newHP = (u32)oldHP * newMaxHP / oldMaxHP;
    gBattleMons[bank].hp = (u16)newHP;
    if (gBattleMons[bank].hp > gBattleMons[bank].maxHP)
        gBattleMons[bank].hp = gBattleMons[bank].maxHP;
    
    // 准备显示文本
    gBattleScripting.bank = bank;
    PREPARE_TYPE_BUFFER(gBattleTextBuff1, monType);
    
    // 根据 caseId 返回不同的脚本
    switch (caseId) {
        case 0:  // 战斗开始时
            return BattleScript_PrimalInstinct;
        default: // SwitchIn 时
            return BattleScript_PrimalInstinctSub;
    }
}

//判断某物种是否为觉醒(Primal Instinct)后的形态物种
bool8 IsAwakeningFormSpecies(u16 species)
{
    u32 i;

    for (i = 0; gAwakeningFormTable[i].baseSpecies != SPECIES_NONE; ++i)
    {
        if (gAwakeningFormTable[i].maleSpecies == species || gAwakeningFormTable[i].femaleSpecies == species)
            return TRUE;
    }

    return FALSE;
}


//In theory, this function will do nothing as the regular forms revert should
//should take care of the reversion. This is to prevent bugs if the player
//gives themselves a Mega or Primal to start the battle.
void MegaRevert(struct Pokemon* party)
{
	int i;

	for (i = 0; i < PARTY_SIZE; ++i)
		TryRevertMega(&party[i]);
}

void TryRevertMega(struct Pokemon* mon)
{
	const struct Evolution* evolutions = gEvolutionTable[mon->species];

	for (u8 i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if (evolutions[i].method == EVO_MEGA && evolutions[i].param == 0)
		{
			mon->species = evolutions[i].targetSpecies;
			CalculateMonStats(mon);
		}
	}
}

static bool8 IsItemKeystone(u16 item)
{
	for (u8 i = 0; i < ARRAY_COUNT(sKeystoneTable); ++i)
	{
		if (item == sKeystoneTable[i])
			return TRUE;
	}
	return FALSE;
}

static item_t FindTrainerKeystone(u16 trainerId)
{
	if (gBattleTypeFlags & (BATTLE_TYPE_FRONTIER | BATTLE_TYPE_LINK) || IsFrontierTrainerId(trainerId))
		return ITEM_MEGA_RING;

	for (u8 i = 0; i < TRAINER_ITEM_COUNT; ++i)
	{
		if (IsItemKeystone(gTrainers[trainerId].items[i]))
			return gTrainers[trainerId].items[i];
	}

	return ITEM_NONE;
}

static item_t FindPlayerKeystone(void)
{
	#ifdef VAR_KEYSTONE
		u16 keystone = VarGet(VAR_KEYSTONE);
		if (keystone != ITEM_NONE)
			return keystone;
	#else
		for (u8 i = 0; i < ARRAY_COUNT(sKeystoneTable); ++i)
		{
			if (CheckBagHasItem(sKeystoneTable[i], 1))
				return sKeystoneTable[i];
		}
	#endif

	#ifdef DEBUG_MEGA
		return ITEM_MEGA_RING; //Give player Mega Ring if they have none
	#endif

	if (gBattleTypeFlags & (BATTLE_TYPE_FRONTIER | BATTLE_TYPE_LINK))
		return ITEM_MEGA_RING;

	return ITEM_NONE;
}

static item_t FindBankKeystone(u8 bank)
{
	if (gBattleTypeFlags & BATTLE_TYPE_LINK)
		return ITEM_MEGA_RING; //You can always Mega Evolve in a link battle

	#ifdef DEBUG_MEGA
		if (bank + 1)
			return ITEM_MEGA_RING;
	#endif

	if (SIDE(bank) == SIDE_OPPONENT)
	{
		if (gBattleTypeFlags & BATTLE_TYPE_TWO_OPPONENTS)
		{
			if (GetBattlerPosition(bank) == B_POSITION_OPPONENT_LEFT)
				return FindTrainerKeystone(gTrainerBattleOpponent_A);
			else
				return FindTrainerKeystone(SECOND_OPPONENT);
		}
		else
			return FindTrainerKeystone(gTrainerBattleOpponent_A);
	}
	else //SIDE_PLAYER
	{
		if (gBattleTypeFlags & BATTLE_TYPE_INGAME_PARTNER)
		{
			if (GetBattlerPosition(bank) == B_POSITION_PLAYER_RIGHT)
				return FindTrainerKeystone(VarGet(VAR_PARTNER));
			else
				return FindPlayerKeystone();
		}
		else
			return FindPlayerKeystone();
	}
}

bool8 MegaEvolutionEnabled(u8 bank)
{
	if (gBattleTypeFlags & (BATTLE_TYPE_LINK))
		return TRUE;

	if (FindBankKeystone(bank) == ITEM_NONE)
	{
		#ifdef DEBUG_MEGA
			return TRUE;
		#else
			return FALSE;
		#endif
	}
	else
		return TRUE;
}

bool8 BankMegaEvolved(u8 bank, bool8 checkUB)
{
	if ((SIDE(bank) == B_SIDE_PLAYER && gBattleTypeFlags & BATTLE_TYPE_INGAME_PARTNER)
	||  (SIDE(bank) == B_SIDE_OPPONENT && gBattleTypeFlags & BATTLE_TYPE_TWO_OPPONENTS))
	{
		if (checkUB)
		{
			if (gNewBS->ultraData.done[bank])
				return TRUE;
			else
				return FALSE;
		}
		else
		{
			if (gNewBS->megaData.done[bank])
				return TRUE;
			else
				return FALSE;
		}
	}

	if (checkUB)
	{
		if (gNewBS->ultraData.done[bank] || gNewBS->ultraData.done[PARTNER(bank)])
			return TRUE;
	}
	else
	{
		if (gNewBS->megaData.done[bank] || (gNewBS->megaData.done[PARTNER(bank)]))
			return TRUE;
	}

	return FALSE;
}

bool8 IsMegaSpecies(u16 species)
{
	const struct Evolution* evolutions = gEvolutionTable[species];

	for (u8 i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if (evolutions[i].method == EVO_MEGA
		&& (evolutions[i].unknown == MEGA_VARIANT_STANDARD || evolutions[i].unknown == MEGA_VARIANT_WISH)
		&& evolutions[i].param == 0)
			return TRUE;
	}

	return FALSE;
}

//No better way to check for these next two
bool8 IsBluePrimalSpecies(unusedArg u16 species)
{
	#ifdef SPECIES_KYOGRE_PRIMAL
	return species == SPECIES_KYOGRE_PRIMAL;
	#else
	return FALSE;
	#endif
}

bool8 IsRedPrimalSpecies(unusedArg u16 species)
{
	#ifdef SPECIES_GROUDON_PRIMAL
	return species == SPECIES_GROUDON_PRIMAL;
	#else
	return FALSE;
	#endif
}

bool8 IsPrimalSpecies(u16 species)
{
	return IsBluePrimalSpecies(species) || IsRedPrimalSpecies(species);
}

bool8 IsMega(u8 bank)
{
	return(IsMegaSpecies(GetBankPartyData(bank)->species));
}

bool8 IsBluePrimal(u8 bank)
{
	return IsBluePrimalSpecies(GetBankPartyData(bank)->species);
}

bool8 IsRedPrimal(u8 bank)
{
	return IsRedPrimalSpecies(GetBankPartyData(bank)->species);
}

bool8 IsUltraNecrozma(u8 bank)
{
	return IsUltraNecrozmaSpecies(GetBankPartyData(bank)->species);
}

bool8 IsUltraNecrozmaSpecies(u16 species)
{
	const struct Evolution* evolutions = gEvolutionTable[species];

	for (u8 i = 0; i < EVOS_PER_MON; ++i)
	{
		if (evolutions[i].method == EVO_NONE) //Most likely end of entries
			break; //Break now to save time
		else if (evolutions[i].method == EVO_MEGA && evolutions[i].unknown == MEGA_VARIANT_ULTRA_BURST && evolutions[i].param == 0)
			return TRUE;
	}

	return FALSE;
}

bool8 HasMegaSymbol(u8 bank)
{
	return IsMega(bank) || IsBluePrimal(bank) || IsRedPrimal(bank) || IsUltraNecrozma(bank);
}

const u8* GetTrainerName(u8 bank)
{
	u8 battlerNum = 0;
	u16 trainerId = 0xFFFF;
	u8 multiplayerId = GetMultiplayerId();

	u16 linkPartner = GetBattlerMultiplayerId(BATTLE_PARTNER(gLinkPlayers[multiplayerId].id));
	u16 linkOpponent1 = GetBattlerMultiplayerId(BATTLE_OPPOSITE(gLinkPlayers[multiplayerId].id));
	u16 linkOpponent2 = GetBattlerMultiplayerId(BATTLE_PARTNER(BATTLE_OPPOSITE(gLinkPlayers[multiplayerId].id)));

	switch (GetBattlerPosition(bank)) {
		case B_POSITION_PLAYER_LEFT:
			if (IsAIControlledBattle())
			{
				if (InBattleSands())
				{
					trainerId = BATTLE_FACILITY_MULTI_TRAINER_TID;
					battlerNum = 2; //Name stored in partner var
				}
				else
				{
					trainerId = VarGet(VAR_PARTNER);
				}
			}
			break;

		case B_POSITION_OPPONENT_LEFT:
			if (gBattleTypeFlags & BATTLE_TYPE_LINK)
				trainerId = linkOpponent1;
			else
				trainerId = gTrainerBattleOpponent_A;
			break;

		case B_POSITION_PLAYER_RIGHT:
			battlerNum = 2;
			if (gBattleTypeFlags & BATTLE_TYPE_INGAME_PARTNER)
			{
				trainerId = VarGet(VAR_PARTNER);
			}
			else if (gBattleTypeFlags & BATTLE_TYPE_LINK && gBattleTypeFlags & BATTLE_TYPE_MULTI)
				trainerId = linkPartner;
			else if (IsAIControlledBattle())
			{
				if (InBattleSands())
				{
					trainerId = BATTLE_FACILITY_MULTI_TRAINER_TID;
					battlerNum = 2; //Name stored in partner var
				}
				else
				{
					trainerId = VarGet(VAR_PARTNER);
				}
			}
			else
				battlerNum = 0;
			break;

		case B_POSITION_OPPONENT_RIGHT:
			battlerNum = 1;
			if (gBattleTypeFlags & BATTLE_TYPE_LINK && gBattleTypeFlags & BATTLE_TYPE_MULTI)
				trainerId = linkOpponent2;
			else if (gBattleTypeFlags & BATTLE_TYPE_LINK)
				trainerId = linkOpponent1;
			else if (!(gBattleTypeFlags & BATTLE_TYPE_TWO_OPPONENTS))
			{
				trainerId = gTrainerBattleOpponent_A;
				battlerNum = 0;
			}
			else
				trainerId = SECOND_OPPONENT;
			break;
	}

	if (trainerId == 0xFFFF)
	{
		if (gBattleTypeFlags & BATTLE_TYPE_LINK)
			return gLinkPlayers[multiplayerId].name;
		else
			return gSaveBlock2->playerName;
	}
	else if (gBattleTypeFlags & BATTLE_TYPE_LINK)
	{
		return gLinkPlayers[trainerId].name;
	}
	else
	{
		u8 class = gTrainers[trainerId].trainerClass;
		u8* name = NULL;

		if (trainerId < RAID_BATTLE_MULTI_TRAINER_TID)
			name = TryGetRivalNameByTrainerClass(class);

		if (name == NULL)
		{
			if (gBattleTypeFlags & BATTLE_TYPE_FRONTIER
			|| IsFrontierTrainerId(trainerId))
				return GetFrontierTrainerName(trainerId, battlerNum);
			
			return gTrainers[trainerId].trainerName;
		}

		return name;
	}
}

u8* TryGetRivalNameByTrainerClass(unusedArg u8 class)
{
	#ifdef UNBOUND
		if (class == CLASS_RIVAL|| class == CLASS_RIVAL_2)
			return GetExpandedPlaceholder(ExpandPlaceholder_RivalName);
		else
	#elif defined OVERWRITE_RIVAL
		if (class == CLASS_RIVAL || class == CLASS_RIVAL_2 || class == CLASS_CHAMPION)
			return GetExpandedPlaceholder(ExpandPlaceholder_RivalName);
		else
	#endif
			return NULL;
}

void MegaRetrieveData(void)
{
	if (gBattleTypeFlags & (BATTLE_TYPE_POKE_DUDE | BATTLE_TYPE_OLD_MAN)) //Poke Dude's controller wasn't updated so these need to be manually set to 0
	{
		gNewBS->megaData.chosen[gActiveBattler] = 0;
		gNewBS->ultraData.chosen[gActiveBattler] = 0;
		gNewBS->zMoveData.toBeUsed[gActiveBattler] = 0;
		gNewBS->dynamaxData.toBeUsed[gActiveBattler] = 0;
	}
	else
	{
		gNewBS->megaData.chosen[gActiveBattler] |= gBattleBufferB[gActiveBattler][4];
		gNewBS->ultraData.chosen[gActiveBattler] |= gBattleBufferB[gActiveBattler][5];
		gNewBS->zMoveData.toBeUsed[gActiveBattler] |= gBattleBufferB[gActiveBattler][6];
		gNewBS->dynamaxData.toBeUsed[gActiveBattler] |= gBattleBufferB[gActiveBattler][7];
	}
}
