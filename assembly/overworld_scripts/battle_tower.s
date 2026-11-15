.align 2
.thumb

.include "../xse_commands.s"
.include "../xse_defines.s"
.include "../asm_defines.s"

@===== 对战开拓区大厅(map 2.7)脚本 =====
@ 7个NPC: 塔前台/宫殿前台/矿山前台/马戏团前台/记录/教学(30BP)/BP商店
@ 新游戏出生: 玩家房间3.2 ON_LOAD脚本一次性warp进来(FLAG_TOWER_SPAWN_QUEUED门控)
@ C辅助函数见 src/frontier.c (callasm 直调); 设施流程全共享, 按0x403A分支
@ 注意: subvar/compare的value操作数是字面量, var-vs-var要用comparevartovar

.global EventScript_BattleTowerReceptionMenu
.global EventScript_BattleTowerReception
.global EventScript_FrontierPalaceReception
.global EventScript_FrontierMineReception
.global EventScript_FrontierCircusReception
.global EventScript_FrontierRecordsNPC
.global EventScript_FrontierTutorNPC
.global EventScript_FrontierShopNPC
.global EventScript_TowerSpawnMapScripts

.equ FLAG_TOWER_MID_CHALLENGE, 0x947	@src/config.h 中断续战
.equ FLAG_TOWER_SPAWN_QUEUED, 0x948		@出生warp一次性门控
.equ FLAG_BATTLE_FACILITY, 0x930		@src/config.h

.equ VAR_TOWER_BP, 0x5163				@src/config.h BP钱包
.equ VAR_TOWER_STREAK_CURR, 0x5164		@src/config.h 当前连胜镜像

@ 设施配置VAR(全部是存档VAR,续战时自动还原)
.equ VAR_FACILITY_POKE_NUM, 0x5015
.equ VAR_FACILITY_POKE_LEVEL, 0x5016
.equ VAR_FACILITY_BATTLE_TYPE, 0x5017
.equ VAR_FACILITY_TIER, 0x5018
.equ VAR_FACILITY_NUM, 0x403A			@0=塔 1=宫殿Sands 2=矿山Mine 3=马戏团Circus
.equ VAR_TOWER_LOST, 0x403C				@战斗结果

.equ TID_TOWER_TRAINER, 0x399			@BATTLE_TOWER_TID
.equ TID_FRONTIER_BRAIN, 0x397			@FRONTIER_BRAIN_TID

@ TowerPrepareNextBattle 返回的对手类型 (sp052 的 Var8001 输入)
.equ KIND_REGULAR, 0
.equ KIND_BRAIN, 2
@ BATTLE_MINE_FORMAT_1/2/3 (VAR_BATTLE_FACILITY_TIER 取值)
.equ MINE_FORMAT_1, 17
.equ MINE_FORMAT_2, 18
.equ MINE_FORMAT_3, 19

@ BP商店道具 (include/constants/items.h)
.equ ITEM_FOCUS_SASH, 0x2AB
.equ ITEM_EXPERT_BELT, 0x2A4
.equ ITEM_CHOICE_BAND, 186
.equ ITEM_CHOICE_SPECS, 0x2B8
.equ ITEM_CHOICE_SCARF, 0x2B7
.equ ITEM_LEFTOVERS, 200
.equ ITEM_ASSAULT_VEST, 0x2C7

@-----------------------------------------------
@ 对战塔前台 (npc0)
@-----------------------------------------------
EventScript_BattleTowerReceptionMenu:
	lock
	faceplayer
	checkflag FLAG_TOWER_MID_CHALLENGE
	if SET _goto EventScript_BattleTowerResumeAsk
	msgbox gText_TowerWelcome MSG_NORMAL
	multichoiceoption gText_FrontierChoiceChallenge 0
	multichoiceoption gText_FrontierChoiceLeave 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 0
	if notequal _goto EventScript_FrontierReception_Leave
	setvar VAR_FACILITY_NUM, 0
	goto EventScript_FrontierModeMenu

EventScript_BattleTowerReception:
	msgbox gText_TowerWelcome MSG_NORMAL
	goto EventScript_BattleTowerReceptionMenu

@-----------------------------------------------
@ 对战宫殿前台 (npc1, Sands: AI代打+随机增益)
@-----------------------------------------------
EventScript_FrontierPalaceReception:
	lock
	faceplayer
	checkflag FLAG_TOWER_MID_CHALLENGE
	if SET _goto EventScript_BattleTowerResumeAsk
	msgbox gText_PalaceIntro MSG_NORMAL
	multichoiceoption gText_FrontierChoiceChallenge 0
	multichoiceoption gText_FrontierChoiceLeave 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 0
	if notequal _goto EventScript_FrontierReception_Leave
	setvar VAR_FACILITY_NUM, 1
	setvar 0x8000, 1
	special 0x6D						@sp06D: 随机AI伙伴控制我方宝可梦
	goto EventScript_FrontierModeMenu

@-----------------------------------------------
@ 对战矿山前台 (npc2, Mine: 每场随机规则)
@-----------------------------------------------
EventScript_FrontierMineReception:
	lock
	faceplayer
	checkflag FLAG_TOWER_MID_CHALLENGE
	if SET _goto EventScript_BattleTowerResumeAsk
	msgbox gText_MineIntro MSG_NORMAL
	multichoiceoption gText_FrontierChoiceChallenge 0
	multichoiceoption gText_FrontierChoiceLeave 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 0
	if notequal _goto EventScript_FrontierReception_Leave
	setvar VAR_FACILITY_NUM, 2
	special 0x6F						@sp06F: 队伍能否参加矿山
	compare LASTRESULT, FALSE
	if equal _goto EventScript_FrontierMine_CantParticipate
	msgbox gText_MineFormatAsk MSG_NORMAL
	multichoiceoption gText_MineFormat1 0
	multichoiceoption gText_MineFormat2 1
	multichoiceoption gText_MineFormat3 2
	multichoice 0, 0, THREE_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 3
	if greaterorequal _goto EventScript_FrontierReception_Leave
	compare LASTRESULT, 0
	if equal _goto EventScript_FrontierMine_SetFormat1
	compare LASTRESULT, 1
	if equal _goto EventScript_FrontierMine_SetFormat2
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	setvar VAR_FACILITY_TIER, MINE_FORMAT_3
	goto EventScript_FrontierRegistration

EventScript_FrontierMine_SetFormat1:
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	setvar VAR_FACILITY_TIER, MINE_FORMAT_1
	goto EventScript_FrontierRegistration

EventScript_FrontierMine_SetFormat2:
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	setvar VAR_FACILITY_TIER, MINE_FORMAT_2
	goto EventScript_FrontierRegistration

EventScript_FrontierMine_CantParticipate:
	msgbox gText_MineCantParticipate MSG_NORMAL
	release
	end

@-----------------------------------------------
@ 对战马戏团前台 (npc3, Circus: 每场随机场地效果)
@-----------------------------------------------
EventScript_FrontierCircusReception:
	lock
	faceplayer
	checkflag FLAG_TOWER_MID_CHALLENGE
	if SET _goto EventScript_BattleTowerResumeAsk
	msgbox gText_CircusIntro MSG_NORMAL
	multichoiceoption gText_FrontierChoiceChallenge 0
	multichoiceoption gText_FrontierChoiceLeave 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 0
	if notequal _goto EventScript_FrontierReception_Leave
	setvar VAR_FACILITY_NUM, 3
	goto EventScript_FrontierModeMenu

@-----------------------------------------------
@ 共享: 对战间选择 (塔/宫殿/马戏团; 同时归零规则VAR)
@-----------------------------------------------
EventScript_FrontierModeMenu:
	setvar VAR_FACILITY_TIER, 0
	msgbox gText_TowerModeAsk MSG_NORMAL
	multichoiceoption gText_TowerModeSingle50 0
	multichoiceoption gText_TowerModeDouble50 1
	multichoiceoption gText_TowerModeSingle100 2
	multichoiceoption gText_TowerModeDouble100 3
	multichoice 0, 0, FOUR_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 4
	if greaterorequal _goto EventScript_FrontierReception_Leave
	compare LASTRESULT, 0
	if equal _goto EventScript_FrontierMode_Single50
	compare LASTRESULT, 1
	if equal _goto EventScript_FrontierMode_Double50
	compare LASTRESULT, 2
	if equal _goto EventScript_FrontierMode_Single100
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 100
	setvar VAR_FACILITY_BATTLE_TYPE, 1
	goto EventScript_FrontierRegistration

EventScript_FrontierMode_Single50:
	setvar VAR_FACILITY_POKE_NUM, 3
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	goto EventScript_FrontierRegistration

EventScript_FrontierMode_Double50:
	setvar VAR_FACILITY_POKE_NUM, 4
	setvar VAR_FACILITY_POKE_LEVEL, 50
	setvar VAR_FACILITY_BATTLE_TYPE, 1
	goto EventScript_FrontierRegistration

EventScript_FrontierMode_Single100:
	setvar VAR_FACILITY_POKE_NUM, 6
	setvar VAR_FACILITY_POKE_LEVEL, 100
	setvar VAR_FACILITY_BATTLE_TYPE, 0
	goto EventScript_FrontierRegistration

@-----------------------------------------------
@ 共享: 登记队伍 (tier已由入口分支设好)
@-----------------------------------------------
EventScript_FrontierRegistration:
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
	if equal _goto EventScript_FrontierRegistrationCancelled
	special 0x73
	setvar 0x8000, 1
	special 0x55					@重置当前连胜
	callasm SyncTowerStreakToVars
	setflag FLAG_TOWER_MID_CHALLENGE
	goto EventScript_FrontierNextBattle

EventScript_FrontierRegistrationCancelled:
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_FrontierSeeYou MSG_NORMAL
	release
	end

@-----------------------------------------------
@ 共享: 战斗循环
@-----------------------------------------------
EventScript_FrontierNextBattle:
	compare VAR_FACILITY_NUM, 2
	if equal _goto EventScript_FrontierMineRandomize
	compare VAR_FACILITY_NUM, 3
	if equal _goto EventScript_FrontierCircusEffect
	goto EventScript_FrontierAnnounceBattle

EventScript_FrontierMineRandomize:
	special 0x70					@sp070: 随机本场等级/规模/规则
	goto EventScript_FrontierAnnounceBattle

EventScript_FrontierCircusEffect:
	special 0x72					@sp072: 随机本场场地效果, 说明->gStringVarC
	doweather
	msgbox gText_CircusEffectNotice MSG_NORMAL

EventScript_FrontierAnnounceBattle:
	callasm TowerPrepareNextBattle	@LASTRESULT=0常规/2大君, gStringVar1=本场序号
	copyvar 0x8006, LASTRESULT
	msgbox gText_TowerNextBattle MSG_NORMAL
	setvar 0x8000, 0
	copyvar 0x8001, 0x8006
	special 0x52					@生成对手, gStringVar1=对手名
	setvar 0x8000, 0
	copyvar 0x8001, 0x8006
	special 0x53					@对手开场白 -> 标准缓冲
	callstd MSG_NORMAL
	compare 0x8006, KIND_BRAIN
	if equal _goto EventScript_FrontierBrainBattleSetup
	setvar 0x8003, TID_TOWER_TRAINER
	goto EventScript_FrontierDoBattle

EventScript_FrontierBrainBattleSetup:
	setvar 0x8003, TID_FRONTIER_BRAIN

EventScript_FrontierDoBattle:
	trainerbattle3 0x3, 0x8003, 0xF00, gText_TowerTrainerDefeated
	compare VAR_TOWER_LOST, 0
	if notequal _goto EventScript_FrontierLost

	@胜利: (矿山先还原规则) -> 连胜+1 -> 镜像 -> 发BP
	compare VAR_FACILITY_NUM, 2
	if equal _goto EventScript_FrontierMineRevertTier
	goto EventScript_FrontierWinStreak

EventScript_FrontierMineRevertTier:
	special 0x71					@sp071: 还原本来的矿山规则VAR

EventScript_FrontierWinStreak:
	setvar 0x8000, 0
	special 0x55
	callasm SyncTowerStreakToVars
	special2 LASTRESULT, 0x56		@LASTRESULT=BP
	callasm AwardTowerBP			@BP入账, 本次BP->gStringVar1 总额->gStringVar2
	msgbox gText_TowerGotBP MSG_NORMAL

	callasm TowerCheckMilestone		@连胜是10的倍数时 gStringVar3=连胜数
	compare LASTRESULT, FALSE
	if notequal _goto EventScript_FrontierMilestone
	goto EventScript_FrontierContinueAsk

EventScript_FrontierMilestone:
	msgbox gText_TowerMilestone MSG_NORMAL

EventScript_FrontierContinueAsk:
	msgbox gText_TowerContinueAsk MSG_YESNO
	compare LASTRESULT, FALSE
	if equal _goto EventScript_FrontierQuitClean
	goto EventScript_FrontierNextBattle

@---- 主动中断(连胜保留, 恢复队伍) ----
EventScript_FrontierQuitClean:
	callasm RestoreTowerPartyFromSaveBlock
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerQuitDone MSG_NORMAL
	release
	end

@---- 挑战失败 ----
EventScript_FrontierLost:
	compare VAR_FACILITY_NUM, 2
	if equal _goto EventScript_FrontierLostMineRevert
	goto EventScript_FrontierLostCommon

EventScript_FrontierLostMineRevert:
	special 0x71

EventScript_FrontierLostCommon:
	setvar 0x8000, 1
	special 0x55					@连胜清零
	callasm SyncTowerStreakToVars
	callasm RestoreTowerPartyFromSaveBlock
	clearflag FLAG_TOWER_MID_CHALLENGE
	clearflag FLAG_BATTLE_FACILITY
	msgbox gText_TowerChallengeFailed MSG_NORMAL
	release
	end

@---- 中断续战 / 挑战作废 (四个前台共用) ----
EventScript_BattleTowerResumeAsk:
	msgbox gText_TowerResumeAsk MSG_YESNO
	compare LASTRESULT, FALSE
	if equal _goto EventScript_BattleTowerVoidChallenge
	setflag FLAG_BATTLE_FACILITY
	callasm SyncTowerStreakFromVars
	msgbox gText_TowerResumeWelcome MSG_NORMAL
	goto EventScript_FrontierNextBattle

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

EventScript_FrontierReception_Leave:
	release
	end

@-----------------------------------------------
@ 记录NPC (npc4): 设施菜单 + 单打/双打
@-----------------------------------------------
EventScript_FrontierRecordsNPC:
	lock
	faceplayer
	msgbox gText_RecordsAsk MSG_NORMAL
	multichoiceoption gText_RecordsTower 0
	multichoiceoption gText_RecordsPalace 1
	multichoiceoption gText_RecordsMine 2
	multichoiceoption gText_RecordsCircus 3
	multichoice 0, 0, FOUR_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 4
	if greaterorequal _goto EventScript_FrontierReception_Leave
	compare LASTRESULT, 0
	if equal _goto EventScript_FrontierRecords_Tower
	compare LASTRESULT, 1
	if equal _goto EventScript_FrontierRecords_Palace
	compare LASTRESULT, 2
	if equal _goto EventScript_FrontierRecords_Mine
	setvar VAR_FACILITY_NUM, 3
	goto EventScript_FrontierRecords_Style

EventScript_FrontierRecords_Tower:
	setvar VAR_FACILITY_NUM, 0
	goto EventScript_FrontierRecords_Style

EventScript_FrontierRecords_Palace:
	setvar VAR_FACILITY_NUM, 1
	goto EventScript_FrontierRecords_Style

EventScript_FrontierRecords_Mine:
	setvar VAR_FACILITY_NUM, 2
	setvar 0x8000, 0
	goto EventScript_FrontierRecords_Show

EventScript_FrontierRecords_Style:
	msgbox gText_RecordsStyleAsk MSG_NORMAL
	multichoiceoption gText_SingleBattle 0
	multichoiceoption gText_DoubleBattle 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 2
	if greaterorequal _goto EventScript_FrontierReception_Leave
	compare LASTRESULT, 0
	if notequal _goto EventScript_FrontierRecords_Double
	setvar 0x8000, 0
	goto EventScript_FrontierRecords_Show

EventScript_FrontierRecords_Double:
	setvar 0x8000, 1

EventScript_FrontierRecords_Show:
	special 0x57
	waitstate
	release
	end

@-----------------------------------------------
@ 教学NPC (npc5, 道破仙君): 80招滚动多选, 统一30BP
@-----------------------------------------------
EventScript_FrontierTutorNPC:
	lock
	faceplayer
	callasm BufferTowerBP			@gStringVar1 = BP总额
	msgbox gText_TutorIntro MSG_NORMAL
	setvar 0x8000, 2				@gScrollingSets[2] = 80教学招式
	setvar 0x8001, 6				@一次显示6行
	special 0x158
	waitstate
	compare LASTRESULT, 80
	if greaterorequal _goto EventScript_FrontierReception_Leave
	copyvar 0x8007, LASTRESULT		@保存教学表索引
	callasm BufferTutorMoveName		@gStringVar1 = 招式名
	msgbox gText_TutorConfirm MSG_YESNO
	compare LASTRESULT, FALSE
	if equal _goto EventScript_FrontierReception_Leave
	copyvar 0x8003, VAR_TOWER_BP
	compare 0x8003, 30
	if lessthan _goto EventScript_FrontierTutorBroke
	copyvar 0x8005, 0x8007			@0x8005 = 教学表索引 (ChooseMonForMoveTutor输入)
	special 0x18D					@选择可学的宝可梦并教学(取消=0x7F)
	waitstate
	compare LASTRESULT, 0x7F
	if equal _goto EventScript_FrontierReception_Leave
	subvar VAR_TOWER_BP, 30
	msgbox gText_TutorLearned MSG_NORMAL
	release
	end

EventScript_FrontierTutorBroke:
	msgbox gText_TutorBroke MSG_NORMAL
	release
	end

@-----------------------------------------------
@ BP商店NPC (npc6): 道具换BP (call TryBuy成功返回后给货)
@-----------------------------------------------
EventScript_FrontierShopNPC:
	lock
	faceplayer
	callasm BufferTowerBP			@gStringVar1 = BP总额
	msgbox gText_ShopIntro MSG_NORMAL
	multichoiceoption gText_ShopItem1 0
	multichoiceoption gText_ShopItem2 1
	multichoiceoption gText_ShopItem3 2
	multichoiceoption gText_ShopItem4 3
	multichoiceoption gText_ShopItem5 4
	multichoiceoption gText_ShopItem6 5
	multichoiceoption gText_ShopItem7 6
	multichoice 0, 0, SEVEN_MULTICHOICE_OPTIONS, 1
	compare LASTRESULT, 7
	if greaterorequal _goto EventScript_FrontierReception_Leave
	compare LASTRESULT, 0
	if equal _goto EventScript_FrontierShop_Item1
	compare LASTRESULT, 1
	if equal _goto EventScript_FrontierShop_Item2
	compare LASTRESULT, 2
	if equal _goto EventScript_FrontierShop_Item3
	compare LASTRESULT, 3
	if equal _goto EventScript_FrontierShop_Item4
	compare LASTRESULT, 4
	if equal _goto EventScript_FrontierShop_Item5
	compare LASTRESULT, 5
	if equal _goto EventScript_FrontierShop_Item6
	@6 = Item7
	setvar 0x8006, 20
	call EventScript_FrontierShop_TryBuy
	additem ITEM_ASSAULT_VEST, 1
	bufferitem 0x1, ITEM_ASSAULT_VEST
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item1:
	setvar 0x8006, 10
	call EventScript_FrontierShop_TryBuy
	additem ITEM_FOCUS_SASH, 1
	bufferitem 0x1, ITEM_FOCUS_SASH
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item2:
	setvar 0x8006, 10
	call EventScript_FrontierShop_TryBuy
	additem ITEM_EXPERT_BELT, 1
	bufferitem 0x1, ITEM_EXPERT_BELT
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item3:
	setvar 0x8006, 15
	call EventScript_FrontierShop_TryBuy
	additem ITEM_CHOICE_BAND, 1
	bufferitem 0x1, ITEM_CHOICE_BAND
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item4:
	setvar 0x8006, 15
	call EventScript_FrontierShop_TryBuy
	additem ITEM_CHOICE_SPECS, 1
	bufferitem 0x1, ITEM_CHOICE_SPECS
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item5:
	setvar 0x8006, 15
	call EventScript_FrontierShop_TryBuy
	additem ITEM_CHOICE_SCARF, 1
	bufferitem 0x1, ITEM_CHOICE_SCARF
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Item6:
	setvar 0x8006, 20
	call EventScript_FrontierShop_TryBuy
	additem ITEM_LEFTOVERS, 1
	bufferitem 0x1, ITEM_LEFTOVERS
	msgbox gText_ShopGot MSG_NORMAL
	goto EventScript_FrontierShop_Balance

EventScript_FrontierShop_Balance:
	callasm BufferTowerBP
	msgbox gText_ShopBalance MSG_NORMAL
	goto EventScript_FrontierShopNPC

EventScript_FrontierShopBroke:
	msgbox gText_ShopBroke MSG_NORMAL
	release
	end

@ TryBuy: 0x8006=价格; BP足够则扣款并return, 不足则提示后直接release+end
EventScript_FrontierShop_TryBuy:
	copyvar 0x8003, VAR_TOWER_BP
	comparevartovar 0x8003, 0x8006
	if lessthan _goto EventScript_FrontierShop_TryBuyFail
	callasm SpendTowerBP				@0x8006=价格, 扣款
	return

EventScript_FrontierShop_TryBuyFail:
	msgbox gText_ShopBroke MSG_NORMAL
	release
	end

@-----------------------------------------------
@ 新游戏出生: 玩家房间3.2的地图脚本表 (ON_LOAD一次性warp进开拓区大厅)
@-----------------------------------------------
EventScript_TowerSpawnMapScripts:
	.byte 0x01						@MAP_SCRIPT_ON_LOAD
	.4byte EventScript_TowerSpawnScript
	.byte 0x03						@保留房间原有的ON_TRANSITION脚本
	.4byte 0x08165B94
	.byte 0x00						@表终止

EventScript_TowerSpawnScript:
	checkflag FLAG_TOWER_SPAWN_QUEUED
	if SET _goto EventScript_TowerSpawn_Done
	setflag FLAG_TOWER_SPAWN_QUEUED
	warp 2, 7, 0, 0, 0				@进入对战开拓区大厅(map 2.7 warp0)
	waitstate
EventScript_TowerSpawn_Done:
	end
