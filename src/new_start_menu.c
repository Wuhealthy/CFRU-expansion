#include "defines.h"
#include "../include/bg.h"
#include "../include/event_data.h"
#include "../include/fieldmap.h"
#include "../include/field_player_avatar.h"
#include "../include/field_weather.h"
#include "../include/gpu_regs.h"
#include "../include/item_menu.h"
#include "../include/link.h"
#include "../include/main.h"
#include "../include/menu.h"
#include "../include/money.h"
#include "../include/new_game.h"
#include "../include/new_start_menu.h"
#include "../include/new_start_menu_data.h"
#include "../include/overworld.h"
#include "../include/palette.h"
#include "../include/party_menu.h"
#include "../include/save.h"
#include "../include/safari_zone.h"
#include "../include/script.h"
#include "../include/sound.h"
#include "../include/string_util.h"
#include "../include/text.h"
#include "../include/window.h"
#include "../include/constants/field_weather.h"
#include "../include/constants/flags.h"
#include "../include/constants/game_stat.h"
#include "../include/constants/songs.h"
#include "../include/new/dexnav.h"
#include "../include/new/dynamic_ow_pals.h"

void Task_HandleChooseMonInput(u8 taskId);

#define NEW_START_MENU_VISIBLE_ICONS 7
#define NEW_START_MENU_ACTION_COUNT 9
#define NEW_START_MENU_INFO_BASE_BLOCK 0x210
#define NEW_START_MENU_WINDOW_NONE 0xFF
#define NEW_START_MENU_SPRITE_NONE 0xFF
#define NEW_START_MENU_ICON_Y 140
#define NEW_START_MENU_ARROW_Y 125
#define NEW_START_MENU_BG_Y 152
#define NEW_START_MENU_INFO_TEXT_Y 16
#define NEW_START_MENU_INFO_TEXT_TOP 1
#define NEW_START_MENU_INFO_RIGHT_EDGE (DISPLAY_WIDTH - 8)
#define NEW_START_MENU_SAFARI_BALLS_X 128
#define NEW_START_MENU_BG_OBJ_PAL_SLOT 13
#define NEW_START_MENU_ICON_OBJ_PAL_SLOT 14
#define NEW_START_MENU_ARROW_OBJ_PAL_SLOT 15
#define NEW_START_MENU_BG_TILES_SIZE 4800
#define NEW_START_MENU_BG_TILE_WIDTH 30
#define NEW_START_MENU_INFO_WIDTH 32
#define NEW_START_MENU_INFO_HEIGHT 2
#define NEW_START_MENU_INFO_TILE_BYTES (NEW_START_MENU_INFO_WIDTH * NEW_START_MENU_INFO_HEIGHT * TILE_SIZE_4BPP)
#define NEW_START_MENU_INFO_TEXT_SPRITES 4
#define NEW_START_MENU_INFO_TEXT_SPRITE_WIDTH 64
#define NEW_START_MENU_INFO_TEXT_SPRITE_TILES 32
#define NEW_START_MENU_INFO_TEXT_SPRITE_BYTES (NEW_START_MENU_INFO_TEXT_SPRITE_TILES * TILE_SIZE_4BPP)
#define NEW_START_MENU_BG_SPRITES 4
#define NEW_START_MENU_BG_SPRITE_TILES 64
#define NEW_START_MENU_BG_SPRITE_BYTES (NEW_START_MENU_BG_SPRITE_TILES * TILE_SIZE_4BPP)
#define NEW_START_MENU_BG_SPRITE_WIDTH_TILES 8
#define NEW_START_MENU_BG_SPRITE_HEIGHT_TILES 8
#define NEW_START_MENU_PALETTE_BYTES 32
#define NEW_START_MENU_ICON_FONT 1
#define NEW_START_MENU_MONEY_DIGITS 6
#define NEW_START_MENU_POKENAV_SCRIPT ((const u8 *)0x0871F5B0)
#define NEW_START_MENU_CURSOR_BOB_SPEED 8
#define NEW_START_MENU_LAST_ACTION_NONE 0xFF
#define NEW_START_MENU_LAST_ACTION_VALID 0x80

#define sReturnToNewStartMenu (*(bool8 *)0x0203E057)
#define sLastNewStartMenuAction (*(u8 *)0x0203E058)
#define gSafariBallNumber (*(u16 *)0x02039994)
#define CB2_OpenPokedexFromStartMenu_ ((void (*)(void))0x0810275D)
#define FieldClearVBlankHBlankCallbacks_ ((void (*)(void))0x080569BD)
#define FieldCB_ReturnToFieldOpenStartMenu_ ((bool8 (*)(void))0x0807E3BD)
#define FreezeObjectEvents_ ((void (*)(void))0x08068975)
#define ClearPlayerHeldMovementAndUnfreezeObjectEvents_ ((void (*)(void))0x080696C1)
#define LockPlayerFieldControls_ ((void (*)(void))0x08069941)
#define SafariZoneRetirePrompt_ ((void (*)(void))0x080A0F3D)
#define ShowPlayerTrainerCard_ ((void (*)(void (*)(void)))0x0808B699)
#define ShowTrainerCardInLink_ ((void (*)(u8, MainCallback))0x0808B701)
#define UnlockPlayerFieldControls_ ((void (*)(void))0x0806994D)
#define gDifferentSaveFile (*(bool8 *)0x02031DB0)

extern u8 gText_StartMenu_TimeBase_12Hr[];
extern u8 gText_StartMenu_AM[];
extern u8 gText_StartMenu_PM[];
extern u8 gText_StartMenu_Sunday[];
extern u8 gText_StartMenu_Monday[];
extern u8 gText_StartMenu_Tuesday[];
extern u8 gText_StartMenu_Wednesday[];
extern u8 gText_StartMenu_Thursday[];
extern u8 gText_StartMenu_Friday[];
extern u8 gText_StartMenu_Saturday[];
extern u8 gText_StartMenu_Error[];


static u8* sDayNames[] =
{
    gText_StartMenu_Sunday,
    gText_StartMenu_Monday,
    gText_StartMenu_Tuesday,
    gText_StartMenu_Wednesday,
    gText_StartMenu_Thursday,
    gText_StartMenu_Friday,
    gText_StartMenu_Saturday,
};

enum
{
    NEW_MENU_ACTION_RETIRE_SAFARI,
    NEW_MENU_ACTION_POKEDEX,
    NEW_MENU_ACTION_POKEMON,
    NEW_MENU_ACTION_BAG,
    NEW_MENU_ACTION_POKENAV,
    NEW_MENU_ACTION_PLAYER,
    NEW_MENU_ACTION_SAVE,
    NEW_MENU_ACTION_DEXNAV,
    NEW_MENU_ACTION_OPTION,
};

enum
{
    TASK_STATE_INIT,
    TASK_STATE_DRAW_INITIAL,
    TASK_STATE_HANDLE_INPUT,
    TASK_STATE_WAIT_CALLBACK,
    TASK_STATE_SAVE_CONFIRM,
    TASK_STATE_SAVE_OVERWRITE_CONFIRM,
    TASK_STATE_SAVE_DO_SAVE,
    TASK_STATE_SAVE_RESULT,
};

struct NewStartMenuState
{
    u8 windowId;
    u8 infoWindowId;
    u8 bgSpriteIds[NEW_START_MENU_BG_SPRITES];
    u8 infoBgSpriteIds[NEW_START_MENU_BG_SPRITES];
    u8 iconSpriteIds[NEW_START_MENU_VISIBLE_ICONS];
    u8 iconObjWindowSpriteIds[NEW_START_MENU_VISIBLE_ICONS];
    u8 infoTextSpriteIds[NEW_START_MENU_INFO_TEXT_SPRITES];
    u8 infoTextObjWindowSpriteIds[NEW_START_MENU_INFO_TEXT_SPRITES];
    u8 actions[NEW_START_MENU_ACTION_COUNT];
    u8 actionCount;
    u8 arrowSpriteId;
    u8 arrowObjWindowSpriteId;
    u8 cursorPos;
    u8 scrollOffset;
    u8 selectedAction;
    u8 saveResult;
    u16 delay;
    u16 savedDispcnt;
    u16 savedBldCnt;
    u16 savedBldAlpha;
    u16 savedWin0H;
    u16 savedWin0V;
    u16 savedWin1H;
    u16 savedWin1V;
    u16 savedWinIn;
    u16 savedWinOut;
    u8 savedBg0Priority;
    bool8 blendEnabled;
    bool8 objWindowEnabled;
    bool8 objPalettesSaved;
    u16 savedObjWindowDispcnt;
    u16 savedObjWindowWinOut;
    u16 savedObjPalUnfaded[3][16];
    u16 savedObjPalFaded[3][16];
    u16 savedObjPalHw[3][16];
    u8 savedObjPalTypes[3];
    u8 savedObjPalCounts[3];
    u16 savedObjPalTags[3];
    u8 infoWindowTiles[NEW_START_MENU_INFO_TILE_BYTES];
    u8 infoTextTiles[NEW_START_MENU_INFO_TILE_BYTES];
    bool8 (*callback)(void);
};

extern const u8 gText_NewStartMenuMoneyLabel[];
extern const u8 gText_NewStartMenuPokedexName[];
extern const u8 gText_NewStartMenuPokemonName[];
extern const u8 gText_NewStartMenuBagName[];
extern const u8 gText_NewStartMenuPokenavName[];
extern const u8 gText_NewStartMenuPlayerName[];
extern const u8 gText_NewStartMenuSaveName[];
extern const u8 gText_NewStartMenuDexNavName[];
extern const u8 gText_NewStartMenuOptionName[];
extern const u8 gText_NewStartMenuSavePrompt[];
extern const u8 gText_NewStartMenuSaving[];
extern const u8 gText_NewStartMenuSaved[];
extern const u8 gText_NewStartMenuSaveError[];
extern const u8 gText_MenuRetire[];
extern const u8 gText_NewStartMenuSafariSteps[];
extern const u8 gText_NewStartMenuSafariBalls[];
extern const u8 SystemScript_PartyMenuFromField[];
extern const u8 SystemScript_ItemMenuFromField[];

bool8 __attribute__((long_call)) StartMenuOptionCallback(void);
bool8 __attribute__((long_call)) StartMenuLinkModePlayerCallback(void);
void __attribute__((long_call)) SaveQuestLogData(void);
void __attribute__((long_call)) DestroySafariZoneStatsWindow(void);
void __attribute__((long_call)) ScriptContext2_Disable(void);

static void Task_NewStartMenu(u8 taskId);
static void CleanupNewStartMenuResources(struct NewStartMenuState *state);
static void HideNewStartMenuInternal(struct NewStartMenuState *state);
static void CloseNewStartMenuForFieldScript(struct NewStartMenuState *state);
static void LaunchNewStartMenuFieldScript(u8 taskId, struct NewStartMenuState *state, const u8 *script);
static void SpriteCB_NewStartMenuArrow(struct Sprite *sprite);
static bool8 FieldCB2_OpenNewStartMenuFromReturn(void);
void CB2_ReturnToFieldWithOpenMenuFromNewStartMenu(void);
static void SetUpReturnToNewStartMenu(void);
static void ArmReturnToNewStartMenuHook(void);
static void SetNewStartMenuSpritePalette(struct Sprite *sprite, u8 palSlot);
static bool8 NewStartMenuPokedexCallback(void);
static bool8 NewStartMenuPokemonCallback(void);
static bool8 NewStartMenuBagCallback(void);
static bool8 NewStartMenuPlayerCallback(void);
static bool8 NewStartMenuDexNavCallback(void);
void NewStartMenuReturnToFieldWithOpenMenuHook(void);

static const s16 sNewStartMenuIconX[NEW_START_MENU_VISIBLE_ICONS] = {21, 54, 87, 120, 153, 186, 219};
static const s16 sNewStartMenuBgX[NEW_START_MENU_BG_SPRITES] = {32, 96, 160, 224};
static const s16 sNewStartMenuInfoTextX[NEW_START_MENU_INFO_TEXT_SPRITES] = {32, 96, 160, 224};

static const u8 sNewStartMenuActionOrder[NEW_START_MENU_ACTION_COUNT] =
{
    NEW_MENU_ACTION_POKEDEX,
    NEW_MENU_ACTION_POKEMON,
    NEW_MENU_ACTION_BAG,
    NEW_MENU_ACTION_POKENAV,
    NEW_MENU_ACTION_PLAYER,
    NEW_MENU_ACTION_SAVE,
    NEW_MENU_ACTION_DEXNAV,
    NEW_MENU_ACTION_RETIRE_SAFARI,
    NEW_MENU_ACTION_OPTION,
};

static const u8 *const sNewStartMenuDisplayNames[NEW_START_MENU_ACTION_COUNT] =
{
    [NEW_MENU_ACTION_RETIRE_SAFARI] = gText_MenuRetire,
    [NEW_MENU_ACTION_POKEDEX] = gText_NewStartMenuPokedexName,
    [NEW_MENU_ACTION_POKEMON] = gText_NewStartMenuPokemonName,
    [NEW_MENU_ACTION_BAG]     = gText_NewStartMenuBagName,
    [NEW_MENU_ACTION_POKENAV] = gText_NewStartMenuPokenavName,
    [NEW_MENU_ACTION_PLAYER]  = gText_NewStartMenuPlayerName,
    [NEW_MENU_ACTION_SAVE]    = gText_NewStartMenuSaveName,
    [NEW_MENU_ACTION_DEXNAV]  = gText_NewStartMenuDexNavName,
    [NEW_MENU_ACTION_OPTION]  = gText_NewStartMenuOptionName,
};

static const struct TextColor sNewStartMenuTextColor =
{
    .bgColor = TEXT_COLOR_TRANSPARENT,
    .fgColor = TEXT_COLOR_WHITE,
    .shadowColor = TEXT_COLOR_DARK_GREY,
};

static const u16 sNewStartMenuBGPalRaw[16] =
{
    0x0000, 0x18C6, 0x7FFF, 0x294A,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
};

static const u16 sNewStartMenuIconPalRaw[16] =
{
    0x6310, 0x7BDE, 0x2948, 0x4A52,
    0x5AD6, 0x6B58, 0x019E, 0x229A,
    0x3290, 0x00DA, 0x1A14, 0x339E,
    0x00D4, 0x0200, 0x0000, 0x0000,
};

static const u16 sNewStartMenuArrowPalRaw[16] =
{
    0x5739, 0x0000, 0x7FFF, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
};

static const struct OamData sNewStartMenuArrowOam =
{
    .y = 0,
    .affineMode = ST_OAM_AFFINE_OFF,
    .objMode = ST_OAM_OBJ_NORMAL,
    .mosaic = FALSE,
    .bpp = ST_OAM_4BPP,
    .shape = SPRITE_SHAPE(16x16),
    .x = 0,
    .matrixNum = 0,
    .size = SPRITE_SIZE(16x16),
    .tileNum = 0,
    .priority = 0,
    .paletteNum = NEW_START_MENU_ARROW_OBJ_PAL_SLOT,
    .affineParam = 0,
};

static const struct OamData sNewStartMenuIconOam =
{
    .y = 0,
    .affineMode = ST_OAM_AFFINE_OFF,
    .objMode = ST_OAM_OBJ_NORMAL,
    .mosaic = FALSE,
    .bpp = ST_OAM_4BPP,
    .shape = SPRITE_SHAPE(32x32),
    .x = 0,
    .matrixNum = 0,
    .size = SPRITE_SIZE(32x32),
    .tileNum = 0,
    .priority = 0,
    .paletteNum = NEW_START_MENU_ICON_OBJ_PAL_SLOT,
    .affineParam = 0,
};

static const struct OamData sNewStartMenuBgOam =
{
    .y = 0,
    .affineMode = ST_OAM_AFFINE_OFF,
    .objMode = ST_OAM_OBJ_BLEND,
    .mosaic = FALSE,
    .bpp = ST_OAM_4BPP,
    .shape = SPRITE_SHAPE(64x64),
    .x = 0,
    .matrixNum = 0,
    .size = SPRITE_SIZE(64x64),
    .tileNum = 0,
    .priority = 1,
    .paletteNum = NEW_START_MENU_BG_OBJ_PAL_SLOT,
    .affineParam = 0,
};

static const struct OamData sNewStartMenuInfoTextOam =
{
    .y = 0,
    .affineMode = ST_OAM_AFFINE_OFF,
    .objMode = ST_OAM_OBJ_NORMAL,
    .mosaic = FALSE,
    .bpp = ST_OAM_4BPP,
    .shape = SPRITE_SHAPE(64x32),
    .x = 0,
    .matrixNum = 0,
    .size = SPRITE_SIZE(64x32),
    .tileNum = 0,
    .priority = 0,
    .paletteNum = NEW_START_MENU_ICON_OBJ_PAL_SLOT,
    .affineParam = 0,
};

static const u8 sNewStartMenuInfoTextSpriteTiles[NEW_START_MENU_INFO_TEXT_SPRITE_BYTES] = {0};
static const u8 sNewStartMenuBgSpriteTiles[NEW_START_MENU_BG_SPRITE_BYTES] = {0};

static const struct SpriteFrameImage sNewStartMenuIconImages[] =
{
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 0),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 1),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 2),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 3),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 4),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 5),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 6),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 7),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 8),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 9),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 10),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 11),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 12),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 13),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 14),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 15),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 16),
    overworld_frame(sNewStartMenuIconTiles, 4, 4, 17),
};

static const struct SpriteFrameImage sNewStartMenuArrowImages[] =
{
    overworld_frame(sNewStartMenuArrowTiles, 2, 2, 0),
};

static const struct SpriteFrameImage sNewStartMenuInfoTextImages[] =
{
    obj_frame_tiles(sNewStartMenuInfoTextSpriteTiles),
};

static const struct SpriteFrameImage sNewStartMenuBgImages[] =
{
    obj_frame_tiles(sNewStartMenuBgSpriteTiles),
};

static const union AnimCmd sNewStartMenuArrowAnim[] =
{
    ANIMCMD_FRAME(0, 0),
    ANIMCMD_END,
};

static const union AnimCmd *const sNewStartMenuArrowAnims[] =
{
    sNewStartMenuArrowAnim,
};

#define START_MENU_ICON_ANIMS(name, unselected, selected)               \
static const union AnimCmd sAnim_##name##_Unselected[] =                \
{                                                                       \
    ANIMCMD_FRAME(unselected, 0),                                       \
    ANIMCMD_END,                                                        \
};                                                                      \
static const union AnimCmd sAnim_##name##_Selected[] =                  \
{                                                                       \
    ANIMCMD_FRAME(selected, 0),                                         \
    ANIMCMD_END,                                                        \
};                                                                      \
static const union AnimCmd *const sAnims_##name[] =                     \
{                                                                       \
    sAnim_##name##_Unselected,                                          \
    sAnim_##name##_Selected,                                            \
}

START_MENU_ICON_ANIMS(Pokenav, 7, 0);
START_MENU_ICON_ANIMS(Pokedex, 8, 1);
START_MENU_ICON_ANIMS(Pokemon, 9, 2);
START_MENU_ICON_ANIMS(Bag, 10, 3);
START_MENU_ICON_ANIMS(Player, 11, 4);
START_MENU_ICON_ANIMS(Save, 12, 5);
START_MENU_ICON_ANIMS(Option, 13, 6);
START_MENU_ICON_ANIMS(Retire, 15, 14);
START_MENU_ICON_ANIMS(Dexnav, 17, 16);

#define START_MENU_ICON_TEMPLATE(name)                                  \
{                                                                       \
    .tileTag = SPRITE_INVALID_TAG,                                      \
    .paletteTag = SPRITE_INVALID_TAG,                                   \
    .oam = &sNewStartMenuIconOam,                                       \
    .anims = sAnims_##name,                                             \
    .images = sNewStartMenuIconImages,                                  \
    .affineAnims = gDummySpriteAffineAnimTable,                         \
    .callback = SpriteCallbackDummy,                                    \
}

static const struct SpriteTemplate sNewStartMenuIconTemplates[NEW_START_MENU_ACTION_COUNT] =
{
    [NEW_MENU_ACTION_RETIRE_SAFARI] = START_MENU_ICON_TEMPLATE(Retire),
    [NEW_MENU_ACTION_POKEDEX] = START_MENU_ICON_TEMPLATE(Pokedex),
    [NEW_MENU_ACTION_POKEMON] = START_MENU_ICON_TEMPLATE(Pokemon),
    [NEW_MENU_ACTION_BAG]     = START_MENU_ICON_TEMPLATE(Bag),
    [NEW_MENU_ACTION_POKENAV] = START_MENU_ICON_TEMPLATE(Pokenav),
    [NEW_MENU_ACTION_PLAYER]  = START_MENU_ICON_TEMPLATE(Player),
    [NEW_MENU_ACTION_SAVE]    = START_MENU_ICON_TEMPLATE(Save),
    [NEW_MENU_ACTION_DEXNAV]  = START_MENU_ICON_TEMPLATE(Dexnav),
    [NEW_MENU_ACTION_OPTION]  = START_MENU_ICON_TEMPLATE(Option),
};

static const struct SpriteTemplate sNewStartMenuArrowTemplate =
{
    .tileTag = SPRITE_INVALID_TAG,
    .paletteTag = SPRITE_INVALID_TAG,
    .oam = &sNewStartMenuArrowOam,
    .anims = sNewStartMenuArrowAnims,
    .images = sNewStartMenuArrowImages,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = SpriteCB_NewStartMenuArrow,
};

static const struct SpriteTemplate sNewStartMenuInfoTextTemplate =
{
    .tileTag = SPRITE_INVALID_TAG,
    .paletteTag = SPRITE_INVALID_TAG,
    .oam = &sNewStartMenuInfoTextOam,
    .anims = gDummySpriteAnimTable,
    .images = sNewStartMenuInfoTextImages,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = SpriteCallbackDummy,
};

static const struct SpriteTemplate sNewStartMenuBgTemplate =
{
    .tileTag = SPRITE_INVALID_TAG,
    .paletteTag = SPRITE_INVALID_TAG,
    .oam = &sNewStartMenuBgOam,
    .anims = gDummySpriteAnimTable,
    .images = sNewStartMenuBgImages,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = SpriteCallbackDummy,
};

static void SetTaskStatePtr(u8 taskId, struct NewStartMenuState *state)
{
    gTasks[taskId].data[14] = (u32)state;
    gTasks[taskId].data[15] = (u32)state >> 16;
}

static struct NewStartMenuState *GetTaskStatePtr(u8 taskId)
{
    return (struct NewStartMenuState *)((u16)gTasks[taskId].data[14] | ((u16)gTasks[taskId].data[15] << 16));
}

static void SpriteCB_NewStartMenuArrow(struct Sprite *sprite)
{
    static const s8 sBobOffsets[] = {0, -1, -2, -3, -2, -1, 0, 1, 2, 3, 2, 1};

    if (++sprite->data[0] >= NEW_START_MENU_CURSOR_BOB_SPEED)
    {
        sprite->data[0] = 0;
        if (++sprite->data[1] >= (s16)ARRAY_COUNT(sBobOffsets))
            sprite->data[1] = 0;
    }

    sprite->pos2.y = sBobOffsets[sprite->data[1]];

    if (sprite->data[7] < MAX_SPRITES)
        gSprites[sprite->data[7]].pos2.y = sprite->pos2.y;
}

static bool8 FieldCB2_OpenNewStartMenuFromReturn(void)
{
    sReturnToNewStartMenu = FALSE;
    ShowNewStartMenu();
    return TRUE;
}

static void SetUpReturnToNewStartMenu(void)
{
    sReturnToNewStartMenu = FALSE;
    gFieldCallback2 = FieldCB2_OpenNewStartMenuFromReturn;
}

static void ArmReturnToNewStartMenuHook(void)
{
    sReturnToNewStartMenu = TRUE;
}

void CB2_ReturnToFieldWithOpenMenuFromNewStartMenu(void)
{
    ArmReturnToNewStartMenuHook();
    CB2_ReturnToFieldWithOpenMenu();
}

void NewStartMenuBagMenuFromStartMenu(void)
{
    GoToBagMenu(BAG_OPEN_REGULAR, OPEN_BAG_LAST, CB2_ReturnToFieldWithOpenMenuFromNewStartMenu);
}

void CB2_ReturnToFieldWithNewStartMenu(void)
{
    SetUpReturnToNewStartMenu();
    CB2_ReturnToFieldFromDiploma();
}

void NewStartMenuReturnToFieldWithOpenMenuHook(void)
{
    if (sReturnToNewStartMenu)
    {
        SetUpReturnToNewStartMenu();
        CB2_ReturnToFieldFromDiploma();
    }
    else
    {
        FieldClearVBlankHBlankCallbacks_();
        gFieldCallback2 = FieldCB_ReturnToFieldOpenStartMenu_;
        CB2_ReturnToField();
    }
}

static bool8 NewStartMenuPokedexCallback(void)
{
    if (!gPaletteFade->active)
    {
        IncrementGameStat(GAME_STAT_CHECKED_POKEDEX);
        PlayRainStoppingSoundEffect();
        CleanupOverworldWindowsAndTilemaps();
        ArmReturnToNewStartMenuHook();
        SetMainCallback2(CB2_OpenPokedexFromStartMenu_);
        return TRUE;
    }

    return FALSE;
}

static bool8 NewStartMenuPokemonCallback(void)
{
    if (!gPaletteFade->active)
    {
        PlayRainStoppingSoundEffect();
        CleanupOverworldWindowsAndTilemaps();
        FreezeObjectEvents_();
        ScriptContext2_Enable();
        PrepareOverworldReturn();
        InitPartyMenu(PARTY_MENU_TYPE_FIELD, PARTY_LAYOUT_SINGLE, PARTY_ACTION_CHOOSE_MON, FALSE, PARTY_MSG_CHOOSE_MON, Task_HandleChooseMonInput, CB2_ReturnToFieldWithNewStartMenu);
        return TRUE;
    }

    return FALSE;
}

static bool8 NewStartMenuBagCallback(void)
{
    if (!gPaletteFade->active)
    {
        PlayRainStoppingSoundEffect();
        CleanupOverworldWindowsAndTilemaps();
        GoToBagMenu(BAG_OPEN_REGULAR, OPEN_BAG_LAST, CB2_ReturnToFieldWithOpenMenuFromNewStartMenu);
        return TRUE;
    }

    return FALSE;
}

static bool8 NewStartMenuPlayerCallback(void)
{
    if (!gPaletteFade->active)
    {
        PlayRainStoppingSoundEffect();
        CleanupOverworldWindowsAndTilemaps();
        if (IsUpdateLinkStateCBActive())
            ShowTrainerCardInLink_(GetMultiplayerId(), CB2_ReturnToFieldWithNewStartMenu);
        else
            ShowPlayerTrainerCard_(CB2_ReturnToFieldWithNewStartMenu);
        return TRUE;
    }

    return FALSE;
}

static bool8 NewStartMenuDexNavCallback(void)
{
    ArmReturnToNewStartMenuHook();
    return StartMenuDexNavCallback();
}

static bool8 ShouldShowNewStartMenuAction(u8 action)
{
    bool8 isSafariZone = GetSafariZoneFlag();

    switch (action)
    {
    case NEW_MENU_ACTION_RETIRE_SAFARI:
        return isSafariZone;
    case NEW_MENU_ACTION_POKEDEX:
        return FlagGet(FLAG_SYS_POKEDEX_GET);
    case NEW_MENU_ACTION_POKEMON:
#ifdef FLAG_SYS_POKEMON_GET
        return FlagGet(FLAG_SYS_POKEMON_GET);
#else
        return !isSafariZone;
#endif
    case NEW_MENU_ACTION_BAG:
        if (isSafariZone)
        {
#ifdef FLAG_SYS_BAG_GET
            return FlagGet(FLAG_SYS_BAG_GET);
#else
            return TRUE;
#endif
        }
#ifdef FLAG_SYS_BAG_HIDE
        return !FlagGet(FLAG_SYS_BAG_HIDE);
#else
        return TRUE;
#endif
    case NEW_MENU_ACTION_POKENAV:
        return !isSafariZone && FlagGet(FLAG_POKENAV);
    case NEW_MENU_ACTION_PLAYER:
        if (isSafariZone)
        {
#ifdef FLAG_SYS_PLAYER_GET
            return FlagGet(FLAG_SYS_PLAYER_GET);
#else
            return TRUE;
#endif
        }
#ifdef FLAG_SYS_PLAYER_HIDE
        return !FlagGet(FLAG_SYS_PLAYER_HIDE);
#else
        return TRUE;
#endif
    case NEW_MENU_ACTION_SAVE:
        if (isSafariZone)
            return FALSE;
#ifdef FLAG_SYS_SAVE_HIDE
        return !FlagGet(FLAG_SYS_SAVE_HIDE);
#else
        return TRUE;
#endif
    case NEW_MENU_ACTION_DEXNAV:
        if (isSafariZone)
            return FALSE;
#ifdef FLAG_SYS_DEXNAV
        return FlagGet(FLAG_SYS_DEXNAV) && FlagGet(FLAG_SYS_POKEDEX_GET);
#else
        return FALSE;
#endif
    case NEW_MENU_ACTION_OPTION:
        return TRUE;
    default:
        return FALSE;
    }
}

static void AddNewStartMenuAction(struct NewStartMenuState *state, u8 action)
{
    if (state->actionCount < NEW_START_MENU_ACTION_COUNT)
        state->actions[state->actionCount++] = action;
}

static void BuildNewStartMenuActions(struct NewStartMenuState *state)
{
    u32 i;
    u8 savedAction = (sLastNewStartMenuAction & NEW_START_MENU_LAST_ACTION_VALID)
                   ? (sLastNewStartMenuAction & ~NEW_START_MENU_LAST_ACTION_VALID)
                   : NEW_START_MENU_LAST_ACTION_NONE;

    state->actionCount = 0;

    for (i = 0; i < ARRAY_COUNT(sNewStartMenuActionOrder); i++)
    {
        u8 action = sNewStartMenuActionOrder[i];

        if (ShouldShowNewStartMenuAction(action))
            AddNewStartMenuAction(state, action);
    }

    if (state->actionCount == 0)
        AddNewStartMenuAction(state, NEW_MENU_ACTION_OPTION);

    state->cursorPos = 0;
    for (i = 0; savedAction != NEW_START_MENU_LAST_ACTION_NONE && i < state->actionCount; i++)
    {
        if (state->actions[i] == savedAction)
        {
            state->cursorPos = i;
            break;
        }
    }

    if (state->actionCount > NEW_START_MENU_VISIBLE_ICONS && state->cursorPos == state->actionCount - 1)
        state->scrollOffset = state->cursorPos;
    else
        state->scrollOffset = 0;

    state->selectedAction = state->actions[state->cursorPos];
}

static void InitNewStartMenuState(struct NewStartMenuState *state)
{
    u32 i;
    const u8 slots[3] = {NEW_START_MENU_BG_OBJ_PAL_SLOT, NEW_START_MENU_ICON_OBJ_PAL_SLOT, NEW_START_MENU_ARROW_OBJ_PAL_SLOT};

    state->windowId = NEW_START_MENU_WINDOW_NONE;
    state->infoWindowId = NEW_START_MENU_WINDOW_NONE;
    state->arrowSpriteId = NEW_START_MENU_SPRITE_NONE;
    state->arrowObjWindowSpriteId = NEW_START_MENU_SPRITE_NONE;
    state->cursorPos = 0;
    state->scrollOffset = 0;
    state->selectedAction = NEW_MENU_ACTION_OPTION;
    state->actionCount = 0;
    state->saveResult = SAVE_STATUS_ERROR;
    state->delay = 0;
    state->savedDispcnt = 0;
    state->savedBldCnt = 0;
    state->savedBldAlpha = 0;
    state->savedWin0H = 0;
    state->savedWin0V = 0;
    state->savedWin1H = 0;
    state->savedWin1V = 0;
    state->savedWinIn = 0;
    state->savedWinOut = 0;
    state->savedBg0Priority = 0;
    state->blendEnabled = FALSE;
    state->objWindowEnabled = FALSE;
    state->objPalettesSaved = FALSE;
    state->savedObjWindowDispcnt = 0;
    state->savedObjWindowWinOut = 0;
    state->callback = NULL;

    for (i = 0; i < NEW_START_MENU_BG_SPRITES; i++)
    {
        state->bgSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        state->infoBgSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
    }

    for (i = 0; i < NEW_START_MENU_VISIBLE_ICONS; i++)
    {
        state->iconSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        state->iconObjWindowSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
    }

    for (i = 0; i < NEW_START_MENU_INFO_TEXT_SPRITES; i++)
    {
        state->infoTextSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        state->infoTextObjWindowSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
    }

    for (i = 0; i < 3; i++)
    {
        state->savedObjPalTypes[i] = GetPalRefType(slots[i]);
    }
    
    BuildNewStartMenuActions(state);
}

static u8 GetVisibleIconCount(const struct NewStartMenuState *state)
{
    u8 remaining = state->actionCount - state->scrollOffset;

    if (remaining > NEW_START_MENU_VISIBLE_ICONS)
        return NEW_START_MENU_VISIBLE_ICONS;
    else
        return remaining;
}

static void UpdateNewStartMenuScroll(struct NewStartMenuState *state)
{
    if (state->actionCount <= NEW_START_MENU_VISIBLE_ICONS)
    {
        state->scrollOffset = 0;
        return;
    }

    if (state->cursorPos == state->actionCount - 1)
        state->scrollOffset = state->cursorPos;
    else
        state->scrollOffset = 0;
}

static bool8 IsNewStartMenuInDarkCave(void)
{
    return Overworld_GetFlashLevel() != 0;
}

static void SetNewStartMenuSpritePalette(struct Sprite *sprite, u8 palSlot)
{
    sprite->oam.paletteNum = palSlot;
    PalRefIncreaseCount(palSlot);
    // Re-assert the "don't DNS tint" marking: destroying a menu sprite decrements
    // the slot's count, and when it reaches 0 PalRefDecreaseCount clears the type.
    // Without this the menu's icons/cursor would get the DNS tint after a redraw.
    SetPalRefType(palSlot, PalTypeOther);
}

static void EnableNewStartMenuObjWindow(struct NewStartMenuState *state)
{
    if (state->objWindowEnabled)
        return;

    if (!IsNewStartMenuInDarkCave())
        return;

    state->savedObjWindowDispcnt = GetGpuReg(REG_OFFSET_DISPCNT);
    state->savedObjWindowWinOut = GetGpuReg(REG_OFFSET_WINOUT);
    SetGpuRegBits(REG_OFFSET_DISPCNT, DISPCNT_OBJWIN_ON);
    SetGpuRegBits(REG_OFFSET_WINOUT, WINOUT_WINOBJ_OBJ);
    state->objWindowEnabled = TRUE;
}

static void DisableNewStartMenuObjWindow(struct NewStartMenuState *state)
{
    if (!state->objWindowEnabled)
        return;

    SetGpuReg(REG_OFFSET_DISPCNT, state->savedObjWindowDispcnt);
    SetGpuReg(REG_OFFSET_WINOUT, state->savedObjWindowWinOut);
    state->objWindowEnabled = FALSE;
}

static void DestroyNewStartMenuIconSprites(struct NewStartMenuState *state)
{
    u32 i;

    for (i = 0; i < NEW_START_MENU_VISIBLE_ICONS; i++)
    {
        if (state->iconObjWindowSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->iconObjWindowSpriteIds[i]]);
            DestroySprite(&gSprites[state->iconObjWindowSpriteIds[i]]);
            state->iconObjWindowSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }

        if (state->iconSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->iconSpriteIds[i]]);
            DestroySprite(&gSprites[state->iconSpriteIds[i]]);
            state->iconSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }
    }
}

static void DestroyNewStartMenuArrowSprite(struct NewStartMenuState *state)
{
    if (state->arrowObjWindowSpriteId < MAX_SPRITES)
    {
        FreeSpriteTiles(&gSprites[state->arrowObjWindowSpriteId]);
        DestroySprite(&gSprites[state->arrowObjWindowSpriteId]);
        state->arrowObjWindowSpriteId = NEW_START_MENU_SPRITE_NONE;
    }

    if (state->arrowSpriteId < MAX_SPRITES)
    {
        FreeSpriteTiles(&gSprites[state->arrowSpriteId]);
        DestroySprite(&gSprites[state->arrowSpriteId]);
        state->arrowSpriteId = NEW_START_MENU_SPRITE_NONE;
    }
}

static void DestroyNewStartMenuBgSprites(struct NewStartMenuState *state)
{
    u32 i;

    for (i = 0; i < NEW_START_MENU_BG_SPRITES; i++)
    {
        if (state->bgSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->bgSpriteIds[i]]);
            DestroySprite(&gSprites[state->bgSpriteIds[i]]);
            state->bgSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }

        if (state->infoBgSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->infoBgSpriteIds[i]]);
            DestroySprite(&gSprites[state->infoBgSpriteIds[i]]);
            state->infoBgSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }
    }
}

static void DestroyNewStartMenuInfoTextSprites(struct NewStartMenuState *state)
{
    u32 i;

    for (i = 0; i < NEW_START_MENU_INFO_TEXT_SPRITES; i++)
    {
        if (state->infoTextObjWindowSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->infoTextObjWindowSpriteIds[i]]);
            DestroySprite(&gSprites[state->infoTextObjWindowSpriteIds[i]]);
            state->infoTextObjWindowSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }

        if (state->infoTextSpriteIds[i] < MAX_SPRITES)
        {
            FreeSpriteTiles(&gSprites[state->infoTextSpriteIds[i]]);
            DestroySprite(&gSprites[state->infoTextSpriteIds[i]]);
            state->infoTextSpriteIds[i] = NEW_START_MENU_SPRITE_NONE;
        }
    }
}

static void CopyNewStartMenuBgTilesToSprite(u8 spriteId, u8 srcTileY, u8 rowsToCopy, u8 spritePart)
{
    u32 row;
    u32 objRowStride;
    u8 *dst;

    if (spriteId >= MAX_SPRITES)
        return;

    dst = (u8 *)(OBJ_VRAM0 + gSprites[spriteId].oam.tileNum * TILE_SIZE_4BPP);
    CpuFill16(0, dst, NEW_START_MENU_BG_SPRITE_BYTES);
    objRowStride = NEW_START_MENU_BG_SPRITE_WIDTH_TILES;

    for (row = 0; row < NEW_START_MENU_BG_SPRITE_HEIGHT_TILES; row++)
    {
        u32 srcRow = srcTileY + row;

        if (row < rowsToCopy && srcRow < 5)
        {
            u32 srcTileX = spritePart * NEW_START_MENU_BG_SPRITE_WIDTH_TILES;
            u32 tilesToCopy = NEW_START_MENU_BG_SPRITE_WIDTH_TILES;

            if (srcTileX < NEW_START_MENU_BG_TILE_WIDTH)
            {
                if (srcTileX + tilesToCopy > NEW_START_MENU_BG_TILE_WIDTH)
                    tilesToCopy = NEW_START_MENU_BG_TILE_WIDTH - srcTileX;

                CpuCopy16(
                    &sNewStartMenuBGTiles[(srcRow * NEW_START_MENU_BG_TILE_WIDTH + srcTileX) * TILE_SIZE_4BPP],
                    dst + row * objRowStride * TILE_SIZE_4BPP,
                    tilesToCopy * TILE_SIZE_4BPP);
            }
        }
    }
}

static void CreateNewStartMenuBgSprites(struct NewStartMenuState *state)
{
    u32 i;

    if (IsNewStartMenuInDarkCave())
        return;

    for (i = 0; i < NEW_START_MENU_BG_SPRITES; i++)
    {
        u8 spriteId = CreateSprite(&sNewStartMenuBgTemplate, sNewStartMenuBgX[i], NEW_START_MENU_BG_Y, 2);

        if (spriteId == MAX_SPRITES)
        {
            DestroyNewStartMenuBgSprites(state);
            return;
        }

        state->bgSpriteIds[i] = spriteId;
        SetNewStartMenuSpritePalette(&gSprites[spriteId], NEW_START_MENU_BG_OBJ_PAL_SLOT);
        CopyNewStartMenuBgTilesToSprite(spriteId, 0, 5, i);
    }

    for (i = 0; i < NEW_START_MENU_BG_SPRITES; i++)
    {
        u8 spriteId = CreateSprite(&sNewStartMenuBgTemplate, sNewStartMenuBgX[i], 32, 2);

        if (spriteId == MAX_SPRITES)
        {
            DestroyNewStartMenuBgSprites(state);
            return;
        }

        state->infoBgSpriteIds[i] = spriteId;
        SetNewStartMenuSpritePalette(&gSprites[spriteId], NEW_START_MENU_BG_OBJ_PAL_SLOT);
        CopyNewStartMenuBgTilesToSprite(spriteId, 0, NEW_START_MENU_INFO_HEIGHT, i);
    }
}

static void ClearNewStartMenuInfoTextSprites(struct NewStartMenuState *state)
{
    u32 i;

    CpuFill16(0, state->infoTextTiles, sizeof(state->infoTextTiles));

    for (i = 0; i < NEW_START_MENU_INFO_TEXT_SPRITES; i++)
    {
        if (state->infoTextSpriteIds[i] < MAX_SPRITES)
        {
            u8 *tileData = (u8 *)(OBJ_VRAM0 + gSprites[state->infoTextSpriteIds[i]].oam.tileNum * TILE_SIZE_4BPP);
            CpuFill16(0, tileData, NEW_START_MENU_INFO_TEXT_SPRITE_BYTES);
        }

        if (state->infoTextObjWindowSpriteIds[i] < MAX_SPRITES)
        {
            u8 *tileData = (u8 *)(OBJ_VRAM0 + gSprites[state->infoTextObjWindowSpriteIds[i]].oam.tileNum * TILE_SIZE_4BPP);
            CpuFill16(0, tileData, NEW_START_MENU_INFO_TEXT_SPRITE_BYTES);
        }
    }
}

static void CopyNewStartMenuTextWindowToSpritesFrom(struct NewStartMenuState *state, u8 startSprite)
{
    u32 i;
    u32 row;
    u8 *src;

    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return;

    src = (u8 *)GetWindowAttribute(state->infoWindowId, WINDOW_TILE_DATA);

    for (i = startSprite; i < NEW_START_MENU_INFO_TEXT_SPRITES; i++)
    {
        if (state->infoTextSpriteIds[i] < MAX_SPRITES)
        {
            u8 *dst = (u8 *)(OBJ_VRAM0 + gSprites[state->infoTextSpriteIds[i]].oam.tileNum * TILE_SIZE_4BPP);
            u8 *dstObjWindow = NULL;

            if (state->infoTextObjWindowSpriteIds[i] < MAX_SPRITES)
                dstObjWindow = (u8 *)(OBJ_VRAM0 + gSprites[state->infoTextObjWindowSpriteIds[i]].oam.tileNum * TILE_SIZE_4BPP);

            for (row = 0; row < NEW_START_MENU_INFO_HEIGHT; row++)
            {
                u32 srcTileX = i * 8;
                u32 tilesToCopy = 8;

                if (srcTileX < NEW_START_MENU_INFO_WIDTH)
                {
                    if (srcTileX + tilesToCopy > NEW_START_MENU_INFO_WIDTH)
                        tilesToCopy = NEW_START_MENU_INFO_WIDTH - srcTileX;

                    CpuCopy16(
                        src + (row * NEW_START_MENU_INFO_WIDTH + srcTileX) * TILE_SIZE_4BPP,
                        dst + row * 8 * TILE_SIZE_4BPP,
                        tilesToCopy * TILE_SIZE_4BPP);

                    if (dstObjWindow != NULL)
                    {
                        CpuCopy16(
                            src + (row * NEW_START_MENU_INFO_WIDTH + srcTileX) * TILE_SIZE_4BPP,
                            dstObjWindow + row * 8 * TILE_SIZE_4BPP,
                            tilesToCopy * TILE_SIZE_4BPP);
                    }
                }
            }
        }
    }
}

static void PrintNewStartMenuInfoText(struct NewStartMenuState *state, s16 x, const u8 *str)
{
    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return;

    if (x < 0)
        x = 0;

    if (x >= NEW_START_MENU_INFO_WIDTH * 8)
        return;

    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));
    CopyToWindowPixelBuffer(state->infoWindowId, state->infoTextTiles, sizeof(state->infoTextTiles), 0);
    WindowPrint(
        state->infoWindowId,
        NEW_START_MENU_ICON_FONT,
        x,
        NEW_START_MENU_INFO_TEXT_TOP,
        &sNewStartMenuTextColor,
        0,
        str);
    CpuCopy16(
        (const void *)GetWindowAttribute(state->infoWindowId, WINDOW_TILE_DATA),
        state->infoTextTiles,
        sizeof(state->infoTextTiles));
    CopyNewStartMenuTextWindowToSpritesFrom(state, 0);
}

static u8 GetNewStartMenuWindowPixel(const u8 *tileData, u32 widthTiles, u32 x, u32 y)
{
    const u8 *tile;
    u8 pixels;

    tile = tileData + (((y / 8) * widthTiles) + (x / 8)) * TILE_SIZE_4BPP;
    pixels = tile[(y % 8) * 4 + ((x % 8) / 2)];

    if (x & 1)
        return pixels >> 4;
    else
        return pixels & 0xF;
}

static s16 GetNewStartMenuRenderedRightAlignX(struct NewStartMenuState *state, const u8 *str, s16 rightEdge)
{
    const u8 *tileData;
    s32 x;
    s32 y;
    s16 width = 0;

    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return 0;

    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));
    WindowPrint(
        state->infoWindowId,
        NEW_START_MENU_ICON_FONT,
        0,
        NEW_START_MENU_INFO_TEXT_TOP,
        &sNewStartMenuTextColor,
        0,
        str);

    tileData = (const u8 *)GetWindowAttribute(state->infoWindowId, WINDOW_TILE_DATA);
    for (x = NEW_START_MENU_INFO_WIDTH * 8 - 1; x >= 0; x--)
    {
        for (y = 0; y < NEW_START_MENU_INFO_HEIGHT * 8; y++)
        {
            if (GetNewStartMenuWindowPixel(tileData, NEW_START_MENU_INFO_WIDTH, x, y) != TEXT_COLOR_TRANSPARENT)
            {
                width = x + 1;
                x = -1;
                break;
            }
        }
    }

    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));
    return rightEdge - width;
}

static void CreateNewStartMenuInfoTextSprites(struct NewStartMenuState *state)
{
    u32 i;

    for (i = 0; i < NEW_START_MENU_INFO_TEXT_SPRITES; i++)
    {
        u8 spriteId = CreateSprite(&sNewStartMenuInfoTextTemplate, sNewStartMenuInfoTextX[i], NEW_START_MENU_INFO_TEXT_Y, 0);
        u8 objWindowSpriteId;

        if (spriteId == MAX_SPRITES)
        {
            DestroyNewStartMenuInfoTextSprites(state);
            return;
        }

        state->infoTextSpriteIds[i] = spriteId;
        SetNewStartMenuSpritePalette(&gSprites[spriteId], NEW_START_MENU_ICON_OBJ_PAL_SLOT);

        if (IsNewStartMenuInDarkCave())
        {
            objWindowSpriteId = CreateSprite(&sNewStartMenuInfoTextTemplate, sNewStartMenuInfoTextX[i], NEW_START_MENU_INFO_TEXT_Y, 0);
            if (objWindowSpriteId == MAX_SPRITES)
            {
                DestroyNewStartMenuInfoTextSprites(state);
                return;
            }

            state->infoTextObjWindowSpriteIds[i] = objWindowSpriteId;
            SetNewStartMenuSpritePalette(&gSprites[objWindowSpriteId], NEW_START_MENU_ICON_OBJ_PAL_SLOT);
            gSprites[objWindowSpriteId].oam.objMode = ST_OAM_OBJ_WINDOW;
        }
    }

    ClearNewStartMenuInfoTextSprites(state);
}

static void BackupNewStartMenuObjPalettes(struct NewStartMenuState *state)
{
    u32 i;
    const u8 slots[3] = {NEW_START_MENU_BG_OBJ_PAL_SLOT, NEW_START_MENU_ICON_OBJ_PAL_SLOT, NEW_START_MENU_ARROW_OBJ_PAL_SLOT};

    if (state->objPalettesSaved)
        return;

    for (i = 0; i < ARRAY_COUNT(slots); i++)
    {
        u16 offset = slots[i] * 16;

        CpuCopy16(&gPlttBufferUnfaded2[offset], state->savedObjPalUnfaded[i], NEW_START_MENU_PALETTE_BYTES);
        CpuCopy16(&gPlttBufferFaded2[offset], state->savedObjPalFaded[i], NEW_START_MENU_PALETTE_BYTES);
        CpuCopy16((void *)(OBJ_PLTT + offset * sizeof(u16)), state->savedObjPalHw[i], NEW_START_MENU_PALETTE_BYTES);
        state->savedObjPalTypes[i] = GetPalRefType(slots[i]);
        state->savedObjPalCounts[i] = GetPalRefCount(slots[i]);
        state->savedObjPalTags[i] = GetPalRefTag(slots[i]);
    }

    state->objPalettesSaved = TRUE;
}

static void RestoreNewStartMenuObjPalettes(struct NewStartMenuState *state)
{
    u32 i;
    const u8 slots[3] = {NEW_START_MENU_BG_OBJ_PAL_SLOT, NEW_START_MENU_ICON_OBJ_PAL_SLOT, NEW_START_MENU_ARROW_OBJ_PAL_SLOT};

    if (!state->objPalettesSaved)
        return;

    for (i = 0; i < ARRAY_COUNT(slots); i++)
    {
        u16 offset = slots[i] * 16;

        CpuCopy16(state->savedObjPalUnfaded[i], &gPlttBufferUnfaded2[offset], NEW_START_MENU_PALETTE_BYTES);
        CpuCopy16(state->savedObjPalFaded[i], &gPlttBufferFaded2[offset], NEW_START_MENU_PALETTE_BYTES);
        CpuCopy16(state->savedObjPalHw[i], (void *)(OBJ_PLTT + offset * sizeof(u16)), NEW_START_MENU_PALETTE_BYTES);
        SetPalRefType(slots[i], state->savedObjPalTypes[i]);
        SetPalRefCount(slots[i], state->savedObjPalCounts[i]);
        SetPalRefTag(slots[i], state->savedObjPalTags[i]);
    }

    state->objPalettesSaved = FALSE;
}

static void LoadNewStartMenuSpritePalettes(struct NewStartMenuState *state)
{
    u16 bgOffset = NEW_START_MENU_BG_OBJ_PAL_SLOT * 16;
    u16 iconOffset = NEW_START_MENU_ICON_OBJ_PAL_SLOT * 16;
    u16 arrowOffset = NEW_START_MENU_ARROW_OBJ_PAL_SLOT * 16;
    u8 i;
    const u8 slots[3] = {NEW_START_MENU_BG_OBJ_PAL_SLOT, NEW_START_MENU_ICON_OBJ_PAL_SLOT, NEW_START_MENU_ARROW_OBJ_PAL_SLOT};

    BackupNewStartMenuObjPalettes(state);

    //Mark the menu's palette slots so the DNS doesn't fade the menu UI, and so dynamic
    //overworld sprites (e.g. the tall grass effect) don't get assigned these slots.
    for (i = 0; i < ARRAY_COUNT(slots); i++)
        SetPalRefType(slots[i], PalTypeOther);

    CpuCopy16(sNewStartMenuBGPalRaw, &gPlttBufferUnfaded2[bgOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuBGPalRaw, &gPlttBufferFaded2[bgOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuBGPalRaw, (void *)(OBJ_PLTT + bgOffset * sizeof(u16)), NEW_START_MENU_PALETTE_BYTES);

    CpuCopy16(sNewStartMenuIconPalRaw, &gPlttBufferUnfaded2[iconOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuIconPalRaw, &gPlttBufferFaded2[iconOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuIconPalRaw, (void *)(OBJ_PLTT + iconOffset * sizeof(u16)), NEW_START_MENU_PALETTE_BYTES);

    CpuCopy16(sNewStartMenuArrowPalRaw, &gPlttBufferUnfaded2[arrowOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuArrowPalRaw, &gPlttBufferFaded2[arrowOffset], NEW_START_MENU_PALETTE_BYTES);
    CpuCopy16(sNewStartMenuArrowPalRaw, (void *)(OBJ_PLTT + arrowOffset * sizeof(u16)), NEW_START_MENU_PALETTE_BYTES);
}

static void PrepareNewStartMenuInfoTiles(struct NewStartMenuState *state)
{
    u32 row;
    u32 tilesToCopy = NEW_START_MENU_BG_TILE_WIDTH;

    CpuFill16(0, state->infoWindowTiles, sizeof(state->infoWindowTiles));

    if (tilesToCopy > NEW_START_MENU_INFO_WIDTH)
        tilesToCopy = NEW_START_MENU_INFO_WIDTH;

    for (row = 0; row < NEW_START_MENU_INFO_HEIGHT; row++)
    {
        CpuCopy16(
            &sNewStartMenuBGTiles[row * NEW_START_MENU_BG_TILE_WIDTH * TILE_SIZE_4BPP],
            &state->infoWindowTiles[row * NEW_START_MENU_INFO_WIDTH * TILE_SIZE_4BPP],
            tilesToCopy * TILE_SIZE_4BPP);
    }
}

static void ResetNewStartMenuInfoBg(struct NewStartMenuState *state)
{
    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return;

    CopyToWindowPixelBuffer(state->infoWindowId, state->infoWindowTiles, sizeof(state->infoWindowTiles), 0);
}

static void LoadNewStartMenuBg(struct NewStartMenuState *state)
{
    struct WindowTemplate template;

    PrepareNewStartMenuInfoTiles(state);
    template = SetWindowTemplateFields(0, 0, 20, NEW_START_MENU_INFO_WIDTH, 2, 0, NEW_START_MENU_INFO_BASE_BLOCK);
    state->infoWindowId = AddWindow(&template);
    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));
}

static void EnableNewStartMenuBlend(struct NewStartMenuState *state)
{
    if (state->blendEnabled)
        return;

    if (Overworld_GetFlashLevel() != 0)
        return;

    state->savedDispcnt = GetGpuReg(REG_OFFSET_DISPCNT);
    state->savedBldCnt = GetGpuReg(REG_OFFSET_BLDCNT);
    state->savedBldAlpha = GetGpuReg(REG_OFFSET_BLDALPHA);
    state->savedWin0H = GetGpuReg(REG_OFFSET_WIN0H);
    state->savedWin0V = GetGpuReg(REG_OFFSET_WIN0V);
    state->savedWin1H = GetGpuReg(REG_OFFSET_WIN1H);
    state->savedWin1V = GetGpuReg(REG_OFFSET_WIN1V);
    state->savedWinIn = GetGpuReg(REG_OFFSET_WININ);
    state->savedWinOut = GetGpuReg(REG_OFFSET_WINOUT);
    state->savedBg0Priority = GetBgAttribute(0, BG_ATTR_PRIORITY);

    SetBgAttribute(0, BG_ATTR_PRIORITY, 0);
    SetGpuReg(REG_OFFSET_WIN0H, WIN_RANGE(0, DISPLAY_WIDTH));
    SetGpuReg(REG_OFFSET_WIN0V, WIN_RANGE(0, NEW_START_MENU_INFO_HEIGHT * 8));
    SetGpuReg(REG_OFFSET_WIN1H, WIN_RANGE(0, DISPLAY_WIDTH));
    SetGpuReg(REG_OFFSET_WIN1V, WIN_RANGE(NEW_START_MENU_ICON_Y - 20, DISPLAY_HEIGHT));
    SetGpuReg(REG_OFFSET_WININ,
        WININ_WIN0_BG_ALL | WININ_WIN0_OBJ | WININ_WIN0_CLR
        | WININ_WIN1_BG_ALL | WININ_WIN1_OBJ | WININ_WIN1_CLR);
    SetGpuReg(REG_OFFSET_WINOUT,
        WINOUT_WIN01_BG_ALL | WINOUT_WIN01_OBJ
        | WINOUT_WINOBJ_BG_ALL | WINOUT_WINOBJ_OBJ);
    SetGpuReg(REG_OFFSET_DISPCNT, state->savedDispcnt | DISPCNT_OBJ_1D_MAP | DISPCNT_WIN0_ON | DISPCNT_WIN1_ON);

    SetGpuReg(REG_OFFSET_BLDCNT,
        BLDCNT_EFFECT_BLEND
        | BLDCNT_TGT2_BG0
        | BLDCNT_TGT2_BG1
        | BLDCNT_TGT2_BG2
        | BLDCNT_TGT2_BG3
        | BLDCNT_TGT2_BD);
    SetGpuReg(REG_OFFSET_BLDALPHA, BLDALPHA_BLEND(8, 8));
    state->blendEnabled = TRUE;
}

static void DisableNewStartMenuBlend(struct NewStartMenuState *state)
{
    if (!state->blendEnabled)
        return;

    SetGpuReg(REG_OFFSET_BLDCNT, state->savedBldCnt);
    SetGpuReg(REG_OFFSET_BLDALPHA, state->savedBldAlpha);
    SetGpuReg(REG_OFFSET_WIN0H, state->savedWin0H);
    SetGpuReg(REG_OFFSET_WIN0V, state->savedWin0V);
    SetGpuReg(REG_OFFSET_WIN1H, state->savedWin1H);
    SetGpuReg(REG_OFFSET_WIN1V, state->savedWin1V);
    SetGpuReg(REG_OFFSET_WININ, state->savedWinIn);
    SetGpuReg(REG_OFFSET_WINOUT, state->savedWinOut);
    SetGpuReg(REG_OFFSET_DISPCNT, state->savedDispcnt);
    SetBgAttribute(0, BG_ATTR_PRIORITY, state->savedBg0Priority);
    state->blendEnabled = FALSE;
}

static void DrawNewStartMenuMessage(struct NewStartMenuState *state, const u8 *text)
{
    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return;

    ResetNewStartMenuInfoBg(state);
    CopyWindowToVram(state->infoWindowId, COPYWIN_GFX);
    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));

    ClearNewStartMenuInfoTextSprites(state);
    PrintNewStartMenuInfoText(state, 4, text);
    ResetNewStartMenuInfoBg(state);
}

static void DrawNewStartMenuInfo(struct NewStartMenuState *state)
{
    u8 action;
    const u8 *name;
    s16 x;

    if (state->infoWindowId == NEW_START_MENU_WINDOW_NONE)
        return;

    action = state->actions[state->cursorPos];

    ResetNewStartMenuInfoBg(state);
    CopyWindowToVram(state->infoWindowId, COPYWIN_GFX);
    FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));

    ClearNewStartMenuInfoTextSprites(state);
    if (GetSafariZoneFlag())
    {
        ConvertIntToDecimalStringN(gStringVar1, gSafariSteps, STR_CONV_MODE_RIGHT_ALIGN, 3);
        StringExpandPlaceholders(gStringVar4, gText_NewStartMenuSafariSteps);
        PrintNewStartMenuInfoText(state, 4, gStringVar4);

        ConvertIntToDecimalStringN(gStringVar1, gSafariBallNumber, STR_CONV_MODE_RIGHT_ALIGN, 2);
        StringExpandPlaceholders(gStringVar4, gText_NewStartMenuSafariBalls);
        PrintNewStartMenuInfoText(state, NEW_START_MENU_SAFARI_BALLS_X, gStringVar4);
    }
    else
    {
        //原来显示金钱
        //ConvertIntToDecimalStringN(gStringVar1, VarGet(VAR_0x40E0), STR_CONV_MODE_LEFT_ALIGN, NEW_START_MENU_MONEY_DIGITS);
        //StringCopy(gStringVar4, gText_NewStartMenuMoneyLabel);
        //StringAppend(gStringVar4, gStringVar1);
        //PrintNewStartMenuInfoText(state, 4, gStringVar4);
        // 显示当前时间（替代金钱）
        const u8* amPMString = (gClock.hour >= 12) ? gText_StartMenu_PM : gText_StartMenu_AM;

        // 格式化小时（12小时制）
        ConvertIntToDecimalStringN(gStringVar1,
            (gClock.hour == 0) ? 12 : (gClock.hour > 12) ? gClock.hour - 12 : gClock.hour,
            STR_CONV_MODE_RIGHT_ALIGN, 2);

        // 格式化分钟（补零）
        ConvertIntToDecimalStringN(gStringVar2, gClock.minute, STR_CONV_MODE_LEADING_ZEROS, 2);

        // 构建 AM/PM
        StringCopy(gStringVar3, amPMString);

        // 获取星期名称
        StringCopy(gStringVarC,
            (gClock.dayOfWeek >= 7) ? gText_StartMenu_Error : sDayNames[gClock.dayOfWeek]);

        // 组合完整时间字符串
        StringExpandPlaceholders(gStringVar4, gText_StartMenu_TimeBase_12Hr);

        // 打印时间
        PrintNewStartMenuInfoText(state, 4, gStringVar4);
    }

    StringExpandPlaceholders(gStringVar2, sNewStartMenuDisplayNames[action]);
    name = gStringVar2;
    x = GetNewStartMenuRenderedRightAlignX(state, name, NEW_START_MENU_INFO_RIGHT_EDGE);
    if (x < 0)
        x = 0;

    PrintNewStartMenuInfoText(state, x, name);
    ResetNewStartMenuInfoBg(state);
}

static void RedrawNewStartMenu(struct NewStartMenuState *state)
{
    u32 slot;
    u8 visibleCount;
    u8 selectedSlot = NEW_START_MENU_SPRITE_NONE;
    bool8 isSingleIconPage;

    DestroyNewStartMenuIconSprites(state);
    DestroyNewStartMenuArrowSprite(state);

    visibleCount = GetVisibleIconCount(state);
    isSingleIconPage = (visibleCount == 1 && state->scrollOffset != 0);

    for (slot = 0; slot < visibleCount; slot++)
    {
        u8 actionIndex = state->scrollOffset + slot;
        u8 action = state->actions[actionIndex];
        s16 x = isSingleIconPage ? sNewStartMenuIconX[NEW_START_MENU_VISIBLE_ICONS / 2] : sNewStartMenuIconX[slot];
        u8 spriteId = CreateSprite(&sNewStartMenuIconTemplates[action], x, NEW_START_MENU_ICON_Y, 1);
        u8 objWindowSpriteId;

        if (spriteId != MAX_SPRITES)
        {
            state->iconSpriteIds[slot] = spriteId;
            SetNewStartMenuSpritePalette(&gSprites[spriteId], NEW_START_MENU_ICON_OBJ_PAL_SLOT);
            StartSpriteAnim(&gSprites[spriteId], actionIndex == state->cursorPos ? 1 : 0);

            if (IsNewStartMenuInDarkCave())
            {
                objWindowSpriteId = CreateSprite(&sNewStartMenuIconTemplates[action], x, NEW_START_MENU_ICON_Y, 1);
                if (objWindowSpriteId != MAX_SPRITES)
                {
                    state->iconObjWindowSpriteIds[slot] = objWindowSpriteId;
                    SetNewStartMenuSpritePalette(&gSprites[objWindowSpriteId], NEW_START_MENU_ICON_OBJ_PAL_SLOT);
                    gSprites[objWindowSpriteId].oam.objMode = ST_OAM_OBJ_WINDOW;
                    StartSpriteAnim(&gSprites[objWindowSpriteId], actionIndex == state->cursorPos ? 1 : 0);
                }
            }
        }

        if (actionIndex == state->cursorPos)
            selectedSlot = slot;
    }

    if (selectedSlot != NEW_START_MENU_SPRITE_NONE)
    {
        s16 x = isSingleIconPage ? sNewStartMenuIconX[NEW_START_MENU_VISIBLE_ICONS / 2] : sNewStartMenuIconX[selectedSlot];
        u8 spriteId = CreateSprite(&sNewStartMenuArrowTemplate, x, NEW_START_MENU_ARROW_Y, 0);
        u8 objWindowSpriteId;

        if (spriteId != MAX_SPRITES)
        {
            state->arrowSpriteId = spriteId;
            SetNewStartMenuSpritePalette(&gSprites[spriteId], NEW_START_MENU_ARROW_OBJ_PAL_SLOT);
            gSprites[spriteId].data[7] = MAX_SPRITES;

            if (IsNewStartMenuInDarkCave())
            {
                objWindowSpriteId = CreateSprite(&sNewStartMenuArrowTemplate, x, NEW_START_MENU_ARROW_Y, 0);
                if (objWindowSpriteId != MAX_SPRITES)
                {
                    state->arrowObjWindowSpriteId = objWindowSpriteId;
                    SetNewStartMenuSpritePalette(&gSprites[objWindowSpriteId], NEW_START_MENU_ARROW_OBJ_PAL_SLOT);
                    gSprites[objWindowSpriteId].oam.objMode = ST_OAM_OBJ_WINDOW;
                    gSprites[objWindowSpriteId].callback = SpriteCallbackDummy;
                    gSprites[objWindowSpriteId].pos2.y = gSprites[spriteId].pos2.y;
                    gSprites[spriteId].data[7] = objWindowSpriteId;
                }
            }
        }
    }
}

static void DoNewStartMenuSave(struct NewStartMenuState *state)
{
    save_serialize_map();
    IncrementGameStat(GAME_STAT_SAVED_GAME);
    SaveQuestLogData();

    if (gDifferentSaveFile == TRUE)
    {
        TrySavingData(SAVE_OVERWRITE_DIFFERENT_FILE);
        gDifferentSaveFile = FALSE;
    }
    else
    {
        TrySavingData(SAVE_NORMAL);
    }

    state->saveResult = (gDamagedSaveSectors == 0) ? SAVE_STATUS_OK : SAVE_STATUS_ERROR;
}

static bool8 (*GetNewStartMenuActionCallback(u8 action))(void)
{
    switch (action)
    {
    case NEW_MENU_ACTION_POKEDEX:
        return NewStartMenuPokedexCallback;
    case NEW_MENU_ACTION_POKEMON:
        return NewStartMenuPokemonCallback;
    case NEW_MENU_ACTION_BAG:
        return NewStartMenuBagCallback;
    case NEW_MENU_ACTION_PLAYER:
        return NewStartMenuPlayerCallback;
    case NEW_MENU_ACTION_DEXNAV:
        return NewStartMenuDexNavCallback;
    case NEW_MENU_ACTION_OPTION:
        return StartMenuOptionCallback;
    default:
        return NULL;
    }
}

static void BeginNewStartMenuAction(u8 taskId, struct NewStartMenuState *state)
{
    u8 action = state->actions[state->cursorPos];

    sLastNewStartMenuAction = NEW_START_MENU_LAST_ACTION_VALID | action;
    state->selectedAction = action;

    if (action == NEW_MENU_ACTION_RETIRE_SAFARI)
    {
        CloseNewStartMenuForFieldScript(state);
        ScriptContext2_Enable();
        Free(state);
        DestroyTask(taskId);
        SafariZoneRetirePrompt_();
        return;
    }

    if (action == NEW_MENU_ACTION_POKENAV)
    {
        LaunchNewStartMenuFieldScript(taskId, state, NEW_START_MENU_POKENAV_SCRIPT);
        return;
    }

    if (action == NEW_MENU_ACTION_SAVE)
    {
        DrawNewStartMenuMessage(state, gText_NewStartMenuSavePrompt);
        gTasks[taskId].data[0] = TASK_STATE_SAVE_CONFIRM;
        return;
    }

    state->callback = GetNewStartMenuActionCallback(action);
    if (state->callback != NULL)
    {
        CleanupNewStartMenuResources(state);
        FadeScreen(FADE_TO_BLACK, 0);
        gTasks[taskId].data[0] = TASK_STATE_WAIT_CALLBACK;
    }
}

static void HandleNewStartMenuInput(u8 taskId, struct NewStartMenuState *state)
{
    if (state->delay != 0)
    {
        state->delay--;
        if (state->delay == 0)
            DrawNewStartMenuInfo(state);
        return;
    }

    if (JOY_NEW(DPAD_LEFT))
    {
        PlaySE(SE_SELECT);
        if (state->cursorPos > 0)
        {
            state->cursorPos--;
            sLastNewStartMenuAction = NEW_START_MENU_LAST_ACTION_VALID | state->actions[state->cursorPos];
            UpdateNewStartMenuScroll(state);
            RedrawNewStartMenu(state);
            DrawNewStartMenuInfo(state);
        }
    }
    else if (JOY_NEW(DPAD_RIGHT))
    {
        PlaySE(SE_SELECT);
        if (state->cursorPos < state->actionCount - 1)
        {
            state->cursorPos++;
            sLastNewStartMenuAction = NEW_START_MENU_LAST_ACTION_VALID | state->actions[state->cursorPos];
            UpdateNewStartMenuScroll(state);
            RedrawNewStartMenu(state);
            DrawNewStartMenuInfo(state);
        }
    }
    else if (JOY_NEW(A_BUTTON))
    {
        PlaySE(SE_SELECT);
        BeginNewStartMenuAction(taskId, state);
    }
    else if (JOY_NEW(B_BUTTON | START_BUTTON))
    {
        PlaySE(SE_SELECT);
        sLastNewStartMenuAction = NEW_START_MENU_LAST_ACTION_VALID | state->actions[state->cursorPos];
        HideNewStartMenuInternal(state);
        Free(state);
        DestroyTask(taskId);
    }
}

static void HandleNewStartMenuSave(u8 taskId, struct NewStartMenuState *state)
{
    switch (gTasks[taskId].data[0])
    {
    case TASK_STATE_SAVE_CONFIRM:
        if (JOY_NEW(A_BUTTON))
        {
            PlaySE(SE_SELECT);
            gTasks[taskId].data[0] = TASK_STATE_SAVE_DO_SAVE;
        }
        else if (JOY_NEW(B_BUTTON))
        {
            PlaySE(SE_SELECT);
            DrawNewStartMenuInfo(state);
            gTasks[taskId].data[0] = TASK_STATE_HANDLE_INPUT;
        }
        break;
    case TASK_STATE_SAVE_OVERWRITE_CONFIRM:
        if (JOY_NEW(A_BUTTON))
        {
            PlaySE(SE_SELECT);
            gTasks[taskId].data[0] = TASK_STATE_SAVE_DO_SAVE;
        }
        else if (JOY_NEW(B_BUTTON))
        {
            PlaySE(SE_SELECT);
            DrawNewStartMenuInfo(state);
            gTasks[taskId].data[0] = TASK_STATE_HANDLE_INPUT;
        }
        break;
    case TASK_STATE_SAVE_DO_SAVE:
        DrawNewStartMenuMessage(state, gText_NewStartMenuSaving);
        DoNewStartMenuSave(state);
        state->delay = 60;
        DrawNewStartMenuMessage(state, state->saveResult == SAVE_STATUS_OK ? gText_NewStartMenuSaved : gText_NewStartMenuSaveError);
        gTasks[taskId].data[0] = TASK_STATE_SAVE_RESULT;
        break;
    case TASK_STATE_SAVE_RESULT:
        if (state->delay != 0)
            state->delay--;

        if (state->delay == 0 || JOY_NEW(A_BUTTON | B_BUTTON))
        {
            PlaySE(SE_SELECT);
            sLastNewStartMenuAction = NEW_START_MENU_LAST_ACTION_VALID | state->actions[state->cursorPos];
            HideNewStartMenuInternal(state);
            Free(state);
            DestroyTask(taskId);
        }
        break;
    }
}

static void CleanupNewStartMenuResources(struct NewStartMenuState *state)
{
    if (state == NULL)
        return;

    DisableNewStartMenuBlend(state);
    DisableNewStartMenuObjWindow(state);
    DestroyNewStartMenuBgSprites(state);
    DestroyNewStartMenuIconSprites(state);
    DestroyNewStartMenuArrowSprite(state);
    DestroyNewStartMenuInfoTextSprites(state);
    RestoreNewStartMenuObjPalettes(state);

    if (state->infoWindowId != NEW_START_MENU_WINDOW_NONE)
    {
        FillWindowPixelBuffer(state->infoWindowId, PIXEL_FILL(0));
        RemoveWindow(state->infoWindowId);
        state->infoWindowId = NEW_START_MENU_WINDOW_NONE;
    }
}

static void LaunchNewStartMenuFieldScript(u8 taskId, struct NewStartMenuState *state, const u8 *script)
{
    CloseNewStartMenuForFieldScript(state);
    ScriptContext2_Enable();
    ScriptContext1_SetupScript(script);
    Free(state);
    DestroyTask(taskId);
}

static void CloseNewStartMenuForFieldScript(struct NewStartMenuState *state)
{
    CleanupNewStartMenuResources(state);
}

static void HideNewStartMenuInternal(struct NewStartMenuState *state)
{
    CleanupNewStartMenuResources(state);
    ScriptContext2_Disable();
    ClearPlayerHeldMovementAndUnfreezeObjectEvents_();
    UnlockPlayerFieldControls_();
}

static void Task_NewStartMenu(u8 taskId)
{
    struct NewStartMenuState *state = GetTaskStatePtr(taskId);

    if (state == NULL)
    {
        DestroyTask(taskId);
        return;
    }

    switch (gTasks[taskId].data[0])
    {
    case TASK_STATE_INIT:
        LoadNewStartMenuBg(state);
        LoadNewStartMenuSpritePalettes(state);
        EnableNewStartMenuBlend(state);
        EnableNewStartMenuObjWindow(state);
        CreateNewStartMenuBgSprites(state);
        CreateNewStartMenuInfoTextSprites(state);
        RedrawNewStartMenu(state);
        gTasks[taskId].data[0] = TASK_STATE_DRAW_INITIAL;
        break;
    case TASK_STATE_DRAW_INITIAL:
        DrawNewStartMenuInfo(state);
        gTasks[taskId].data[0] = TASK_STATE_HANDLE_INPUT;
        break;
    case TASK_STATE_HANDLE_INPUT:
        HandleNewStartMenuInput(taskId, state);
        break;
    case TASK_STATE_WAIT_CALLBACK:
        if (state->callback != NULL && state->callback() == TRUE)
        {
            if (state->selectedAction == NEW_MENU_ACTION_OPTION)
            {
                ArmReturnToNewStartMenuHook();
                gMain.savedCallback = CB2_ReturnToFieldWithOpenMenu;
            }
            Free(state);
            DestroyTask(taskId);
        }
        break;
    case TASK_STATE_SAVE_CONFIRM:
    case TASK_STATE_SAVE_OVERWRITE_CONFIRM:
    case TASK_STATE_SAVE_DO_SAVE:
    case TASK_STATE_SAVE_RESULT:
        HandleNewStartMenuSave(taskId, state);
        break;
    }
}

void ShowNewStartMenu(void)
{
    u8 taskId;
    struct NewStartMenuState *state = Calloc(sizeof(*state));

    if (state == NULL)
        return;

    InitNewStartMenuState(state);
    taskId = CreateTask(Task_NewStartMenu, 80);
    if (taskId == 0xFF)
    {
        Free(state);
        return;
    }

    if (!IsUpdateLinkStateCBActive())
    {
        FreezeObjectEvents_();
        HandleEnforcedLookDirectionOnPlayerStopMoving();
        StopPlayerAvatar();
    }

    SetTaskStatePtr(taskId, state);
    ScriptContext2_Enable();
    LockPlayerFieldControls_();
}

void StartMenu_Init(void)
{
    if (ScriptContext2_IsEnabled() || ScriptContext1_IsScriptSetUp())
        return;

    ShowNewStartMenu();
}

void HideNewStartMenu(void)
{
    u8 taskId = FindTaskIdByFunc(Task_NewStartMenu);
    struct NewStartMenuState *state;

    if (taskId == 0xFF)
        return;

    state = GetTaskStatePtr(taskId);
    HideNewStartMenuInternal(state);
    Free(state);
    DestroyTask(taskId);
}
