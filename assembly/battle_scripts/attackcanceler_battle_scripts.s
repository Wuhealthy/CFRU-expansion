.text
.thumb
.align 2
/*
attackcanceler_battle_scripts.s
	battle scripts to support attackcanceler battle command
*/

.include "../asm_defines.s"
.include "../battle_script_macros.s"

.global BattleScript_PrintCustomString
.global BattleScript_QuickClaw
.global BattleScript_MagicBounce
.global BattleScript_PsychoRebound
.global BattleScript_PsychoReboundSetTerrain
.global BattleScript_MoveUsedFlinched
.global BattleScript_MoveUsedDevolvedForgot
.global BattleScript_MoveUsedIsConfused
.global BattleScript_MoveUsedLoafingAround
.global BattleScript_MoveUsedGravityPrevents
.global BattleScript_MoveUsedHealBlockPrevents
.global BattleScript_MoveUsedThroatChopPrevents
.global BattleScript_MoveUsedFailedPrimalWeather
.global BattleScript_MoveUsedPsychicTerrainPrevents
.global BattleScript_MoveUsedPowderPrevents
.global BattleScript_StanceChangeToBlade
.global BattleScript_StanceChangeToShield
.global BattleScript_ZMoveActivateStatus
.global BattleScript_ZMoveActivateDamaging
.global BattleScript_DarkTypePreventsPrankster
.global BattleScript_MoveUsedSkyBattlePrevents
.global BattleScript_MoveUsedRingChallengePrevents
.global BattleScript_CantUseSignatureMove
.global BattleScript_HoopaCantUseHyperspaceFury
.global BattleScript_MoveUsedDynamaxPrevents
.global BattleScript_MoveUsedRaidBattlePrevents
.global BattleScript_MoveUsedRaidShieldPrevents
.global BattleScript_RaidBattleStatNullification

.global BattleScript_TryRemoveIllusion
.global AbilityRaisedStatString

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_PrintCustomString:
	printstring 0x184
	waitmessage DELAY_1SECOND
	return

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MagicBounceCommon:
	call BattleScript_AttackstringBackupScriptingBank
	ppreduce
	pause 0x10
	call BattleScript_AbilityPopUp
	setword BATTLE_STRING_LOADER gText_MagicBounce
	printstring 0x184
	waitmessage DELAY_1SECOND	
	call BattleScript_AbilityPopUpRevert
	orword HIT_MARKER, HITMARKER_ATTACKSTRING_PRINTED | HITMARKER_NO_PPDEDUCT | HITMARKER_x800000
	various BANK_ATTACKER 0x1
	return

BattleScript_PsychoReboundSetTerrain:
    callasm TransferTerrainData
    waitstateatk
    playanimation2 BANK_SCRIPTING ANIM_ARG_1 0x0
    setword BATTLE_STRING_LOADER PsychicTerrainSetString
    printstring 0x184
    waitmessage DELAY_1SECOND
    setbyte SEED_HELPER 0
    callasm SeedRoomServiceLooper
    callasm TryActivateMimicry
    return

BattleScript_MagicBounce:
    call BattleScript_MagicBounceCommon
    return

BattleScript_PsychoRebound:
    call BattleScript_MagicBounceCommon
    callasm CheckTerrainAndSetPsychicTerrain
    return

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedFlinched:
	printstring 0x4A
	waitmessage DELAY_1SECOND
	jumpifability BANK_ATTACKER ABILITY_STEADFAST SteadfastBoost
	goto BS_MOVE_END

SteadfastBoost:
	jumpifstat BANK_ATTACKER EQUALS STAT_SPD STAT_MAX BS_MOVE_END
	copyarray BATTLE_SCRIPTING_BANK USER_BANK 0x1
	call BattleScript_AbilityPopUp
	setbyte 0x2023FDF 0x0
	playstatchangeanimation BANK_ATTACKER STAT_ANIM_SPD STAT_ANIM_UP
	setbyte STAT_CHANGE_BYTE STAT_SPD | INCREASE_1
	statbuffchange STAT_ATTACKER | STAT_BS_PTR BS_MOVE_END
	jumpifbyte EQUALS MULTISTRING_CHOOSER 0x2 BS_MOVE_END
	copyarray 0x2023FDB USER_BANK 0x1 @;gBattlescripting->bank
	printfromtable gStatUpStringIds
	waitmessage DELAY_1SECOND
	call BattleScript_AbilityPopUpRevert
	goto BS_MOVE_END
	
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedDevolvedForgot:
	setword BATTLE_STRING_LOADER gText_DevolvedForgotMove
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedIsConfused:
	printstring 65 @;STRINGID_PKMNISCONFUSED
	waitmessage DELAY_1SECOND
	chosenstatusanimation BANK_ATTACKER TRUE STATUS2_CONFUSION
	goto 0x81D90DF

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedLoafingAround:
	call BS_FLUSH_MESSAGE_BOX
	jumpifbyte EQUALS MULTISTRING_CHOOSER 0x4 BattleScript_TruantLoafingAround
	printfromtable 0x83FE61A @;gInobedientStringIds
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

BattleScript_TruantLoafingAround:
	setbyte MULTISTRING_CHOOSER 0x0
	call BattleScript_AbilityPopUp
	printfromtable 0x83FE61A @;gInobedientStringIds
	waitmessage DELAY_1SECOND
	call BattleScript_AbilityPopUpRevert
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedGravityPrevents:
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER GravityAttackCancelString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto 0x81D694E

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedHealBlockPrevents:
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER HealBlockAttackCancelString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedThroatChopPrevents:
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER ThroatChopAttackCancelString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedFailedPrimalWeather:
	orbyte OUTCOME OUTCOME_FAILED
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	jumpifhalfword ANDS WEATHER_FLAGS weather_harsh_sun HarshSunEvaportionBS
	setword BATTLE_STRING_LOADER MoveFizzledInHeavyRainString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

HarshSunEvaportionBS:
	setword BATTLE_STRING_LOADER MoveEvaporatedInHarshSunString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedPsychicTerrainPrevents:
	orbyte OUTCOME OUTCOME_FAILED
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	setword BATTLE_STRING_LOADER PsychicTerrainAttackCancelString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedPowderPrevents:
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	playanimation BANK_ATTACKER ANIM_POWDER_EXPLOSION 0x0
	jumpifability BANK_ATTACKER ABILITY_MAGICGUARD SkipPowderDamage
	graphicalhpupdate BANK_ATTACKER
	datahpupdate BANK_ATTACKER

SkipPowderDamage:
	setword BATTLE_STRING_LOADER PowderExplosionString
	printstring 0x184
	waitmessage DELAY_1SECOND
	faintpokemon BANK_ATTACKER 0x0 0x0
	orbyte OUTCOME 0x1
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_StanceChangeToBlade:
	call BS_FLUSH_MSGBOX
	call BattleScript_AbilityPopUp
	playanimation BANK_ATTACKER ANIM_TRANSFORM 0x0
	setword BATTLE_STRING_LOADER String_SwitchedToBladeForm
	printstring 0x184
	waitmessage DELAY_1SECOND
	call BattleScript_AbilityPopUpRevert
	return

BattleScript_StanceChangeToShield:
	call BS_FLUSH_MSGBOX
	call BattleScript_AbilityPopUp
	playanimation BANK_ATTACKER ANIM_TRANSFORM 0x0
	setword BATTLE_STRING_LOADER String_SwitchedToShieldForm
	printstring 0x184
	waitmessage DELAY_1SECOND
	call BattleScript_AbilityPopUpRevert
	return

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_ZMoveActivateStatus:
	call BattleScript_TryRemoveIllusion
	setword BATTLE_STRING_LOADER ZPowerSurroundsString
	printstring 0x184
	playanimation BANK_ATTACKER ANIM_ZMOVE_ACTIVATE 0x0
	callasm SetZEffect+1
	setword BATTLE_STRING_LOADER ZMoveUnleashedString
	printstring 0x184
	waitmessage DELAY_1SECOND
	return

BattleScript_ZMoveActivateDamaging:
	call BattleScript_TryRemoveIllusion
	setword BATTLE_STRING_LOADER ZPowerSurroundsString
	printstring 0x184
	playanimation BANK_ATTACKER ANIM_ZMOVE_ACTIVATE 0x0
	setword BATTLE_STRING_LOADER ZMoveUnleashedString
	printstring 0x184
	waitmessage DELAY_1SECOND
	return

BattleScript_TryRemoveIllusion:
	jumpifspecialstatusflag BANK_SCRIPTING STATUS3_ILLUSION 0x1 RemoveIllusionReturn
	@;remove illusion counter
	call BS_FLUSH_MESSAGE_BOX
	clearspecialstatusbit BANK_SCRIPTING STATUS3_ILLUSION
	callasm ClearScriptingBankDisguisedAs
	reloadhealthbar BANK_SCRIPTING
	playanimation BANK_SCRIPTING ANIM_TRANSFORM 0x0
	setword BATTLE_STRING_LOADER IllusionWoreOffString
	printstring 0x184
	waitmessage DELAY_1SECOND
RemoveIllusionReturn:
	return

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_DarkTypePreventsPrankster:
	orbyte OUTCOME OUTCOME_NOT_AFFECTED
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	printstring 27 @;STRINGID_IT_DOESNT_AFFECT
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedSkyBattlePrevents:
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER SkyBattleAttackCancelString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedRingChallengePrevents:
	attackstring
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER gText_RingChallengeAttackCancel
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_CantUseSignatureMove:
	attackstring
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER CantUseHyperspaceFuryString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

BattleScript_HoopaCantUseHyperspaceFury:
	attackstring
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER WrongHoopaFormString
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedDynamaxPrevents:
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER gText_DynamaxAttackCancel
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedRaidBattlePrevents:
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER gText_RaidBattleAttackCancel
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_MoveUsedRaidShieldPrevents:
	attackstring
	ppreduce
	pause DELAY_HALFSECOND
	orbyte OUTCOME OUTCOME_FAILED
	setword BATTLE_STRING_LOADER gText_RaidShieldProtected
	printstring 0x184
	waitmessage DELAY_1SECOND
	goto BS_MOVE_END

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

BattleScript_RaidBattleStatNullification:
	call BS_FLUSH_MSGBOX
	playanimation BANK_SCRIPTING ANIM_RAID_BATTLE_ENERGY_BURST 0x0
	setword BATTLE_STRING_LOADER gText_RaidBattleStatNullification
	printstring 0x184
	waitmessage DELAY_1SECOND
	refreshhpbar BANK_SCRIPTING
	return

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.align 2
.global PsychicTerrainAttackCancelString
AbilityRaisedStatString: .byte 0xFD, 0x13, 0x03, 0x0B, 0xFD, 0x00, 0xFE, 0xFD, 0x01, 0xFF
GravityAttackCancelString: .byte 0x0F, 0x77, 0x0F, 0x88, 0x10, 0xA9, 0x08, 0x79, 0x03, 0x0B, 0x0F, 0x5E, 0x0E, 0x19, 0x3B, 0xFE, 0xFD, 0x0F, 0x0D, 0xA4, 0x03, 0xAB, 0x0B, 0xF5, 0x0F, 0x71, 0xFD, 0x14, 0x3C, 0xFF
HealBlockAttackCancelString: .byte 0x0F, 0xE6, 0x05, 0x65, 0x04, 0x1E, 0x03, 0xE5, 0x0C, 0x9B, 0x0D, 0xE6, 0x3B, 0xFE, 0xFD, 0x0F, 0x0D, 0xA4, 0x03, 0xAB, 0x0B, 0xF5, 0x0F, 0x71, 0xFD, 0x14, 0x3C, 0xFF
ThroatChopAttackCancelString: .byte 0xFD, 0x0F, 0x0C, 0x21, 0x03, 0x04, 0x08, 0x9E, 0x0B, 0xCC, 0x0F, 0xB4, 0x0D, 0x23, 0x02, 0xAC, 0x03, 0x0B, 0x0F, 0x5E, 0x0E, 0x19, 0x3B, 0xFE, 0x0D, 0xA4, 0x03, 0xAB, 0x0B, 0xF5, 0x0F, 0x71, 0x0B, 0xD7, 0x0F, 0x44, 0x03, 0x0B, 0x10, 0x43, 0x0C, 0x02, 0x3C, 0xFF
MoveEvaporatedInHarshSunString: .byte 0x0C, 0x51, 0x0C, 0x39, 0x0E, 0x5F, 0x03, 0x0B, 0x04, 0x6D, 0x05, 0x84, 0xFE, 0x0F, 0xE6, 0x0E, 0xB8, 0x07, 0xEF, 0x03, 0x0B, 0x0E, 0xDD, 0x04, 0xAA, 0x0D, 0xE6, 0x10, 0x67, 0x03, 0xA5, 0x08, 0x9E, 0x3C, 0xFF
MoveFizzledInHeavyRainString: .byte 0x05, 0x7D, 0x0C, 0x39, 0x0E, 0x5F, 0x03, 0x0B, 0x04, 0x6D, 0x05, 0x84, 0xFE, 0x0F, 0xE6, 0x01, 0x66, 0x0F, 0x98, 0x10, 0xA1, 0x0B, 0xE3, 0x0E, 0x32, 0x08, 0x9E, 0x3C, 0xFF
PsychicTerrainAttackCancelString: .byte 0xFD, 0x10, 0x0F, 0x71, 0x07, 0x5B, 0x0B, 0xCF, 0x02, 0x23, 0x03, 0x1F, 0xFE, 0x01, 0x5B, 0x0D, 0x6D, 0x08, 0x9E, 0x11, 0x0C, 0x05, 0xA5, 0x3C, 0xFF
PowderExplosionString: .byte 0x02, 0xEF, 0x05, 0x7D, 0x0E, 0xCF, 0x07, 0x25, 0x02, 0x85, 0x03, 0x04, 0xFD, 0x0F, 0xFE, 0x0B, 0xCB, 0x0B, 0xAD, 0x03, 0x0B, 0x03, 0xDE, 0x09, 0x9F, 0x0B, 0xED, 0x3B, 0x01, 0x69, 0x10, 0x1B, 0x08, 0x9E, 0x3C, 0xFF
String_SwitchedToBladeForm: .byte 0xFD, 0x0F, 0x01, 0xA1, 0x0D, 0x70, 0x08, 0x9E, 0xFE, 0x02, 0xF4, 0x05, 0xEC, 0x0E, 0x59, 0x0C, 0xAD, 0x3C, 0xFF
String_SwitchedToShieldForm: .byte 0xFD, 0x0F, 0x01, 0xA1, 0x0D, 0x70, 0x08, 0x9E, 0xFE, 0x03, 0x81, 0x0A, 0x23, 0x0E, 0x59, 0x0C, 0xAD, 0x3C, 0xFF
ZPowerSurroundsString: .byte 0xFD, 0x0F, 0xFE, 0x0B, 0x43, 0xD4, 0x08, 0x79, 0x08, 0x92, 0x08, 0xD0, 0x10, 0x49, 0x08, 0x9E, 0x0B, 0x2B, 0x0B, 0xCB, 0x3C, 0xFF
ZMoveUnleashedString: .byte 0xFD, 0x0F, 0x0C, 0x12, 0x03, 0xC8, 0x08, 0x9E, 0xFE, 0x0B, 0x2B, 0x08, 0x79, 0x03, 0x0B, 0xD4, 0x10, 0x43, 0x0C, 0x02, 0x3C, 0xFF
IllusionWoreOffString: .byte 0xFD, 0x13, 0x03, 0x0B, 0x05, 0x50, 0x07, 0xA5, 0xFE, 0x0E, 0x28, 0x0B, 0xE3, 0x08, 0x9E, 0x3C, 0xFF
SkyBattleAttackCancelString: .byte 0x02, 0xE9, 0x0F, 0xE6, 0x07, 0xE3, 0x10, 0xA1, 0x03, 0x79, 0x10, 0x30, 0x10, 0xA1, 0x0E, 0x32, 0x04, 0xC3, 0x01, 0xD6, 0x05, 0xBC, 0xB0, 0xB0, 0xFF
