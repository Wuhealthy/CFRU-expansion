#pragma once

#include "../global.h"

/**
 * \file follow_me.c
 * \brief Contains functions for implementing a feature that allows the player to
 *        be followed by NPCs.
 */

//Exported Functions
u8 GetFollowerObjectId(void);
u8 GetFollowerLocalId(void);
const u8* GetFollowerScriptPointer(void);
void HideFollower(void);
void TryFreezeFollowerAnim(struct EventObject* npc);
void IsFollowerStoppingRockClimb(void);
void FollowMe_SetIndicatorToComeOutDoor(void);
void FollowMe_SetIndicatorToRecreateSurfBlob(void);
void FollowMe_TryRemoveFollowerOnWhiteOut(void);
void FollowMe(struct EventObject* npc, u8 state, bool8 ignoreScriptActive);
void FollowMe_Ledges(struct EventObject* npc, struct Sprite* obj, u16* ledgeFramesTbl);
bool8 FollowMe_IsCollisionExempt(struct EventObject* obstacle, struct EventObject* collider);
void FollowMe_FollowerToWater(void);
void FollowMe_BindToSurbBlobOnReloadScreen(void);
void PrepareFollowerDismountSurf(void);
void StairsMoveFollower(void);
void FollowMe_HandleBike(void);
void FollowMe_HandleSprite(void);
void FollowMe_WarpSetEnd(void);
bool8 IsFollowerAtCoords(s16 x, s16 y);
void CreateFollowerAvatar(void);
void TryAttachFollowerToPlayer(void);
bool8 IsFollowerPokemon(void);
void FollowMe_SyncFacingWithPlayer(void);

//Functions Hooked In
void PlayerGoThroughDoor(u8 taskId);
void sp0D1_SetUpFollowerSprite(void);
void sp0D2_DestroyFollowerSprite(void);

//New Added
u16 GetMiniStepCount(u8 speed);
void RunMiniStep(struct Sprite *sprite, u8 speed, u8 currentFrame);
void CreateSparkleSprite(void);

//Exported Data Structures

struct Follower
{
	bool8 inProgress;
	u8 objId;
	u8 currentSprite;
	u8 delayedState;
	struct
	{
		u8 id;
		u8 number;
		u8 group;
	} map;
	bool8 warpEnd;
	struct Coords16 log;
	const u8* script;
	u16 flag;
	u16 gfxId;
	u8 flags;
	u8 locked;
	bool8 createSurfBlob;
	bool8 comeOutDoorStairs;
};

#define FOLLOWER_FLAG_HAS_RUNNING_FRAMES 0x1
#define FOLLOWER_FLAG_CAN_BIKE 0x2
#define FOLLOWER_FLAG_CAN_LEAVE_ROUTE 0x4
#define FOLLOWER_FLAG_CAN_SURF 0x8
#define FOLLOWER_FLAG_CAN_WATERFALL 0x10
#define FOLLOWER_FLAG_CAN_DIVE 0x20
#define FOLLOWER_FLAG_CAN_ROCK_CLIMB 0x40
#define FOLLOWER_FLAG_CLEAR_ON_WHITE_OUT 0x80

//Where the follower mon stood when it was removed for a battle or a menu, so it comes back on the same tile.
//Lives outside gFollowerState (that struct has no spare room). 0x203E0CE-0x203E0D3 are free (BTS limit is 0x203E0D4).
//The tile is only meaningful on the map it was saved on, so the map is stored too (see FollowerSavedTileUsable).
#define FOLLOWER_SAVED_X         (*(vu8*) 0x203E0CE) //Event object coordinates (map coords + 7)
#define FOLLOWER_SAVED_Y         (*(vu8*) 0x203E0CF)
#define FOLLOWER_SAVED_DIR       (*(vu8*) 0x203E0D0) //Facing direction
#define FOLLOWER_SAVED_VALID     (*(vu8*) 0x203E0D1)
#define FOLLOWER_SAVED_MAP_GROUP (*(vu8*) 0x203E0D2)
#define FOLLOWER_SAVED_MAP_NUM   (*(vu8*) 0x203E0D3)

bool8 FollowerSavedTileUsable(void);

//Switches for the individual fixes from cfru_fixes.patch, so each can be bisected with a one-line change (1 = on, 0 = off).
#define FOLLOWER_FIX_SAVED_TILE  1 //Follower returns to its old tile after a battle/menu
#define FOLLOWER_FIX_SPAWN_WALL  1 //CreateFollowerMonObject never spawns the follower inside an impassable tile
#define FOLLOWER_FIX_DOOR_Y      0 //WarpSetEnd skips the "step into the doorway" if that tile is impassable (0 = original CFRU behaviour)

#define DEFAULT_FOLLOWER_LOCAL_ID 0xFE

extern struct Follower gFollowerState; //0x203B818
