#include "defines.h"
#include "../include/event_data.h"
#include "../include/link.h"
#include "../include/main.h"
#include "../include/field_player_avatar.h"
#include "../include/overworld.h"
#include "../include/script.h"

/*
fast_forward.c
	Decomp-style fast forward: enabled from the Options menu (FLAG_FAST_FORWARD) and the
	game logic runs several times per real frame, while music keeps playing at normal speed.

	Why music is unaffected: m4aSoundMain() is called from VBlankIntr (interrupt), not from
	the main loop, so the sound engine is locked to the real 59.7 Hz. We only skip the
	"wait for next VBlank" at the end of AgbMain's loop.

	Baseline (needs only the gWirelessCommType line in BPRE.ld): while toggled on,
	never wait for VBlank. Extras are OFF by default; enable ONE at a time to see which
	one you want / which one breaks.
*/

// Uncomment to never fast forward during battles.
//#define FF_DISABLE_IN_BATTLE

// Stopgap: run at normal speed while surfing in the overworld. The toggle stays on, so fast forward
// resumes as soon as you leave the water. Comment this out to fast forward while surfing as well.
#define FF_PAUSE_WHILE_SURFING

#define FF_FADE_BOOST
#define SPLTT_BUFFER_TRANSFER_PENDING (*(vu32*) 0x2037AC8)
#ifdef FF_SKIP_DURING_MAP_LOAD
#include "../include/overworld.h"
void CB2_LoadMap2(void);
#endif

bool8 ShouldSkipVBlankWait(void)
{
	//修复室内失效：联机流程（Cable Club/神秘礼物等）会置位 gWirelessCommType，被中途
	//退出时该标志残留（原版仅连接失败路径才清零），导致快进守卫永远命中、功能消失
	//直到重启。回到大地图且未建立连接时必然为残留，安全清除；真联机不受影响。
	if (gWirelessCommType != 0 && !gReceivedRemoteLinkPlayers
	&& gMain.callback2 == CB2_Overworld)
		gWirelessCommType = 0;

	if (gReceivedRemoteLinkPlayers || gWirelessCommType)
		return FALSE;

	#ifdef FLAG_FAST_FORWARD
	if (!FlagGet(FLAG_FAST_FORWARD)) //快进开关由选项菜单控制（存档 flag 持久化）
		return FALSE;
	#else
	return FALSE;
	#endif

	#ifdef FF_DISABLE_IN_BATTLE
	if (gMain.inBattle)
		return FALSE;
	#endif

	#ifdef FF_PAUSE_WHILE_SURFING
	if (gMain.callback2 == CB2_Overworld && TestPlayerAvatarFlags(PLAYER_AVATAR_FLAG_SURFING))
		return FALSE;
	#endif

	#ifdef FF_SKIP_DURING_MAP_LOAD
	if (gMain.callback2 == CB2_LoadMap || gMain.callback2 == CB2_LoadMap2)
		return FALSE;
	#endif

	#ifdef FF_FADE_BOOST
	SPLTT_BUFFER_TRANSFER_PENDING = 0;
	#endif

	return TRUE;
}
