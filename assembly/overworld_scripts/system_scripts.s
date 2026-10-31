.text
.thumb
.align 2

.include "../xse_commands.s"
.include "../xse_defines.s"
.include "../asm_defines.s"

.equ SPECIAL_STOP_SOUNDS, 0x9A

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_SecondBagItemCanBeRegisteredToL
EventScript_SecondBagItemCanBeRegisteredToL:
	lockall
	msgbox gText_SecondBagItemCanBeRegisteredToL MSG_SIGN
	releaseall
	end

.global SystemScript_EnableAutoRun
SystemScript_EnableAutoRun:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x2
	signmsg
	msgboxsign
	msgbox gText_AutoRunEnable MSG_SIGN
	releaseall
	end
	
.global SystemScript_DisableAutoRun
SystemScript_DisableAutoRun:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x3
	msgboxsign
	msgbox gText_AutoRunDisable MSG_SIGN
	releaseall
	end

.global SystemScript_EnableBikeTurboBoost
SystemScript_EnableBikeTurboBoost:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x2
	signmsg
	msgboxsign
	msgbox gText_BikeTurboBoostEnable MSG_SIGN
	releaseall
	end
	
.global SystemScript_DisableBikeTurboBoost
SystemScript_DisableBikeTurboBoost:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x3
	msgboxsign
	msgbox gText_BikeTurboBoostDisable MSG_SIGN
	releaseall
	end

.global SystemScript_EnableSurfTurboBoost
SystemScript_EnableSurfTurboBoost:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x2
	signmsg
	msgboxsign
	msgbox gText_SurfTurboBoostEnable MSG_SIGN
	releaseall
	end

.global SystemScript_DisableSurfTurboBoost
SystemScript_DisableSurfTurboBoost:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x3
	msgboxsign
	msgbox gText_SurfTurboBoostDisable MSG_SIGN
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@ L 按钮：野外功能多选菜单
@ 步行显示自动奔跑，骑车显示涡轮加速，冲浪显示涡轮冲浪；
@ 第二项均为更改觉醒力量属性。由 read_keys.c 按玩家状态选择脚本。

.equ FLAG_AUTO_RUN, 0x914
.equ FLAG_BIKE_TURBO_BOOST, 0x91F
.equ FLAG_SURF_TURBO_BOOST, 0x929
.equ VAR_TIME_OVERRIDE, 0x5161 @日夜更改强制时段(0=现实时间,1/2/3/4=早晨/白天/傍晚/夜晚)

.global SystemScript_LButtonMenu
SystemScript_LButtonMenu:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x5 @SE_SELECT
	preparemsg gText_LButtonMenu_Prompt
	waitmsg
	multichoiceoption gText_LButtonMenu_AutoRun 0
	multichoiceoption gText_LButtonMenu_DayNight 1
	multichoiceoption gText_LButtonMenu_PokemonTraining 2
	multichoiceoption gText_LButtonMenu_OnlineShop 3
	multichoice 0x0 0x0 FOUR_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_ToggleAutoRun
	case 1, SystemScript_LButtonMenu_DayNight
	case 2, SystemScript_LButtonMenu_Training
	case 3, SystemScript_LButtonMenu_OnlineShop
	releaseall
	end

.global SystemScript_LButtonMenu_Bike
SystemScript_LButtonMenu_Bike:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x5 @SE_SELECT
	preparemsg gText_LButtonMenu_Prompt
	waitmsg
	multichoiceoption gText_LButtonMenu_BikeTurbo 0
	multichoiceoption gText_LButtonMenu_DayNight 1
	multichoiceoption gText_LButtonMenu_PokemonTraining 2
	multichoiceoption gText_LButtonMenu_OnlineShop 3
	multichoice 0x0 0x0 FOUR_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_ToggleBikeTurbo
	case 1, SystemScript_LButtonMenu_DayNight
	case 2, SystemScript_LButtonMenu_Training
	case 3, SystemScript_LButtonMenu_OnlineShop
	releaseall
	end

.global SystemScript_LButtonMenu_Surf
SystemScript_LButtonMenu_Surf:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x5 @SE_SELECT
	preparemsg gText_LButtonMenu_Prompt
	waitmsg
	multichoiceoption gText_LButtonMenu_SurfTurbo 0
	multichoiceoption gText_LButtonMenu_DayNight 1
	multichoiceoption gText_LButtonMenu_PokemonTraining 2
	multichoiceoption gText_LButtonMenu_OnlineShop 3
	multichoice 0x0 0x0 FOUR_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_ToggleSurfTurbo
	case 1, SystemScript_LButtonMenu_DayNight
	case 2, SystemScript_LButtonMenu_Training
	case 3, SystemScript_LButtonMenu_OnlineShop
	releaseall
	end

@ 日夜更改：强制时段(1/2/3/4=早晨/白天/傍晚/夜晚，0=恢复现实时间)，影响野外遭遇等所有时段判定
SystemScript_LButtonMenu_DayNight:
	multichoiceoption gText_LButtonMenu_DayNight_Morning 0
	multichoiceoption gText_LButtonMenu_DayNight_Day 1
	multichoiceoption gText_LButtonMenu_DayNight_Evening 2
	multichoiceoption gText_LButtonMenu_DayNight_Night 3
	multichoiceoption gText_LButtonMenu_DayNight_Realtime 4
	multichoice 0x0 0x0 FIVE_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_DayNight_SetMorning
	case 1, SystemScript_LButtonMenu_DayNight_SetDay
	case 2, SystemScript_LButtonMenu_DayNight_SetEvening
	case 3, SystemScript_LButtonMenu_DayNight_SetNight
	case 4, SystemScript_LButtonMenu_DayNight_SetRealtime
	releaseall
	end

SystemScript_LButtonMenu_DayNight_SetMorning:
	setvar VAR_TIME_OVERRIDE, 0x1
	goto SystemScript_LButtonMenu_DayNight_Done

SystemScript_LButtonMenu_DayNight_SetDay:
	setvar VAR_TIME_OVERRIDE, 0x2
	goto SystemScript_LButtonMenu_DayNight_Done

SystemScript_LButtonMenu_DayNight_SetEvening:
	setvar VAR_TIME_OVERRIDE, 0x3
	goto SystemScript_LButtonMenu_DayNight_Done

SystemScript_LButtonMenu_DayNight_SetNight:
	setvar VAR_TIME_OVERRIDE, 0x4
	goto SystemScript_LButtonMenu_DayNight_Done

SystemScript_LButtonMenu_DayNight_SetRealtime:
	setvar VAR_TIME_OVERRIDE, 0x0
	goto SystemScript_LButtonMenu_DayNight_Done

SystemScript_LButtonMenu_DayNight_Done:
	preparemsg gText_LButtonMenu_DayNight_Done
	waitmsg
	releaseall
	end

@ 宝可梦培养：觉醒力量属性 / 更改个体值（全满 6000 元，单项 1000 元）
SystemScript_LButtonMenu_Training:
	multichoiceoption gText_LButtonMenu_HiddenPower 0
	multichoiceoption gText_LButtonMenu_IVEditor 1
	multichoice 0x0 0x0 TWO_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_HiddenPower
	case 1, SystemScript_LButtonMenu_IVMenu
	releaseall
	end

@ 更改个体值主菜单
SystemScript_LButtonMenu_IVMenu:
	countpokemon
	compare LASTRESULT 0x0
	if equal _goto SystemScript_LButtonMenu_Cancelled
	multichoiceoption gText_LButtonMenu_IVMaxAll 0
	multichoiceoption gText_LButtonMenu_IVCustom 1
	multichoice 0x0 0x0 TWO_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_IVMaxAll
	case 1, SystemScript_LButtonMenu_IVCustom
	releaseall
	end

@ 全个体值升满：花 6000 元把六项 IV 一次性设为 31
SystemScript_LButtonMenu_IVMaxAll:
	checkmoney 6000
	compare LASTRESULT 0x1
	if 0x0 _goto SystemScript_LButtonMenu_IV_NoMoney
	special 0x9F @ Opens Pokemon selection menu
	waitstate
	compare 0x8004 PARTY_SIZE
	if greaterorequal _goto SystemScript_LButtonMenu_Cancelled
	msgbox gText_LButtonMenu_IVMaxAll_Confirm MSG_YESNO
	compare LASTRESULT FALSE
	if equal _goto SystemScript_LButtonMenu_IVMenu
	setvar 0x8003 0x0 @ 防 SELECT_FROM_PC 分支误写盒子
	setvar 0x8005 0x6 @ SetAllIVs
	setvar 0x8006 31
	special 0x10 @ sp010_IVSetter
	removemoney 6000
	msgbox gText_LButtonMenu_IVDone MSG_NORMAL
	goto SystemScript_LButtonMenu_IVMenu

@ 自定义个体值：选一只宝可梦，再选能力项，逐项输入 0-31（每项 1000 元）
SystemScript_LButtonMenu_IVCustom:
	special 0x9F
	waitstate
	compare 0x8004 PARTY_SIZE
	if greaterorequal _goto SystemScript_LButtonMenu_Cancelled
SystemScript_LButtonMenu_IVCustom_StatMenu:
	multichoiceoption gText_LButtonMenu_IVStat_HP 0
	multichoiceoption gText_LButtonMenu_IVStat_Atk 1
	multichoiceoption gText_LButtonMenu_IVStat_Def 2
	multichoiceoption gText_LButtonMenu_IVStat_SpAtk 3
	multichoiceoption gText_LButtonMenu_IVStat_SpDef 4
	multichoiceoption gText_LButtonMenu_IVStat_Spd 5
	multichoice 0x0 0x0 SIX_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_IVCustom_HP
	case 1, SystemScript_LButtonMenu_IVCustom_Atk
	case 2, SystemScript_LButtonMenu_IVCustom_Def
	case 3, SystemScript_LButtonMenu_IVCustom_SpAtk
	case 4, SystemScript_LButtonMenu_IVCustom_SpDef
	case 5, SystemScript_LButtonMenu_IVCustom_Spd
	releaseall
	end

@ sp010_IVSetter 的能力序号：0=HP 1=攻击 2=防御 3=速度 4=特攻 5=特防
SystemScript_LButtonMenu_IVCustom_HP:
	setvar 0x8005 0x0
	msgbox gText_LButtonMenu_IVCustom_EnterHP MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input
SystemScript_LButtonMenu_IVCustom_Atk:
	setvar 0x8005 0x1
	msgbox gText_LButtonMenu_IVCustom_EnterAtk MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input
SystemScript_LButtonMenu_IVCustom_Def:
	setvar 0x8005 0x2
	msgbox gText_LButtonMenu_IVCustom_EnterDef MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input
SystemScript_LButtonMenu_IVCustom_SpAtk:
	setvar 0x8005 0x4
	msgbox gText_LButtonMenu_IVCustom_EnterSpAtk MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input
SystemScript_LButtonMenu_IVCustom_SpDef:
	setvar 0x8005 0x5
	msgbox gText_LButtonMenu_IVCustom_EnterSpDef MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input
SystemScript_LButtonMenu_IVCustom_Spd:
	setvar 0x8005 0x3
	msgbox gText_LButtonMenu_IVCustom_EnterSpd MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input

SystemScript_LButtonMenu_IVCustom_Input:
	checkmoney 1000
	compare LASTRESULT 0x1
	if 0x0 _goto SystemScript_LButtonMenu_IV_NoMoney
	special 0xB3 @ 数字输入界面（取消返回 0xFFFF）
	waitstate
	compare LASTRESULT 0xFFFF
	if equal _goto SystemScript_LButtonMenu_IVCustom_StatMenu
	compare LASTRESULT 32
	if greaterorequal _goto SystemScript_LButtonMenu_IVCustom_Invalid
	copyvar 0x8006 LASTRESULT
	setvar 0x8003 0x0 @ 防 SELECT_FROM_PC 分支误写盒子
	special 0x10 @ sp010_IVSetter
	removemoney 1000
	msgbox gText_LButtonMenu_IVDone MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_StatMenu

SystemScript_LButtonMenu_IVCustom_Invalid:
	msgbox gText_LButtonMenu_IVInvalid MSG_NORMAL
	goto SystemScript_LButtonMenu_IVCustom_Input

SystemScript_LButtonMenu_IV_NoMoney:
	msgbox gText_LButtonMenu_IV_NoMoneyText MSG_NORMAL
	goto SystemScript_LButtonMenu_IVMenu

@ 网上商店：所有商店的二级菜单（买完后返回本菜单，按 B 退出）
SystemScript_LButtonMenu_OnlineShop:
	multichoiceoption gText_LButtonMenu_MegaShop 0
	multichoiceoption gText_LButtonMenu_TmShop 1
	multichoiceoption gText_LButtonMenu_BattleItemShop 2
	multichoiceoption gText_LButtonMenu_EvolutionItemShop 3
	multichoiceoption gText_LButtonMenu_TrainingShop 4
	multichoiceoption gText_LButtonMenu_BallShop 5
	multichoice 0x0 0x0 SIX_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_LButtonMenu_MegaShop
	case 1, SystemScript_LButtonMenu_TmShop
	case 2, SystemScript_LButtonMenu_BattleItemShop
	case 3, SystemScript_LButtonMenu_EvolutionItemShop
	case 4, SystemScript_LButtonMenu_TrainingShop
	case 5, SystemScript_LButtonMenu_BallShop
	releaseall
	end

SystemScript_LButtonMenu_MegaShop:
	preparemsg gText_LButtonMenu_MegaShop_Greeting
	waitmsg
	pokemart MegaStoneShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop

SystemScript_LButtonMenu_TmShop:
	preparemsg gText_LButtonMenu_TmShop_Greeting
	waitmsg
	pokemart TmShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop

SystemScript_LButtonMenu_BattleItemShop:
	preparemsg gText_LButtonMenu_BattleItemShop_Greeting
	waitmsg
	pokemart BattleItemShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop

SystemScript_LButtonMenu_EvolutionItemShop:
	preparemsg gText_LButtonMenu_EvolutionItemShop_Greeting
	waitmsg
	pokemart EvolutionItemShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop

SystemScript_LButtonMenu_TrainingShop:
	preparemsg gText_LButtonMenu_TrainingShop_Greeting
	waitmsg
	pokemart TrainingShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop

SystemScript_LButtonMenu_BallShop:
	preparemsg gText_LButtonMenu_BallShop_Greeting
	waitmsg
	pokemart BallShopItems
	msgbox gText_LButtonMenu_MegaShop_Farewell MSG_KEEPOPEN
	goto SystemScript_LButtonMenu_OnlineShop


@ 所有 Mega 进化石（不含 Ultranecrozium Z）
.align 2
MegaStoneShopItems:
	.hword ITEM_MEGA_RING
	.hword ITEM_VENUSAURITE
	.hword ITEM_CHARIZARDITE_X
	.hword ITEM_CHARIZARDITE_Y
	.hword ITEM_BLASTOISINITE
	.hword ITEM_BEEDRILLITE
	.hword ITEM_PIDGEOTITE
	.hword ITEM_ALAKAZITE
	.hword ITEM_SLOWBRONITE
	.hword ITEM_GENGARITE
	.hword ITEM_KANGASKHANITE
	.hword ITEM_PINSIRITE
	.hword ITEM_GYARADOSITE
	.hword ITEM_AERODACTYLITE
	.hword ITEM_MEWTWONITE_X
	.hword ITEM_MEWTWONITE_Y
	.hword ITEM_AMPHAROSITE
	.hword ITEM_STEELIXITE
	.hword ITEM_SCIZORITE
	.hword ITEM_HERACRONITE
	.hword ITEM_HOUNDOOMINITE
	.hword ITEM_TYRANITARITE
	.hword ITEM_SCEPTILITE
	.hword ITEM_BLAZIKENITE
	.hword ITEM_SWAMPERTITE
	.hword ITEM_GARDEVOIRITE
	.hword ITEM_SABLENITE
	.hword ITEM_MAWILITE
	.hword ITEM_AGGRONITE
	.hword ITEM_MEDICHAMITE
	.hword ITEM_MANECTITE
	.hword ITEM_SHARPEDONITE
	.hword ITEM_CAMERUPTITE
	.hword ITEM_ALTARIANITE
	.hword ITEM_BANETTITE
	.hword ITEM_ABSOLITE
	.hword ITEM_GLALITITE
	.hword ITEM_SALAMENCITE
	.hword ITEM_METAGROSSITE
	.hword ITEM_LATIASITE
	.hword ITEM_LATIOSITE
	.hword ITEM_LOPUNNITE
	.hword ITEM_GARCHOMPITE
	.hword ITEM_LUCARIONITE
	.hword ITEM_ABOMASITE
	.hword ITEM_GALLADITE
	.hword ITEM_AUDINITE
	.hword ITEM_DIANCITE
	.hword ITEM_BAXCALIBURITE
	.hword ITEM_TATSUGIRIITE
	.hword ITEM_RAICHUXITE
	.hword ITEM_RAICHUYITE
	.hword ITEM_GLIMMORAITE
	.hword ITEM_SCOVILLAINITE
	.hword ITEM_FALINKSITE
	.hword ITEM_CLEFABLEITE
	.hword ITEM_ZERAORAITE
	.hword ITEM_MAGEARNAITE
	.hword ITEM_DRAMPAITE
	.hword ITEM_GOLISOPODITE
	.hword ITEM_VICTREEBELITE
	.hword ITEM_CRABMINBLEITE
	.hword ITEM_ZYGARDEITE
	.hword ITEM_GOODRAITE
	.hword ITEM_HAWLUCHAITE
	.hword ITEM_DRAGALGEITE
	.hword ITEM_BARBARACLEITE
	.hword ITEM_STARMIEITE
	.hword ITEM_MALAMARITE
	.hword ITEM_MEOWSTICITE
	.hword ITEM_VAPOREONITE
	.hword ITEM_JOLTEONITE
	.hword ITEM_FLAREONITE
	.hword ITEM_ARTICUNOITE
	.hword ITEM_ZAPDOSITE
	.hword ITEM_MOLTRESITE
	.hword ITEM_DRAGONITEITE
	.hword ITEM_MEGANIUMITE
	.hword ITEM_TYPHLOSIONITE
	.hword ITEM_FERALIGATRITE
	.hword ITEM_FLOETTEITE
	.hword ITEM_PYROARITE
	.hword ITEM_ESPEONITE
	.hword ITEM_UMBREONITE
	.hword ITEM_GRENINJAITE
	.hword ITEM_SKARMORYITE
	.hword ITEM_GRENINJAZITE
	.hword ITEM_PALAFINITE
	.hword ITEM_RAIKOUITE
	.hword ITEM_ENTEIITE
	.hword ITEM_SUICUNEITE
	.hword ITEM_LUGIAITE
	.hword ITEM_HOOHITE
	.hword ITEM_SLAKINGITE
	.hword ITEM_POLTEAGEISTITE
	.hword ITEM_CHESNAUGHTITE
	.hword ITEM_DELPHOXITE
	.hword ITEM_GOLURKITE
	.hword ITEM_CHANDELUREITE
	.hword ITEM_CHIMECHOITE
	.hword ITEM_ABSOLZITE
	.hword ITEM_ANNIHILAPEITE
	.hword ITEM_TORTERRAITE
	.hword ITEM_INFERNAPEITE
	.hword ITEM_EMPOLEONITE
	.hword ITEM_STARAPTORITE
	.hword ITEM_SCOLIPEDEITE
	.hword ITEM_SCRAFTYITE
	.hword ITEM_EELEKTROSSITE
	.hword ITEM_GARCHOMPZITE
	.hword ITEM_LUCARIOZITE
	.hword ITEM_FROSLASSITE
	.hword ITEM_HEATRANITE
	.hword ITEM_DARKRAIITE
	.hword ITEM_CRESSELIAITE
	.hword ITEM_SERPERIORITE
	.hword ITEM_EMBOARITE
	.hword ITEM_SAMUROTTITE
	.hword ITEM_EXCADRILLITE
	.hword 0x0

@ 所有招式学习器 TM01–TM120（不含秘传学习器 HM）
.align 2
TmShopItems:
	.hword ITEM_TM01
	.hword ITEM_TM02
	.hword ITEM_TM03
	.hword ITEM_TM04
	.hword ITEM_TM05
	.hword ITEM_TM06
	.hword ITEM_TM07
	.hword ITEM_TM08
	.hword ITEM_TM09
	.hword ITEM_TM10
	.hword ITEM_TM11
	.hword ITEM_TM12
	.hword ITEM_TM13
	.hword ITEM_TM14
	.hword ITEM_TM15
	.hword ITEM_TM16
	.hword ITEM_TM17
	.hword ITEM_TM18
	.hword ITEM_TM19
	.hword ITEM_TM20
	.hword ITEM_TM21
	.hword ITEM_TM22
	.hword ITEM_TM23
	.hword ITEM_TM24
	.hword ITEM_TM25
	.hword ITEM_TM26
	.hword ITEM_TM27
	.hword ITEM_TM28
	.hword ITEM_TM29
	.hword ITEM_TM30
	.hword ITEM_TM31
	.hword ITEM_TM32
	.hword ITEM_TM33
	.hword ITEM_TM34
	.hword ITEM_TM35
	.hword ITEM_TM36
	.hword ITEM_TM37
	.hword ITEM_TM38
	.hword ITEM_TM39
	.hword ITEM_TM40
	.hword ITEM_TM41
	.hword ITEM_TM42
	.hword ITEM_TM43
	.hword ITEM_TM44
	.hword ITEM_TM45
	.hword ITEM_TM46
	.hword ITEM_TM47
	.hword ITEM_TM48
	.hword ITEM_TM49
	.hword ITEM_TM50
	.hword ITEM_TM51
	.hword ITEM_TM52
	.hword ITEM_TM53
	.hword ITEM_TM54
	.hword ITEM_TM55
	.hword ITEM_TM56
	.hword ITEM_TM57
	.hword ITEM_TM58
	.hword ITEM_TM59
	.hword ITEM_TM60
	.hword ITEM_TM61
	.hword ITEM_TM62
	.hword ITEM_TM63
	.hword ITEM_TM64
	.hword ITEM_TM65
	.hword ITEM_TM66
	.hword ITEM_TM67
	.hword ITEM_TM68
	.hword ITEM_TM69
	.hword ITEM_TM70
	.hword ITEM_TM71
	.hword ITEM_TM72
	.hword ITEM_TM73
	.hword ITEM_TM74
	.hword ITEM_TM75
	.hword ITEM_TM76
	.hword ITEM_TM77
	.hword ITEM_TM78
	.hword ITEM_TM79
	.hword ITEM_TM80
	.hword ITEM_TM81
	.hword ITEM_TM82
	.hword ITEM_TM83
	.hword ITEM_TM84
	.hword ITEM_TM85
	.hword ITEM_TM86
	.hword ITEM_TM87
	.hword ITEM_TM88
	.hword ITEM_TM89
	.hword ITEM_TM90
	.hword ITEM_TM91
	.hword ITEM_TM92
	.hword ITEM_TM93
	.hword ITEM_TM94
	.hword ITEM_TM95
	.hword ITEM_TM96
	.hword ITEM_TM97
	.hword ITEM_TM98
	.hword ITEM_TM99
	.hword ITEM_TM100
	.hword ITEM_TM101
	.hword ITEM_TM102
	.hword ITEM_TM103
	.hword ITEM_TM104
	.hword ITEM_TM105
	.hword ITEM_TM106
	.hword ITEM_TM107
	.hword ITEM_TM108
	.hword ITEM_TM109
	.hword ITEM_TM110
	.hword ITEM_TM111
	.hword ITEM_TM112
	.hword ITEM_TM113
	.hword ITEM_TM114
	.hword ITEM_TM115
	.hword ITEM_TM116
	.hword ITEM_TM117
	.hword ITEM_TM118
	.hword ITEM_TM119
	.hword ITEM_TM120
	.hword 0x0

@ 全部对战携带道具（按持有效果筛选；排除Mega石/经验共享/不变石/安抚铃/幸运蛋/净化符/EV负重/进化素材/特性胶囊/薄荷）
.align 2
BattleItemShopItems:
	.hword ITEM_BERRY_JUICE
	.hword ITEM_RAZOR_CLAW
	.hword ITEM_RAZOR_FANG
	.hword ITEM_CHERI_BERRY
	.hword ITEM_CHESTO_BERRY
	.hword ITEM_PECHA_BERRY
	.hword ITEM_RAWST_BERRY
	.hword ITEM_ASPEAR_BERRY
	.hword ITEM_LEPPA_BERRY
	.hword ITEM_ORAN_BERRY
	.hword ITEM_PERSIM_BERRY
	.hword ITEM_LUM_BERRY
	.hword ITEM_SITRUS_BERRY
	.hword ITEM_FIGY_BERRY
	.hword ITEM_WIKI_BERRY
	.hword ITEM_MAGO_BERRY
	.hword ITEM_AGUAV_BERRY
	.hword ITEM_IAPAPA_BERRY
	.hword ITEM_LIECHI_BERRY
	.hword ITEM_GANLON_BERRY
	.hword ITEM_SALAC_BERRY
	.hword ITEM_PETAYA_BERRY
	.hword ITEM_APICOT_BERRY
	.hword ITEM_LANSAT_BERRY
	.hword ITEM_STARF_BERRY
	.hword ITEM_ENIGMA_BERRY
	.hword ITEM_BRIGHT_POWDER
	.hword ITEM_WHITE_HERB
	.hword ITEM_QUICK_CLAW
	.hword ITEM_MENTAL_HERB
	.hword ITEM_CHOICE_BAND
	.hword ITEM_KINGS_ROCK
	.hword ITEM_SILVER_POWDER
	.hword ITEM_AMULET_COIN
	.hword ITEM_SOUL_DEW
	.hword ITEM_DEEP_SEA_TOOTH
	.hword ITEM_DEEP_SEA_SCALE
	.hword ITEM_SMOKE_BALL
	.hword ITEM_FOCUS_BAND
	.hword ITEM_SCOPE_LENS
	.hword ITEM_METAL_COAT
	.hword ITEM_LEFTOVERS
	.hword ITEM_LIGHT_BALL
	.hword ITEM_SOFT_SAND
	.hword ITEM_HARD_STONE
	.hword ITEM_MIRACLE_SEED
	.hword ITEM_BLACK_GLASSES
	.hword ITEM_BLACK_BELT
	.hword ITEM_MAGNET
	.hword ITEM_MYSTIC_WATER
	.hword ITEM_SHARP_BEAK
	.hword ITEM_POISON_BARB
	.hword ITEM_NEVER_MELT_ICE
	.hword ITEM_SPELL_TAG
	.hword ITEM_TWISTED_SPOON
	.hword ITEM_CHARCOAL
	.hword ITEM_DRAGON_FANG
	.hword ITEM_SILK_SCARF
	.hword ITEM_SHELL_BELL
	.hword ITEM_SEA_INCENSE
	.hword ITEM_LAX_INCENSE
	.hword ITEM_LUCKY_PUNCH
	.hword ITEM_METAL_POWDER
	.hword ITEM_THICK_CLUB
	.hword ITEM_LEEK
	.hword ITEM_RED_ORB
	.hword ITEM_BLUE_ORB
	.hword ITEM_OCCA_BERRY
	.hword ITEM_PASSHO_BERRY
	.hword ITEM_WACAN_BERRY
	.hword ITEM_RINDO_BERRY
	.hword ITEM_YACHE_BERRY
	.hword ITEM_CHOPLE_BERRY
	.hword ITEM_KEBIA_BERRY
	.hword ITEM_SHUCA_BERRY
	.hword ITEM_COBA_BERRY
	.hword ITEM_PAYAPA_BERRY
	.hword ITEM_TANGA_BERRY
	.hword ITEM_CHARTI_BERRY
	.hword ITEM_KASIB_BERRY
	.hword ITEM_HABAN_BERRY
	.hword ITEM_COLBUR_BERRY
	.hword ITEM_BABIRI_BERRY
	.hword ITEM_CHILAN_BERRY
	.hword ITEM_MICLE_BERRY
	.hword ITEM_CUSTAP_BERRY
	.hword ITEM_JABOCA_BERRY
	.hword ITEM_ROWAP_BERRY
	.hword ITEM_ROSELI_BERRY
	.hword ITEM_KEE_BERRY
	.hword ITEM_MARANGA_BERRY
	.hword ITEM_RUSTED_SWORD
	.hword ITEM_RUSTED_SHIELD
	.hword ITEM_ADAMANT_ORB
	.hword ITEM_LUSTROUS_ORB
	.hword ITEM_GRISEOUS_ORB
	.hword ITEM_FIST_PLATE
	.hword ITEM_SKY_PLATE
	.hword ITEM_TOXIC_PLATE
	.hword ITEM_EARTH_PLATE
	.hword ITEM_STONE_PLATE
	.hword ITEM_INSECT_PLATE
	.hword ITEM_SPOOKY_PLATE
	.hword ITEM_IRON_PLATE
	.hword ITEM_FLAME_PLATE
	.hword ITEM_SPLASH_PLATE
	.hword ITEM_MEADOW_PLATE
	.hword ITEM_ZAP_PLATE
	.hword ITEM_MIND_PLATE
	.hword ITEM_ICICLE_PLATE
	.hword ITEM_DRACO_PLATE
	.hword ITEM_DREAD_PLATE
	.hword ITEM_PIXIE_PLATE
	.hword ITEM_FIGHTING_MEMORY
	.hword ITEM_FLYING_MEMORY
	.hword ITEM_POISON_MEMORY
	.hword ITEM_GROUND_MEMORY
	.hword ITEM_ROCK_MEMORY
	.hword ITEM_BUG_MEMORY
	.hword ITEM_GHOST_MEMORY
	.hword ITEM_STEEL_MEMORY
	.hword ITEM_FIRE_MEMORY
	.hword ITEM_WATER_MEMORY
	.hword ITEM_GRASS_MEMORY
	.hword ITEM_ELECTRIC_MEMORY
	.hword ITEM_PSYCHIC_MEMORY
	.hword ITEM_ICE_MEMORY
	.hword ITEM_DRAGON_MEMORY
	.hword ITEM_DARK_MEMORY
	.hword ITEM_FAIRY_MEMORY
	.hword ITEM_BURN_DRIVE
	.hword ITEM_DOUSE_DRIVE
	.hword ITEM_SHOCK_DRIVE
	.hword ITEM_CHILL_DRIVE
	.hword ITEM_NORMALIUM_Z
	.hword ITEM_FIGHTINIUM_Z
	.hword ITEM_FLYINIUM_Z
	.hword ITEM_POISONIUM_Z
	.hword ITEM_GROUNDIUM_Z
	.hword ITEM_ROCKIUM_Z
	.hword ITEM_BUGINIUM_Z
	.hword ITEM_GHOSTIUM_Z
	.hword ITEM_STEELIUM_Z
	.hword ITEM_FIRIUM_Z
	.hword ITEM_WATERIUM_Z
	.hword ITEM_GRASSIUM_Z
	.hword ITEM_ELECTRIUM_Z
	.hword ITEM_PSYCHIUM_Z
	.hword ITEM_ICIUM_Z
	.hword ITEM_DRAGONIUM_Z
	.hword ITEM_DARKINIUM_Z
	.hword ITEM_FAIRIUM_Z
	.hword ITEM_ALORAICHIUM_Z
	.hword ITEM_DECIDIUM_Z
	.hword ITEM_EEVIUM_Z
	.hword ITEM_INCINIUM_Z
	.hword ITEM_KOMMONIUM_Z
	.hword ITEM_LUNALIUM_Z
	.hword ITEM_LYCANIUM_Z
	.hword ITEM_MARSHADIUM_Z
	.hword ITEM_MEWNIUM_Z
	.hword ITEM_MIMIKIUM_Z
	.hword ITEM_PIKANIUM_Z
	.hword ITEM_PIKASHUNIUM_Z
	.hword ITEM_PRIMARIUM_Z
	.hword ITEM_SNORLIUM_Z
	.hword ITEM_SOLGANIUM_Z
	.hword ITEM_TAPUNIUM_Z
	.hword ITEM_LUCK_INCENSE
	.hword ITEM_FULL_INCENSE
	.hword ITEM_ODD_INCENSE
	.hword ITEM_ROCK_INCENSE
	.hword ITEM_ROSE_INCENSE
	.hword ITEM_WAVE_INCENSE
	.hword ITEM_NORMAL_GEM
	.hword ITEM_FIGHTING_GEM
	.hword ITEM_FLYING_GEM
	.hword ITEM_POISON_GEM
	.hword ITEM_GROUND_GEM
	.hword ITEM_ROCK_GEM
	.hword ITEM_BUG_GEM
	.hword ITEM_GHOST_GEM
	.hword ITEM_STEEL_GEM
	.hword ITEM_FIRE_GEM
	.hword ITEM_WATER_GEM
	.hword ITEM_GRASS_GEM
	.hword ITEM_ELECTRIC_GEM
	.hword ITEM_PSYCHIC_GEM
	.hword ITEM_ICE_GEM
	.hword ITEM_DRAGON_GEM
	.hword ITEM_DARK_GEM
	.hword ITEM_FAIRY_GEM
	.hword ITEM_WIDE_LENS
	.hword ITEM_MUSCLE_BAND
	.hword ITEM_WISE_GLASSES
	.hword ITEM_EXPERT_BELT
	.hword ITEM_LIGHT_CLAY
	.hword ITEM_LIFE_ORB
	.hword ITEM_POWER_HERB
	.hword ITEM_TOXIC_ORB
	.hword ITEM_FLAME_ORB
	.hword ITEM_QUICK_POWDER
	.hword ITEM_FOCUS_SASH
	.hword ITEM_ZOOM_LENS
	.hword ITEM_METRONOME
	.hword ITEM_IRON_BALL
	.hword ITEM_LAGGING_TAIL
	.hword ITEM_DESTINY_KNOT
	.hword ITEM_BLACK_SLUDGE
	.hword ITEM_ICY_ROCK
	.hword ITEM_SMOOTH_ROCK
	.hword ITEM_HEAT_ROCK
	.hword ITEM_DAMP_ROCK
	.hword ITEM_GRIP_CLAW
	.hword ITEM_CHOICE_SCARF
	.hword ITEM_CHOICE_SPECS
	.hword ITEM_STICKY_BARB
	.hword ITEM_SHED_SHELL
	.hword ITEM_BIG_ROOT
	.hword ITEM_EVIOLITE
	.hword ITEM_FLOAT_STONE
	.hword ITEM_ROCKY_HELMET
	.hword ITEM_AIR_BALLOON
	.hword ITEM_RED_CARD
	.hword ITEM_RING_TARGET
	.hword ITEM_BINDING_BAND
	.hword ITEM_ABSORB_BULB
	.hword ITEM_CELL_BATTERY
	.hword ITEM_EJECT_BUTTON
	.hword ITEM_WEAKNESS_POLICY
	.hword ITEM_ASSAULT_VEST
	.hword ITEM_LUMINOUS_MOSS
	.hword ITEM_SNOWBALL
	.hword ITEM_SAFETY_GOGGLES
	.hword ITEM_ADRENALINE_ORB
	.hword ITEM_TERRAIN_EXTENDER
	.hword ITEM_PROTECTIVE_PADS
	.hword ITEM_ELECTRIC_SEED
	.hword ITEM_GRASSY_SEED
	.hword ITEM_MISTY_SEED
	.hword ITEM_PSYCHIC_SEED
	.hword ITEM_EJECT_PACK
	.hword ITEM_ROOM_SERVICE
	.hword ITEM_BLUNDER_POLICY
	.hword ITEM_HEAVY_DUTY_BOOTS
	.hword ITEM_UTILITY_UMBRELLA
	.hword ITEM_THROAT_SPRAY
	.hword ITEM_CLEAR_AMULET
	.hword ITEM_COVERT_CLOAK
	.hword ITEM_LOADED_DICE
	.hword ITEM_PUNCHING_GLOVE
	.hword ITEM_BOOSTER_ENERGY
	.hword ITEM_WELLSPRING_MASK
	.hword ITEM_HEARTHFLAME_MASK
	.hword ITEM_CORNERSTONE_MASK
	.hword ITEM_MIRROR_HERB
	.hword ITEM_AWAKEN_CHARM
	.hword 0x0

@ 全部进化道具（对应 item_tables.c 中 FieldUseFunc_EvoItem 的 48 项 + 携带进化道具）
.align 2
EvolutionItemShopItems:
@ 进化石
	.hword ITEM_FIRE_STONE
	.hword ITEM_WATER_STONE
	.hword ITEM_THUNDER_STONE
	.hword ITEM_LEAF_STONE
	.hword ITEM_MOON_STONE
	.hword ITEM_SUN_STONE
	.hword ITEM_SHINY_STONE
	.hword ITEM_DUSK_STONE
	.hword ITEM_DAWN_STONE
	.hword ITEM_ICE_STONE
@ 通信携带进化
	.hword ITEM_LINK_CABLE
	.hword ITEM_METAL_COAT
	.hword ITEM_KINGS_ROCK
	.hword ITEM_DRAGON_SCALE
	.hword ITEM_UP_GRADE
	.hword ITEM_DUBIOUS_DISC
	.hword ITEM_PROTECTOR
	.hword ITEM_ELECTIRIZER
	.hword ITEM_MAGMARIZER
	.hword ITEM_REAPER_CLOTH
	.hword ITEM_PRISM_SCALE
	.hword ITEM_SACHET
	.hword ITEM_WHIPPED_DREAM
	.hword ITEM_DEEP_SEA_TOOTH
	.hword ITEM_DEEP_SEA_SCALE
	.hword ITEM_OVAL_STONE
	.hword ITEM_RAZOR_CLAW
	.hword ITEM_RAZOR_FANG
@ 剑盾/传说阿尔宙斯/朱紫进化素材
	.hword ITEM_SWEET_APPLE
	.hword ITEM_TART_APPLE
	.hword ITEM_CRACKED_POT
	.hword ITEM_CHIPPED_POT
	.hword ITEM_GALARICA_CUFF
	.hword ITEM_GALARICA_WREATH
	.hword ITEM_STRAWBERRY_SWEET
	.hword ITEM_BERRY_SWEET
	.hword ITEM_LOVE_SWEET
	.hword ITEM_CLOVER_SWEET
	.hword ITEM_FLOWER_SWEET
	.hword ITEM_RIBBON_SWEET
	.hword ITEM_STAR_SWEET
	.hword ITEM_AUSPICIOUS_ARMOR
	.hword ITEM_MALICIOUS_ARMOR
	.hword ITEM_BLACK_AUGURITE
	.hword ITEM_METAL_ALLOY
	.hword ITEM_PEAT_BLOCK
	.hword ITEM_LEADERS_CREST
	.hword ITEM_SYRUPY_APPLE
	.hword ITEM_GIMMIGHOUL_COIN
	.hword ITEM_UNREMARKABLE_TEACUP
	.hword ITEM_MASTERPIECE_TEACUP
	.hword 0x0

@ 养成道具（薄荷/特性胶囊/特性膏药/增强剂）
.align 2
TrainingShopItems:
@ 性格薄荷（全部 21 种）
	.hword ITEM_LONELY_MINT
	.hword ITEM_ADAMANT_MINT
	.hword ITEM_NAUGHTY_MINT
	.hword ITEM_BRAVE_MINT
	.hword ITEM_BOLD_MINT
	.hword ITEM_IMPISH_MINT
	.hword ITEM_LAX_MINT
	.hword ITEM_RELAXED_MINT
	.hword ITEM_MODEST_MINT
	.hword ITEM_MILD_MINT
	.hword ITEM_RASH_MINT
	.hword ITEM_QUIET_MINT
	.hword ITEM_CALM_MINT
	.hword ITEM_GENTLE_MINT
	.hword ITEM_CAREFUL_MINT
	.hword ITEM_SASSY_MINT
	.hword ITEM_TIMID_MINT
	.hword ITEM_HASTY_MINT
	.hword ITEM_JOLLY_MINT
	.hword ITEM_NAIVE_MINT
	.hword ITEM_SERIOUS_MINT
@ 特性养成
	.hword ITEM_ABILITY_CAPSULE
	.hword ITEM_ABILITY_PATCH
@ 增强剂
	.hword ITEM_HP_UP
	.hword ITEM_PROTEIN
	.hword ITEM_IRON
	.hword ITEM_CARBOS
	.hword ITEM_CALCIUM
	.hword ITEM_ZINC
	.hword 0x0

@ 精灵球（不卖大师球/狩猎球等特殊球）
.align 2
BallShopItems:
@ 常规球
	.hword ITEM_POKE_BALL
	.hword ITEM_GREAT_BALL
	.hword ITEM_ULTRA_BALL
	.hword ITEM_PREMIER_BALL
@ 条件加成球
	.hword ITEM_NET_BALL
	.hword ITEM_DIVE_BALL
	.hword ITEM_NEST_BALL
	.hword ITEM_REPEAT_BALL
	.hword ITEM_TIMER_BALL
	.hword ITEM_LUXURY_BALL
	.hword ITEM_DUSK_BALL
	.hword ITEM_HEAL_BALL
	.hword ITEM_QUICK_BALL
@ 宝可梦球种（丰缘/神奥限定球）
	.hword ITEM_FAST_BALL
	.hword ITEM_LEVEL_BALL
	.hword ITEM_LURE_BALL
	.hword ITEM_HEAVY_BALL
	.hword ITEM_LOVE_BALL
	.hword ITEM_FRIEND_BALL
	.hword ITEM_MOON_BALL
	.hword ITEM_BEAST_BALL
	.hword ITEM_DREAM_BALL
	.hword 0x0

SystemScript_LButtonMenu_ToggleAutoRun:
	checkflag FLAG_AUTO_RUN
	if SET _goto SystemScript_LButtonMenu_ToggleAutoRun_Disable
	setflag FLAG_AUTO_RUN
	goto SystemScript_EnableAutoRun
SystemScript_LButtonMenu_ToggleAutoRun_Disable:
	clearflag FLAG_AUTO_RUN
	goto SystemScript_DisableAutoRun

SystemScript_LButtonMenu_ToggleBikeTurbo:
	checkflag FLAG_BIKE_TURBO_BOOST
	if SET _goto SystemScript_LButtonMenu_ToggleBikeTurbo_Disable
	setflag FLAG_BIKE_TURBO_BOOST
	goto SystemScript_EnableBikeTurboBoost
SystemScript_LButtonMenu_ToggleBikeTurbo_Disable:
	clearflag FLAG_BIKE_TURBO_BOOST
	goto SystemScript_DisableBikeTurboBoost

SystemScript_LButtonMenu_ToggleSurfTurbo:
	checkflag FLAG_SURF_TURBO_BOOST
	if SET _goto SystemScript_LButtonMenu_ToggleSurfTurbo_Disable
	setflag FLAG_SURF_TURBO_BOOST
	goto SystemScript_EnableSurfTurboBoost
SystemScript_LButtonMenu_ToggleSurfTurbo_Disable:
	clearflag FLAG_SURF_TURBO_BOOST
	goto SystemScript_DisableSurfTurboBoost

SystemScript_LButtonMenu_HiddenPower:
	countpokemon
	compare LASTRESULT 0x0
	if equal _goto SystemScript_LButtonMenu_Cancelled
	special 0x9F @ Opens Pokemon selection menu
	waitstate

	@ Use vars 0x8002 and 0x8003 instead of 0x8004 and 0x800D
	copyvar 0x8002 0x8004
	copyvar 0x8003 0x800D

	compare 0x8002 0x7
	if TRUE _goto SystemScript_LButtonMenu_Cancelled
	call SystemScript_ChooseHiddenPowerType
	compare LASTRESULT 0x7F @ 属性选择被取消
	if equal _goto SystemScript_LButtonMenu_Cancelled
	goto SystemScript_LButtonMenu_Training

SystemScript_LButtonMenu_Cancelled:
	releaseall
	end

@ 与 EventScript_ChangeHiddenPowerTypeNPC 共用的觉醒力量属性选择例程。
@ 前置条件：0x8002 = 已选好的队伍宝可梦。
@ 返回：LASTRESULT = 0x7F 表示取消了属性选择，否则为 0x1。
.global SystemScript_ChooseHiddenPowerType
SystemScript_ChooseHiddenPowerType:
	special2 0x8003 0x147
	bufferpokemon 0x0 0x8003
	msgbox gText_ChangeHiddenPowerTypeNPCSelected MSG_NORMAL

	@ Reset 0x8004 and 0x800D (Required for Scrolling Multichoice)
	resetvar 0x8004
	resetvar 0x800D

	@ Scrolling Multichoice
	setvar 0x8000 1 @ Multichoice Index
	setvar 0x8001 6 @ Number of options to display at once
	special 0x158   @ Scrolling Multichoice
	waitstate

	@ Based on Hidden Power Type
	switch LASTRESULT
		case 0, SystemScript_ChooseHiddenPowerType_SetNormal
		case 1, SystemScript_ChooseHiddenPowerType_SetFighting
		case 2, SystemScript_ChooseHiddenPowerType_SetFlying
		case 3, SystemScript_ChooseHiddenPowerType_SetPoison
		case 4, SystemScript_ChooseHiddenPowerType_SetGround
		case 5, SystemScript_ChooseHiddenPowerType_SetRock
		case 6, SystemScript_ChooseHiddenPowerType_SetBug
		case 7, SystemScript_ChooseHiddenPowerType_SetGhost
		case 8, SystemScript_ChooseHiddenPowerType_SetSteel
		case 9, SystemScript_ChooseHiddenPowerType_SetFire
		case 10, SystemScript_ChooseHiddenPowerType_SetWater
		case 11, SystemScript_ChooseHiddenPowerType_SetGrass
		case 12, SystemScript_ChooseHiddenPowerType_SetElectric
		case 13, SystemScript_ChooseHiddenPowerType_SetPsychic
		case 14, SystemScript_ChooseHiddenPowerType_SetIce
		case 15, SystemScript_ChooseHiddenPowerType_SetDragon
		case 16, SystemScript_ChooseHiddenPowerType_SetDark
		case 17, SystemScript_ChooseHiddenPowerType_SetFairy

SystemScript_ChooseHiddenPowerType_Cancelled:
	setvar LASTRESULT 0x7F
	return

SystemScript_ChooseHiddenPowerType_SetNormal:
	setvar 0x8001 TYPE_NORMAL
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchNormal MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetFighting:
	setvar 0x8001 TYPE_FIGHTING
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchFighting MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetFlying:
	setvar 0x8001 TYPE_FLYING
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchFlying MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetPoison:
	setvar 0x8001 TYPE_POISON
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchPoison MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetGround:
	setvar 0x8001 TYPE_GROUND
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchGround MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetRock:
	setvar 0x8001 TYPE_ROCK
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchRock MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetBug:
	setvar 0x8001 TYPE_BUG
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchBug MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetGhost:
	setvar 0x8001 TYPE_GHOST
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchGhost MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetSteel:
	setvar 0x8001 TYPE_STEEL
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchSteel MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetFire:
	setvar 0x8001 TYPE_FIRE
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchFire MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetWater:
	setvar 0x8001 TYPE_WATER
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchWater MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetGrass:
	setvar 0x8001 TYPE_GRASS
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchGrass MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetElectric:
	setvar 0x8001 TYPE_ELECTRIC
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchElectric MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetPsychic:
	setvar 0x8001 TYPE_PSYCHIC
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchPsychic MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetIce:
	setvar 0x8001 TYPE_ICE
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchIce MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetDragon:
	setvar 0x8001 TYPE_DRAGON
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchDragon MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetDark:
	setvar 0x8001 TYPE_DARK
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchDark MSG_NORMAL
	setvar LASTRESULT 0x1
	return

SystemScript_ChooseHiddenPowerType_SetFairy:
	setvar 0x8001 TYPE_FAIRY
	callasm ChangeHiddenPowerTypeInOW
	msgbox gText_ChangeHiddenPowerTypeNPCFetchFairy MSG_NORMAL
	setvar LASTRESULT 0x1
	return

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_PartyMenuFromField
SystemScript_PartyMenuFromField:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x5 @SE_SELECT
	fadescreen FADEOUT_BLACK
	callasm InitPartyMenuFromField
	releaseall
    end

.global SystemScript_ItemMenuFromField
SystemScript_ItemMenuFromField:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x5 @SE_SELECT
	fadescreen FADEOUT_BLACK
	callasm InitBagMenuFromField
	releaseall
	end

.global SystemScript_MiningScan
SystemScript_MiningScan:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0xCA @SE_TWINKLE
	getplayerpos 0x8000 0x8001
	setfieldeffectarg 0, 0x8000
	setfieldeffectarg 1, 0x8001
	setfieldeffectarg 2, TRUE
	dofieldeffect 48 @FLDEFF_THIN_RING
	callasm IsBestMiningSpotOutOfView
	compare LASTRESULT 0x0 @Out of view
	if notequal _goto SystemScript_MiningScan_SkipFieldEffect
	setfieldeffectarg 0, 0x8004
	setfieldeffectarg 1, 0x8005
	setfieldeffectarg 2, 0x8006
	dofieldeffect 54 @FLDEFF_SPARKLE
	waitfieldeffect 54 @FLDEFF_SPARKLE
	releaseall
	end

SystemScript_MiningScan_SkipFieldEffect:
	waitfieldeffect 48 @FLDEFF_THIN_RING
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_PoisonSurvial
SystemScript_PoisonSurvial:
	lockall
	msgboxsign
	msgbox gText_PoisonSurvial MSG_KEEPOPEN
	closeonkeypress
	releaseall
	end
	
@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ VAR_REPEL_STEP_COUNT, 0x4020

.global EventScript_BwRepelWoreOff
.global EventScript_RepelWoreOff
EventScript_BwRepelWoreOff:
	lockall
	checkitem 0x800E 1
	compare LASTRESULT 1
	if greaterorequal _goto AnotherRepel
	goto EventScript_RepelWoreOff
	
AnotherRepel:
	bufferitem 0x2 0x800E
	msgboxsign
	msgbox gText_AskUseAnotherRepel MSG_YESNO
	compare LASTRESULT 0x1
	if notequal _goto EndScript
	compare 0x800E ITEM_REPEL
	if equal _goto UseAnotherRepel
	compare 0x800E ITEM_SUPER_REPEL
	if equal _goto UseAnotherSuperRepel
	compare 0x800E ITEM_MAX_REPEL
	if equal _goto UseAnotherMaxRepel
	goto EndScript
	
UseAnotherRepel:
	removeitem ITEM_REPEL 1
	setvar VAR_REPEL_STEP_COUNT 100
	goto FinishNewRepel
	
UseAnotherSuperRepel:
	removeitem ITEM_SUPER_REPEL 1
	setvar VAR_REPEL_STEP_COUNT 200
	goto FinishNewRepel
	
UseAnotherMaxRepel:
	removeitem ITEM_MAX_REPEL 1
	setvar VAR_REPEL_STEP_COUNT 250
	goto FinishNewRepel
	
FinishNewRepel:
	checksound
	sound 0x29 @;Repel spray sound
	msgboxsign
	msgbox gText_UsedAnotherRepel MSG_SIGN
	goto EndScript
	
EventScript_RepelWoreOff:
	lockall
	msgboxsign
	msgbox gText_RepelWoreOff MSG_KEEPOPEN
	closeonkeypress
	
EndScript:
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_StartDexNavBattle
SystemScript_StartDexNavBattle:
	lockall
	call FollowerPositionFixScript
	special SPECIAL_STOP_SOUNDS
	sound 0x15 @;Exclaim
	applymovement PLAYER m_PlayerExclaim
	waitmovement 0x0
	checksound
	pause 0x10
	dowildbattle
	releaseall
	end

.global SystemScript_DisplayDexnavMsg
SystemScript_DisplayDexnavMsg:
	lockall
	callstd MSG_NORMAL
	releaseall
	end

.global SystemScript_DexNavDetector
SystemScript_DexNavDetector:
	lockall
	special SPECIAL_STOP_SOUNDS
	sound 0x69 @;SE_POKENAV_SEARCHING
	applymovement PLAYER m_PlayerConfused
	waitmovement 0x0
	msgbox gText_DexNavDetectedRarePokemon MSG_KEEPOPEN
	closeonkeypress
	releaseall
	end

m_PlayerExclaim: .byte exclaim, end_m
m_PlayerConfused: .byte say_question, end_m

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_WaitForFollower
SystemScript_WaitForFollower:
	lock
	pause 0x10
	release
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ SPECIAL_SHOW_ITEM_SPRITE_ON_FIND_OBTAIN, 0xE4
.equ SPECIAL_CLEAR_ITEM_SPRITE_AFTER_FIND_OBTAIN, 0xE5
.equ Systemcript_BufferPocketNameTryFanfare, 0x81A66BC
.equ SystemScript_NoRoomToPickUpItem, 0x81A682D

SystemScript_FindItem: @Originally at 0x81A67B3
	lock
	pause 0x10 @;Give time for the click sound to play when talking to a Poke Ball
	special SPECIAL_STOP_SOUNDS @;In case the bike jingle is playing at the same time
	copyvar 0x8004, 0x8000
	copyvar 0x8005, 0x8001
	checkitemspace 0x8000, 0x8001
	copyvar 0x8007, LASTRESULT
	bufferitem 1, 0x8000
	checkitemtype 0x8000
	call Systemcript_BufferPocketNameTryFanfare
	compare 0x8007, TRUE
	if equal _call SystemScript_PickUpItem
	compare 0x8007, FALSE
	if equal _call SystemScript_NoRoomToPickUpItem
	release
	return

SystemScript_PickUpItem:
	textcolor BLACK
	hidesprite LASTTALKED
	pause 0x1
	special SPECIAL_SHOW_ITEM_SPRITE_ON_FIND_OBTAIN
	additem 0x8004 0x8005
	special2 LASTRESULT 0x196
	copyvar 0x8008 LASTRESULT
	compare 0x8008 0x1
	if equal _call 0x81A6821
	compare 0x8008 0x0
	if equal _call SystemScript_FindNormalItem
	waitfanfare
	waitmsg
	msgbox 0x81A5218 MSG_KEEPOPEN 
	special SPECIAL_CLEAR_ITEM_SPRITE_AFTER_FIND_OBTAIN
	return

SystemScript_FindNormalItem:
	compare 0x8005 0x1
	if greaterthan _goto SystemScript_FindMultipleNormalItems
	preparemsg 0x81A5231
	return

SystemScript_FindMultipleNormalItems:
	buffernumber 0x0 0x8005
	callasm TryAppendSOntoEndOfItemString
	preparemsg gText_FoundMultipleItems
	return

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

SystemScript_ObtainItem:
	copyvar 0x8013 0x8012
	copyvar 0x8004 0x8000 @;Copy item to 0x8004
	copyvar 0x8005 0x8001 @;Copy amount to 0x8005
	textcolor BLACK
	additem 0x8000 0x8001
	copyvar 0x8007 LASTRESULT
	call 0x81A6697
	copyvar 0x8012 0x8013
	return

.global SystemScript_ObtainItemMessage
SystemScript_ObtainItemMessage:
	special SPECIAL_SHOW_ITEM_SPRITE_ON_FIND_OBTAIN
	compare 0x8005 1
	if lessorequal _call ObtainedSingleItemMsg
	compare 0x8005 1
	if greaterthan _call ObtainedMultipleItemMsg
	waitfanfare
	waitmsg
	msgbox 0x81A5218 MSG_KEEPOPEN @;[PLAYER] put the item in the...
	setvar LASTRESULT 0x1
	special SPECIAL_CLEAR_ITEM_SPRITE_AFTER_FIND_OBTAIN
	return

ObtainedSingleItemMsg:
	special2 LASTRESULT 0x196
	compare LASTRESULT 0x0
	if equal _call ObtainedRegularItem
	compare LASTRESULT 0x1
	if equal _call ObtainedTMHM
	return

ObtainedTMHM:
	preparemsg gText_ObtainedTMHM
	return

ObtainedRegularItem:
	preparemsg 0x81A51F6 @;Obtained the item!
	return
	
ObtainedMultipleItemMsg:
	buffernumber 0x0 0x8005
	callasm TryAppendSOntoEndOfItemString
	preparemsg gText_ObtainedMultipleItems
	return

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ GAME_STAT_FOUND_HIDDEN_ITEM, 20

@Var8005 = Item
@Var8006 = Quantity
SystemScript_PickedUpHiddenItem: @;Replaces 81A6885
	callasm ShowItemSpriteOnFindHidden
	compare 0x8006 1
	if equal _call 0x81A68AA @;EventScript_FoundSingleHiddenItem
	compare 0x8006 1
	if notequal _call 0x81A68BA @;EventScript_FoundMultipleHiddenItems
	waitfanfare
	waitmsg
	msgbox 0x81A5218 MSG_KEEPOPEN @;gText_PutItemAway
	callasm ClearItemSpriteAfterFindHidden
	special 0x96 @;SetHiddenItemFlag
	incrementgamestat GAME_STAT_FOUND_HIDDEN_ITEM
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.macro showselectitems num
EventScript_ShowSelectItems\num:
	multichoice 0x0 0x0 TWO_MULTICHOICE_OPTIONS + \num - 2 0x0
	releaseall
	end
.endm

.global EventScript_ShowSelectItems
EventScript_ShowSelectItems:
	lockall
	preparemsg gText_UseWhichRegisteredItem
	waitmsg
	callasm UseChosenRegisteredItem @;Fires when script ends
	switch 0x8004
	case 2, EventScript_ShowSelectItems2
	case 3, EventScript_ShowSelectItems3
	case 4, EventScript_ShowSelectItems4
	case 5, EventScript_ShowSelectItems5
	case 6, EventScript_ShowSelectItems6
	releaseall
	end

showselectitems 2
showselectitems 3
showselectitems 4
showselectitems 5
showselectitems 6

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ FLAG_AUTO_HMS, 0x902 @For Unbound
.equ FLDEFF_USE_ROCK_CLIMB, 55

.global EventScript_UseRockClimb
EventScript_UseRockClimb:
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_ROCKCLIMB
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseRockClimb_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseRockClimb_SkipAsk

EventScript_UseRockClimb_Ask:
	msgbox gText_WantToScaleCliff MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_RockClimbEnd
	msgbox 0x81BDFD7 MSG_NORMAL @;[BUFFER1] used [BUFFER2]!

EventScript_UseRockClimb_SkipAsk:
	setfieldeffectarg 0, 0x8004
	goto EventScript_RockClimb

.global EventScript_JustRockWall
EventScript_JustRockWall:
	msgbox gText_RockIsRocky MSG_NORMAL
EventScript_RockClimbEnd:
	closeonkeypress
	end

.equ SPECIAL_GET_PLAYER_FACING, 0x1AA
.global EventScript_RockClimb
EventScript_RockClimb:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	dofieldeffect FLDEFF_USE_ROCK_CLIMB
	waitfieldeffect FLDEFF_USE_ROCK_CLIMB
	callasm FollowMe_WarpSetEnd
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseADMRockClimb
EventScript_UseADMRockClimb:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_RockClimb
	msgbox gText_WantToScaleCliffWithADM MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_RockClimbEnd
	closeonkeypress
	goto EventScript_RockClimb

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseSandboxRockClimb
EventScript_UseSandboxRockClimb:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_RockClimb
	msgbox gText_WantToScaleCliffSandbox MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_RockClimbEnd
	closeonkeypress
	goto EventScript_RockClimb

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_Defog
EventScript_Defog:
	lockall
	doanimation 0x28
	waitstate
	checksound
	sound 0x7E
	setweather 0x0
	doweather
	checksound
	msgbox gText_DefogBlewAwayFog MSG_KEEPOPEN
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ SPECIAL_POKEMON_TYPE_IN_PARTY, 0xB2
.equ SPECIAL_SPECIES_IN_PARTY, 0x17C

.global EventScript_UseLavaSurf
.global EventScript_UseLavaSurf_Debug
EventScript_UseLavaSurf:
	@;Check Groudon - special case
	setvar 0x8004 SPECIES_GROUDON
	callasm GetGroudonPartyIndexIn8004
	compare 0x8004 PARTY_SIZE
	if lessthan _goto EventScript_UseLavaSurf_Offer

	@;Check Fire-type
	setvar 0x8000 TYPE_FIRE
	special SPECIAL_POKEMON_TYPE_IN_PARTY
	compare LASTRESULT PARTY_SIZE
	if equal _goto EventScript_MagmaGlistens
	copyvar 0x8004 LASTRESULT
EventScript_UseLavaSurf_Debug:
EventScript_UseLavaSurf_Offer:
	bufferpartypokemon 0x0 0x8004
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseLavaSurf_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseLavaSurf_SkipAsk

EventScript_UseLavaSurf_Ask:
	msgbox gText_LikeToLavaSurf MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_LavaSurfEnd
	lockall
	msgbox gText_LavaSurfedWith MSG_KEEPOPEN

EventScript_UseLavaSurf_SkipAsk:
	lockall
	setanimation 0x0 0x8004
	doanimation 0x9
	releaseall
	end

.global EventScript_MagmaGlistens
EventScript_MagmaGlistens:
	msgbox gText_LavaDyed MSG_NORMAL
EventScript_LavaSurfEnd:
	closeonkeypress
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseWaterfall
EventScript_UseWaterfall:
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_WATERFALL
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseWaterfall_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseWaterfall_SkipAsk

EventScript_UseWaterfall_Ask:
	msgbox 0x81BE33F MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_WaterfallEnd
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	msgbox 0x81BDFD7 MSG_KEEPOPEN

EventScript_UseWaterfall_SkipMsg:
	setanimation 0x0 0x8004
	doanimation 0x2B
	callasm FollowMe_WarpSetEnd
EventScript_WaterfallEnd:
	releaseall
	end

EventScript_UseWaterfall_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	goto EventScript_UseWaterfall_SkipMsg

.global EventScript_WallOfWater
EventScript_WallOfWater:
	msgbox 0x81BE30A MSG_NORMAL
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseADMWaterfall
EventScript_UseADMWaterfall:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMWaterfall_SkipAsk
	msgbox gText_OfferADMWaterfall MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_WaterfallEnd
EventScript_UseADMWaterfall_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	callasm DoWaterfallWithNoShowMon
	callasm FollowMe_WarpSetEnd
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseSandboxWaterfall
EventScript_UseSandboxWaterfall:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMWaterfall_SkipAsk
	msgbox gText_OfferSandboxWaterfall MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_WaterfallEnd
	goto EventScript_UseADMWaterfall_SkipAsk

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseSurf
EventScript_UseSurf:
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_SURF
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseSurf_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseSurf_SkipAsk

EventScript_UseSurf_Ask:
	callasm IsPlayerFacingMurkyBrownWaterToVar
	compare LASTRESULT 0x0
	if notequal _goto EventScript_UseSurf_AskMurkyWater
	msgbox 0x81A556E MSG_YESNO	
EventScript_UseSurf_CheckAnswer:
	compare LASTRESULT NO
	if equal _goto EventScript_SurfEnd
	lockall
	msgbox 0x81BDFD7 MSG_KEEPOPEN
	checkflag 0x4BD
	if equal _goto EventScript_FollowerMonWasOn

EventScript_FollowerMonWasOn:
	setflag 0xA07
	callasm CreateSparkleSprite
	hidefollowermon

EventScript_UseSurf_SkipAsk:
	lockall
	setanimation 0x0 0x8004
	doanimation 0x9
EventScript_SurfEnd:
	releaseall
	end

EventScript_UseSurf_AskMurkyWater:
	msgbox gText_WaterMurkyBrownUseSurf MSG_YESNO	
	goto EventScript_UseSurf_CheckAnswer

.global EventScript_WaterDyedBlue
EventScript_WaterDyedBlue:
	msgbox gText_WaterDyed MSG_NORMAL
	end

.global EventScript_WaterMurkyBrown
EventScript_WaterMurkyBrown:
	msgbox gText_WaterMurkyBrown MSG_NORMAL
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseADMSurf
EventScript_UseADMSurf:
	callasm GetFirstNonEggIn8004
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMSurf_SkipAsk
	callasm IsPlayerFacingMurkyBrownWaterToVar
	compare LASTRESULT 0x0
	if notequal _goto EventScript_UseADMSurf_AskMurkyWater
	msgbox gText_OfferSurfWithADM MSG_YESNO	
EventScript_UseADMSurf_CheckAnswer:
	compare LASTRESULT NO
	if equal _goto EventScript_SurfEnd
	lockall
	bufferpartypokemon 0x0 0x8004
	msgbox gText_ADMBlewUpInflatablePokemon MSG_KEEPOPEN

EventScript_UseADMSurf_SkipAsk:
	lockall
	setanimation 0x0 0x8004
	doanimation 0x9
	releaseall
	end

EventScript_UseADMSurf_AskMurkyWater:
	msgbox gText_WaterMurkyBrownUseADMSurf MSG_YESNO	
	goto EventScript_UseADMSurf_CheckAnswer

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseSandboxSurf
EventScript_UseSandboxSurf:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMSurf_SkipAsk
	callasm IsPlayerFacingMurkyBrownWaterToVar
	compare LASTRESULT 0x0
	if notequal _goto EventScript_UseSandboxSurf_AskMurkyWater
	msgbox 0x81A556E MSG_YESNO	
EventScript_UseSandboxSurf_CheckAnswer:
	compare LASTRESULT NO
	if equal _goto EventScript_SurfEnd
	lockall
	callasm GetFirstNonEggIn8004
	bufferpartypokemon 0x0 0x8004
	msgbox gText_SandboxSurfStarted MSG_KEEPOPEN
	goto EventScript_UseADMSurf_SkipAsk

EventScript_UseSandboxSurf_AskMurkyWater:
	msgbox gText_WaterMurkyBrownUseSurf MSG_YESNO	
	goto EventScript_UseSandboxSurf_CheckAnswer

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ FLDEFF_USE_DIVE, 44
.global EventScript_UseDive
EventScript_UseDive:
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_DIVE
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseDive_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseDive_SkipAsk

EventScript_UseDive_Ask:
	msgbox gText_WantToDive MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_EndDive
EventScript_UseDive_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	msgbox 0x81BDFD7 MSG_NORMAL
	setanimation 0x0 0x8004
	setanimation 0x1 1
	doanimation FLDEFF_USE_DIVE
	waitanimation FLDEFF_USE_DIVE
	waitstate
	goto EventScript_EndDive

.global EventScript_CantDive
EventScript_CantDive:
	msgbox gText_CantDive MSG_NORMAL
EventScript_EndDive:
	releaseall
	end

.global EventScript_UseDiveUnderwater
EventScript_UseDiveUnderwater:
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_DIVE
	callasm IsUnboundToVar
	compare LASTRESULT 0x0
	if equal _goto EventScript_UseDiveUnderwater_Ask
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseDiveUnderwater_SkipAsk

EventScript_UseDiveUnderwater_Ask:
	msgbox gText_WantToSurface MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_EndSurface
EventScript_UseDiveUnderwater_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	msgbox 0x81BDFD7 MSG_NORMAL
	setanimation 0x0 0x8004
	setanimation 0x1 1
	doanimation FLDEFF_USE_DIVE
	waitanimation FLDEFF_USE_DIVE
	callasm FollowMe_SetIndicatorToRecreateSurfBlob
	waitstate
	goto EventScript_EndSurface

.global EventScript_CantSurface
EventScript_CantSurface:
	msgbox gText_CantSurface MSG_NORMAL
EventScript_EndSurface:
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UseADMDive
EventScript_UseADMDive:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMDive_SkipAsk

EventScript_UseADMDive_Ask:
	msgbox gText_WantToADMDive MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_EndDive
EventScript_UseADMDive_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	msgbox gText_UsedADMDive MSG_KEEPOPEN
	closeonkeypress
	callasm DoDiveWarpSkipShowMon
	waitstate
	goto EventScript_EndDive

.global EventScript_UseADMDiveUnderwater
EventScript_UseADMDiveUnderwater:
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_UseADMDiveUnderwater_SkipAsk

EventScript_UseADMDiveUnderwater_Ask:
	msgbox gText_WantToADMSurface MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_EndSurface
EventScript_UseADMDiveUnderwater_SkipAsk:
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	msgbox gText_UsedADMDiveResurface MSG_KEEPOPEN
	closeonkeypress
	callasm DoDiveWarpSkipShowMon
	callasm FollowMe_SetIndicatorToRecreateSurfBlob
	waitstate
	goto EventScript_EndSurface

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ FLAG_SYS_USE_FLASH, 0x806
.global EventScript_UseFlash
EventScript_UseFlash:
	lockall
	bufferpartypokemon 0x0 0x8004
	bufferattack 0x1 MOVE_FLASH
	setflag FLAG_SYS_USE_FLASH
	msgbox 0x81BDFD7 MSG_NORMAL
	checksound
	sound 0xC8
	animateflash 0x0
	setflashlevel 0x0
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ SPECIAL_BUFFER_SWARM_TEXT, 0x58

.global EventScript_TVSwarm
EventScript_TVSwarm:
	special SPECIAL_BUFFER_SWARM_TEXT
	msgbox gText_TVSwarm MSG_SIGN
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_LockedDoor
EventScript_LockedDoor:
	msgbox gText_DoorIsLocked MSG_SIGN
	end

.global EventScript_PsychicBarrier
EventScript_PsychicBarrier:
	msgbox gText_PsychicBarrier MSG_SIGN
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ SPECIAL_DISMOUNT_BICYCLE, 0xAF

.global EventScript_Ladder
EventScript_Ladder:
	special SPECIAL_GET_PLAYER_FACING
	compare PLAYERFACING LEFT
	if equal _goto EventScript_FacingLadderSideways
	compare PLAYERFACING RIGHT
	if equal _goto EventScript_FacingLadderSideways
	lockall
	call FollowerIntoPlayerScript
	callasm HideFollower
	special SPECIAL_DISMOUNT_BICYCLE
	compare PLAYERFACING DOWN
	if equal _goto EventScript_LadderDown

EventScript_LadderUp:
	applymovement PLAYER m_LadderClimbUp
	waitmovement 0x0
	setvar PLAYERFACING UP
	callasm ShouldLadderClimbContinue
	compare LASTRESULT 0
	if equal _goto EventScript_LadderUpFinish
	goto EventScript_LadderUp

EventScript_LadderDown:
	applymovement PLAYER m_LadderClimbDown
	waitmovement 0x0
	setvar PLAYERFACING DOWN
	callasm ShouldLadderClimbContinue
	compare LASTRESULT 0
	if equal _goto EventScript_LadderDownFinish
	goto EventScript_LadderDown

EventScript_LadderUpFinish:
	applymovement PLAYER m_LadderClimbUp
	goto EventScript_LadderFinish

EventScript_LadderDownFinish:
	applymovement PLAYER m_LadderClimbDown
	goto EventScript_LadderFinish

EventScript_FacingLadderSideways:
	msgbox gText_CantReachLadder MSG_NORMAL
EventScript_LadderEnd:
	releaseall
	end

EventScript_LadderFinish:
	waitmovement PLAYER
	callasm FollowMe_WarpSetEnd
	releaseall
	end

m_LadderClimbUp: .byte walk_up_slow, end_m
m_LadderClimbDown: .byte 0xAF, end_m

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_HiddenGrottoForest
EventScript_HiddenGrottoForest:
	msgboxsign
	msgbox gText_FollowNarrowPath MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_HiddenGrottoForest_Reject
	release
	callasm FollowHiddenGrottoWarp
	compare LASTRESULT 0x0
	if equal _goto EventScript_HiddenGrottoForest_Nowhere
	waitstate

EventScript_HiddenGrottoForest_Reject:
	msgboxnormal
	release
	end
	
EventScript_HiddenGrottoForest_Nowhere:
	msgbox gText_FollowNarrowPathNowhere MSG_NORMAL
	msgboxnormal
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.equ SE_HEADBUTT, 0x74
.equ GAME_STAT_HEADBUTT_WILD_ENCOUNTERS, 37

.global EventScript_HeadbuttTree
EventScript_HeadbuttTree:
	checkattack MOVE_HEADBUTT
	compare LASTRESULT PARTY_SIZE
	if equal _goto EventScript_HeadbuttTree_NoUsableMons
	setanimation 0x0 LASTRESULT
	bufferpartypokemon 0x0 LASTRESULT
	bufferattack 0x1 MOVE_HEADBUTT
	checkflag FLAG_AUTO_HMS
	if SET _goto EventScript_HeadbuttTree_SkipAsk
	msgbox gText_WantToUseHeadbutt MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_HeadbuttTree_End

EventScript_HeadbuttTree_SkipAsk:
	lockall
	msgbox 0x81BDFD7 MSG_NORMAL
	doanimation 0x28
	waitstate
	special SPECIAL_STOP_SOUNDS
	sound SE_HEADBUTT
	setvar 0x8004 0x5 @This controls how far the screen shakes vertically
	setvar 0x8005 0x0 @This controls how far the screen shakes horizontally
	setvar 0x8006 0x8 @This controls how long the overall animation lasts
	setvar 0x8007 0x3 @This controls how long one screen shake lasts
	special 0x136 @SPECIAL_SHAKE_SCREEN
	waitstate
	callasm HeadbuttWildEncounter
	compare LASTRESULT 0x0 @No data for this area
	if equal _goto EventScript_HeadbuttTree_End
	incrementgamestat GAME_STAT_HEADBUTT_WILD_ENCOUNTERS
	waitstate

EventScript_HeadbuttTree_End:
	releaseall
	end

EventScript_HeadbuttTree_NoUsableMons:
	msgbox gText_TreeCanBeHeadbutted MSG_NORMAL
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global EventScript_UndergroundMining
EventScript_UndergroundMining:
	msgbox gText_StartMining MSG_YESNO
	compare LASTRESULT NO
	if equal _goto EventScript_UndergroundMining_End
	callasm ResetMiningSpots
	startmining @Right now is not implemented
	waitstate
	callasm PrepMiningWarp @Try to go through door if there is one
	switch LASTRESULT
	case 0, EventScript_UndergroundMining_End
	case 0xFF, EventScript_UnderwaterMining_Door
	case 0xFE, EventScript_UnderwaterMining_Door2

	@Update door tiles
	sound 0x7C @Rock Smash
	getplayerpos 0x8004 0x8005
	subvar 0x8004 1 @1 Left
	subvar 0x8005 2 @2 Up
	setmaptile 0x8004 0x8005 0x2D0 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2D1 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2D2 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2D8 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2D9 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2DA 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2E0 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2E1 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2E2 0x0
EventScript_UndergroundMining_ReloadDoorTiles:
	special 0x8E @Reload tiles
	checksound
	applymovement PLAYER m_WalkUp1
	waitmovement 0x0
	callasm DoWarp
	waitstate

EventScript_UndergroundMining_End:
	releaseall
	end

EventScript_UnderwaterMining_Door:
	@Update door tiles
	sound 0x7C @Rock Smash
	getplayerpos 0x8004 0x8005
	subvar 0x8004 1 @1 Left
	subvar 0x8005 2 @2 Up
	setmaptile 0x8004 0x8005 0x2B8 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2B9 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2BA 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2C0 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2C1 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2C2 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2C8 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2C9 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2CA 0x0
	goto EventScript_UndergroundMining_ReloadDoorTiles

EventScript_UnderwaterMining_Door2:
	@Update door tiles
	sound 0x7C @Rock Smash
	getplayerpos 0x8004 0x8005
	subvar 0x8004 1 @1 Left
	subvar 0x8005 2 @2 Up
	setmaptile 0x8004 0x8005 0x2B8 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2B9 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2BA 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2C0 0x1
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2C1 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2C2 0x1
	subvar 0x8004 2 @2 Left
	addvar 0x8005 1 @1 Down
	setmaptile 0x8004 0x8005 0x2D4 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2D5 0x0
	addvar 0x8004 1 @1 Right
	setmaptile 0x8004 0x8005 0x2D6 0x0
	goto EventScript_UndergroundMining_ReloadDoorTiles

m_WalkUp1: .byte walk_up, end_m

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_StopZooming
SystemScript_StopZooming:
	lockall
	msgbox gText_StopZooming MSG_KEEPOPEN
	pause 0x80
	releaseall
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_DebugMenu
SystemScript_DebugMenu:
	lockall
	multichoiceoption gText_DebugMenu_SetFlag 0
	multichoiceoption gText_DebugMenu_GiveItem 1
	multichoiceoption gText_DebugMenu_Give 2
	multichoiceoption gText_DebugMenu_Party 3
	multichoiceoption gText_DebugMenu_MaxCoinage 4
	multichoiceoption gText_DebugMenu_Debug 5
	multichoice 0x0 0x0 SIX_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_DebugMenu_SetFlag
	case 1, SystemScript_DebugMenu_GiveItem
	case 2, SystemScript_DebugMenu_Custom
	case 3, SystemScript_DebugMenu_Party
	case 4, SystemScript_DebugMenu_MaxCoinage
	case 5, SystemScript_DebugMenu_Debug
SystemScript_DebugMenu_End:
	releaseall
	end

SystemScript_DebugMenu_SetFlag:
	multichoiceoption gText_DebugMenu_AllBadges 0
	multichoiceoption gText_DebugMenu_GameClear 1
	multichoiceoption gText_DebugMenu_Pokedexes 2
	multichoiceoption gText_DebugMenu_FlySpots 3
	multichoiceoption gText_DebugMenu_CustomFlag 4
	multichoice 0x0 0x0 FIVE_MULTICHOICE_OPTIONS 0x0
	compare LASTRESULT 0x5
	if greaterorequal _goto SystemScript_DebugMenu_End
	callasm DebugMenu_ProcessSetFlag
	goto SystemScript_DebugMenu_SetFlag

SystemScript_DebugMenu_GiveItem:
	multichoiceoption gText_DebugMenu_UsefulKeyItems 0
	multichoiceoption gText_DebugMenu_GeneralUsefulItems 1
	multichoiceoption gText_DebugMenu_PokeBalls 2
	multichoiceoption gText_DebugMenu_Berries 3
	multichoiceoption gText_DebugMenu_TMs 4
	multichoiceoption gText_DebugMenu_AllItems 5
	multichoice 0x0 0x0 SIX_MULTICHOICE_OPTIONS 0x0
	compare LASTRESULT 0x6
	if greaterorequal _goto SystemScript_DebugMenu_End
	callasm DebugMenu_ProcessGiveItem
	goto SystemScript_DebugMenu_GiveItem

SystemScript_DebugMenu_Level100Team:
	callasm DebugMenu_SetTeamToLevel100
	goto SystemScript_DebugMenu_Party

SystemScript_DebugMenu_MaxCoinage:
	callasm DebugMenu_MaxMoneyAndCoins
	goto SystemScript_DebugMenu

SystemScript_DebugMenu_ShinyTeam:
	callasm DebugMenu_ShinyTeam
	goto SystemScript_DebugMenu_Party

SystemScript_DebugMenu_Party:
	multichoiceoption gText_DebugMenu_HealTeam 0
	multichoiceoption gText_DebugMenu_Level100Team 1
	multichoiceoption gText_DebugMenu_ShinyTeam 2
	multichoice 0x0 0x0 THREE_MULTICHOICE_OPTIONS 0x0
	switch LASTRESULT
	case 0, SystemScript_DebugMenu_HealTeam
	case 1, SystemScript_DebugMenu_Level100Team
	case 2, SystemScript_DebugMenu_ShinyTeam
	goto SystemScript_DebugMenu

SystemScript_DebugMenu_HealTeam:
	callasm DebugMenu_HealTeam
	goto SystemScript_DebugMenu_Party

.global SystemScript_DebugMenu_GiveCustom
SystemScript_DebugMenu_Custom:
	lockall
	multichoiceoption gText_DebugMenu_GivePokemonById 0
	multichoiceoption gText_DebugMenu_GiveItemById 1
	multichoiceoption gText_DebugMenu_CustomSetFlag 2
	multichoiceoption gText_DebugMenu_SetVar 3
	multichoiceoption gText_DebugMenu_Trainerbattle 4
	multichoice 0, 0, FIVE_MULTICHOICE_OPTIONS, 0
	switch LASTRESULT
		case 0, SystemScript_DebugMenu_GivePokemonPrompt
		case 1, SystemScript_DebugMenu_GiveItemPrompt
		case 2, SystemScript_DebugMenu_CustomSetFlag
		case 3, SystemScript_DebugMenu_SetVar
		case 4, SystemScript_DebugMenu_Trainerbattle
	releaseall
	end

.global SystemScript_DebugMenu_Debug
SystemScript_DebugMenu_Debug:
	lockall
	multichoiceoption gText_DebugMenu_Dex 0
	multichoiceoption gText_DebugMenu_StartWildBattle 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 0
	switch LASTRESULT
		case 0, SystemScript_DebugMenu_DebugPokedex
		case 1, SystemScript_DebugMenu_StartWildBattleNow
	releaseall
	end

SystemScript_DebugMenu_DebugPokedex:
	lock
	callasm DebugMenu_Dex
	setflag 0x829
	special 0x16F
	msgbox gText_DebugMenu_SuccessfulDex MSG_NORMAL
	release
	end

.global SystemScript_DebugMenu_GivePokemonPrompt
SystemScript_DebugMenu_GivePokemonPrompt:
	callasm DebugMenu_StartPokemonSelector
	waitstate
	copyvar 0x8000, LASTRESULT
	compare 0x8000 0x0
	if equal _goto SystemScript_DebugMenu_Custom
	multichoiceoption gText_DebugMenu_ShinyFalse 0
	multichoiceoption gText_DebugMenu_ShinyTrue 1
	multichoice 0, 0, TWO_MULTICHOICE_OPTIONS, 0
	copyvar 0x8001, LASTRESULT
	callasm DebugMenu_GivePokemonFromVar
	bufferpokemon 0x0 0x8000
	compare LASTRESULT 0x1
	if equal _goto SuccessFul
	msgbox gText_Failed MSG_NORMAL
	goto SystemScript_DebugMenu_Custom
SuccessFul:
	lock
	msgbox gText_ReceivedPokemon MSG_NORMAL
	setflag 0x828
	goto SystemScript_DebugMenu_Custom

.global SystemScript_DebugMenu_GiveItemPrompt
SystemScript_DebugMenu_GiveItemPrompt:
	lockall
	callasm DebugMenu_StartItemSelector
	waitstate
	copyvar 0x8000, LASTRESULT
	compare 0x8001 0x0
	if equal _goto SystemScript_DebugMenu_Custom
	bufferitem 0x0 0x8000
	giveitem 0x8000 0x1 MSG_OBTAIN
	goto SystemScript_DebugMenu_Custom

.global SystemScript_DebugMenu_CustomSetFlag
SystemScript_DebugMenu_CustomSetFlag:
	lockall
	callasm DebugMenu_StartFlagSelector
	waitstate
	copyvar 0x8000, LASTRESULT
	compare 0x8001 0x0
	if equal _goto SystemScript_DebugMenu_Custom
	callasm DebugMenu_SetterFlag
	msgbox Text_FlagSet MSG_NORMAL
	goto SystemScript_DebugMenu_Custom

.global SystemScript_DebugMenu_SetVar
SystemScript_DebugMenu_SetVar:
	lockall
	callasm DebugMenu_StartVarSelector
	waitstate
	copyvar 0x5158, LASTRESULT
	compare 0x8001 0x0
	if equal _goto SystemScript_DebugMenu_Custom
	callasm DebugMenu_StartValueSelector
	waitstate
	copyvar 0x5159, LASTRESULT
	compare 0x8001 0x0
	if equal _goto SystemScript_DebugMenu_Custom
	callasm DebugMenu_SetterVar
	msgbox Text_VarSet MSG_NORMAL
	goto SystemScript_DebugMenu_Custom

.global SystemScript_DebugMenu_Trainerbattle
SystemScript_DebugMenu_Trainerbattle:
	lockall
	msgbox gText_TrainerCustomBattle MSG_NORMAL
	special 0xB3
	waitstate
	setvar 0x8000 0xFEFE
	setvar 0x503A 0x2
	setvar 0x503B 0x0
	trainerbattle3 0x3 LASTRESULT 0x100 DebugMenu_LossMessage
	releaseall
	end

SystemScript_DebugMenu_StartWildBattleNow:
	msgbox gText_DebugMenu_EnterSpecies MSG_NORMAL
	special 0xB3
	waitstate
	copyvar 0x8000, LASTRESULT
	setwildbattle 0x8000 0x64 0x0
	dowildbattle
	end

@;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

.global SystemScript_PokemonEncounter
SystemScript_PokemonEncounter:
	lock
	call 0x020370B9
	callasm CheckIfFirstEnemyMonShiny
	compare 0x8000 0x1
	if equal _call PlayShinyJingle
	setvar 0x8000 0x0
	setvar 0x8001 0x0
	setvar 0x8002 0x0
	setvar 0x8003 0x0
	preparemsg EncounterScript_msg
	waitmsg
	setvar 0x8006 0x0
	loadpointer 0x0 EncounterScript_option1
	special 0x25
	setvar 0x8006 0x1
	loadpointer 0x0 EncounterScript_option2
	special 0x25
	multichoice 0x0 0x0 0x20 0x0
	compare 0x800D 0x0
	if equal _goto selectedOption1
	compare 0x800D 0x1
	if equal _goto selectedOption2
	hidepokepic
	release
	end

selectedOption1:
	hidepokepic
	release
	end

selectedOption2:
	hidepokepic
	dowildbattle
	release
	end

PlayShinyJingle:
	waitcry
	pause 0x2
	sound 0x5F
	waitse
	return

.equ FLAG_EXP_SHARE, 0x906
.global SystemScript_Exp_Share_On
SystemScript_Exp_Share_On:
	msgbox gText_Exp_Share_Ask_On MSG_YESNO
	compare LASTRESULT FALSE
	if equal _goto EndScript
	setflag FLAG_EXP_SHARE
	msgboxsign
	msgbox gText_Exp_Share_On MSG_SIGN
	goto EndScript

.global SystemScript_Exp_Share_Off
SystemScript_Exp_Share_Off:
	msgbox gText_Exp_Share_Ask_Off MSG_YESNO
	compare LASTRESULT FALSE
	if equal _goto EndScript
	clearflag FLAG_EXP_SHARE
	msgboxsign
	msgbox gText_Exp_Share_Off MSG_SIGN
	goto EndScript

.global SystemScript_Portable_PC_On
.global SystemScript_Portable_PC_Off

SystemScript_Portable_PC_On:
	lockall
	msgbox gText_PortablePCPrompt MSG_KEEPOPEN

	@ Define multichoice options inline
	multichoiceoption gText_OpenPCBox 0
	multichoiceoption gText_HealPokemon 1
	multichoice 0x0, 0x0, TWO_MULTICHOICE_OPTIONS, 0x0

	switch LASTRESULT
	case 0, OpenPCBox
	case 1, HealParty
	releaseall
	end

OpenPCBox:
	special 0x3C
	waitstate
	playse 0x3
	releaseall
	end

HealParty:
	special 0x0
	playse 0x1
	waitse
	msgbox gText_HealedPCParty MSG_NORMAL
	releaseall
	end

SystemScript_Portable_PC_Off:
	lock
	msgbox gText_PCUnavailable MSG_NORMAL
	release
	end
