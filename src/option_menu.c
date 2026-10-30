#include "defines.h"
#include "defines_battle.h"
#include "../include/options_menu.h"
#include "../include/battle_setup.h"
#include "../include/event_data.h"
#include "../include/pokemon.h"
#include "../include/pokemon_storage_system.h"
#include "../include/random.h"
#include "../include/script.h"
#include "../include/string_util.h"
#include "../include/wild_encounter.h"
#include "../include/constants/event_objects.h"
#include "../include/constants/items.h"
#include "../include/constants/maps.h"
#include "../include/constants/pokedex.h"
#include "../include/constants/region_map_sections.h"
#include "../include/constants/species.h"
#include "../include/constants/trainer_classes.h"
#include "../include/constants/trainers.h"
#include "../include/constants/tutors.h"
#include "../include/new/ability_tables.h"
#include "../include/new/ai_advanced.h"
#include "../include/new/build_pokemon.h"
#include "../include/new/build_pokemon_2.h"
#include "../include/new/catching.h"
#include "../include/new/dexnav.h"
#include "../include/new/dynamax.h"
#include "../include/new/form_change.h"
#include "../include/new/frontier.h"
#include "../include/new/item.h"
#include "../include/new/learn_move.h"
#include "../include/new/mega.h"
#include "../include/new/multi.h"
#include "../include/new/pokemon_storage_system.h"
#include "../include/new/util2.h"
#include "../include/text.h"
#include "../include/overworld.h"
#include "../include/tm_case.h"
#include "../include/text_window.h"
#include "../include/bg.h"
#include "../include/pokemon_summary_screen.h"
#include "../include/menu.h"
#include "../include/new/battle_strings.h"
#include "../include/pokedex.h"
#include "../include/menu_helpers.h"
#include "../include/gba/m4a_internal.h"
#include "../include/malloc.h"
#include "../include/mgba.h"
#include "../include/sound.h"
#include "../include/constants/songs.h"

void CB2_OptionMenu(void);
bool8 LoadOptionMenuPalette(void);
void LoadOptionMenuItemNames(void);
void Task_OptionMenu(u8 taskId);
void CloseAndSaveOptionMenu(u8 taskId);
u8 OptionMenu_ProcessInput(void);
void BufferOptionMenuString(u8 selection);
void PrintOptionDescription(void);
void OptionMenu_PickSwitchCancel(void);
static void OptionMenu_DrawVisibleList(void);
static void OptionMenu_ScrollCursor(void);

// Value-storage indices (kept separate from the unified list below)
enum
{
    MENUITEM_TEXTSPEED = 0,
    MENUITEM_BATTLESCENE,
    MENUITEM_BATTLESTYLE,
    MENUITEM_SOUND,
    MENUITEM_BUTTONMODE,
    MENUITEM_FRAMETYPE,
    MENUITEM_CANCEL,
    MENUITEM_COUNT,
};

enum
{
    MENUITEM_RBUTTONMODE = 0,
    MENUITEM_BATTLEMUSIC,
    MENUITEM_WILDLEVELSCALING,
    MENUITEM_AUTOSORTBAG,
	MENUITEM_GAME_DIFFICULTY,
    MENUITEM_INVERSE_BATTLE,
    MENUITEM_CANCEL_PAGE_2,
    MENUITEM_PAGE2_COUNT,
};

enum
{
    MENUITEM_DOUBLE_BATTLE = 0,
    MENUITEM_NO_RANDOM_WILD_ENCOUNTERS,
    MENUITEM_DAMAGE_DISPLAY,
    MENUITEM_CANCEL_PAGE_3,
    MENUITEM_PAGE3_COUNT,
};

// Unified single-page list: all settings from the former 3 pages, plus cancel
enum
{
    OPT_TEXTSPEED = 0,
    OPT_BATTLESCENE,
    OPT_BATTLESTYLE,
    OPT_SOUND,
    OPT_BUTTONMODE,
    OPT_FRAMETYPE,
    OPT_RBUTTONMODE,
    OPT_BATTLEMUSIC,
    OPT_WILDLEVELSCALING,
    OPT_AUTOSORTBAG,
    OPT_GAME_DIFFICULTY,
    OPT_INVERSE_BATTLE,
    OPT_DOUBLE_BATTLE,
    OPT_NO_RANDOM_WILD_ENCOUNTERS,
    OPT_DAMAGE_DISPLAY,
    OPT_EXP_CATCH_UP,
    OPT_SHINY_ODDS,
    OPT_RANDOM_WILD_SPECIES,
    OPT_RANDOM_LEARNSETS,
    OPT_RANDOM_ABILITIES,
    OPT_RANDOM_TRAINERS,
    OPT_CANCEL,
    OPT_COUNT,
};

//分页:0=一般设置 1=对战设置 2=随机设置(L/R键切换)
#define OPT_PAGE_COUNT 3
static const u8 sOptionPageItems[OPT_PAGE_COUNT][9] =
{
	//第1页:一般设置
	{ OPT_TEXTSPEED, OPT_SOUND, OPT_BUTTONMODE, OPT_FRAMETYPE, OPT_RBUTTONMODE,
	  OPT_AUTOSORTBAG, OPT_BATTLEMUSIC, OPT_NO_RANDOM_WILD_ENCOUNTERS, OPT_CANCEL },
	//第2页:对战设置
	{ OPT_BATTLESCENE, OPT_BATTLESTYLE, OPT_INVERSE_BATTLE, OPT_DOUBLE_BATTLE,
	  OPT_DAMAGE_DISPLAY, OPT_EXP_CATCH_UP, OPT_GAME_DIFFICULTY, OPT_CANCEL },
	//第3页:随机设置
	{ OPT_RANDOM_WILD_SPECIES, OPT_RANDOM_LEARNSETS, OPT_RANDOM_ABILITIES,
	  OPT_RANDOM_TRAINERS, OPT_SHINY_ODDS, OPT_WILDLEVELSCALING, OPT_CANCEL },
};
static const u8 sOptionPageItemCount[OPT_PAGE_COUNT] = {9, 8, 7};

#define OPTION_LIST_VISIBLE 7

// Window Ids
enum
{
    WIN_TEXT_OPTION,
    WIN_OPTIONS
};

struct OptionMenu
{
    /*0x00*/ u16 option[MENUITEM_COUNT];
    /*0x??*/ u16 cursorPos;   //当前页内的光标行
    /*0x??*/ u16 scrollTop;   //当前页内可见区首行
    /*0x??*/ u8 page;         //当前页(0=一般 1=对战 2=随机)
    /*0x??*/ u8 pageCursor[OPT_PAGE_COUNT];   //每页记住的光标
    /*0x??*/ u8 pageScrollTop[OPT_PAGE_COUNT]; //每页记住的滚动顶
    /*0x??*/ u8 loadState;
    /*0x??*/ u8 state;
    /*0x??*/ u8 loadPaletteState;
    /*0x??*/ u16 option_secondPage[MENUITEM_PAGE2_COUNT];
    /*0x??*/ u16 option_thirdPage[MENUITEM_PAGE3_COUNT];
    /*0x??*/ u16 shinyOdds;   //闪光概率选项,存于VAR_SHINY_ODDS
    /*0x??*/ u16 randomWildSpecies;   //随机野生遭遇开关,存于VAR_RANDOM_WILD_SPECIES
    /*0x??*/ u16 randomLearnsets;     //随机招式表开关,存于FLAG_POKEMON_LEARNSET_RANDOMIZER
    /*0x??*/ u16 randomAbilities;     //随机特性开关,存于FLAG_ABILITY_RANDOMIZER
    /*0x??*/ u16 randomTrainers;      //随机训练家开关,存于FLAG_TRAINER_RANDOMIZER
    /*0x??*/ u16 expCatchUp;          //经验共享升级开关,存于FLAG_EXP_SHARE_CATCH_UP
};

extern struct OptionMenu *sOptionMenuPtr;
extern const u8 gText_TextSpeed[];
extern const u8 gText_BattleScene[];
extern const u8 gText_BattleStyle[];
extern const u8 gText_Sound[];
extern const u8 gText_ButtonMode[];
extern const u8 gText_Frame[];
extern const u8 gText_OptionMenuCancel[];
extern const u8 gText_RButtonMode[];
extern const u8 gText_BattleMusic[];
extern const u8 gText_WildLevelScaling[];
extern const u8 gText_AutoSortBag[];
extern const u8 gText_GameDifficulty[];
extern const u8 gText_InverseBattle[];
extern const u8 gText_DoubleBattle[];
extern const u8 gText_NoRandomWildEncounters[];
extern const u8 gText_DamageDisplay[];
extern const u8 gText_ShinyOdds[];
extern const u8 gText_RandomWildSpecies[];
extern const u8 gText_RandomLearnsets[];
extern const u8 gText_RandomAbilities[];
extern const u8 gText_RandomTrainers[];
extern const u8 gText_ExpCatchUp[];

extern const u8 gText_OptionDesc_TextSpeed[];
extern const u8 gText_OptionDesc_BattleScene[];
extern const u8 gText_OptionDesc_BattleStyle[];
extern const u8 gText_OptionDesc_Sound[];
extern const u8 gText_OptionDesc_ButtonMode[];
extern const u8 gText_OptionDesc_Frame[];
extern const u8 gText_OptionDesc_RButtonMode[];
extern const u8 gText_OptionDesc_BattleMusic[];
extern const u8 gText_OptionDesc_WildLevelScaling[];
extern const u8 gText_OptionDesc_AutoSortBag[];
extern const u8 gText_OptionDesc_GameDifficulty[];
extern const u8 gText_OptionDesc_InverseBattle[];
extern const u8 gText_OptionDesc_DoubleBattle[];
extern const u8 gText_OptionDesc_NoRandomWildEncounters[];
extern const u8 gText_OptionDesc_DamageDisplay[];
extern const u8 gText_OptionDesc_Cancel[];
extern const u8 gText_OptionDesc_ShinyOdds[];
extern const u8 gText_OptionDesc_RandomWildSpecies[];
extern const u8 gText_OptionDesc_RandomLearnsets[];
extern const u8 gText_OptionDesc_RandomAbilities[];
extern const u8 gText_OptionDesc_RandomTrainers[];
extern const u8 gText_OptionDesc_ExpCatchUp[];

extern const u8 gText_TextSpeedSlow[];
extern const u8 gText_TextSpeedMid[];
extern const u8 gText_TextSpeedFast[];
extern const u8 gText_BattleSceneOn[];
extern const u8 gText_BattleSceneOff[];
extern const u8 gText_BattleStyleShift[];
extern const u8 gText_BattleStyleSet[];
extern const u8 gText_SoundMono[];
extern const u8 gText_SoundStereo[];
extern const u8 gText_ButtonTypeHelp[];
extern const u8 gText_ButtonTypeLR[];
extern const u8 gText_ButtonTypeLEqualsA[];
extern const u8 gText_FrameType[];
extern const u8 gText_RButtonDexNav[];
extern const u8 gText_RButtonPokemon[];
extern const u8 gText_RButtonItems[];
extern const u8 gText_FRLG[];
extern const u8 gText_RSE[];
extern const u8 gText_OnOption[];
extern const u8 gText_OffOption[];
extern const u8 gText_ByName[];
extern const u8 gText_ByType[];
extern const u8 gText_ByAmount[];
extern const u8 gText_Normal[];
extern const u8 gText_Easy[];
extern const u8 gText_Hard[];
extern const u8 gText_Expert[];
extern const u8 gText_Odds1_8192[];
extern const u8 gText_Odds1_2048[];
extern const u8 gText_Odds1_1024[];
extern const u8 gText_Odds1_512[];
extern const u8 gText_Odds1_256[];
extern const u8 gText_Odds1_128[];
extern const u8 gText_Odds1_64[];
extern const u8 gText_Odds1_32[];
extern const u8 gText_Odds1_16[];
extern const u8 gText_Odds1_8[];
extern const u8 gText_Odds1_4[];
extern const u8 gText_Odds1_2[];
extern const u8 gText_OddsAlways[];

static const u8 *const sTextSpeedOptions[] =
{
    gText_TextSpeedSlow,
    gText_TextSpeedMid,
    gText_TextSpeedFast
};
static const u8 *const sBattleSceneOptions[] =
{
    gText_BattleSceneOn,
    gText_BattleSceneOff
};
static const u8 *const sBattleStyleOptions[] =
{
    gText_BattleStyleShift,
    gText_BattleStyleSet
};
static const u8 *const sSoundOptions[] =
{
    gText_SoundMono,
    gText_SoundStereo
};
static const u8 *const sButtonTypeOptions[] =
{
    gText_ButtonTypeHelp,
	gText_ButtonTypeLR,
	gText_ButtonTypeLEqualsA
};

static const u8 *const sRButtonModeOptions[] =
{
    gText_RButtonDexNav,
	gText_RButtonPokemon,
	gText_RButtonItems
};

static const u8 *const sBattleMusicOptions[] =
{
    gText_FRLG,
	gText_RSE
};
static const u8 *const sWildScalingOptions[] =
{
	gText_OffOption,
    gText_OnOption
};

static const u8 *const sAutoSortBagOptions[] =
{
    gText_OffOption,
    gText_ByName,
    gText_ByType,
    gText_ByAmount,
};
static const u8 *const sGameDifficultyOptions[] =
{
	gText_Normal,
	gText_Easy,
	gText_Hard,
	gText_Expert,
};
static const u8 *const sInverseBattleOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sDoubleBattleOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sNoRandomWildEncountersOptions[] =
{
	gText_OffOption,
    gText_OnOption
};
static const u8 *const sDamageDisplayOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
//与build_pokemon.c中sShinyOddsDenominators保持一致:档位0为原版1/8192,1~11依次对应分母表,12为必闪
#define SHINY_ODDS_MENU_OPTION_COUNT 13
static const u8 *const sShinyOddsOptions[] =
{
	gText_Odds1_8192,
	gText_Odds1_2048,
	gText_Odds1_1024,
	gText_Odds1_512,
	gText_Odds1_256,
	gText_Odds1_128,
	gText_Odds1_64,
	gText_Odds1_32,
	gText_Odds1_16,
	gText_Odds1_8,
	gText_Odds1_4,
	gText_Odds1_2,
	gText_OddsAlways,
};
static const u8 *const sRandomWildSpeciesOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sRandomLearnsetsOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sRandomAbilitiesOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sRandomTrainersOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
static const u8 *const sExpCatchUpOptions[] =
{
	gText_OffOption,
	gText_OnOption
};
// Description shown in the top text box for each unified list item
static const u8 *const sOptionDescriptions[OPT_COUNT] =
{
    [OPT_TEXTSPEED]                 = gText_OptionDesc_TextSpeed,
    [OPT_BATTLESCENE]               = gText_OptionDesc_BattleScene,
    [OPT_BATTLESTYLE]               = gText_OptionDesc_BattleStyle,
    [OPT_SOUND]                     = gText_OptionDesc_Sound,
    [OPT_BUTTONMODE]                = gText_OptionDesc_ButtonMode,
    [OPT_FRAMETYPE]                 = gText_OptionDesc_Frame,
    [OPT_RBUTTONMODE]               = gText_OptionDesc_RButtonMode,
    [OPT_BATTLEMUSIC]               = gText_OptionDesc_BattleMusic,
    [OPT_WILDLEVELSCALING]          = gText_OptionDesc_WildLevelScaling,
    [OPT_AUTOSORTBAG]               = gText_OptionDesc_AutoSortBag,
    [OPT_GAME_DIFFICULTY]           = gText_OptionDesc_GameDifficulty,
    [OPT_INVERSE_BATTLE]            = gText_OptionDesc_InverseBattle,
    [OPT_DOUBLE_BATTLE]             = gText_OptionDesc_DoubleBattle,
    [OPT_NO_RANDOM_WILD_ENCOUNTERS] = gText_OptionDesc_NoRandomWildEncounters,
    [OPT_DAMAGE_DISPLAY]            = gText_OptionDesc_DamageDisplay,
    [OPT_SHINY_ODDS]                = gText_OptionDesc_ShinyOdds,
    [OPT_RANDOM_WILD_SPECIES]       = gText_OptionDesc_RandomWildSpecies,
    [OPT_RANDOM_LEARNSETS]          = gText_OptionDesc_RandomLearnsets,
    [OPT_RANDOM_ABILITIES]          = gText_OptionDesc_RandomAbilities,
    [OPT_RANDOM_TRAINERS]           = gText_OptionDesc_RandomTrainers,
    [OPT_EXP_CATCH_UP]              = gText_OptionDesc_ExpCatchUp,
    [OPT_CANCEL]                    = gText_OptionDesc_Cancel,
};

static const u16 sOptionMenuItemCounts[MENUITEM_COUNT] = {3, 2, 2, 2, 3, 10, 0};
static const u16 sOptionMenuItemCounts_SecondPage[MENUITEM_PAGE2_COUNT] = {3, 2, 2, 4, 4, 2, 0};
static const u16 sOptionMenuItemCounts_ThirdPage[MENUITEM_PAGE3_COUNT] = {2, 2, 2, 0};

static const u8 * GetOptionItemName(u16 item)
{
    switch (item)
    {
    case OPT_TEXTSPEED:                   return gText_TextSpeed;
    case OPT_BATTLESCENE:                 return gText_BattleScene;
    case OPT_BATTLESTYLE:                 return gText_BattleStyle;
    case OPT_SOUND:                       return gText_Sound;
    case OPT_BUTTONMODE:                  return gText_ButtonMode;
    case OPT_FRAMETYPE:                   return gText_Frame;
    case OPT_RBUTTONMODE:                 return gText_RButtonMode;
    case OPT_BATTLEMUSIC:                 return gText_BattleMusic;
    case OPT_WILDLEVELSCALING:            return gText_WildLevelScaling;
    case OPT_AUTOSORTBAG:                 return gText_AutoSortBag;
    case OPT_GAME_DIFFICULTY:             return gText_GameDifficulty;
    case OPT_INVERSE_BATTLE:              return gText_InverseBattle;
    case OPT_DOUBLE_BATTLE:               return gText_DoubleBattle;
    case OPT_NO_RANDOM_WILD_ENCOUNTERS:   return gText_NoRandomWildEncounters;
    case OPT_DAMAGE_DISPLAY:              return gText_DamageDisplay;
    case OPT_SHINY_ODDS:                  return gText_ShinyOdds;
    case OPT_RANDOM_WILD_SPECIES:         return gText_RandomWildSpecies;
    case OPT_RANDOM_LEARNSETS:            return gText_RandomLearnsets;
    case OPT_RANDOM_ABILITIES:            return gText_RandomAbilities;
    case OPT_RANDOM_TRAINERS:             return gText_RandomTrainers;
    case OPT_EXP_CATCH_UP:                return gText_ExpCatchUp;
    default:                              return gText_OptionMenuCancel;
    }
}

// Pointer to the stored value of a unified list item (NULL for cancel)
static u16 * GetOptionItemValuePtr(u16 item)
{
    switch (item)
    {
    case OPT_TEXTSPEED:                   return &sOptionMenuPtr->option[MENUITEM_TEXTSPEED];
    case OPT_BATTLESCENE:                 return &sOptionMenuPtr->option[MENUITEM_BATTLESCENE];
    case OPT_BATTLESTYLE:                 return &sOptionMenuPtr->option[MENUITEM_BATTLESTYLE];
    case OPT_SOUND:                       return &sOptionMenuPtr->option[MENUITEM_SOUND];
    case OPT_BUTTONMODE:                  return &sOptionMenuPtr->option[MENUITEM_BUTTONMODE];
    case OPT_FRAMETYPE:                   return &sOptionMenuPtr->option[MENUITEM_FRAMETYPE];
    case OPT_RBUTTONMODE:                 return &sOptionMenuPtr->option_secondPage[MENUITEM_RBUTTONMODE];
    case OPT_BATTLEMUSIC:                 return &sOptionMenuPtr->option_secondPage[MENUITEM_BATTLEMUSIC];
    case OPT_WILDLEVELSCALING:            return &sOptionMenuPtr->option_secondPage[MENUITEM_WILDLEVELSCALING];
    case OPT_AUTOSORTBAG:                 return &sOptionMenuPtr->option_secondPage[MENUITEM_AUTOSORTBAG];
    case OPT_GAME_DIFFICULTY:             return &sOptionMenuPtr->option_secondPage[MENUITEM_GAME_DIFFICULTY];
    case OPT_INVERSE_BATTLE:              return &sOptionMenuPtr->option_secondPage[MENUITEM_INVERSE_BATTLE];
    case OPT_DOUBLE_BATTLE:               return &sOptionMenuPtr->option_thirdPage[MENUITEM_DOUBLE_BATTLE];
    case OPT_NO_RANDOM_WILD_ENCOUNTERS:   return &sOptionMenuPtr->option_thirdPage[MENUITEM_NO_RANDOM_WILD_ENCOUNTERS];
    case OPT_DAMAGE_DISPLAY:              return &sOptionMenuPtr->option_thirdPage[MENUITEM_DAMAGE_DISPLAY];
    case OPT_SHINY_ODDS:                  return &sOptionMenuPtr->shinyOdds;
    case OPT_RANDOM_WILD_SPECIES:         return &sOptionMenuPtr->randomWildSpecies;
    case OPT_RANDOM_LEARNSETS:            return &sOptionMenuPtr->randomLearnsets;
    case OPT_RANDOM_ABILITIES:            return &sOptionMenuPtr->randomAbilities;
    case OPT_RANDOM_TRAINERS:             return &sOptionMenuPtr->randomTrainers;
    case OPT_EXP_CATCH_UP:                return &sOptionMenuPtr->expCatchUp;
    default:                              return NULL;
    }
}

static u16 GetOptionItemCount(u16 item)
{
    switch (item)
    {
    case OPT_TEXTSPEED:                   return sOptionMenuItemCounts[MENUITEM_TEXTSPEED];
    case OPT_BATTLESCENE:                 return sOptionMenuItemCounts[MENUITEM_BATTLESCENE];
    case OPT_BATTLESTYLE:                 return sOptionMenuItemCounts[MENUITEM_BATTLESTYLE];
    case OPT_SOUND:                       return sOptionMenuItemCounts[MENUITEM_SOUND];
    case OPT_BUTTONMODE:                  return sOptionMenuItemCounts[MENUITEM_BUTTONMODE];
    case OPT_FRAMETYPE:                   return sOptionMenuItemCounts[MENUITEM_FRAMETYPE];
    case OPT_RBUTTONMODE:                 return sOptionMenuItemCounts_SecondPage[MENUITEM_RBUTTONMODE];
    case OPT_BATTLEMUSIC:                 return sOptionMenuItemCounts_SecondPage[MENUITEM_BATTLEMUSIC];
    case OPT_WILDLEVELSCALING:            return sOptionMenuItemCounts_SecondPage[MENUITEM_WILDLEVELSCALING];
    case OPT_AUTOSORTBAG:                 return sOptionMenuItemCounts_SecondPage[MENUITEM_AUTOSORTBAG];
    case OPT_GAME_DIFFICULTY:             return sOptionMenuItemCounts_SecondPage[MENUITEM_GAME_DIFFICULTY];
    case OPT_INVERSE_BATTLE:              return sOptionMenuItemCounts_SecondPage[MENUITEM_INVERSE_BATTLE];
    case OPT_DOUBLE_BATTLE:               return sOptionMenuItemCounts_ThirdPage[MENUITEM_DOUBLE_BATTLE];
    case OPT_NO_RANDOM_WILD_ENCOUNTERS:   return sOptionMenuItemCounts_ThirdPage[MENUITEM_NO_RANDOM_WILD_ENCOUNTERS];
    case OPT_DAMAGE_DISPLAY:              return sOptionMenuItemCounts_ThirdPage[MENUITEM_DAMAGE_DISPLAY];
    case OPT_SHINY_ODDS:                  return SHINY_ODDS_MENU_OPTION_COUNT;
    case OPT_RANDOM_WILD_SPECIES:         return 2;
    case OPT_RANDOM_LEARNSETS:            return 2;
    case OPT_RANDOM_ABILITIES:            return 2;
    case OPT_RANDOM_TRAINERS:             return 2;
    case OPT_EXP_CATCH_UP:                return 2;
    default:                              return 0;
    }
}

static const u8 * GetOptionItemValueString(u16 item)
{
    u16 *value = GetOptionItemValuePtr(item);
    static u8 str[20];

    if (value == NULL)
        return NULL;

    switch (item)
    {
    case OPT_TEXTSPEED:                   return sTextSpeedOptions[*value];
    case OPT_BATTLESCENE:                 return sBattleSceneOptions[*value];
    case OPT_BATTLESTYLE:                 return sBattleStyleOptions[*value];
    case OPT_SOUND:                       return sSoundOptions[*value];
    case OPT_BUTTONMODE:                  return sButtonTypeOptions[*value];
    case OPT_FRAMETYPE:
        ConvertIntToDecimalStringN(str, *value + 1, STR_CONV_MODE_RIGHT_ALIGN, 2);
        return str;
    case OPT_RBUTTONMODE:                 return sRButtonModeOptions[*value];
    case OPT_BATTLEMUSIC:                 return sBattleMusicOptions[*value];
    case OPT_WILDLEVELSCALING:            return sWildScalingOptions[*value];
    case OPT_AUTOSORTBAG:                 return sAutoSortBagOptions[*value];
    case OPT_GAME_DIFFICULTY:             return sGameDifficultyOptions[*value];
    case OPT_INVERSE_BATTLE:              return sInverseBattleOptions[*value];
    case OPT_DOUBLE_BATTLE:               return sDoubleBattleOptions[*value];
    case OPT_NO_RANDOM_WILD_ENCOUNTERS:   return sNoRandomWildEncountersOptions[*value];
    case OPT_DAMAGE_DISPLAY:              return sDamageDisplayOptions[*value];
    case OPT_SHINY_ODDS:                  return sShinyOddsOptions[*value];
    case OPT_RANDOM_WILD_SPECIES:         return sRandomWildSpeciesOptions[*value];
    case OPT_RANDOM_LEARNSETS:            return sRandomLearnsetsOptions[*value];
    case OPT_RANDOM_ABILITIES:            return sRandomAbilitiesOptions[*value];
    case OPT_RANDOM_TRAINERS:             return sRandomTrainersOptions[*value];
    case OPT_EXP_CATCH_UP:                return sExpCatchUpOptions[*value];
    default:                              return NULL;
    }
}

void CB2_OptionsMenuFromStartMenu(void)
{
    u8 i;

    if (gMain.savedCallback == NULL)
        gMain.savedCallback = CB2_ReturnToFieldWithOpenMenu;
    sOptionMenuPtr = AllocZeroed(sizeof(struct OptionMenu));
    sOptionMenuPtr->loadState = 0;
    sOptionMenuPtr->loadPaletteState = 0;
    sOptionMenuPtr->state = 0;
    sOptionMenuPtr->cursorPos = 0;
    sOptionMenuPtr->scrollTop = 0;
    sOptionMenuPtr->option[MENUITEM_TEXTSPEED] = gSaveBlock2->optionsTextSpeed;
    sOptionMenuPtr->option[MENUITEM_BATTLESCENE] = gSaveBlock2->optionsBattleSceneOff;
    sOptionMenuPtr->option[MENUITEM_BATTLESTYLE] = gSaveBlock2->optionsBattleStyle;
    sOptionMenuPtr->option[MENUITEM_SOUND] = gSaveBlock2->optionsSound;
    sOptionMenuPtr->option[MENUITEM_BUTTONMODE] = gSaveBlock2->optionsButtonMode;
    sOptionMenuPtr->option[MENUITEM_FRAMETYPE] = gSaveBlock2->optionsWindowFrameType;
    sOptionMenuPtr->option_secondPage[MENUITEM_RBUTTONMODE] = VarGet(VAR_R_BUTTON_MODE);
    sOptionMenuPtr->option_secondPage[MENUITEM_BATTLEMUSIC] = VarGet(VAR_BATTLE_MUSIC);
    sOptionMenuPtr->option_secondPage[MENUITEM_WILDLEVELSCALING] = VarGet(VAR_WILD_LEVEL_SCALING);
    sOptionMenuPtr->option_secondPage[MENUITEM_AUTOSORTBAG] = VarGet(VAR_AUTO_SORT_BAG);
    sOptionMenuPtr->option_secondPage[MENUITEM_GAME_DIFFICULTY] = VarGet(VAR_GAME_DIFFICULTY);
    sOptionMenuPtr->option_secondPage[MENUITEM_INVERSE_BATTLE] = VarGet(VAR_INVERSE_BATTLE);
    sOptionMenuPtr->option_thirdPage[MENUITEM_DOUBLE_BATTLE] = VarGet(VAR_DOUBLE_BATTLE);
    sOptionMenuPtr->option_thirdPage[MENUITEM_NO_RANDOM_WILD_ENCOUNTERS] = VarGet(VAR_NO_RANDOM_WILD_ENCOUNTERS);
    sOptionMenuPtr->option_thirdPage[MENUITEM_DAMAGE_DISPLAY] = VarGet(VAR_DAMAGE_TEXT_DISPLAY);
    sOptionMenuPtr->shinyOdds = VarGet(VAR_SHINY_ODDS);
    if (sOptionMenuPtr->shinyOdds >= SHINY_ODDS_MENU_OPTION_COUNT) //旧存档该VAR可能是残留数据,视为原版概率
        sOptionMenuPtr->shinyOdds = 0;
    sOptionMenuPtr->randomWildSpecies = VarGet(VAR_RANDOM_WILD_SPECIES);
    if (sOptionMenuPtr->randomWildSpecies >= 2) //旧存档该VAR可能是残留数据,视为关闭
        sOptionMenuPtr->randomWildSpecies = 0;
    sOptionMenuPtr->randomLearnsets = FlagGet(FLAG_POKEMON_LEARNSET_RANDOMIZER);
    sOptionMenuPtr->randomAbilities = FlagGet(FLAG_ABILITY_RANDOMIZER);
    sOptionMenuPtr->randomTrainers = FlagGet(FLAG_TRAINER_RANDOMIZER);
    sOptionMenuPtr->expCatchUp = FlagGet(FLAG_EXP_SHARE_CATCH_UP);

    for (i = 0; i < MENUITEM_COUNT - 1; i++)
    {
        if (sOptionMenuPtr->option[i] > (sOptionMenuItemCounts[i]) - 1)
            sOptionMenuPtr->option[i] = 0;
    }
    SetMainCallback2(CB2_OptionMenu);
}

void CB2_OptionsMenuFromMainMenu(void)
{
    // Closing Options from the title screen must return to the title's main
    // menu, not to the field/start menu.
    gMain.savedCallback = CB2_InitMainMenu;
    CB2_OptionsMenuFromStartMenu();
}

void Task_OptionMenu(u8 taskId)
{
    switch (sOptionMenuPtr->loadState)
    {
    case 0:
        BeginNormalPaletteFade(0xFFFFFFFF, 0, 0x10, 0, RGB_BLACK);
        OptionMenu_SetVBlankCallback();
        sOptionMenuPtr->loadState++;
        break;
    case 1:
        if (gPaletteFade->active)
            return;
        sOptionMenuPtr->loadState++;
        break;
    case 2:
        if (((bool32)MenuHelpers_CallLinkSomething()) == TRUE)
            break;
        switch (OptionMenu_ProcessInput())
        {
        case 0:
            break;
        case 1: // exit
            sOptionMenuPtr->loadState++;
            break;
        case 2: // frame type changed: reload border graphics
            LoadBgTiles(1, GetUserFrameGraphicsInfo(sOptionMenuPtr->option[MENUITEM_FRAMETYPE])->tiles, 0x120, 0x1AA);
            LoadPalette(GetUserFrameGraphicsInfo(sOptionMenuPtr->option[MENUITEM_FRAMETYPE])->palette, 0x20, 0x20);
            BufferOptionMenuString(sOptionMenuPtr->cursorPos - sOptionMenuPtr->scrollTop);
            break;
        case 3: // cursor moved (list may have scrolled)
            OptionMenu_ScrollCursor();
            PrintOptionDescription();
            break;
        case 4: // value changed
            BufferOptionMenuString(sOptionMenuPtr->cursorPos - sOptionMenuPtr->scrollTop);
            break;
        case 5: // page switched (L/R): redraw the whole page
            OptionMenu_DrawVisibleList();
            UpdateSettingSelectionDisplay(sOptionMenuPtr->cursorPos - sOptionMenuPtr->scrollTop);
            PrintOptionDescription();
            OptionMenu_PickSwitchCancel();
            break;
        }
        break;
    case 3:
        BeginNormalPaletteFade(0xFFFFFFFF, 0, 0, 0x10, RGB_BLACK);
        sOptionMenuPtr->loadState++;
        break;
    case 4:
        if (gPaletteFade->active)
            return;
        sOptionMenuPtr->loadState++;
        break;
    case 5:
        CloseAndSaveOptionMenu(taskId);
        break;
    }
}
void CloseAndSaveOptionMenu(u8 taskId)
{
    gFieldCallback = FieldCB_DefaultWarpExit;
    SetMainCallback2(gMain.savedCallback);
    FreeAllWindowBuffers();
    gSaveBlock2->optionsTextSpeed = sOptionMenuPtr->option[MENUITEM_TEXTSPEED];
    gSaveBlock2->optionsBattleSceneOff = sOptionMenuPtr->option[MENUITEM_BATTLESCENE];
    gSaveBlock2->optionsBattleStyle = sOptionMenuPtr->option[MENUITEM_BATTLESTYLE];
    gSaveBlock2->optionsSound = sOptionMenuPtr->option[MENUITEM_SOUND];
    gSaveBlock2->optionsButtonMode = sOptionMenuPtr->option[MENUITEM_BUTTONMODE];
    gSaveBlock2->optionsWindowFrameType = sOptionMenuPtr->option[MENUITEM_FRAMETYPE];
    VarSet(VAR_R_BUTTON_MODE, sOptionMenuPtr->option_secondPage[MENUITEM_RBUTTONMODE]);
    VarSet(VAR_BATTLE_MUSIC, sOptionMenuPtr->option_secondPage[MENUITEM_BATTLEMUSIC]);
    VarSet(VAR_WILD_LEVEL_SCALING, sOptionMenuPtr->option_secondPage[MENUITEM_WILDLEVELSCALING]);
    VarSet(VAR_AUTO_SORT_BAG, sOptionMenuPtr->option_secondPage[MENUITEM_AUTOSORTBAG]);
    VarSet(VAR_GAME_DIFFICULTY, sOptionMenuPtr->option_secondPage[MENUITEM_GAME_DIFFICULTY]);
    VarSet(VAR_INVERSE_BATTLE, sOptionMenuPtr->option_secondPage[MENUITEM_INVERSE_BATTLE]);
    VarSet(VAR_DOUBLE_BATTLE, sOptionMenuPtr->option_thirdPage[MENUITEM_DOUBLE_BATTLE]);
    VarSet(VAR_NO_RANDOM_WILD_ENCOUNTERS, sOptionMenuPtr->option_thirdPage[MENUITEM_NO_RANDOM_WILD_ENCOUNTERS]);
    VarSet(VAR_DAMAGE_TEXT_DISPLAY, sOptionMenuPtr->option_thirdPage[MENUITEM_DAMAGE_DISPLAY]);
    VarSet(VAR_SHINY_ODDS, sOptionMenuPtr->shinyOdds);
    VarSet(VAR_RANDOM_WILD_SPECIES, sOptionMenuPtr->randomWildSpecies);
    if (sOptionMenuPtr->randomLearnsets)
        FlagSet(FLAG_POKEMON_LEARNSET_RANDOMIZER);
    else
        FlagClear(FLAG_POKEMON_LEARNSET_RANDOMIZER);
    if (sOptionMenuPtr->randomAbilities)
        FlagSet(FLAG_ABILITY_RANDOMIZER);
    else
        FlagClear(FLAG_ABILITY_RANDOMIZER);
    if (sOptionMenuPtr->randomTrainers)
        FlagSet(FLAG_TRAINER_RANDOMIZER);
    else
        FlagClear(FLAG_TRAINER_RANDOMIZER);
    if (sOptionMenuPtr->expCatchUp)
        FlagSet(FLAG_EXP_SHARE_CATCH_UP);
    else
        FlagClear(FLAG_EXP_SHARE_CATCH_UP);
    SetPokemonCryStereo(gSaveBlock2->optionsSound);
    FREE_AND_SET_NULL(sOptionMenuPtr);
    DestroyTask(taskId);
}

void CB2_OptionMenu(void)
{
    u8 i, state;
    state = sOptionMenuPtr->state;
    switch (state)
    {
    case 0:
        OptionMenu_InitCallbacks();
        break;
    case 1:
        InitOptionMenuBg();
        break;
    case 2:
        OptionMenu_ResetSpriteData();
        break;
    case 3:
        if (LoadOptionMenuPalette() != TRUE)
            return;
        break;
    case 4:
        PrintOptionMenuHeader();
        break;
    case 5:
        DrawOptionMenuBg();
        break;
    case 6:
        LoadOptionMenuItemNames();
        break;
    case 7:
        for (i = 0; i < OPTION_LIST_VISIBLE; i++)
            BufferOptionMenuString(i);
        break;
    case 8:
        UpdateSettingSelectionDisplay(sOptionMenuPtr->cursorPos - sOptionMenuPtr->scrollTop);
        PrintOptionDescription();
        break;
    case 9:
        OptionMenu_PickSwitchCancel();
        break;
    default:
        SetOptionMenuTask();
		break;
    }
    sOptionMenuPtr->state++;
}

static const u8 sOptionMenuPickSwitchCancelTextColor[] = {TEXT_DYNAMIC_COLOR_6, TEXT_COLOR_WHITE, TEXT_COLOR_DARK_GREY};
static const u8 sOptionMenuTextColor[] = {TEXT_COLOR_TRANSPARENT, TEXT_COLOR_LIGHT_RED, TEXT_COLOR_RED};

// Prints the current value of the list item shown at visible row `selection`
void BufferOptionMenuString(u8 selection)
{
    u8 str[20];
    u8 buf[12];
    u8 dst[3];
    u8 x, y;
    u16 item;
    const u8 * valueString;

    if (selection >= OPTION_LIST_VISIBLE)
        return;
    if (sOptionMenuPtr->scrollTop + selection >= sOptionPageItemCount[sOptionMenuPtr->page])
        return; //越过本页最后一行(页项目数不足7)时不画值列

    memcpy(dst, sOptionMenuTextColor, 3);
    x = 0x82;
    y = ((GetFontAttribute(2, FONTATTR_MAX_LETTER_HEIGHT) - 1) * (selection)) + 2;
    FillWindowPixelRect(1, 1, x, y, 0x46, GetFontAttribute(2, FONTATTR_MAX_LETTER_HEIGHT));

    item = sOptionPageItems[sOptionMenuPtr->page][sOptionMenuPtr->scrollTop + selection];
    if (item == OPT_FRAMETYPE)
    {
        StringCopy(str, gText_FrameType);
        ConvertIntToDecimalStringN(buf, sOptionMenuPtr->option[MENUITEM_FRAMETYPE] + 1, 1, 2);
        StringAppendN(str, buf, 3);
        AddTextPrinterParameterized3(1, 2, x, y, dst, -1, str);
    }
    else
    {
        valueString = GetOptionItemValueString(item);
        if (valueString != NULL)
            AddTextPrinterParameterized3(1, 2, x, y, dst, -1, valueString);
    }

    PutWindowTilemap(1);
    CopyWindowToVram(1, COPYWIN_BOTH);
}

// Keeps the cursor inside the visible window, scrolling the list if needed,
// then redraws names + values and moves the selection cursor.
static void OptionMenu_ScrollCursor(void)
{
    if (sOptionMenuPtr->cursorPos < sOptionMenuPtr->scrollTop)
        sOptionMenuPtr->scrollTop = sOptionMenuPtr->cursorPos;
    else if (sOptionMenuPtr->cursorPos >= sOptionMenuPtr->scrollTop + OPTION_LIST_VISIBLE)
        sOptionMenuPtr->scrollTop = sOptionMenuPtr->cursorPos - OPTION_LIST_VISIBLE + 1;

    OptionMenu_DrawVisibleList();
    UpdateSettingSelectionDisplay(sOptionMenuPtr->cursorPos - sOptionMenuPtr->scrollTop);
}

static void OptionMenu_DrawVisibleList(void)
{
    LoadOptionMenuItemNames();
    {
        u8 i;
        for (i = 0; i < OPTION_LIST_VISIBLE; i++)
            BufferOptionMenuString(i);
    }
}

//切换到前一页/后一页(L/R键),保存并恢复每页的光标与滚动位置;返回5表示需要整页重画
static u8 OptionMenu_SwitchPage(s8 dir)
{
    s32 newPage = sOptionMenuPtr->page + dir;

    if (newPage < 0)
        newPage = OPT_PAGE_COUNT - 1;
    else if (newPage >= OPT_PAGE_COUNT)
        newPage = 0;

    if (newPage == sOptionMenuPtr->page)
        return 0;

    sOptionMenuPtr->pageCursor[sOptionMenuPtr->page] = sOptionMenuPtr->cursorPos;
    sOptionMenuPtr->pageScrollTop[sOptionMenuPtr->page] = sOptionMenuPtr->scrollTop;
    sOptionMenuPtr->page = newPage;
    sOptionMenuPtr->cursorPos = sOptionMenuPtr->pageCursor[newPage];
    sOptionMenuPtr->scrollTop = sOptionMenuPtr->pageScrollTop[newPage];

    if (sOptionMenuPtr->cursorPos >= sOptionPageItemCount[newPage])
        sOptionMenuPtr->cursorPos = sOptionPageItemCount[newPage] - 1;

    PlaySE(SE_SELECT);
    return 5;
}

u8 OptionMenu_ProcessInput(void)
{
    u16 *curr;
    u16 current;
    u16 item;

    if (JOY_NEW(L_BUTTON))
    {
        return OptionMenu_SwitchPage(-1);
    }
    else if (JOY_NEW(R_BUTTON))
    {
        return OptionMenu_SwitchPage(1);
    }
    else if (JOY_REPT(DPAD_RIGHT))
    {
        item = sOptionPageItems[sOptionMenuPtr->page][sOptionMenuPtr->cursorPos];
        curr = GetOptionItemValuePtr(item);
        if (curr == NULL)
            return 0;
        current = *curr;
        if (current == GetOptionItemCount(item) - 1)
            *curr = 0;
        else
            *curr = current + 1;
        if (item == OPT_FRAMETYPE)
            return 2;
        return 4;
    }
    else if (JOY_REPT(DPAD_LEFT))
    {
        item = sOptionPageItems[sOptionMenuPtr->page][sOptionMenuPtr->cursorPos];
        curr = GetOptionItemValuePtr(item);
        if (curr == NULL)
            return 0;
        if (*curr == 0)
            *curr = GetOptionItemCount(item) - 1;
        else
            --*curr;
        if (item == OPT_FRAMETYPE)
            return 2;
        return 4;
    }
    else if (JOY_REPT(DPAD_UP))
    {
        if (sOptionMenuPtr->cursorPos == 0)
            sOptionMenuPtr->cursorPos = sOptionPageItemCount[sOptionMenuPtr->page] - 1;
        else
            sOptionMenuPtr->cursorPos = sOptionMenuPtr->cursorPos - 1;
        PlaySE(SE_SELECT);
        return 3;
    }
    else if (JOY_REPT(DPAD_DOWN))
    {
        if (sOptionMenuPtr->cursorPos >= sOptionPageItemCount[sOptionMenuPtr->page] - 1)
            sOptionMenuPtr->cursorPos = 0;
        else
            sOptionMenuPtr->cursorPos = sOptionMenuPtr->cursorPos + 1;
        PlaySE(SE_SELECT);
        return 3;
    }
    else if (JOY_NEW(B_BUTTON) || JOY_NEW(A_BUTTON))
    {
        return 1;
    }
    else
    {
        return 0;
    }
}
extern const u16 sOptionMenuPalette[];
static const u8 sOptionDescriptionTextColor[] = {TEXT_COLOR_TRANSPARENT, TEXT_COLOR_DARK_GREY, TEXT_COLOR_LIGHT_GREY};

// Replaces the fixed header text with a description of the option under the cursor
void PrintOptionDescription(void)
{
    u16 item = sOptionPageItems[sOptionMenuPtr->page][sOptionMenuPtr->cursorPos];
    const u8 *desc = (item < OPT_COUNT) ? sOptionDescriptions[item] : NULL;

    FillWindowPixelBuffer(WIN_TEXT_OPTION, PIXEL_FILL(1));
    if (desc != NULL)
    {
        s32 width = GetStringWidth(2, desc, 0);
        s32 x = (GetWindowAttribute(WIN_TEXT_OPTION, WINDOW_WIDTH) * 8 - width) / 2;
        if (x < 0)
            x = 0;
        AddTextPrinterParameterized3(WIN_TEXT_OPTION, 2, x, 2, sOptionDescriptionTextColor, 0, desc);
    }
    PutWindowTilemap(WIN_TEXT_OPTION);
    CopyWindowToVram(WIN_TEXT_OPTION, COPYWIN_BOTH);
}

bool8 LoadOptionMenuPalette(void)
{
    switch (sOptionMenuPtr->loadPaletteState)
    {
    case 0:
        LoadBgTiles(1, GetUserFrameGraphicsInfo(sOptionMenuPtr->option[MENUITEM_FRAMETYPE])->tiles, 0x120, 0x1AA);
        break;
    case 1:
        LoadPalette(GetUserFrameGraphicsInfo(sOptionMenuPtr->option[MENUITEM_FRAMETYPE])->palette, 0x20, 0x20);
        break;
    case 2:
        LoadPalette(sOptionMenuPalette, 0x10, 0x20);
        LoadPalette(stdpal_get(2), 0xF0, 0x20);
        break;
    case 3:
        DrawWindowBorderWithStdpal3(1, 0x1B3, 0x30);
        break;
    default:
        return TRUE;
    }
    sOptionMenuPtr->loadPaletteState++;
    return FALSE;
}

// Draws the names of the currently visible slice of the active page
void LoadOptionMenuItemNames(void)
{
    u8 i;

    FillWindowPixelBuffer(1, PIXEL_FILL(1));
    for (i = 0; i < OPTION_LIST_VISIBLE; i++)
    {
        u16 row = sOptionMenuPtr->scrollTop + i;
        u16 item;
        if (row >= sOptionPageItemCount[sOptionMenuPtr->page])
            break;
        item = sOptionPageItems[sOptionMenuPtr->page][row];
        AddTextPrinterParameterized(WIN_OPTIONS, 2, GetOptionItemName(item), 8, (u8)((i * (GetFontAttribute(2, FONTATTR_MAX_LETTER_HEIGHT))) + 2) - i, TEXT_SPEED_FF, NULL);
    }
    PutWindowTilemap(1);
    CopyWindowToVram(1, COPYWIN_BOTH);
}

extern const u8 gText_PickSwitchCancel[];
extern const u8 gText_OptionPageGeneral[];
extern const u8 gText_OptionPageBattle[];
extern const u8 gText_OptionPageRandomizer[];

static const u8 *const sOptionPageNames[OPT_PAGE_COUNT] =
{
	gText_OptionPageGeneral,
	gText_OptionPageBattle,
	gText_OptionPageRandomizer,
};

void OptionMenu_PickSwitchCancel(void)
{
    s32 x;
    //左侧显示当前页名(带LR提示),右侧保留原有的按键说明
    FillWindowPixelBuffer(2, PIXEL_FILL(15));
    AddTextPrinterParameterized3(2, 0, 4, 0, sOptionMenuPickSwitchCancelTextColor, 0, sOptionPageNames[sOptionMenuPtr->page]);
    x = 0xE4 - GetStringWidth(0, gText_PickSwitchCancel, 0);
    AddTextPrinterParameterized3(2, 0, x, 0, sOptionMenuPickSwitchCancelTextColor, 0, gText_PickSwitchCancel);
    PutWindowTilemap(2);
    CopyWindowToVram(2, COPYWIN_BOTH);
}
