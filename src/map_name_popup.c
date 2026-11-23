#include "defines.h"
#include "../include/constants/flags.h"
#include "../include/constants/rgb.h"
#include "../include/bg.h"
#include "../include/event_data.h"
#include "../include/fieldmap.h"
#include "../include/gpu_regs.h"
#include "../include/menu.h"
#include "../include/palette.h"
#include "../include/region_map.h"
#include "../include/task.h"
#include "../include/window.h"

/*
	DPPt 风格地图名弹窗：左上角、无边框、白字深色阴影（原版为顶部滑入的白色标签框）。
	hooks 表把 ShowMapNamePopup / DismissMapNamePopup / IsMapNamePopupTaskActive
	三个入口重定向到本文件，原版 ROM 内部与 CFRU C 代码的调用全部生效。
	动画沿用原版机制：窗口画在 BG0 tilemap 底部 wrap 区（行 29-30，屏幕外），
	每帧写 BG0VOFS 让窗口从屏幕上方滑入、停留、滑出。
*/

#define POPUP_PRIORITY       0x5A
#define POPUP_SLIDE_STEP     2
#define POPUP_SLIDE_DISTANCE 24
#define POPUP_HOLD_FRAMES    120
#define POPUP_PALETTE_NUM    13
#define POPUP_FONT           2

enum
{
	POPUP_STATE_INIT,
	POPUP_STATE_SLIDE_IN,
	POPUP_STATE_HOLD,
	POPUP_STATE_SLIDE_OUT,
	POPUP_STATE_CLEAR_MAP,
	POPUP_STATE_WAIT_DMA,
};

enum
{
	POPUP_DATA_STATE,
	POPUP_DATA_SCROLL,
	POPUP_DATA_WINDOW,
	POPUP_DATA_TIMER,
};

static const struct WindowTemplate sMapNamePopupWindowTemplate =
{
	.bg = 0,
	.tilemapLeft = 1,
	.tilemapTop = 29,
	.width = 14,
	.height = 2,
	.paletteNum = POPUP_PALETTE_NUM,
	.baseBlock = 1,
};

static const struct TextColor sMapNamePopupTextColor =
{
	.bgColor = TEXT_COLOR_TRANSPARENT,
	.fgColor = TEXT_COLOR_WHITE,
	.shadowColor = TEXT_COLOR_DARK_GREY,
};

static const u16 sMapNamePopupPalette[16] =
{
	[0] = RGB_BLACK, // BG color 0：GBA 下透明，透出地图
	[1] = RGB_WHITE, // 文字
	[2] = RGB_BLACK, // 阴影
};

static void Task_MapNamePopup(u8 taskId)
{
	s16 *data = gTasks[taskId].data;
	switch (data[POPUP_DATA_STATE])
	{
	case POPUP_STATE_INIT:
	{
		u8 windowId = AddWindow(&sMapNamePopupWindowTemplate);
		if (windowId == 0xFF)
		{
			DestroyTask(taskId);
			break;
		}
		LoadPalette(sMapNamePopupPalette, PLTT_ID(POPUP_PALETTE_NUM), PLTT_SIZE_4BPP);
		FillWindowPixelBuffer(windowId, PIXEL_FILL(0));
		GetMapName(gStringVar4, gMapHeader.regionMapSectionId, 0);
		WindowPrint(windowId, POPUP_FONT, 1, 2, &sMapNamePopupTextColor, TEXT_SPEED_FF, gStringVar4);
		PutWindowTilemap(windowId);
		CopyWindowToVram(windowId, COPYWIN_BOTH);
		data[POPUP_DATA_WINDOW] = windowId;
		data[POPUP_DATA_SCROLL] = 0;
		data[POPUP_DATA_STATE] = POPUP_STATE_SLIDE_IN;
		break;
	}
	case POPUP_STATE_SLIDE_IN:
		data[POPUP_DATA_SCROLL] -= POPUP_SLIDE_STEP;
		if (data[POPUP_DATA_SCROLL] <= -POPUP_SLIDE_DISTANCE)
		{
			data[POPUP_DATA_SCROLL] = -POPUP_SLIDE_DISTANCE;
			data[POPUP_DATA_TIMER] = 0;
			data[POPUP_DATA_STATE] = POPUP_STATE_HOLD;
		}
		break;
	case POPUP_STATE_HOLD:
		if (++data[POPUP_DATA_TIMER] >= POPUP_HOLD_FRAMES)
		{
			data[POPUP_DATA_TIMER] = 0;
			data[POPUP_DATA_STATE] = POPUP_STATE_SLIDE_OUT;
		}
		break;
	case POPUP_STATE_SLIDE_OUT:
		data[POPUP_DATA_SCROLL] += POPUP_SLIDE_STEP;
		if (data[POPUP_DATA_SCROLL] >= 0)
		{
			data[POPUP_DATA_SCROLL] = 0;
			data[POPUP_DATA_STATE] = POPUP_STATE_CLEAR_MAP;
		}
		break;
	case POPUP_STATE_CLEAR_MAP:
		ClearWindowTilemap(data[POPUP_DATA_WINDOW]);
		CopyWindowToVram(data[POPUP_DATA_WINDOW], COPYWIN_MAP);
		data[POPUP_DATA_STATE] = POPUP_STATE_WAIT_DMA;
		break;
	case POPUP_STATE_WAIT_DMA:
		if (!IsDma3ManagerBusyWithBgCopy())
		{
			RemoveWindow(data[POPUP_DATA_WINDOW]);
			DestroyTask(taskId);
		}
		break;
	}
	SetGpuReg(REG_OFFSET_BG0VOFS, (u16)data[POPUP_DATA_SCROLL]);
}

void ShowMapNamePopupHook(bool32 palIntoFadedBuffer)
{
	(void)palIntoFadedBuffer;
	if (FlagGet(FLAG_HIDE_MAP_NAME_POPUP))
		return;
	if (FindTaskIdByFunc(Task_MapNamePopup) != 0xFF)
		return;
	CreateTask(Task_MapNamePopup, POPUP_PRIORITY);
}

void DismissMapNamePopupHook(void)
{
	u8 taskId = FindTaskIdByFunc(Task_MapNamePopup);
	if (taskId == 0xFF)
		return;
	if (gTasks[taskId].data[POPUP_DATA_STATE] < POPUP_STATE_CLEAR_MAP)
	{
		gTasks[taskId].data[POPUP_DATA_STATE] = POPUP_STATE_CLEAR_MAP;
		gTasks[taskId].data[POPUP_DATA_SCROLL] = 0; // VOFS 归 0，弹窗立即消失
	}
}

bool32 IsMapNamePopupTaskActiveHook(void)
{
	return FindTaskIdByFunc(Task_MapNamePopup) != 0xFF;
}
