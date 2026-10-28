# Chinese Font (中文字库)

`chinese_font.bin` is the CJK font patch extracted byte-for-byte from an external
FireRed 汉字库 patch (diff of `test - 副本1.gba` vs `test - 副本.gba`, 2026-10-28).
It is written into the ROM by `scripts/insert.py` **dynamically**, right after the
follower-mon sprites (4-byte aligned), so it moves safely if the follower-mon data
grows. The blob's internal font-base pointers and the six code-hook literals are
relocated to the runtime address at insert time (see `CHINESE_FONT_POINTERS` /
`CHINESE_FONT_HOOKS` in insert.py). The blob was extracted at file offset 0x129B404
(GBA 0x0929B404); `CHINESE_FONT_BLOB_BASE` asserts those original pointer values
before rewriting them.

## Blob layout (offsets relative to blob start)

| Offset in blob | Contents                                                                        |
|----------------|---------------------------------------------------------------------------------|
| 0x00000        | Full-width CJK glyphs, custom-LZ compressed (~108 KB)                            |
| 0x01B040       | Half-width glyphs + small header (~74 KB); base used by code = +0x90 (font B ptr) |
| 0x023A60       | Hook code + literal pools (888 bytes), text-engine entry point (Thumb)           |

0xFF padding gaps between the three parts are part of the blob and are kept.
The two absolute font-base pointers live at blob offsets **0x2DB64** (full-width)
and **0x2DB68** (half-width, delta 0x1B0D0).

## What the hooks do

- **0x08005842** (text printer): jumps to the blob's entry, which reads a 2-byte
  char (lead/trail), validates it as CJK (lead 0x01–0x1E excluding 0x06/0x1B, or
  0x37–0x3F; trail < 0xF7), advances the string cursor by 2 and converts it to a
  glyph index `((lead') << 8) + (trail - lead'*9)`, decompresses the glyph into
  IWRAM 0x03003DA0 and blits it via 0x08002F8C, then returns to 0x0800584C.
- **0x0813C10A / 0x0813C164 / 0x0813C18E / 0x0813C36A / 0x0813C3DA** (glyph draw):
  stubs (entry + 0x2DCC4/0x2DCE4/0x2DD04/0x2DD24/0x2DD48) so a 2-byte CJK char
  occupies a single glyph cell (they peek byte 2 and bump the cursor), and glyph
  codes >= 0x1000 are rendered from the CJK font instead of the vanilla font.
- **0x080F80D0**: one byte (`movs r0,#0xA` → `#0`) — static, lives in `bytereplacement`.
- **0x083FEB89/95/A1/AD/C5**: five palette-slot bytes (0x00 → 0x01) in the
  intro/title data table at 0x083FEB7C — static, lives in `bytereplacement`.

## Text encoding

`charmap.tbl` already encodes for this font: a charmap code `0xLLHH` is emitted
big-endian (`LL HH`) by the string compiler, and the hooks decode
`glyph = ((lead') << 8) + (trail - lead'*9)` with
`lead' = lead-1 (lead<6) / lead-2 (6≤lead<0x1B) / lead-3 (lead≥0x1B)`.
That makes charmap 0x0100 (啊) glyph 0, 0x0200 (曹) glyph 0xF7, … contiguous.
Codes whose trail byte would be ≥ 0xF7 (e.g. 0x01F7–0x01FF) are reserved/empty in
charmap.tbl on purpose. Lead bytes 0x37–0x3F map to glyphs 0x1B05–0x1B0D
(full-width punctuation).

## Build integration

- Blob + 6 dynamic hooks are applied by `scripts/insert.py` directly after the
  follower-mon sprites, with a capacity guard against the engine (0x1350000).
- The 7 static byte patches live in `bytereplacement` under `##Chinese Font`.
- Verification (2026-10-28): a full build equals the external patch ROM shifted
  to the dynamic address — byte-for-byte identical pointer/relocation semantics.
