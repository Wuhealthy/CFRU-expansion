#pragma once

#include "../global.h"
#include "../pokemon.h"

/**
 * \file anility_util.h
 * \brief Contains utility functions pertaining to Abilities.
 */

//Exported Functions
const u8* GetAbilityName(ability_t ability, u16 species);
void CopyAbilityName(u8* dst, ability_t ability, u16 species);
void CopyAbilityNameForSummary(u8* dst, ability_t ability, u16 species);
u16 GetProperAbilityPopUpSpecies(u8 bank);
void SetProperAbilityPopUpSpecies(u8 bank);
void SetTookAbilityFrom(u8 taker, u8 takenFrom);
void SwapTookAbilityFrom(u8 bank1, u8 bank2);
void ResetTookAbilityFrom(u8 bank);
bool8 IsTargetAbilityIgnored(ability_t defAbility, ability_t atkAbility, u16 move);
bool8 IsTargetAbilityIgnoredNoMove(ability_t defAbility, ability_t atkAbility);

bool8 IsClearBodyAbility(ability_t ability);
bool8 IsMoldBreakerAbility(ability_t ability);
bool8 IsMoxieAbility(ability_t ability);
bool8 IsChoiceAbility(ability_t ability);
bool8 IsHPAbsorptionAbility(ability_t ability);
bool8 IsElectricAbsorptionAblity(ability_t ability);
bool8 IsPlusMinusAbility(ability_t ability);
bool8 IsMultiscaleAbility(ability_t ability);
bool8 IsPriorityBlockingAbility(ability_t ability);
bool8 IsUnnerveAbility(ability_t ability);
bool8 UnnerveOnOpposingField(u8 bank);
bool8 AbilityIncreasesWildItemChance(ability_t ability);
bool8 AbilityBlocksIntimidate(ability_t ability);
bool8 AbilityPreventsLoweringAtk(ability_t ability);
bool8 AbilityPreventsLoweringStat(ability_t ability, u8 statId);
bool8 AbilityRaisesOneStatWhenSomeStatIsLowered(ability_t ability);
bool8 IsAffectedBySturdy(ability_t defAbility, u8 bankDef);
bool8 IsAffectedByDisguse(ability_t defAbility, u16 defSpecies, u8 moveSplit);
bool8 IsAffectedByBadDreams(u8 bank);
bool8 IsTrappedByAbility(u8 bankDef, ability_t trapAbility);
bool8 IsWhiteSmokeAbility(ability_t ability, u16 species);
bool8 IsVitalSpiritAbility(ability_t ability, u16 species);
bool8 MindsEyePreventsLoweringStat(ability_t ability, u8 statId);
bool8 IsFullMetalBodyAbility(ability_t ability, u16 species);
bool8 CheckStatusAny(u8 bank);
bool8 IsFaintedPokemonInParty(u8 bank);
bool8 AngerShellStatsCheck(u8 bank);
bool8 SpeciesHasHiddenPowerPhysicality(u16 species);
