#include "defines.h"
#include "../include/battle.h"
#include "../include/bg.h"
#include "../include/decompress.h"
#include "../include/gpu_regs.h"
#include "../include/link.h"
#include "../include/main.h"
#include "../include/malloc.h"
#include "../include/menu.h"
#include "../include/menu_helpers.h"
#include "../include/overworld.h"
#include "../include/palette.h"
#include "../include/pokemon.h"
#include "../include/pokemon_icon.h"
#include "../include/party_menu.h"
#include "../include/pokemon_summary_screen.h"
#include "../include/sound.h"
#include "../include/sprite.h"
#include "../include/string_util.h"
#include "../include/task.h"
#include "../include/text.h"
#include "../include/window.h"

#include "../include/constants/pokemon.h"
#include "../include/constants/songs.h"
#include "../include/constants/species.h"

#include "../include/gba/macro.h"
#include "../include/gba/types.h"

#include "../include/new/bw_party_screen.h"
#include "../include/new/Vanilla_functions.h"
#include "../include/new/ram_locs.h"
#include "../include/new/rom_locs.h"

#ifdef BW_PARTY_SCREEN

extern const u16 gPalSummaryScreen[];
extern const u32 gTilesSummaryScreen[];
extern const u32 gMapSummaryScreenBg[];
extern const struct WindowTemplate sWindowTemplates_Dummy[];

static const struct BgTemplate sBWPartyBgTemplate[] =
{
    {
        .bg = 0,
        .charBaseIndex = 1,
        .mapBaseIndex = 29,
        .screenSize = 0,
        .paletteMode = 0,
        .priority = 0,
        .baseTile = 0
    },
    {
        .bg = 1,
        .charBaseIndex = 0,
        .mapBaseIndex = 30,
        .screenSize = 0,
        .paletteMode = 0,
        .priority = 1,
        .baseTile = 0
    },
    {
        .bg = 2,
        .charBaseIndex = 0,
        .mapBaseIndex = 31,
        .screenSize = 0,
        .paletteMode = 0,
        .priority = 2,
        .baseTile = 0
    },
    {
        .bg = 3,
        .charBaseIndex = 0,
        .mapBaseIndex = 28,
        .screenSize = 0,
        .paletteMode = 0,
        .priority = 3,
        .baseTile = 0
    }
};

static const struct WindowTemplate sBWPartyWindowTemplates[] =
{
    {
        .bg = 0,
        .tilemapLeft = 0,
        .tilemapTop = 0,
        .width = 13,
        .height = 2,
        .paletteNum = 7,
        .baseBlock = 0x0200
    },
    {
        .bg = 0,
        .tilemapLeft = 0,
        .tilemapTop = 18,
        .width = 30,
        .height = 2,
        .paletteNum = 7,
        .baseBlock = 0x0220
    },
    {
        .bg = 0,
        .tilemapLeft = 6,
        .tilemapTop = 3,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x0260
    },
    {
        .bg = 0,
        .tilemapLeft = 14,
        .tilemapTop = 3,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x0280
    },
    {
        .bg = 0,
        .tilemapLeft = 22,
        .tilemapTop = 3,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x02A0
    },
    {
        .bg = 0,
        .tilemapLeft = 6,
        .tilemapTop = 10,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x02C0
    },
    {
        .bg = 0,
        .tilemapLeft = 14,
        .tilemapTop = 10,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x02E0
    },
    {
        .bg = 0,
        .tilemapLeft = 22,
        .tilemapTop = 10,
        .width = 8,
        .height = 4,
        .paletteNum = 7,
        .baseBlock = 0x0300
    },
    DUMMY_WIN_TEMPLATE
};

static const u8 sBWPartySlotCoords[BW_PARTY_NUM_SLOTS][2] =
{
    { 12, 20  },
    { 88, 20  },
    { 164, 20 },
    { 12, 72  },
    { 88, 72  },
    { 164, 72 },
};

static const u8 sBWPartyTextColors[] = { TEXT_COLOR_TRANSPARENT, TEXT_COLOR_WHITE, TEXT_COLOR_DARK_GREY };

static void CB2_SetUpBWParty(void);
static void CB2_RunBWPartyScreen(void);
static void VBlankCB_BWPartyScreen(void);
static void Task_BWPartyInput(u8 taskId);
static void BWParty_DestroyResources(u8 taskId);
static void BWParty_Setup_SetVBlankCallback(void);
static void BWParty_FinishSetup(void);
static void BWParty_InitBgAndWindows(void);
static u8 BWParty_LoadGraphics(void);
static u8 BWParty_CreateSprites(void);
static void BWParty_RenderSlot(u8 slot);
static void BWParty_SetNewSelectTarget(s8 *slotPtr, s8 movementDir);
static void BWParty_UpdateDetailPanel(u8 slot);
static void BWParty_RenderCursor(void);
static u8 BWParty_IsSlotOccupied(u8 slot);
static void BWParty_OpenActionMenu(void);
static void BWParty_CloseActionMenu(void);
static void BWParty_GotoSummary(void);
static void CB2_ReturnToBWPartyScreen(void);

void ShowBWPartyScreen(u8 menuType, u8 layout, u8 partyAction, bool8 keepCursorPos, u8 messageId, TaskFunc task, MainCallback callback)
{
    (void)keepCursorPos;
    sBWPartyScreen = AllocZeroed(sizeof(struct BWPartyScreenData));

    if (sBWPartyScreen == NULL)
    {
        SetMainCallback2(callback);
        return;
    }

    if (callback == NULL)
        callback = CB2_ReturnToField;

    gPartyMenu.exitCallback = callback;
    gPartyMenu.task = task;
    gPartyMenu.menuType = menuType;
    gPartyMenu.layout = layout;
    gPartyMenu.action = partyAction;
    gPartyMenu.slotId = 0;
    gPartyMenu.slotId2 = -1;

    sBWPartyScreen->setupStep = 0;
    sBWPartyScreen->loadGfxStep = 0;
    sBWPartyScreen->spriteStep = 0;
    sBWPartyScreen->menuType = menuType;
    sBWPartyScreen->layout = layout;
    sBWPartyScreen->action = partyAction;
    sBWPartyScreen->slotId = 0;
    sBWPartyScreen->slotId2 = -1;
    sBWPartyScreen->lastSelectedSlot = 0;
    sBWPartyScreen->messageId = messageId;
    sBWPartyScreen->savedCallback = callback;
    sBWPartyScreen->actionMenuOpen = FALSE;
    sBWPartyScreen->selectedAction = 0;
    sBWPartyScreen->cursorSpriteId = 0xFF;
    sBWPartyScreen->inputTaskId = 0xFF;

    SetMainCallback2(CB2_SetUpBWParty);
}

static void CB2_SetUpBWParty(void)
{
    switch (sBWPartyScreen->setupStep)
    {
    case 0:
        ResetSpriteData();
        FreeAllSpritePalettes();
        ResetTasks();
        break;
    case 1:
        DmaClearLarge16(3, (void *)VRAM, VRAM_SIZE, 0x1000);
        DmaClear32(3, (void *)OAM, OAM_SIZE);
        DmaClear16(3, (void *)PLTT, PLTT_SIZE);
        SetGpuReg(REG_OFFSET_DISPCNT, 0);
        ResetBgsAndClearDma3BusyFlags(0);
        InitBgsFromTemplates(0, sBWPartyBgTemplate, NELEMS(sBWPartyBgTemplate));
        ChangeBgX(0, 0, 0);
        ChangeBgY(0, 0, 0);
        ChangeBgX(1, 0, 0);
        ChangeBgY(1, 0, 0);
        ChangeBgX(2, 0, 0);
        ChangeBgY(2, 0, 0);
        ChangeBgX(3, 0, 0);
        ChangeBgY(3, 0, 0);
        DeactivateAllTextPrinters();
        SetGpuReg(REG_OFFSET_DISPCNT, DISPCNT_OBJ_1D_MAP | DISPCNT_OBJ_ON);
        ShowBg(0);
        ShowBg(1);
        ShowBg(2);
        ShowBg(3);
        break;
    case 2:
        ResetSpriteData();
        break;
    case 3:
        if (!BWParty_LoadGraphics())
            return;
        break;
    case 4:
        BWParty_InitBgAndWindows();
        break;
    case 5:
        if (!BWParty_CreateSprites())
            return;
        break;
    case 6:
        break;
    case 7:
    {
        u8 i;
        for (i = 0; i < BW_PARTY_NUM_SLOTS; i++)
            BWParty_RenderSlot(i);
    }
        break;
    case 8:
        BWParty_UpdateDetailPanel(sBWPartyScreen->slotId);
        break;
    case 9:
        break;
    case 10:
        BlendPalettes(0xffffffff, 16, 0);
        break;
    case 11:
    {
        u8 i;
        BeginNormalPaletteFade(0xffffffff, 0, 16, 0, 0);
        for (i = 0; i < NELEMS(sBWPartyWindowTemplates) - 1; i++)
        {
            PutWindowTilemap(sBWPartyScreen->windowIds[i]);
            CopyWindowToVram(sBWPartyScreen->windowIds[i], COPYWIN_BOTH);
        }
    }
        break;
    case 12:
        CopyBgTilemapBufferToVram(0);
        CopyBgTilemapBufferToVram(1);
        CopyBgTilemapBufferToVram(2);
        CopyBgTilemapBufferToVram(3);
        break;
    case 13:
    case 14:
        break;
    default:
        BWParty_Setup_SetVBlankCallback();
        BWParty_FinishSetup();
        return;
    }

    sBWPartyScreen->setupStep++;
}

static u8 BWParty_LoadGraphics(void)
{
    switch (sBWPartyScreen->loadGfxStep)
    {
    case 0:
        LoadPalette(gPalSummaryScreen, 0, 0x20);
        break;
    case 1:
        LZ77UnCompVram(gTilesSummaryScreen, (void *)(VRAM));
        break;
    case 2:
        LZ77UnCompVram(gMapSummaryScreenBg, (void *)(VRAM + 0xF800));
        break;
    case 3:
        return TRUE;
    }

    sBWPartyScreen->loadGfxStep++;
    return FALSE;
}

static void BWParty_InitBgAndWindows(void)
{
    u8 i;

    InitWindows(sWindowTemplates_Dummy);

    for (i = 0; i < NELEMS(sBWPartyWindowTemplates) - 1; i++)
    {
        sBWPartyScreen->windowIds[i] = AddWindow(&sBWPartyWindowTemplates[i]);
        FillWindowPixelBuffer(sBWPartyScreen->windowIds[i], 0xFF);
    }
}

static u8 BWParty_CreateSprites(void)
{
    sBWPartyScreen->cursorSpriteId = 0xFF;
    return TRUE;
}

static void BWParty_RenderSlot(u8 slot)
{
    struct Pokemon *mon;
    u16 species;
    u32 personality;
    bool8 isEgg;
    u8 nicknameBuf[11];
    u8 hpBuf[16];
    u8 windowId;
    u8 spriteId;
    u16 hp, maxHp;
    u8 x, y;

    mon = &gPlayerParty[slot];
    species = GetMonData(mon, MON_DATA_SPECIES, NULL);

    sBWPartyScreen->slots[slot].isEmpty = (species == SPECIES_NONE);
    sBWPartyScreen->slots[slot].isEgg = FALSE;
    sBWPartyScreen->slots[slot].monSpriteId = 0xFF;
    sBWPartyScreen->slots[slot].hpBarSpriteId = 0xFF;
    sBWPartyScreen->slots[slot].statusSpriteId = 0xFF;
    sBWPartyScreen->slots[slot].itemSpriteId = 0xFF;

    if (sBWPartyScreen->slots[slot].isEmpty)
        return;

    isEgg = GetMonData(mon, MON_DATA_IS_EGG, NULL);
    sBWPartyScreen->slots[slot].isEgg = isEgg;

    personality = GetMonData(mon, MON_DATA_PERSONALITY, NULL);
    x = sBWPartySlotCoords[slot][0];
    y = sBWPartySlotCoords[slot][1];

    if (isEgg)
        spriteId = CreateMonIcon(SPECIES_EGG, SpriteCallbackDummy, x, y, 0, personality, FALSE);
    else
        spriteId = CreateMonIcon(species, SpriteCallbackDummy, x, y, 0, personality, FALSE);

    sBWPartyScreen->slots[slot].monSpriteId = spriteId;

    windowId = sBWPartyScreen->windowIds[2 + slot];
    sBWPartyScreen->slots[slot].windowId = windowId;

    GetMonNickname(mon, nicknameBuf);
    AddTextPrinterParameterized3(windowId, 2, 0, 0, sBWPartyTextColors, TEXT_SPEED_FF, nicknameBuf);

    if (!isEgg)
    {
        hp = GetMonData(mon, MON_DATA_HP, NULL);
        maxHp = GetMonData(mon, MON_DATA_MAX_HP, NULL);
        sBWPartyScreen->slots[slot].hpRatio = (maxHp > 0) ? (hp * 255 / maxHp) : 0;

        StringCopy(hpBuf, (const u8 *)"\xF8\xB1");
        ConvertIntToDecimalStringN(hpBuf + 2, hp, STR_CONV_MODE_RIGHT_ALIGN, 3);
        StringCopy(hpBuf + 5, (const u8 *)"\xF8\xB2");
        ConvertIntToDecimalStringN(hpBuf + 7, maxHp, STR_CONV_MODE_RIGHT_ALIGN, 3);
        hpBuf[10] = 0xFF;

        AddTextPrinterParameterized3(windowId, 2, 0, 16, sBWPartyTextColors, TEXT_SPEED_FF, hpBuf);
    }
}

static u8 BWParty_IsSlotOccupied(u8 slot)
{
    if (slot >= BW_PARTY_NUM_SLOTS)
        return FALSE;
    return !sBWPartyScreen->slots[slot].isEmpty;
}

static void BWParty_SetNewSelectTarget(s8 *slotPtr, s8 movementDir)
{
    s8 cur = *slotPtr;
    u8 row, col;
    u8 newSlot;
    u8 i;

    if (cur < 0 || cur >= BW_PARTY_NUM_SLOTS)
        cur = 0;

    if (cur != 6 && cur != 7)
        sBWPartyScreen->lastSelectedSlot = cur;

    row = cur / BW_PARTY_GRID_COLS;
    col = cur % BW_PARTY_GRID_COLS;

    switch (movementDir)
    {
    case 1:
        row = (row + 1) % BW_PARTY_GRID_ROWS;
        break;
    case -1:
        row = (row + BW_PARTY_GRID_ROWS - 1) % BW_PARTY_GRID_ROWS;
        break;
    case 2:
        col = (col + 1) % BW_PARTY_GRID_COLS;
        break;
    case -2:
        col = (col + BW_PARTY_GRID_COLS - 1) % BW_PARTY_GRID_COLS;
        break;
    default:
        return;
    }

    newSlot = row * BW_PARTY_GRID_COLS + col;

    for (i = 0; i < BW_PARTY_NUM_SLOTS; i++)
    {
        if (BWParty_IsSlotOccupied(newSlot))
            break;
        switch (movementDir)
        {
        case 1:
            row = (row + 1) % BW_PARTY_GRID_ROWS;
            break;
        case -1:
            row = (row + BW_PARTY_GRID_ROWS - 1) % BW_PARTY_GRID_ROWS;
            break;
        case 2:
            col = (col + 1) % BW_PARTY_GRID_COLS;
            break;
        case -2:
            col = (col + BW_PARTY_GRID_COLS - 1) % BW_PARTY_GRID_COLS;
            break;
        }
        newSlot = row * BW_PARTY_GRID_COLS + col;
    }

    *slotPtr = newSlot;
}

static void BWParty_UpdateDetailPanel(u8 slot)
{
    u8 windowId;
    struct Pokemon *mon;
    u8 buf[32];

    windowId = sBWPartyScreen->windowIds[1];
    FillWindowPixelBuffer(windowId, 0xFF);

    if (slot >= BW_PARTY_NUM_SLOTS || sBWPartyScreen->slots[slot].isEmpty)
    {
        AddTextPrinterParameterized3(windowId, 2, 4, 0, sBWPartyTextColors, TEXT_SPEED_FF, (const u8 *)"");
        PutWindowTilemap(windowId);
        CopyWindowToVram(windowId, COPYWIN_BOTH);
        return;
    }

    mon = &gPlayerParty[slot];

    if (GetMonData(mon, MON_DATA_IS_EGG, NULL))
    {
        AddTextPrinterParameterized3(windowId, 2, 4, 0, sBWPartyTextColors, TEXT_SPEED_FF, (const u8 *)"");
    }
    else
    {
        u16 hp = GetMonData(mon, MON_DATA_HP, NULL);
        u16 maxHp = GetMonData(mon, MON_DATA_MAX_HP, NULL);
        u8 level = GetMonData(mon, MON_DATA_LEVEL, NULL);

        StringCopy(buf, (const u8 *)"\xF8\xB3");
        ConvertIntToDecimalStringN(buf + 2, level, STR_CONV_MODE_RIGHT_ALIGN, 2);
        StringCopy(buf + 4, (const u8 *)"  \xF8\xB1");
        ConvertIntToDecimalStringN(buf + 8, hp, STR_CONV_MODE_RIGHT_ALIGN, 3);
        StringCopy(buf + 11, (const u8 *)"\xF8\xB2");
        ConvertIntToDecimalStringN(buf + 13, maxHp, STR_CONV_MODE_RIGHT_ALIGN, 3);
        buf[16] = 0xFF;

        AddTextPrinterParameterized3(windowId, 2, 4, 0, sBWPartyTextColors, TEXT_SPEED_FF, buf);
    }

    PutWindowTilemap(windowId);
    CopyWindowToVram(windowId, COPYWIN_BOTH);
}

static void BWParty_RenderCursor(void)
{
    PlaySE(SE_SELECT);
}

static void VBlankCB_BWPartyScreen(void)
{
    LoadOam();
    ProcessSpriteCopyRequests();
    TransferPlttBuffer();
}

static void BWParty_OpenActionMenu(void)
{
    u8 windowId;

    sBWPartyScreen->actionMenuOpen = TRUE;
    sBWPartyScreen->selectedAction = 0;

    windowId = sBWPartyScreen->windowIds[1];
    FillWindowPixelBuffer(windowId, 0xFF);
    AddTextPrinterParameterized3(windowId, 2, 4, 0, sBWPartyTextColors, TEXT_SPEED_FF, (const u8 *)">");
    AddTextPrinterParameterized3(windowId, 2, 16, 0, sBWPartyTextColors, TEXT_SPEED_FF, (const u8 *)" ");
    PutWindowTilemap(windowId);
    CopyWindowToVram(windowId, COPYWIN_BOTH);
}

static void BWParty_CloseActionMenu(void)
{
    sBWPartyScreen->actionMenuOpen = FALSE;
    BWParty_UpdateDetailPanel(sBWPartyScreen->slotId);
}

static void BWParty_GotoSummary(void)
{
    u8 i;

    for (i = 0; i < BW_PARTY_NUM_SLOTS; i++)
    {
        if (sBWPartyScreen->slots[i].monSpriteId != 0xFF)
        {
            FreeResourcesAndDestroySprite(&gSprites[sBWPartyScreen->slots[i].monSpriteId], sBWPartyScreen->slots[i].monSpriteId);
            sBWPartyScreen->slots[i].monSpriteId = 0xFF;
        }
    }

    ShowPokemonSummaryScreen(gPlayerParty, sBWPartyScreen->slotId, gPlayerPartyCount - 1, CB2_ReturnToBWPartyScreen, PSS_MODE_NORMAL);
}

static void CB2_ReturnToBWPartyScreen(void)
{
    if (sBWPartyScreen == NULL)
    {
        SetMainCallback2(CB2_ReturnToField);
        return;
    }

    sBWPartyScreen->setupStep = 0;
    sBWPartyScreen->loadGfxStep = 0;
    sBWPartyScreen->spriteStep = 0;
    sBWPartyScreen->actionMenuOpen = FALSE;

    {
        u8 i;
        for (i = 0; i < BW_PARTY_NUM_SLOTS; i++)
        {
            sBWPartyScreen->slots[i].monSpriteId = 0xFF;
            sBWPartyScreen->slots[i].hpBarSpriteId = 0xFF;
            sBWPartyScreen->slots[i].statusSpriteId = 0xFF;
            sBWPartyScreen->slots[i].itemSpriteId = 0xFF;
        }
    }

    SetMainCallback2(CB2_SetUpBWParty);
}

static void BWParty_Setup_SetVBlankCallback(void)
{
    SetVBlankCallback(VBlankCB_BWPartyScreen);
}

static void BWParty_FinishSetup(void)
{
    sBWPartyScreen->inputTaskId = CreateTask(Task_BWPartyInput, 0);
    SetMainCallback2(CB2_RunBWPartyScreen);
}

static void CB2_RunBWPartyScreen(void)
{
    RunTasks();
    AnimateSprites();
    BuildOamBuffer();
    UpdatePaletteFade();
}

static void BWParty_DestroyResources(u8 taskId)
{
    u8 i;

    (void)taskId;

    if (sBWPartyScreen == NULL)
    {
        SetMainCallback2(gPartyMenu.exitCallback);
        return;
    }

    for (i = 0; i < BW_PARTY_NUM_SLOTS; i++)
    {
        if (sBWPartyScreen->slots[i].monSpriteId != 0xFF)
        {
            FreeResourcesAndDestroySprite(&gSprites[sBWPartyScreen->slots[i].monSpriteId], sBWPartyScreen->slots[i].monSpriteId);
            sBWPartyScreen->slots[i].monSpriteId = 0xFF;
        }
    }

    FreeAllWindowBuffers();
    FREE_AND_SET_NULL(sBWPartyScreen);
    SetMainCallback2(gPartyMenu.exitCallback);
}

static void Task_BWPartyInput(u8 taskId)
{
    s8 oldSlot;

    if (sBWPartyScreen->actionMenuOpen)
    {
        if (JOY_NEW(B_BUTTON))
        {
            PlaySE(SE_SELECT);
            BWParty_CloseActionMenu();
            return;
        }

        if (JOY_NEW(DPAD_UP) || JOY_NEW(DPAD_DOWN))
        {
            PlaySE(SE_SELECT);
            sBWPartyScreen->selectedAction ^= 1;
            {
                u8 windowId = sBWPartyScreen->windowIds[1];
                AddTextPrinterParameterized3(windowId, 2, 4, 0, sBWPartyTextColors, TEXT_SPEED_FF,
                    (sBWPartyScreen->selectedAction == 0) ? (const u8 *)">" : (const u8 *)" ");
                AddTextPrinterParameterized3(windowId, 2, 16, 0, sBWPartyTextColors, TEXT_SPEED_FF,
                    (sBWPartyScreen->selectedAction == 1) ? (const u8 *)">" : (const u8 *)" ");
                CopyWindowToVram(windowId, COPYWIN_BOTH);
            }
            return;
        }

        if (JOY_NEW(A_BUTTON))
        {
            PlaySE(SE_SELECT);
            if (sBWPartyScreen->selectedAction == 0)
            {
                BWParty_CloseActionMenu();
                BWParty_GotoSummary();
            }
            else
            {
                BWParty_CloseActionMenu();
            }
            return;
        }
        return;
    }

    if (JOY_NEW(B_BUTTON))
    {
        PlaySE(SE_SELECT);
        DestroyTask(taskId);
        BWParty_DestroyResources(taskId);
        return;
    }

    if (JOY_NEW(A_BUTTON))
    {
        if (BWParty_IsSlotOccupied(sBWPartyScreen->slotId))
        {
            PlaySE(SE_SELECT);
            BWParty_OpenActionMenu();
        }
        return;
    }

    oldSlot = sBWPartyScreen->slotId;

    if (JOY_NEW(DPAD_UP))
        BWParty_SetNewSelectTarget(&sBWPartyScreen->slotId, -1);
    else if (JOY_NEW(DPAD_DOWN))
        BWParty_SetNewSelectTarget(&sBWPartyScreen->slotId, 1);
    else if (JOY_NEW(DPAD_LEFT))
        BWParty_SetNewSelectTarget(&sBWPartyScreen->slotId, -2);
    else if (JOY_NEW(DPAD_RIGHT))
        BWParty_SetNewSelectTarget(&sBWPartyScreen->slotId, 2);
    else
        return;

    if (oldSlot != sBWPartyScreen->slotId)
    {
        gPartyMenu.slotId = sBWPartyScreen->slotId;
        BWParty_RenderCursor();
        BWParty_UpdateDetailPanel(sBWPartyScreen->slotId);
    }
}

#endif // BW_PARTY_SCREEN
