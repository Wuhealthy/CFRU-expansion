#include "defines.h"
#include "../include/new/front_pic_table.h"

// Keep these keys in sync with the DPE insert script and resolver.
#define FRONT_PIC_TABLE_ADD_KEY1 0x0142B16Du
#define FRONT_PIC_TABLE_SUB_KEY1 0x02F318C9u
#define FRONT_PIC_TABLE_ADD_KEY2 0x0006D2F1u
#define FRONT_PIC_TABLE_SUB_KEY2 0x00D1A75Du
#define FRONT_PIC_TABLE_LEGACY_KEY 0x02000000u
#define FRONT_PIC_TABLE_SHEET_SIZE ((64 * 64) / 2)

static bool8 IsRomPtr(u32 ptr)
{
    return ptr >= 0x08000000 && ptr < 0x0A000000;
}

static bool8 IsFrontPicTableCandidate(const struct CompressedSpriteSheet *table)
{
    return IsRomPtr((u32)table)
        && IsRomPtr((u32)table[0].data)
        && table[0].size == FRONT_PIC_TABLE_SHEET_SIZE
        && table[0].tag == 0
        && IsRomPtr((u32)table[1].data)
        && table[1].size == FRONT_PIC_TABLE_SHEET_SIZE
        && table[1].tag == 1;
}

const struct CompressedSpriteSheet *GetMonFrontPicTableCompat(void)
{
    u32 ptr = *((u32 *)0x08000128);
    u32 decoded;

    if (IsFrontPicTableCandidate((const struct CompressedSpriteSheet *)ptr))
        return (const struct CompressedSpriteSheet *)ptr;

    decoded = ptr + FRONT_PIC_TABLE_SUB_KEY2 - FRONT_PIC_TABLE_ADD_KEY2
              + FRONT_PIC_TABLE_SUB_KEY1 - FRONT_PIC_TABLE_ADD_KEY1;
    if (IsFrontPicTableCandidate((const struct CompressedSpriteSheet *)decoded))
        return (const struct CompressedSpriteSheet *)decoded;

    decoded = ptr + FRONT_PIC_TABLE_LEGACY_KEY;
    if (IsFrontPicTableCandidate((const struct CompressedSpriteSheet *)decoded))
        return (const struct CompressedSpriteSheet *)decoded;

    return NULL;
}
