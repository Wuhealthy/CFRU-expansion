#include "../global.h"
#include "../main.h"
#include "../task.h"
#include "../party_menu.h"

#ifdef BW_PARTY_SCREEN

#define sBWPartyScreen (*(struct BWPartyScreenData **)0x0203B160)

#define BW_PARTY_GRID_COLS    3
#define BW_PARTY_GRID_ROWS    2
#define BW_PARTY_NUM_SLOTS    6

#define BW_PARTY_GRID_ORIGIN_X  8
#define BW_PARTY_GRID_ORIGIN_Y  16
#define BW_PARTY_SLOT_W         72
#define BW_PARTY_SLOT_H         48
#define BW_PARTY_GAP_X          4
#define BW_PARTY_GAP_Y          4

#define TAG_BW_CURSOR   0x8000
#define PAL_BW_CURSOR   0x8000
#define TAG_BW_HPBAR    0x8001
#define PAL_BW_HPBAR    0x8001
#define TAG_BW_BUTTON   0x8002
#define PAL_BW_BUTTON   0x8002

struct BWPartySlot
{
    u8 monSpriteId;
    u8 hpBarSpriteId;
    u8 statusSpriteId;
    u8 itemSpriteId;
    u8 windowId;
    u8 hpRatio;
    u8 ailment;
    bool8 isEmpty;
    bool8 isEgg;
    u8 nicknameBuf[11];
};

struct BWPartyScreenData
{
    u8 setupStep;
    u8 loadGfxStep;
    u8 spriteStep;
    u8 menuType;
    u8 layout;
    u8 action;
    s8 slotId;
    s8 slotId2;
    u8 lastSelectedSlot;
    u8 messageId;
    bool8 actionMenuOpen;
    u8 selectedAction;
    u8 inputTaskId;
    u8 cursorSpriteId;
    u8 windowIds[8];
    MainCallback savedCallback;
    void (*savedVBlankCallback)(void);
    struct BWPartySlot slots[BW_PARTY_NUM_SLOTS];
    u16 palBuffer[16];
};

void ShowBWPartyScreen(u8 menuType, u8 layout, u8 partyAction, bool8 keepCursorPos, u8 messageId, TaskFunc task, MainCallback callback);

void TransferPlttBuffer(void);

#endif // BW_PARTY_SCREEN
