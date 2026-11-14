.align 2
.thumb

.include "../xse_commands.s"
.include "../xse_defines.s"
.include "../asm_defines.s"

@===== 对战塔(水银式)脚本 =====
@ 流程: 前台菜单(挑战/记录/退出) -> 4种模式(单打50/双打50/单打100/双打100)
@       -> 报名选队 -> 连续挑战(每场BP入账, 第20/50场打大君) -> 继续/中断
@ 存档续战: FLAG_TOWER_MID_CHALLENGE + safeBackupParty + 连胜镜像VAR
@ C辅助函数见 src/frontier.c 尾部 (callasm 直调, 无需special表)

.global EventScript_BattleTowerReceptionMenu
.global EventScript_BattleTowerReception

.equ FLAG_TOWER_MID_CHALLENGE, 0x947	@src/config.h
.equ FLAG_BATTLE_FACILITY, 0x930		@src/config.h
.equ VAR_TOWER_BP, 0x5163				@src/config.h BP钱包
.equ VAR_TOWER_STREAK_CURR, 0x5164		@src/config.h 当前连胜镜像

@ 设施配置VAR(全部是存档VAR,续战时自动还原)
.equ VAR_FACILITY_POKE_NUM, 0x5015
.equ VAR_FACILITY_POKE_LEVEL, 0x5016
.equ VAR_FACILITY_BATTLE_TYPE, 0x5017
.equ VAR_FACILITY_TIER, 0x5018
.equ VAR_FACILITY_NUM, 0x403A			@临时VAR: 0=IN_BATTLE_TOWER
.equ VAR_TOWER_LOST, 0x403C				@战斗结果

.equ TID_TOWER_TRAINER, 0x399			@BATTLE_TOWER_TID
.equ TID_FRONTIER_BRAIN, 0x397			@FRONTIER_BRAIN_TID

@ TowerPrepareNextBattle 返回的对手类型 (sp052 的 Var8001 输入)
.equ KIND_REGULAR, 0
.equ KIND_BRAIN, 2

EventScript_BattleTowerReceptionMenu:
	lock
	faceplayer
	checkflag FLAG_TOWER_MID_CHALLENGE
	if SET _goto EventScript_BattleTowerResumeAsk
	goto EventScript_BattleTowerMain

@---- 中断续战 ----
EventScript_BattleTowerResumeAsk:
	msgbox gText_TowerResumeAsk MSG_YESNO
	compare LASTRESULT, FALSE
	if equal _goto EventScript_BattleTowerVoidChallenge
	setvar VAR_FACILITY_NUM, 0
	setflag FLAG_BATTLE_FACILITY
	callasm SyncTowerStreakFromVars
	msgbox gText_TowerResumeWelcome MSG_NORMAL
	goto EventScript_BattleTowerNextBattle

@---- 拒绝续战 => 挑战作废 ----
EventScript_BattleTowerVoidChallenge:
	callasm RestoreTowerPartyFromSaveBlock
	setvar 0x8000, 1
	special 0x55
	callasm SyncTowerStreakToVars
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerVoided MSG_NORMAL
	release
	end

@---- 前台主菜单 ----
EventScript_BattleTowerMain:
	msgbox gText_TowerWelcome MSG_NORMAL
	multichoiceoption gText_TowerChoiceChallenge 0
	multichoiceoption gText_TowerChoiceRecords 1
	multichoiceoption gText_TowerChoiceQuit 2
	multichoice 0, 0, THREE_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 0
	if equal _goto EventScript_BattleTowerReception
	compare LASTRESULT, 1
	if equal _call EventScript_BattleTowerShowRecords
	release
	end

EventScript_BattleTowerShowRecords:
	special 0x57
	waitstate
	return

@---- 报名: 选择对战间 ----
EventScript_BattleTowerReception:
	msgbox gText_TowerModeAsk MSG_NORMAL
	multichoiceoption gText_TowerModeSingle50 0
	multichoiceoption gText_TowerModeDouble50 1
	multichoiceoption gText_TowerModeSingle100 2
	multichoiceoption gText_TowerModeDouble100 3
	multichoice 0, 0, FOUR_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 4
	if greaterorequal _goto EventScript_BattleTowerRegistrationCancelled
	compare LASTRESULT, 0
	if equal _goto EventScript_BattleTowerSetSingle50
	compare LASTRESULT, 1
	if equal _goto EventScript_BattleTowerSetDouble50
	compare LASTRESULT, 2
	if equal _goto EventScript_BattleTowerSetSingle100
	@3 = 双打100
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 100
	setvar VAR_FACILITY_BATTLE_TYPE, 1
	goto EventScript_BattleTowerStartRegistration

EventScript_BattleTowerSetSingle50:
	setvar VAR_FACILITY_POKE_NUM, 3
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	goto EventScript_BattleTowerStartRegistration

EventScript_BattleTowerSetDouble50:
	setvar VAR_FACILITY_POKE_NUM, 4
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 1
	goto EventScript_BattleTowerStartRegistration

EventScript_BattleTowerSetSingle100:
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 100
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	goto EventScript_BattleTowerStartRegistration

@---- 登记队伍 ----
EventScript_BattleTowerStartRegistration:
	setvar VAR_FACILITY_TIER, 0
	setflag FLAG_BATTLE_FACILITY
	callasm BackupTowerPartyToSaveBlock
	special 0x27
	callasm ResetBattleTowerPartySelection
	msgbox gText_TowerSelectTeam MSG_NORMAL
	special 0xF5
	waitstate
	special 0x28
	callasm BattleTowerHasSelectedTeam
	compare LASTRESULT, FALSE
	if equal _goto EventScript_BattleTowerRegistrationCancelled
	special 0x73
	setvar 0x8000, 1
	special 0x55					@重置当前连胜
	callasm SyncTowerStreakToVars
	setflag FLAG_TOWER_MID_CHALLENGE
	goto EventScript_BattleTowerNextBattle

EventScript_BattleTowerRegistrationCancelled:
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerRegistrationCancelled MSG_NORMAL
	release
	end

@---- 战斗循环 ----
EventScript_BattleTowerNextBattle:
	callasm TowerPrepareNextBattle	@LASTRESULT=0常规/2大君, gStringVar1=本场序号
	copyvar 0x8006, LASTRESULT
	msgbox gText_TowerNextBattle MSG_NORMAL
	setvar 0x8000, 0
	copyvar 0x8001, 0x8006
	special 0x52					@生成对手, gStringVar1=对手名
	compare 0x8006, KIND_BRAIN
	if equal _goto EventScript_BattleTowerBrainBattleSetup
	setvar 0x8003, TID_TOWER_TRAINER
	goto EventScript_BattleTowerDoBattle

EventScript_BattleTowerBrainBattleSetup:
	setvar 0x8003, TID_FRONTIER_BRAIN

EventScript_BattleTowerDoBattle:
	trainerbattle3 0x3, 0x8003, 0xF00, gText_TowerTrainerDefeated
	compare VAR_TOWER_LOST, 0
	if notequal _goto EventScript_BattleTowerLost

	@胜利: 连胜+1 -> 镜像 -> 发BP
	setvar 0x8000, 0
	special 0x55
	callasm SyncTowerStreakToVars
	special2 LASTRESULT, 0x56		@LASTRESULT=BP
	callasm AwardTowerBP			@BP入账, 本次BP->gStringVar1 总额->gStringVar2 (buffernumber在本引擎不可靠,数字一律C侧填)
	msgbox gText_TowerGotBP MSG_NORMAL

	callasm TowerCheckMilestone		@连胜是10的倍数时 gStringVar3=连胜数
	compare LASTRESULT, FALSE
	if notequal _goto EventScript_BattleTowerMilestone
	goto EventScript_BattleTowerContinueAsk

EventScript_BattleTowerMilestone:
	msgbox gText_TowerMilestone MSG_NORMAL

EventScript_BattleTowerContinueAsk:
	msgbox gText_TowerContinueAsk MSG_YESNO
	compare LASTRESULT, FALSE
	if equal _goto EventScript_BattleTowerQuitClean
	goto EventScript_BattleTowerNextBattle

@---- 主动中断(连胜保留, 恢复队伍) ----
EventScript_BattleTowerQuitClean:
	callasm RestoreTowerPartyFromSaveBlock
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerQuitDone MSG_NORMAL
	release
	end

@---- 挑战失败 ----
EventScript_BattleTowerLost:
	setvar 0x8000, 1
	special 0x55					@连胜清零
	callasm SyncTowerStreakToVars
	callasm RestoreTowerPartyFromSaveBlock
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerChallengeFailed MSG_NORMAL
	release
	end
