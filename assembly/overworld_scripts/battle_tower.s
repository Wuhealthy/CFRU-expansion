.align 2
.thumb

.include "../xse_commands.s"
.include "../xse_defines.s"
.include "../asm_defines.s"

.global EventScript_BattleTowerReception

EventScript_BattleTowerReception:
	lock
	faceplayer
	msgbox gText_BattleTowerChallengeAsk MSG_YESNO
	compare LASTRESULT FALSE
	if equal _goto EventScript_BattleTowerReception_Cancel

	setvar 0x403A, 0
	setvar 0x5015, 3
	setvar 0x5016, 50
	setvar 0x5017, 0
	setvar 0x5018, 0
	setflag 0x930
	special 0x27
	callasm ResetBattleTowerPartySelection
	msgbox gText_BattleTowerSelectTeam MSG_NORMAL
	special 0xF5
	waitstate
	special 0x28
	callasm BattleTowerHasSelectedTeam
	compare LASTRESULT, FALSE
	if equal _goto EventScript_BattleTowerRegistrationCancelled

	special 0x73
	setvar 0x8002, 0

EventScript_BattleTowerNext:
	setvar 0x8000, 0
	setvar 0x8001, 0
	special 0x52
	setvar 0x8003, 0x399
	trainerbattle3 0x3, 0x8003, 0xF00, gText_BattleTowerTrainerDefeated
	compare LASTRESULT, 1
	if equal _goto EventScript_BattleTowerLost

	setvar 0x8000, 0
	special 0x55
	special 0x0
	addvar 0x8002, 1
	compare 0x8002, 7
	if lessthan _goto EventScript_BattleTowerNext

	clearflag 0x930
	special 0x28
	callasm ResetBattleTowerPartySelection
	msgbox gText_BattleTowerChallengeComplete MSG_NORMAL
	release
	end

EventScript_BattleTowerLost:
	setvar 0x8000, 1
	special 0x55
	clearflag 0x930
	special 0x28
	callasm ResetBattleTowerPartySelection
	msgbox gText_BattleTowerChallengeFailed MSG_NORMAL
	release
	end

EventScript_BattleTowerRegistrationCancelled:
	clearflag 0x930
	callasm ResetBattleTowerPartySelection
	release
	end

EventScript_BattleTowerReception_Cancel:
	release
	end
