.align 2
.thumb

.include "../xse_commands.s"
.include "../xse_defines.s"
.include "../asm_defines.s"

.global EventScript_ChangeTeraTypeNPC
.global EventScript_Pallet_AideGuy

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_ChangeTeraTypeNPC:
    lock
    faceplayer
    msgbox gText_ChangeTeraTypeNPCAsk MSG_YESNO
    compare LASTRESULT FALSE
    if TRUE _goto EventScript_ChangeTeraTypeNPCNo

    msgbox gText_ChangeTeraTypeNPCOpenMenu MSG_NORMAL
    special 0x9F  @ Opens Pokemon selection menu
    waitstate

    @ Use vars 0x8002 and 0x8003 instead of 0x8004 and 0x800D
    copyvar 0x8002 0x8004
    copyvar 0x8003 0x800D

    compare 0x8002 0x7
    if TRUE _goto EventScript_ChangeTeraTypeNPCNo
    goto EventScript_ChangeTeraTypeNPCSelected

EventScript_ChangeTeraTypeNPCNo:
    msgbox gText_ChangeTeraTypeNPCNo MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPCSelected:
    special2 0x8003 0x147
    bufferpokemon 0x0 0x8003
    callasm CanChangeTeraTypeInOW
    compare 0x4001 FALSE
    if TRUE _goto EventScript_ChangeTeraTypeNPCLocked
    msgbox gText_ChangeTeraTypeNPCSelected MSG_NORMAL

    @ Reset 0x8004 and 0x800D (Required for Scrolling Multichoice)
    resetvar 0x8004
    resetvar 0x800D

    @ Scrolling Multichoice
    setvar 0x8000 0 @ Multichoice Index
    setvar 0x8001 6 @ Number of options to display at once
    special 0x158   @ Scrolling Multichoice
    waitstate

    @ Based on Tera Type
    switch LASTRESULT
        case 0, EventScript_ChangeTeraTypeNPC_SetNormal
        case 1, EventScript_ChangeTeraTypeNPC_SetFighting
        case 2, EventScript_ChangeTeraTypeNPC_SetFlying
        case 3, EventScript_ChangeTeraTypeNPC_SetPoison
        case 4, EventScript_ChangeTeraTypeNPC_SetGround
        case 5, EventScript_ChangeTeraTypeNPC_SetRock
        case 6, EventScript_ChangeTeraTypeNPC_SetBug
        case 7, EventScript_ChangeTeraTypeNPC_SetGhost
        case 8, EventScript_ChangeTeraTypeNPC_SetSteel
        case 9, EventScript_ChangeTeraTypeNPC_SetFire
        case 10, EventScript_ChangeTeraTypeNPC_SetWater
        case 11, EventScript_ChangeTeraTypeNPC_SetGrass
        case 12, EventScript_ChangeTeraTypeNPC_SetElectric
        case 13, EventScript_ChangeTeraTypeNPC_SetPsychic
        case 14, EventScript_ChangeTeraTypeNPC_SetIce
        case 15, EventScript_ChangeTeraTypeNPC_SetDragon
        case 16, EventScript_ChangeTeraTypeNPC_SetDark
        case 17, EventScript_ChangeTeraTypeNPC_SetFairy
        case 18, EventScript_ChangeTeraTypeNPC_SetStellar
        case 0x7F, EventScript_ChangeTeraTypeNPCNo

EventScript_ChangeTeraTypeNPCLocked:
    msgbox gText_ChangeTeraTypeNPCLocked MSG_NORMAL
    release
    end


EventScript_ChangeTeraTypeNPC_SetNormal:
    setvar 0x8001 TYPE_NORMAL
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraNormal MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetFighting:
    setvar 0x8001 TYPE_FIGHTING
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraFighting MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetFlying:
    setvar 0x8001 TYPE_FLYING
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraFlying MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetPoison:
    setvar 0x8001 TYPE_POISON
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraPoison MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetGround:
    setvar 0x8001 TYPE_GROUND
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraGround MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetRock:
    setvar 0x8001 TYPE_ROCK
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraRock MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetBug:
    setvar 0x8001 TYPE_BUG
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraBug MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetGhost:
    setvar 0x8001 TYPE_GHOST
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraGhost MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetSteel:
    setvar 0x8001 TYPE_STEEL
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraSteel MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetFire:
    setvar 0x8001 TYPE_FIRE
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraFire MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetWater:
    setvar 0x8001 TYPE_WATER
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraWater MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetGrass:
    setvar 0x8001 TYPE_GRASS
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraGrass MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetElectric:
    setvar 0x8001 TYPE_ELECTRIC
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraElectric MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetPsychic:
    setvar 0x8001 TYPE_PSYCHIC
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraPsychic MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetIce:
    setvar 0x8001 TYPE_ICE
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraIce MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetDragon:
    setvar 0x8001 TYPE_DRAGON
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraDragon MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetDark:
    setvar 0x8001 TYPE_DARK
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraDark MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetFairy:
    setvar 0x8001 TYPE_FAIRY
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraFairy MSG_NORMAL
    release
    end

EventScript_ChangeTeraTypeNPC_SetStellar:
    setvar 0x8001 TYPE_STELLAR
    callasm ChangeTeraTypeInOW
    buffernumber 0x1 0x4001
    msgbox gText_ChangeTeraTypeNPCFetchTeraStellar MSG_NORMAL
    release
    end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_Pallet_AideGuy:
    lock
    faceplayer
        setvar 0x8000 MOVE_GLACIALLANCE
        setvar 0x8001 MOVE_TACKLE
        setvar 0x8002 MOVE_THUNDERWAVE
        setvar 0x8003 0x2E7
        setvar 0x8004 NATURE_MODEST
        setvar 0x8005 0
        setvar 0x8006 16
        setvar 0x8007 16
        setvar 0x8008 16
        setvar 0x8009 16
        setvar 0x800A 16
        setvar 0x800B 16
        givepokemon SPECIES_GARDEVOIR 3 ITEM_LEFTOVERS 0 1 10
        setvar 0x8000 MOVE_WEATHERBALL
        setvar 0x8001 MOVE_THUNDERSHOCK
        setvar 0x8002 MOVE_THUNDERWAVE
        setvar 0x8003 0x2E7
        setvar 0x8004 NATURE_MODEST
        setvar 0x8005 0
        setvar 0x8006 16
        setvar 0x8007 16
        setvar 0x8008 16
        setvar 0x8009 16
        setvar 0x800A 16
        setvar 0x800B 16
        givepokemon SPECIES_GALLADE 2 ITEM_LEFTOVERS 0 1 10
        setflag 0xA08
        setflag 0x828
        additem 0x306 0x1
        msgbox gText_TestScript2 MSG_NORMAL
        release
        end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

EventScript_CoffeeGuy_NPC:      @常青市老爷爷正常对话
	lock
	faceplayer
    checkflag 0x91E
	goto_if TRUE, EventScript_CoffeeGuy_NPC_AlreadyDone
	call EventScript_CoffeeGuy_Tile_Event
	end

EventScript_CoffeeGuy_NPC_AlreadyDone:
	msgbox Text_CoffeeGuy_Tile_Gift, MSG_NORMAL
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_CoffeeGuy_Tile:     @常青市老爷爷右边陷阱脚本给图鉴导航
	lockall
	textcolor 0x0
	applymovement 0x4, Movement_CoffeeGuy_Approach
	waitmovement 0x0
	applymovement 0xFF, Movement_Player_Approach
	waitmovement 0x0
	call EventScript_CoffeeGuy_Tile_Event
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_CoffeeGuy_Tile1:    @常青市老爷爷左边陷阱脚本给图鉴导航
	lockall
	textcolor 0x0
	applymovement 0x4, Movement_Player_Approach
	waitmovement 0x0
	applymovement 0xFF, Movement_CoffeeGuy_Approach
	waitmovement 0x0
	call EventScript_CoffeeGuy_Tile_Event
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_CoffeeGuy_Tile_Event:
	msgbox Text_CoffeeGuy_Tile_Intro, MSG_KEEPOPEN
	closeonkeypress
	special 0x187
	compare 0x800D, 0x2
	goto_if equal, EventScript_CoffeeGuy_Tile_End
	special 0x188
	special 0x9D
	waitstate
	lock
	faceplayer
	msgbox Text_CoffeeGuy_Tile_After, MSG_KEEPOPEN
	setvar 0x4051, 0x2
	setflag 0x91E
	setflag 0x829
    giveitem ITEM_ROOM_1_KEY, 1, MSG_OBTAIN     @ 图鉴导航
	msgbox Text_CoffeeGuy_Tile_Gift, MSG_KEEPOPEN
	release
	end

EventScript_CoffeeGuy_Tile_End:
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Movement_CoffeeGuy_Approach:
	.byte 0x30, 0xFE

Movement_Player_Approach:
	.byte 0x2F, 0xFE

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_BugCatcher_Strongest:
	lock
	faceplayer
	checkflag 0x1200
	goto_if TRUE, EventScript_BugCatcher_AlreadyDefeated

	msgbox Text_BugCatcher_Intro, MSG_YESNO
	compare LASTRESULT, 0x1
	goto_if equal, EventScript_BugCatcher_Battle

	msgbox Text_BugCatcher_Declined, MSG_NORMAL
	release
	end

EventScript_BugCatcher_Battle:
	trainerbattle1 1, 1, 0, Text_BugCatcher_Ready, Text_BugCatcher_Defeat, EventScript_BugCatcher_AfterBattle

EventScript_BugCatcher_AfterBattle:
    setflag 0x1200
	msgbox Text_BugCatcher_AfterBattle, MSG_NORMAL
	giveitem ITEM_TM10, 1, MSG_OBTAIN       @ 觉醒力量招式学习器
	msgbox Text_BugCatcher_Gift, MSG_NORMAL
	release
	end

EventScript_BugCatcher_AlreadyDefeated:
	msgbox Text_BugCatcher_AlreadyDefeated, MSG_NORMAL
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_Pallet_FatGuy_CoinGame: @真新镇胖子每天猜硬币拿奖励
	lock
	faceplayer

	@ 检查今天是否已经玩过
	checkflag 0xE00
	goto_if TRUE, EventScript_Pallet_FatGuy_CoinGame_AlreadyPlayed

	msgbox Text_Pallet_FatGuy_CoinIntro, MSG_YESNO
	compare LASTRESULT, 0x1
	goto_if notequal, EventScript_Pallet_FatGuy_CoinGame_Declined

    @ 标记今天已玩
	setflag 0xE00

	@ 猜硬币：正面/反面
	random 2
	compare LASTRESULT, 0x1
	goto_if equal, EventScript_Pallet_FatGuy_CoinGame_Win

	msgbox Text_Pallet_FatGuy_CoinLose, MSG_NORMAL
	release
	end

EventScript_Pallet_FatGuy_CoinGame_Win:
	msgbox Text_Pallet_FatGuy_CoinWin, MSG_NORMAL

	random 5          @ 随机 0~4
	switch LASTRESULT
	case 0, EventScript_Pallet_FatGuy_Prize0
	case 1, EventScript_Pallet_FatGuy_Prize1
	case 2, EventScript_Pallet_FatGuy_Prize2
	case 3, EventScript_Pallet_FatGuy_Prize3
	case 4, EventScript_Pallet_FatGuy_Prize4
	release
	end

EventScript_Pallet_FatGuy_Prize0:   @ 吃剩的东西
	giveitem ITEM_LEFTOVERS, 1, MSG_OBTAIN
	release
	end

EventScript_Pallet_FatGuy_Prize1:   @ 文柚果
	giveitem ITEM_SITRUS_BERRY, 1, MSG_OBTAIN
	release
	end

EventScript_Pallet_FatGuy_Prize2:   @ 饱腹熏香
	giveitem ITEM_FULL_INCENSE, 1, MSG_OBTAIN
	release
	end

EventScript_Pallet_FatGuy_Prize3:   @ 突击背心
	giveitem ITEM_ASSAULT_VEST, 1, MSG_OBTAIN
	release
	end

EventScript_Pallet_FatGuy_Prize4:   @ 厚底靴
	giveitem ITEM_HEAVY_DUTY_BOOTS, 1, MSG_OBTAIN
	release
	end

EventScript_Pallet_FatGuy_CoinGame_Declined:
	msgbox Text_Pallet_FatGuy_CoinDeclined, MSG_NORMAL
	release
	end

EventScript_Pallet_FatGuy_CoinGame_AlreadyPlayed:
	msgbox Text_Pallet_FatGuy_CoinAlreadyPlayed, MSG_NORMAL
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_Pallet_LittleGirl:      @ 真新镇小女孩送丝绸围巾
	lock
	faceplayer
	checkflag 0x1201
	goto_if TRUE, EventScript_Pallet_LittleGirl_AlreadyDone

	countpokemon
	compare LASTRESULT, 0
	goto_if equal, EventScript_Pallet_LittleGirl_NoMon

	bufferfirstpokemon 0x0
	msgbox Text_Pallet_LittleGirl_ShowMon, MSG_NORMAL
	giveitem ITEM_SILK_SCARF, 1, MSG_OBTAIN
	setflag 0x1201
	release
	end

EventScript_Pallet_LittleGirl_NoMon:
	msgbox Text_Pallet_LittleGirl_NoMon, MSG_NORMAL
	release
	end

EventScript_Pallet_LittleGirl_AlreadyDone:
	msgbox Text_Pallet_LittleGirl_After, MSG_NORMAL
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
EventScript_DynamicShopNPC:     @ 商店根据徽章售卖道具
	lock
	faceplayer

	@ 按徽章数量决定商品列表
	checkflag 0x827
    goto_if TRUE, EventScript_DynamicShop_8
    checkflag 0x826
    goto_if TRUE, EventScript_DynamicShop_7
    checkflag 0x825
    goto_if TRUE, EventScript_DynamicShop_6
    checkflag 0x824
    goto_if TRUE, EventScript_DynamicShop_5
    checkflag 0x823
    goto_if TRUE, EventScript_DynamicShop_4
    checkflag 0x822
    goto_if TRUE, EventScript_DynamicShop_3
    checkflag 0x821
    goto_if TRUE, EventScript_DynamicShop_2
    checkflag 0x820
    goto_if TRUE, EventScript_DynamicShop_1
    goto EventScript_DynamicShop_0

EventScript_DynamicShop_0:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_0
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_1:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_1
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_2:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_2
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_3:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_3
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_4:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_4
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_5:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_5
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_6:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_6
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_7:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_7
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

EventScript_DynamicShop_8:
	preparemsg Text_DynamicShop_Greeting
	waitmsg
	pokemart ShopItems_8
	msgbox Text_DynamicShop_Farewell, MSG_KEEPOPEN
	release
	end

@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
.align 2
ShopItems_0:
	.hword ITEM_POKE_BALL
	.hword ITEM_POTION
	.hword 0x0

ShopItems_1:
	.hword ITEM_POKE_BALL
	.hword ITEM_POTION
	.hword ITEM_ANTIDOTE
	.hword 0x0

ShopItems_2:
	.hword ITEM_POKE_BALL
	.hword ITEM_GREAT_BALL
	.hword ITEM_POTION
	.hword ITEM_SUPER_POTION
	.hword ITEM_ANTIDOTE
	.hword 0x0

ShopItems_3:
	.hword ITEM_POKE_BALL
	.hword ITEM_GREAT_BALL
	.hword ITEM_POTION
	.hword ITEM_SUPER_POTION
	.hword ITEM_ANTIDOTE
	.hword 0x0

ShopItems_4:
	.hword ITEM_GREAT_BALL
	.hword ITEM_SUPER_POTION
	.hword ITEM_SUPER_POTION
	.hword ITEM_AWAKENING
	.hword ITEM_BURN_HEAL
	.hword ITEM_ICE_HEAL
	.hword 0x0

ShopItems_5:
	.hword ITEM_ULTRA_BALL
	.hword ITEM_HYPER_POTION
	.hword ITEM_FULL_HEAL
	.hword ITEM_REVIVE
	.hword ITEM_ESCAPE_ROPE
	.hword 0x0

ShopItems_6:
	.hword ITEM_ULTRA_BALL
	.hword ITEM_HYPER_POTION
	.hword ITEM_FULL_HEAL
	.hword ITEM_REVIVE
	.hword ITEM_MAX_REPEL
	.hword 0x0

ShopItems_7:
	.hword ITEM_ULTRA_BALL
	.hword ITEM_HYPER_POTION
	.hword ITEM_FULL_HEAL
	.hword ITEM_REVIVE
	.hword ITEM_MAX_REPEL
	.hword ITEM_MAX_POTION
	.hword 0x0

ShopItems_8:
	.hword ITEM_ULTRA_BALL
	.hword ITEM_HYPER_POTION
	.hword ITEM_FULL_HEAL
	.hword ITEM_REVIVE
	.hword ITEM_MAX_REPEL
	.hword ITEM_MAX_POTION
	.hword ITEM_FULL_RESTORE
	.hword 0x0
