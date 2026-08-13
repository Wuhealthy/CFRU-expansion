#include "defines.h"
#include "defines_battle.h"
#include "../include/string_util.h"
#include "../include/constants/abilities.h"
#include "../include/constants/pokedex.h"
#include "../include/constants/species.h"

#include "../include/new/ability_tables.h"
#include "../include/new/ability_util.h"
#include "../include/new/battle_util.h"
#include "../include/new/move_tables.h"
#include "../include/new/util.h"

extern const u8 gAbilityNames[][ABILITY_NAME_LENGTH + 1];
extern const u8* gAbilityDescriptions[];
extern u8 CalcMonHiddenPowerType(struct Pokemon* mon);
extern void DoFormChange(u8 bank, u16 species, bool8 ReloadType, bool8 ReloadStats, bool8 reloadAbility);
extern const u8 BattleScript_StartedSchoolingRet2[];

const u8* GetAbilityName(ability_t ability, unusedArg const u16 species)
{
	if (ability >= ABILITIES_COUNT)
		ability = ABILITY_NONE;

	const u8* ptr = gAbilityNames[ability];

	if (ptr[3] == 0x8 || ptr[3] == 0x9) //Expanded Ability Names
		ptr = T1_READ_PTR(ptr);

	return ptr;
}

const u8* GetAbilityDescription(ability_t ability, unusedArg const u16 species)
{
	if (ability >= ABILITIES_COUNT)
		return gAbilityDescriptions[ABILITY_NONE];

	const u8* desc = gAbilityDescriptions[ability];
	return desc;
}

void CopyAbilityName(u8* dst, ability_t ability, const u16 species)
{
	StringCopy(dst, GetAbilityName(ability, species));
}

// FireRed's summary struct reserves exactly 13 bytes for this field.  Keep the
// full canonical name everywhere else, but always leave room for EOS here so a
// long name cannot run into abilityDescStrBuf.
void CopyAbilityNameForSummary(u8* dst, ability_t ability, const u16 species)
{
	const u8 *src = GetAbilityName(ability, species);
	u32 i;

	for (i = 0; i < 12 && src[i] != EOS; ++i)
		dst[i] = src[i];
	dst[i] = EOS;
}

void CopyAbilityDescription(u8* dst, ability_t ability, const u16 species)
{
	StringCopy(dst, GetAbilityDescription(ability, species));
}

u16 GetProperAbilityPopUpSpecies(u8 bank)
{
	if (gNewBS->tookAbilityFrom[bank] != SPECIES_NONE)
		return gNewBS->tookAbilityFrom[bank];
	else
		return SPECIES(bank);
}

void SetProperAbilityPopUpSpecies(u8 bank)
{
	gAbilityPopUpSpecies = GetProperAbilityPopUpSpecies(bank);
}

void SetTookAbilityFrom(u8 taker, u8 takenFrom)
{
	if (gNewBS->tookAbilityFrom[takenFrom] != SPECIES_NONE)
		gNewBS->tookAbilityFrom[taker] = gNewBS->tookAbilityFrom[takenFrom]; //Pass along species
	else
		gNewBS->tookAbilityFrom[taker] = SPECIES(takenFrom);
}

void SwapTookAbilityFrom(u8 bank1, u8 bank2)
{
	u16 species1 = GetProperAbilityPopUpSpecies(bank1);
	u16 species2 = GetProperAbilityPopUpSpecies(bank2);

	gNewBS->tookAbilityFrom[bank1] = species2;
	gNewBS->tookAbilityFrom[bank2] = species1;
}

void ResetTookAbilityFrom(u8 bank)
{
	gNewBS->tookAbilityFrom[bank] = SPECIES_NONE;
}

bool8 IsTargetAbilityIgnored(ability_t defAbility, ability_t atkAbility, u16 move)
{
	return IS_MOLD_BREAKER(atkAbility, move) && gSpecialAbilityFlags[defAbility].gMoldBreakerIgnoredAbilities;
}

bool8 IsTargetAbilityIgnoredNoMove(ability_t defAbility, ability_t atkAbility)
{
	return IsMoldBreakerAbility(atkAbility) && gSpecialAbilityFlags[defAbility].gMoldBreakerIgnoredAbilities;
}

bool8 IsTargetItemIgnoredByAbility(u8 bankAtk, u8 bankDef)
{
    (void)bankDef;
	// 检查攻击方是否拥有无视道具的特性，且满足对应条件
    switch (ABILITY(bankAtk))
    {
        case ABILITY_FLOWERBLADE:
            // 花刃：草属性攻击时无视目标道具
            if (gBattleStruct->dynamicMoveType == TYPE_GRASS)
                return TRUE;
            break;
    }
    
    return FALSE;
}

bool8 IsClearBodyAbility(ability_t ability)
{
	return ability == ABILITY_CLEARBODY
		#ifdef ABILITY_FULLMETALBODY
		|| ability == ABILITY_FULLMETALBODY
		#endif
		#ifdef ABILITY_WHITESMOKE
		|| ability == ABILITY_WHITESMOKE
		#endif
		;
}

bool8 IsMoldBreakerAbility(ability_t ability)
{
	return ability == ABILITY_MOLDBREAKER
		|| ability == ABILITY_TURBOBLAZE
		|| ability == ABILITY_TERAVOLT
		|| ability == ABILITY_MYCELIUMMIGHT
		;
}

bool8 IsMoxieAbility(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_MOXIE:
		#ifdef ABILITY_GRIMNEIGH
		case ABILITY_GRIMNEIGH:
		#endif
		#ifdef ABILITY_CHILLINGNEIGH
		case ABILITY_CHILLINGNEIGH:
		#endif
		#ifdef ABILITY_ASONESHADOWRIDER
		case ABILITY_ASONESHADOWRIDER:
		#endif
		#ifdef ABILITY_ASONEICERIDER
		case ABILITY_ASONEICERIDER:
		#endif
		case ABILITY_BEASTBOOST:
		case ABILITY_SOULHEART:
		case ABILITY_BATTLEBOND:
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsChoiceAbility(ability_t ability)
{
	return ability == ABILITY_GORILLATACTICS;
}

bool8 IsHPAbsorptionAbility(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_WATERABSORB:
		case ABILITY_VOLTABSORB:
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsElectricAbsorptionAblity(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_VOLTABSORB:
		case ABILITY_MOTORDRIVE:
		case ABILITY_LIGHTNINGROD:
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsPlusMinusAbility(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_PLUS:
		case ABILITY_MINUS:
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsMultiscaleAbility(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_MULTISCALE:
		case ABILITY_SHADOWSHIELD:
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsPriorityBlockingAbility(ability_t ability)
{
	switch (ability)
	{
		case ABILITY_DAZZLING:
		#ifdef ABILITY_QUEENLYMAJESTY
		case ABILITY_QUEENLYMAJESTY:
		#endif
			return TRUE;
		default:
			return FALSE;
	}
}

bool8 IsUnnerveAbility(ability_t ability)
{
	return ability == ABILITY_UNNERVE
		#ifdef ABILITY_ASONESHADOWRIDER
		|| ability == ABILITY_ASONESHADOWRIDER
		#endif
		#ifdef ABILITY_ASONEICERIDER
		|| ability == ABILITY_ASONEICERIDER
		#endif
		;
}

bool8 UnnerveOnOpposingField(u8 bank)
{
	return ABILITY_ON_OPPOSING_FIELD(bank, ABILITY_UNNERVE)
		#ifdef ABILITY_ASONESHADOWRIDER
		|| ABILITY_ON_OPPOSING_FIELD(bank, ABILITY_ASONESHADOWRIDER)
		#endif
		#ifdef ABILITY_ASONEICERIDER
		|| ABILITY_ON_OPPOSING_FIELD(bank, ABILITY_ASONEICERIDER)
		#endif
		;
}

bool8 AbilityIncreasesWildItemChance(ability_t ability)
{
	return ability == ABILITY_COMPOUNDEYES || ability == ABILITY_SUPERLUCK;
}

bool8 AbilityBlocksIntimidate(ability_t ability)
{
	return ability == ABILITY_INNERFOCUS
		|| ability == ABILITY_OWNTEMPO
		|| ability == ABILITY_OBLIVIOUS
		|| ability == ABILITY_SCRAPPY;
}

bool8 AbilityPreventsLoweringAtk(ability_t ability)
{
	return ability == ABILITY_HYPERCUTTER
		|| ability == ABILITY_MIRRORARMOR
		|| IsClearBodyAbility(ability);
}

bool8 SpeciesHasHiddenPowerPhysicality(unusedArg u16 species)
{
    switch (species)
    {
        case SPECIES_GALVANTULA_A:
            return TRUE;
		case SPECIES_EEVEE_HERO:
            return TRUE;
        default:
            return FALSE;
    }
}

bool8 TryPrimalInstinctTransform(u8 bank, u16 baseSpecies, u16 heroSpecies, struct Pokemon* mon)
{
    // 检查是否是基础形态且拥有觉醒力量
    if (SPECIES(bank) != baseSpecies)
        return FALSE;
    
    if (!MoveInMoveset(MOVE_HIDDENPOWER, bank))
        return FALSE;
    
    // 保存旧 HP 用于比例计算
    u16 oldMaxHP = gBattleMons[bank].maxHP;
    u16 oldHP = gBattleMons[bank].hp;
    
    // 计算 Hidden Power 属性
    u8 monType = CalcMonHiddenPowerType(mon);
    
    // 执行形态变化
    DoFormChange(bank, heroSpecies, TRUE, TRUE, TRUE);
    
    // 更新最大 HP
    u16 newMaxHP = GetMonData(mon, MON_DATA_MAX_HP, NULL);
    gBattleMons[bank].maxHP = newMaxHP;
    
    // 按比例保留 HP
    u32 newHP = (u32)oldHP * newMaxHP / oldMaxHP;
    gBattleMons[bank].hp = (u16)newHP;
    if (gBattleMons[bank].hp > gBattleMons[bank].maxHP)
        gBattleMons[bank].hp = gBattleMons[bank].maxHP;
    
    // 准备显示文本
    PREPARE_TYPE_BUFFER(gBattleTextBuff1, monType);
    BattleScriptPushCursorAndCallback(BattleScript_StartedSchoolingRet2);
    
    return TRUE;
}

bool8 AbilityPreventsLoweringStat(ability_t ability, u8 statId)
{
	switch (ability)
	{
		case ABILITY_HYPERCUTTER:
			return statId == STAT_STAGE_ATK;
		case ABILITY_BIGPECKS:
			return statId == STAT_STAGE_DEF;
		case ABILITY_KEENEYE:
			return statId == STAT_STAGE_ACC;
		case ABILITY_ILLUMINATE:
			return statId == STAT_STAGE_ACC;
		case ABILITY_MINDSEYE:
			return statId == STAT_STAGE_ACC;
		default:
			return FALSE;
	}
}

bool8 AbilityRaisesOneStatWhenSomeStatIsLowered(ability_t ability)
{
	return ability == ABILITY_DEFIANT
		|| ability == ABILITY_COMPETITIVE;
}

bool8 IsAffectedBySturdy(ability_t defAbility, u8 bankDef)
{
	return defAbility == ABILITY_STURDY
		&& BATTLER_MAX_HP(bankDef);
}

bool8 IsAffectedByDisguse(unusedArg ability_t defAbility, unusedArg u16 defSpecies, unusedArg u8 moveSplit)
{
	#ifdef SPECIES_MIMIKYU
	if (defAbility == ABILITY_DISGUISE && defSpecies == SPECIES_MIMIKYU)
		return TRUE;
	#endif
	#ifdef SPECIES_EISCUE
	if (defAbility == ABILITY_ICEFACE && defSpecies == SPECIES_EISCUE && moveSplit == SPLIT_PHYSICAL)
		return TRUE;
	#endif

	return FALSE;
}

bool8 IsAffectedByBadDreams(u8 bank)
{
	return BATTLER_ALIVE(bank)
		&& (gBattleMons[bank].status1 & STATUS_SLEEP
		 || ABILITY(FOE(bank)) == ABILITY_COMATOSE)
		&& ABILITY(bank) != ABILITY_MAGICGUARD;
}

bool8 IsTrappedByAbility(u8 bankDef, ability_t trapAbility)
{
	if (!CanBeTrapped(bankDef))
		return FALSE;

	switch (trapAbility)
	{
		case ABILITY_SHADOWTAG:
			return ABILITY(bankDef) != ABILITY_SHADOWTAG; //Shadow Tag's not affected by Shadow Tag
		case ABILITY_ARENATRAP:
			return CheckGrounding(bankDef) == GROUNDED;
		case ABILITY_MAGNETPULL:
			return IsOfType(bankDef, TYPE_STEEL);
		default:
			return FALSE;
	}
}

bool8 IsWhiteSmokeAbility(ability_t ability, unusedArg u16 species)
{
	return ability == ABILITY_WHITESMOKE;
}

bool8 IsVitalSpiritAbility(ability_t ability, unusedArg u16 species)
{
	return ability == ABILITY_VITALSPIRIT;
}

bool8 MindsEyePreventsLoweringStat(ability_t ability, u8 statId)
{
	return ability == ABILITY_MINDSEYE && statId == STAT_STAGE_ACC;
}

bool8 IsFullMetalBodyAbility(ability_t ability, unusedArg u16 species)
{
	return ability == ABILITY_FULLMETALBODY;
}

bool8 CheckStatusAny(u8 bank)
{
    return (gBattleMons[bank].status1 & STATUS1_ANY);
}

bool8 IsFaintedPokemonInParty(u8 bank)
{
    u8 i;
    u8 partyCount;
    struct Pokemon* party;
    u8 side = SIDE(bank);
    
    // 根据 bank 的 side 选择正确的队伍
    if (side == B_SIDE_PLAYER)
    {
        party = gPlayerParty;
        partyCount = gPlayerPartyCount;
    }
    else
    {
        party = gEnemyParty;
        partyCount = gEnemyPartyCount;
    }

    for (i = 0; i < partyCount; i++)
    {
        if (GetMonData(&party[i], MON_DATA_HP, NULL) == 0)
            return TRUE;
    }

    return FALSE;
}

bool8 AngerShellStatsCheck(u8 bank)
{
    return (STAT_STAGE(bank, STAT_ATK) != STAT_STAGE_MAX
         || STAT_STAGE(bank, STAT_SPATK) != STAT_STAGE_MAX
         || STAT_STAGE(bank, STAT_SPEED) != STAT_STAGE_MAX
         || STAT_STAGE(bank, STAT_DEF) > STAT_STAGE_MIN
         || STAT_STAGE(bank, STAT_SPDEF) > STAT_STAGE_MIN);
}
