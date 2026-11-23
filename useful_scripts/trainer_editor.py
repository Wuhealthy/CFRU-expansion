#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import struct
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk

try:
    from PIL import Image, ImageTk
except ImportError:
    Image = None
    ImageTk = None


ROOT = Path(__file__).resolve().parents[1]
NORMAL_PARTY = ROOT / "src/Tables/trainers.party"
HARD_PARTY = ROOT / "src/Tables/hardtrainers.party"
OPPONENTS_HEADER = ROOT / "include/constants/opponents.h"
TRAINER_DEFINES = ROOT / "src/Tables/trainer_defines.h"
ROM_PATH = ROOT / "BPRE0.gba"
CACHE_DIR = Path(tempfile.gettempdir()) / "cfru_trainer_editor_sprites"
MOVES_HEADER = ROOT / "include/constants/moves.h"
ITEMS_HEADER = ROOT / "include/constants/items.h"
SPECIES_HEADER = ROOT / "include/constants/species.h"
ABILITIES_HEADER = ROOT / "include/constants/abilities.h"
POKEMON_HEADER = ROOT / "include/constants/pokemon.h"
TRAINERS_HEADER = ROOT / "include/constants/trainers.h"
BATTLE_AI_HEADER = ROOT / "include/constants/battle_ai.h"
MOVE_NAMES_FILE = ROOT / "strings/attack_name_table.string"
Z_MOVE_NAMES_FILE = ROOT / "strings/z_move_names.string"
Z_MOVE_TABLE_FILE = ROOT / "assembly/data/z_move_name_table.s"
TYPE_NAMES_FILE = ROOT / "strings/type_names.string"
ABILITY_NAMES_FILE = ROOT / "strings/ability_name_table.string"
ITEM_TABLES_FILE = ROOT / "src/Tables/item_tables.c"
BASE_STATS_FILE = ROOT.parent / "Dynamic-Pokemon-Expansion-Gen-9" / "src" / "Base_Stats.c"
CLASSES_HEADER = ROOT / "include/constants/trainer_classes.h"
POKEMON_NAMES_FILE = ROOT.parent / "Dynamic-Pokemon-Expansion-Gen-9" / "strings" / "Pokemon_Name_Table.string"
TM_TABLE_FILE = ROOT.parent / "Dynamic-Pokemon-Expansion-Gen-9" / "src" / "TM_Tutor_Tables.c"

sys.path.insert(0, str(ROOT / "scripts"))
from trainer_party import PartyError, Symbols, build as build_trainer_parties, generate as generate_trainer_parties, parse as parse_generated_party  # noqa: E402

TRAINER_FIELDS = [
    "Name",
    "Class",
    "Pic",
    "Gender",
    "Music",
    "Items",
    "Double Battle",
    "AI",
]

MON_FIELDS = [
    "Ability",
    "Level",
    "IVs",
    "EVs",
    "CFRU IV",
    "Nature",
    "Tera Type",
    "Hidden Power Type",
]

STAT_FIELDS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"]
MON_SIMPLE_FIELDS = [field for field in MON_FIELDS if field not in {"IVs", "EVs"}]
STAT_ALIASES = {
    "hp": "HP",
    "atk": "Atk",
    "attack": "Atk",
    "def": "Def",
    "defense": "Def",
    "spa": "SpA",
    "spatk": "SpA",
    "spattack": "SpA",
    "spd": "SpD",
    "dpd": "SpD",
    "spdef": "SpD",
    "spdefense": "SpD",
    "spe": "Spe",
    "speed": "Spe",
}


def remove_prefix(value: str, prefix: str) -> str:
    """Python 3.7-compatible equivalent of str.removeprefix()."""
    return value[len(prefix):] if value.startswith(prefix) else value


@dataclass
class PokemonEntry:
    title: str
    fields: dict[str, str] = field(default_factory=dict)
    moves: list[str] = field(default_factory=list)
    extra_lines: list[str] = field(default_factory=list)

    @property
    def species(self) -> str:
        title = self.title.strip()
        match = re.search(r"\((SPECIES_[A-Z0-9_]+|[^)]+)\)", title)
        if match:
            return remove_prefix(match.group(1), "SPECIES_")
        before_item = title.split("@", 1)[0].strip()
        before_gender = re.sub(r"\s+\([MF]\)\s*$", "", before_item).strip()
        return before_gender

    @property
    def held_item(self) -> str:
        if "@" not in self.title:
            return ""
        return self.title.split("@", 1)[1].strip()


@dataclass
class TrainerBlock:
    trainer_id: str
    start: int
    end: int
    fields: dict[str, str] = field(default_factory=dict)
    pokemon: list[PokemonEntry] = field(default_factory=list)
    raw_prefix: str = ""
    editable: bool = True

    @property
    def label(self) -> str:
        name = self.fields.get("Name", "").strip()
        klass = self.fields.get("Class", "").strip()
        bits = [self.trainer_id]
        if name:
            bits.append(name)
        if klass:
            bits.append(f"({klass})")
        return " - ".join(bits)


def backup(path: Path) -> None:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(path, path.with_suffix(path.suffix + f".trainer_editor_{stamp}.bak"))


def add_trainer_definitions(trainer_id: str) -> None:
    defines = TRAINER_DEFINES.read_text(encoding="utf-8")
    opponents = OPPONENTS_HEADER.read_text(encoding="utf-8")
    if re.search(rf"(?m)^#define\s+{re.escape(trainer_id)}\b", defines):
        raise ValueError(f"{trainer_id} already exists in trainer_defines.h.")
    values = [int(value, 0) for value in re.findall(r"(?m)^#define\s+TRAINER_[A-Z0-9_]+\s+(0x[0-9A-Fa-f]+|\d+)\s*$", defines)]
    new_value = max(values) + 1
    line = f"#define {trainer_id:<45} {new_value}\n"
    count = re.search(r"(?m)^#define\s+MAX_TRAINER_COUNT\b.*$", defines)
    opponent_count = re.search(r"(?m)^#define\s+TRAINERS_COUNT\b.*$", opponents)
    if count is None or opponent_count is None:
        raise ValueError("Trainer count constants were not found.")
    new_defines = defines[:count.start()] + line + f"\n#define MAX_TRAINER_COUNT ({trainer_id} + 1)" + defines[count.end():]
    new_opponents = opponents[:opponent_count.start()] + line + f"#define TRAINERS_COUNT ({trainer_id} + 1)" + opponents[opponent_count.end():]
    backup(TRAINER_DEFINES); backup(OPPONENTS_HEADER)
    TRAINER_DEFINES.write_text(new_defines)
    OPPONENTS_HEADER.write_text(new_opponents)


def strip_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def parse_pokemon(chunk: str) -> PokemonEntry | None:
    lines = [line.rstrip() for line in chunk.splitlines() if line.strip()]
    if not lines:
        return None
    mon = PokemonEntry(title=lines[0])
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith("- "):
            mon.moves.append(stripped[2:].strip())
        elif ":" in stripped:
            key, value = stripped.split(":", 1)
            mon.fields[key.strip()] = value.strip()
        else:
            mon.extra_lines.append(stripped)
    return mon


def parse_trainer_body(body: str) -> tuple[dict[str, str], list[PokemonEntry], str]:
    body = body.strip("\n")
    if not body:
        return {}, [], ""
    parts = re.split(r"\n\s*\n", body)
    fields: dict[str, str] = {}
    prefix_lines: list[str] = []
    trainer_lines = parts[0].splitlines() if parts else []
    for line in trainer_lines:
        stripped = line.strip()
        if ":" in stripped:
            key, value = stripped.split(":", 1)
            fields[key.strip()] = value.strip()
        elif stripped:
            prefix_lines.append(stripped)
    pokemon = []
    for part in parts[1:]:
        mon = parse_pokemon(part)
        if mon is not None:
            pokemon.append(mon)
    return fields, pokemon, "\n".join(prefix_lines)


def parse_party_file(path: Path) -> tuple[str, list[TrainerBlock]]:
    text = path.read_text(encoding="utf-8")
    masked = re.sub(r"/\*.*?\*/", lambda match: re.sub(r"[^\r\n]", " ", match.group(0)), text, flags=re.S)
    pattern = re.compile(r"^===\s+(TRAINER_[A-Z0-9_]+)\s+===\s*$", re.M)
    matches = list(pattern.finditer(masked))
    trainers: list[TrainerBlock] = []
    for index, match in enumerate(matches):
        body_start = match.end()
        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[body_start:block_end]
        body = strip_comments(body)
        fields, pokemon, raw_prefix = parse_trainer_body(body)
        trainers.append(TrainerBlock(match.group(1), match.start(), block_end, fields, pokemon, raw_prefix))
    return text, trainers


def format_mon(mon: PokemonEntry) -> str:
    lines = [mon.title.strip() or "Poochyena"]
    for key in MON_FIELDS:
        value = mon.fields.get(key, "").strip()
        if value:
            lines.append(f"{key}: {value}")
    for key in sorted(k for k in mon.fields if k not in MON_FIELDS):
        value = mon.fields[key].strip()
        if value:
            lines.append(f"{key}: {value}")
    lines.extend(mon.extra_lines)
    lines.extend(f"- {move}" for move in mon.moves if move.strip())
    return "\n".join(lines)


def format_trainer_block(trainer: TrainerBlock) -> str:
    lines = [f"=== {trainer.trainer_id} ==="]
    if trainer.raw_prefix.strip():
        lines.append(trainer.raw_prefix.strip())
    for key in TRAINER_FIELDS:
        if key in trainer.fields:
            lines.append(f"{key}: {trainer.fields.get(key, '').strip()}")
    for key in sorted(k for k in trainer.fields if k not in TRAINER_FIELDS):
        lines.append(f"{key}: {trainer.fields[key].strip()}")
    if trainer.pokemon:
        lines.append("")
        lines.append("\n\n".join(format_mon(mon) for mon in trainer.pokemon))
    return "\n".join(lines).rstrip() + "\n\n"


def normalize_name(value: str) -> str:
    value = remove_prefix(remove_prefix(value.strip(), "SPECIES_"), "TRAINER_PIC_FRONT_")
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    value = value.replace("-", " ").replace("_", " ")
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value


def snake_name(value: str) -> str:
    return normalize_name(value).replace(" ", "_")


def title_from_symbol(symbol: str) -> str:
    value = remove_prefix(symbol, "gTrainerFrontPic_")
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    value = value.replace("Frlg", " FRLG")
    return re.sub(r"\s+", " ", value).strip()


def c_defines(path: Path, prefix: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for name, raw in re.findall(rf"(?m)^\s*#define\s+({re.escape(prefix)}[A-Z0-9_]+)\s+([^/\s]+)", path.read_text(encoding="utf-8")):
        try:
            result[name] = int(raw, 0)
        except ValueError:
            if raw in result:
                result[name] = result[raw]
    return result


def rom_offset(pointer: int) -> int:
    return pointer - 0x08000000 if 0x08000000 <= pointer < 0x0A000000 else pointer


def lz77(data: bytes, offset: int) -> bytes:
    if offset < 0 or offset + 4 > len(data) or data[offset] != 0x10:
        raise ValueError(f"Invalid GBA LZ77 stream at ROM offset 0x{offset:X}")
    size = int.from_bytes(data[offset + 1:offset + 4], "little")
    source = offset + 4
    output = bytearray()
    while len(output) < size:
        flags = data[source]; source += 1
        for bit in range(7, -1, -1):
            if len(output) >= size:
                break
            if flags & (1 << bit):
                first, second = data[source], data[source + 1]; source += 2
                length = (first >> 4) + 3
                distance = ((first & 0xF) << 8 | second) + 1
                for _ in range(length):
                    output.append(output[-distance])
            else:
                output.append(data[source]); source += 1
    return bytes(output[:size])


def gba_image(tiles: bytes, palette_data: bytes):
    if Image is None:
        return None
    colors = []
    for index in range(16):
        color = struct.unpack_from("<H", palette_data, index * 2)[0]
        colors.append(((color & 31) * 255 // 31, ((color >> 5) & 31) * 255 // 31, ((color >> 10) & 31) * 255 // 31, 0 if index == 0 else 255))
    image = Image.new("RGBA", (64, 64))
    pixels = image.load()
    for tile in range(min(64, len(tiles) // 32)):
        tile_x, tile_y = (tile % 8) * 8, (tile // 8) * 8
        for byte_index in range(32):
            value = tiles[tile * 32 + byte_index]
            x = tile_x + (byte_index * 2) % 8
            y = tile_y + (byte_index * 2) // 8
            pixels[x, y] = colors[value & 0xF]
            pixels[x + 1, y] = colors[value >> 4]
    return image


def extract_rom_sprite(kind: str, index: int) -> Path | None:
    if Image is None or not ROM_PATH.exists():
        return None
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / f"{ROM_PATH.stat().st_mtime_ns}_{kind}_{index}.png"
    if target.exists():
        return target
    try:
        rom = ROM_PATH.read_bytes()
        if kind == "pokemon":
            sprite_table = rom_offset(struct.unpack_from("<I", rom, 0x128)[0])
            palette_table = rom_offset(struct.unpack_from("<I", rom, 0x130)[0])
        else:
            sprite_table = rom_offset(0x0823957C)
            palette_table = rom_offset(0x08239A1C)
        sprite_pointer = struct.unpack_from("<I", rom, sprite_table + index * 8)[0]
        palette_pointer = struct.unpack_from("<I", rom, palette_table + index * 8)[0]
        tiles = lz77(rom, rom_offset(sprite_pointer))
        palette = lz77(rom, rom_offset(palette_pointer))
        image = gba_image(tiles, palette)
        if image is None:
            return None
        image.save(target)
        return target
    except (IndexError, OSError, ValueError, struct.error):
        return None


def load_trainer_pic_paths() -> tuple[dict[str, Path], list[str]]:
    values = c_defines(TRAINERS_HEADER, "TRAINER_PIC_")
    paths: dict[str, Path] = {}
    choices: list[str] = []
    for symbol, index in values.items():
        label = symbol_to_display_name(symbol, "TRAINER_PIC_")
        choices.append(label)
        path = extract_rom_sprite("trainer", index)
        if path is not None:
            paths[normalize_name(label)] = path
    return paths, choices


def load_species_choices() -> list[str]:
    if not SPECIES_HEADER.exists():
        return []
    text = strip_comments(SPECIES_HEADER.read_text(encoding="utf-8"))
    species: list[str] = []
    seen: set[str] = set()
    for symbol in re.findall(r"^\s*#define\s+(SPECIES_[A-Z0-9_]+)\b", text, re.M):
        if symbol in {"SPECIES_NONE", "SPECIES_EGG", "SPECIES_SHINY_TAG"}:
            continue
        if symbol.startswith("SPECIES_") and symbol not in seen:
            species.append(symbol_to_display_name(symbol, "SPECIES_"))
            seen.add(symbol)
    return species


def load_move_choices() -> list[str]:
    if not MOVES_HEADER.exists():
        return []
    moves = []
    for symbol in c_defines(MOVES_HEADER, "MOVE_"):
        if symbol in {"MOVE_NONE", "MOVE_DEFAULT", "MOVE_UNAVAILABLE"}:
            continue
        moves.append(symbol_to_display_name(symbol, "MOVE_"))
    return moves


def symbol_to_display_name(symbol: str, prefix: str) -> str:
    return remove_prefix(symbol, prefix).replace("_", " ").title()


# ---------------------------------------------------------------- 中文名映射
# 界面显示中文、写入 .party 时仍是英文（scripts/trainer_party.py 只认英文）

NATURE_EN_ZH = {
    "Hardy": "勤奋", "Lonely": "怕寂寞", "Brave": "勇敢", "Adamant": "固执", "Naughty": "顽皮",
    "Bold": "大胆", "Docile": "坦率", "Relaxed": "悠闲", "Impish": "淘气", "Lax": "乐天",
    "Timid": "胆小", "Hasty": "急躁", "Serious": "认真", "Jolly": "爽朗", "Naive": "天真",
    "Modest": "内敛", "Mild": "慢吞吞", "Quiet": "冷静", "Bashful": "害羞", "Rash": "马虎",
    "Calm": "温和", "Gentle": "温柔", "Sassy": "自大", "Careful": "慎重", "Quirky": "浮躁",
}


def parse_string_labels(path: Path) -> list[tuple[str, str]]:
    """解析 .string 文件: '#org @LABEL' 的下一个非注释行为文本, 返回有序 (LABEL, TEXT) 列表."""
    entries: list[tuple[str, str]] = []
    if not path.exists():
        return entries
    label = None
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if line.startswith("#org @"):
            label = line[len("#org @"):].strip()
        elif line and not line.startswith("#") and "=" not in line and label is not None:
            entries.append((label, line))
            label = None
    return entries


def load_species_zh() -> dict[str, str]:
    """英文名 -> 中文名, 数据来自 DPE 的 Pokemon_Name_Table.string (位置对应种族编号)."""
    entries = [entry for entry in parse_string_labels(POKEMON_NAMES_FILE) if entry[0] != "gSpeciesNames"]
    zh_by_pos = {pos: text for pos, (_label, text) in enumerate(entries)}
    zh_by_label = {}
    for label, text in entries:
        zh_by_label[re.sub(r"^NAME_", "", label).upper()] = text
    en2zh: dict[str, str] = {}
    if SPECIES_HEADER.exists():
        for symbol, index in c_defines(SPECIES_HEADER, "SPECIES_").items():
            if symbol in {"SPECIES_NONE", "SPECIES_EGG", "SPECIES_SHINY_TAG"}:
                continue
            zh = zh_by_pos.get(index) or zh_by_label.get(remove_prefix(symbol, "SPECIES_"))
            if zh and "?" not in zh:
                en2zh[symbol_to_display_name(symbol, "SPECIES_")] = zh
    return en2zh


def load_tm_move_names() -> dict[int, tuple[str, str]]:
    """TM 编号 -> (MOVE_ 符号, 注释中文名), 来自 DPE 的 TM_Tutor_Tables.c (gTMHMMoves, 121-128 是 HM)."""
    result: dict[int, tuple[str, str]] = {}
    if not TM_TABLE_FILE.exists():
        return result
    text = TM_TABLE_FILE.read_text(encoding="utf-8")
    match = re.search(r"gTMHMMoves\[NUM_TMSHMS\]\s*=\s*\{(.*?)\n\};", text, re.S)
    if not match:
        return result
    for line in match.group(1).splitlines():
        entry = re.match(r"\s*MOVE_([A-Z0-9_]+)\s*,?\s*//\s*(\d+)\s*(\S.*)?", line)
        if entry:
            result[int(entry.group(2))] = (entry.group(1), (entry.group(3) or "").strip())
    return result


def load_item_zh() -> dict[str, str]:
    """英文名 -> 中文名, 数据来自 src/Tables/item_tables.c 的 CN("...") 名称.
    CN 可带第二个参数如 CN("皮可西石", 14); TM/HM 等别名道具 (ITEM_TM01_FOCUS_PUNCH -> ITEM_TM01)
    通过 items.h 的 #define 别名链解析."""
    en2zh: dict[str, str] = {}
    symbol_zh: dict[str, str] = {}
    if ITEM_TABLES_FILE.exists():
        text = ITEM_TABLES_FILE.read_text(encoding="utf-8", errors="replace")
        for match in re.finditer(r'CN\("([^"]+)"\s*(?:,[^)]*)?\)(?:(?!\}).){0,300}?\.itemId\s*=\s*ITEM_([A-Z0-9_]+)', text, re.S):
            symbol_zh[match.group(2)] = match.group(1)
        for symbol, zh in symbol_zh.items():
            en2zh[symbol_to_display_name("ITEM_" + symbol, "ITEM_")] = zh
    if ITEMS_HEADER.exists():
        header = ITEMS_HEADER.read_text(encoding="utf-8")
        # 收集每个道具符号的编号: #define 直接赋值 + enum 显式/顺序赋值 (TM/HM 等别名与正式道具同编号)
        id_by_symbol: dict[str, int] = {}
        for name, value in re.findall(r"#define\s+ITEM_([A-Z0-9_]+)\s+(0x[0-9A-Fa-f]+|\d+)\b", header):
            id_by_symbol.setdefault(name, int(value, 0))
        current = None
        for raw in header.splitlines():
            match = re.match(r"ITEM_([A-Z0-9_]+)\s*(?:=\s*(0x[0-9A-Fa-f]+|\d+))?\s*,?\s*$", raw.strip())
            if not match:
                continue
            name, value = match.group(1), match.group(2)
            if value is not None:
                current = int(value, 0)
            elif current is not None:
                current += 1
            else:
                continue
            id_by_symbol.setdefault(name, current)
        zh_by_id = {}
        for symbol, zh in symbol_zh.items():
            item_id = id_by_symbol.get(symbol)
            if item_id is not None:
                zh_by_id[item_id] = zh
        for symbol, item_id in id_by_symbol.items():
            if symbol in symbol_zh:
                continue
            zh = zh_by_id.get(item_id)
            if zh:
                en2zh[symbol_to_display_name("ITEM_" + symbol, "ITEM_")] = zh
        # TM/HM 道具显示「学习器编号·招式中文名」: 编号与招式来自 DPE 的 gTMHMMoves
        tm_moves = load_tm_move_names()
        if tm_moves:
            move_zh_map = load_move_zh()
            for symbol in id_by_symbol:
                number = None
                is_hm = False
                matched = re.match(r"TM(\d+)", symbol)
                if matched:
                    number = int(matched.group(1))
                else:
                    matched = re.match(r"HM(\d+)", symbol)
                    if matched:
                        number = int(matched.group(1)) + 120
                        is_hm = True
                if number is None or number not in tm_moves:
                    continue
                move_symbol, comment = tm_moves[number]
                move_name = move_zh_map.get(symbol_to_display_name("MOVE_" + move_symbol, "MOVE_")) or comment
                if not move_name:
                    continue
                label = "秘传学习器" if is_hm else "招式学习器"
                en2zh[symbol_to_display_name("ITEM_" + symbol, "ITEM_")] = "%s%02d·%s" % (label, number if not is_hm else number - 120, move_name)
    return en2zh


def load_move_zh() -> dict[str, str]:
    """英文名 -> 中文名。attack_name_table.string 的标签多为缩写, 不能按名字匹配,
    必须按位置对应招式编号; Z 招式名在 z_move_names.string (按 z_move_name_table.s 偏移),
    极巨/超极巨招式显示时加前缀 (参考 pokedex_site/tools/extract_data.py)."""
    if not MOVES_HEADER.exists():
        return {}
    header_text = MOVES_HEADER.read_text(encoding="utf-8")
    move_ids: dict[str, int] = {}
    for name, value in re.findall(r"#define\s+MOVE_([A-Z0-9_]+)\s+(0x[0-9A-Fa-f]+|\d+)\b", header_text):
        if name == "NAME_LENGTH":
            continue
        move_ids[name] = int(value, 0)
    bounds = {
        match.group(1): move_ids.get(match.group(2))
        for match in re.finditer(r"#define\s+((?:FIRST|LAST)_\w+_MOVE)\s+MOVE_([A-Z0-9_]+)", header_text)
    }
    name_tbl = [text for label, text in parse_string_labels(MOVE_NAMES_FILE) if label != "gMoveNames"]
    z_names = dict(parse_string_labels(Z_MOVE_NAMES_FILE))
    z_labels = re.findall(r"\.word\s+(\w+)", Z_MOVE_TABLE_FILE.read_text(encoding="utf-8", errors="replace")) if Z_MOVE_TABLE_FILE.exists() else []
    first_z, last_z = bounds.get("FIRST_Z_MOVE"), bounds.get("LAST_Z_MOVE")
    first_max, last_max = bounds.get("FIRST_MAX_MOVE"), bounds.get("LAST_MAX_MOVE")
    first_gmax, last_gmax = bounds.get("FIRST_G_MAX_MOVE"), bounds.get("LAST_G_MAX_MOVE")
    en2zh: dict[str, str] = {}
    for symbol, index in move_ids.items():
        if first_z is not None and last_z is not None and first_z <= index <= last_z:
            slot = index - first_z
            zh = z_names.get(z_labels[slot], "") if slot < len(z_labels) else ""
        else:
            zh = name_tbl[index] if index < len(name_tbl) else ""
        if not zh or zh == "-":
            continue
        if first_gmax is not None and last_gmax is not None and first_gmax <= index <= last_gmax:
            zh = "超极巨" + zh
        elif first_max is not None and last_max is not None and first_max <= index <= last_max:
            zh = "极巨" + zh
        en2zh[symbol_to_display_name("MOVE_" + symbol, "MOVE_")] = zh
    return en2zh


def load_type_zh() -> dict[str, str]:
    zh_by_key = {}
    for label, text in parse_string_labels(TYPE_NAMES_FILE):
        match = re.match(r"NAME_(.+)$", label)
        if match:
            zh_by_key[match.group(1).upper()] = text
    en2zh: dict[str, str] = {}
    if POKEMON_HEADER.exists():
        for symbol in re.findall(r"\b(TYPE_[A-Z0-9_]+)\b", strip_comments(POKEMON_HEADER.read_text(encoding="utf-8"))):
            if symbol in {"TYPE_NONE", "TYPE_MYSTERY", "NUMBER_OF_MON_TYPES"}:
                continue
            zh = zh_by_key.get(remove_prefix(symbol, "TYPE_"))
            if zh and "?" not in zh:
                en2zh.setdefault(symbol_to_display_name(symbol, "TYPE_"), zh)
    return en2zh


def load_ability_zh() -> dict[str, str]:
    zh_by_id = {}
    for label, text in parse_string_labels(ABILITY_NAMES_FILE):
        match = re.match(r"NAME_ABILITY_(\d+)_", label)
        if match:
            zh_by_id[int(match.group(1))] = text
    suffix2zh: dict[str, str] = {}
    if ABILITIES_HEADER.exists():
        for symbol, index in c_defines(ABILITIES_HEADER, "ABILITY_").items():
            zh = zh_by_id.get(index)
            if zh:
                suffix2zh[remove_prefix(symbol, "ABILITY_")] = zh
    return suffix2zh


def load_species_abilities() -> dict[str, tuple[str, str, str]]:
    """种族特性: SPECIES_ 符号 -> (特性1, 特性2, 隐藏特性) 的 ABILITY_ 后缀, 来自 src/Base_Stats.c."""
    result: dict[str, tuple[str, str, str]] = {}
    if not BASE_STATS_FILE.exists():
        return result
    text = BASE_STATS_FILE.read_text(encoding="utf-8", errors="replace")
    for match in re.finditer(r"\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*\{", text):
        start = text.index("{", match.end() - 1)
        depth = 0
        end = len(text) - 1
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        body = text[start:end]
        def grab(field: str) -> str:
            found = re.search(rf"\.\s*{field}\s*=\s*ABILITY_([A-Z0-9_]+)", body)
            return found.group(1) if found and found.group(1) != "NONE" else ""
        result[match.group(1)] = (grab("ability1"), grab("ability2"), grab("hiddenAbility"))
    return result


_NAME_MAPS: dict[str, tuple[dict[str, str], dict[str, str]]] | None = None
_SPECIES_ABILITIES: dict[str, tuple[str, str, str]] | None = None
_ABILITY_SUFFIX_ZH: dict[str, str] | None = None


def get_name_maps() -> dict[str, tuple[dict[str, str], dict[str, str]]]:
    """惰性加载所有中英映射: kind -> (英文->中文, 中文->英文)."""
    global _NAME_MAPS
    if _NAME_MAPS is None:
        maps = {
            "species": load_species_zh(),
            "item": load_item_zh(),
            "move": load_move_zh(),
            "type": load_type_zh(),
            "nature": dict(NATURE_EN_ZH),
        }
        _NAME_MAPS = {}
        for kind, en2zh in maps.items():
            zh2en: dict[str, str] = {}
            for en, zh in en2zh.items():
                zh2en.setdefault(zh, en)
            _NAME_MAPS[kind] = (en2zh, zh2en)
    return _NAME_MAPS


def to_zh(kind: str, value: str) -> str:
    value = value.strip()
    return get_name_maps()[kind][0].get(value, value)


def to_en(kind: str, value: str) -> str:
    value = value.strip()
    return get_name_maps()[kind][1].get(value, value)


def get_species_abilities_cached(symbol: str) -> tuple[str, str, str]:
    global _SPECIES_ABILITIES
    if _SPECIES_ABILITIES is None:
        _SPECIES_ABILITIES = load_species_abilities()
    return _SPECIES_ABILITIES.get(symbol, ("", "", ""))


def ability_suffix_zh(suffix: str) -> str:
    global _ABILITY_SUFFIX_ZH
    if _ABILITY_SUFFIX_ZH is None:
        _ABILITY_SUFFIX_ZH = load_ability_zh()
    if not suffix:
        return "无"
    return _ABILITY_SUFFIX_ZH.get(suffix, suffix.replace("_", " ").title())


FIELD_TO_KIND = {"Nature": "nature", "Tera Type": "type", "Hidden Power Type": "type"}


FIELD_LABELS = {
    "Ability": "特性",
    "Level": "等级",
    "CFRU IV": "CFRU 个体",
    "Nature": "性格",
    "Hidden Power Type": "隐藏力量属性",
    "Tera Type": "太晶属性",
}


def field_label(key: str) -> str:
    return FIELD_LABELS.get(key, key)


def display_name_to_symbol(value: str, prefix: str) -> str:
    cleaned = value.strip()
    if cleaned.startswith(prefix):
        return cleaned.upper()
    return prefix + snake_name(cleaned).upper()


def format_move_name(value: str) -> str:
    value = value.strip()
    if value.startswith("MOVE_"):
        value = symbol_to_display_name(value, "MOVE_")
    return to_zh("move", value)


def load_class_choices() -> list[str]:
    if not CLASSES_HEADER.exists():
        return []
    text = strip_comments(CLASSES_HEADER.read_text(encoding="utf-8"))
    symbols = re.findall(r"\b(CLASS_[A-Z0-9_]+)\s*(?:=|,)", text)
    seen: set[str] = set()
    choices = []
    for symbol in symbols:
        if symbol not in seen:
            seen.add(symbol)
            choices.append(symbol_to_display_name(symbol, "CLASS_"))
    return choices


def load_item_choices() -> list[str]:
    if not ITEMS_HEADER.exists():
        return []
    text = strip_comments(ITEMS_HEADER.read_text(encoding="utf-8"))
    items: list[str] = []
    seen: set[str] = set()
    for symbol in re.findall(r"\b(ITEM_[A-Z0-9_]+)\b", text):
        if symbol in {"ITEM_NONE", "ITEMS_COUNT"}:
            continue
        if symbol in seen:
            continue
        seen.add(symbol)
        items.append(symbol_to_display_name(symbol, "ITEM_"))
    return items


def load_ball_choices(item_choices: list[str]) -> list[str]:
    return [item for item in item_choices if item.endswith(" Ball")]


def load_party_field_choices(field: str) -> list[str]:
    choices: list[str] = []
    for path in (NORMAL_PARTY, HARD_PARTY):
        if not path.exists():
            continue
        for value in re.findall(rf"^\s*{re.escape(field)}:\s*(.+?)\s*$", path.read_text(encoding="utf-8"), re.M):
            value = value.strip()
            if value and value not in choices:
                choices.append(value)
    return choices


def load_music_choices() -> list[str]:
    choices: list[str] = []
    if TRAINERS_HEADER.exists():
        text = strip_comments(TRAINERS_HEADER.read_text(encoding="utf-8"))
        for symbol in re.findall(r"\b(TRAINER_ENCOUNTER_MUSIC_[A-Z0-9_]+)\b", text):
            name = symbol_to_display_name(symbol, "TRAINER_ENCOUNTER_MUSIC_")
            if name not in choices:
                choices.append(name)
    for name in load_party_field_choices("Music"):
        if name not in choices:
            choices.append(name)
    return choices


def load_ai_choices() -> list[str]:
    choices: list[str] = []
    if BATTLE_AI_HEADER.exists():
        text = strip_comments(BATTLE_AI_HEADER.read_text(encoding="utf-8"))
        for symbol in re.findall(r"\b(AI_SCRIPT_[A-Z0-9_]+)\b", text):
            name = symbol_to_display_name(symbol, "AI_SCRIPT_")
            if name not in choices:
                choices.append(name)
    for name in load_party_field_choices("AI"):
        if name not in choices:
            choices.append(name)
    return choices


def load_type_choices() -> list[str]:
    if not POKEMON_HEADER.exists():
        return []
    text = strip_comments(POKEMON_HEADER.read_text(encoding="utf-8"))
    choices: list[str] = []
    for symbol in re.findall(r"\b(TYPE_[A-Z0-9_]+)\b", text):
        if symbol in {"TYPE_NONE", "TYPE_MYSTERY"}:
            continue
        if symbol == "NUMBER_OF_MON_TYPES":
            break
        name = symbol_to_display_name(symbol, "TYPE_")
        if name not in choices:
            choices.append(name)
    return choices


def load_nature_choices() -> list[str]:
    if not POKEMON_HEADER.exists():
        return []
    text = strip_comments(POKEMON_HEADER.read_text(encoding="utf-8"))
    choices: list[str] = []
    for symbol in re.findall(r"\b(NATURE_[A-Z0-9_]+)\b", text):
        if symbol in {"NATURE_RANDOM", "NATURE_MAY_SYNCHRONIZE"}:
            continue
        name = symbol_to_display_name(symbol, "NATURE_")
        if name not in choices:
            choices.append(name)
    return choices


def load_ability_choices() -> list[str]:
    return ["Hidden", "Ability 1", "Ability 2", "Random 1 2", "Random All"]


def load_species_ability_choices() -> dict[str, list[str]]:
    # CFRU trainer parties store an ability slot, not an ability constant.
    return {}


def get_field_case_insensitive(fields: dict[str, str], key: str) -> str:
    wanted = key.lower()
    for field_key, value in fields.items():
        if field_key.lower() == wanted:
            return value
    return ""


def set_field_case_insensitive(fields: dict[str, str], key: str, value: str) -> None:
    for field_key in list(fields):
        if field_key.lower() == key.lower() and field_key != key:
            del fields[field_key]
    fields[key] = value


def parse_stat_spread(value: str) -> dict[str, str]:
    stats: dict[str, str] = {}
    for amount, stat in re.findall(r"(\d+)\s+([A-Za-z]+)", value):
        normalized = STAT_ALIASES.get(stat.lower())
        if normalized is not None:
            stats[normalized] = amount
    return stats


def format_stat_spread(values: dict[str, str]) -> str:
    parts = [f"{value} {stat}" for stat, value in values.items() if value.strip()]
    return " / ".join(parts)


def find_opponent_header_clone(trainer_id: str) -> str | None:
    if not OPPONENTS_HEADER.exists():
        return None
    text = strip_comments(OPPONENTS_HEADER.read_text(encoding="utf-8"))
    pattern = re.compile(r"^\s*#define\s+(TRAINER_[A-Z0-9_]+)\s+(TRAINER_[A-Z0-9_]+)\b", re.M)
    for clone_header, source_header in pattern.findall(text):
        if source_header == trainer_id and clone_header != trainer_id:
            return clone_header
    return None


def pokemon_preview_path(species: str) -> Path | None:
    wanted = re.sub(r"[^A-Z0-9]", "", species.upper())
    for symbol, index in c_defines(SPECIES_HEADER, "SPECIES_").items():
        if re.sub(r"[^A-Z0-9]", "", remove_prefix(symbol, "SPECIES_")) == wanted:
            return extract_rom_sprite("pokemon", index)
    return None


class PartyRepository:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.text = ""
        self.trainers: list[TrainerBlock] = []
        self.load()

    def load(self) -> None:
        self.text, self.trainers = parse_party_file(self.path)

    def save_trainer(self, trainer: TrainerBlock) -> None:
        new_block = format_trainer_block(trainer)
        new_text = self.text[:trainer.start] + new_block + self.text[trainer.end:]
        parsed = parse_generated_party(new_text)
        generate_trainer_parties(parsed, Symbols(ROOT))
        backup(self.path)
        self.text = new_text
        self.path.write_text(self.text, encoding="utf-8")
        build_trainer_parties(ROOT)
        self.load()

    def add_trainer(self, trainer_id: str) -> TrainerBlock:
        trainer_id = trainer_id.strip().upper()
        if not trainer_id.startswith("TRAINER_"):
            trainer_id = "TRAINER_" + trainer_id
        if not re.fullmatch(r"TRAINER_[A-Z0-9_]+", trainer_id):
            raise ValueError("请使用类似 TRAINER_NEW_TRAINER 的 ID。")
        if any(tr.trainer_id == trainer_id for tr in self.trainers):
            raise ValueError(f"{trainer_id} 已存在。")
        trainer = TrainerBlock(
            trainer_id=trainer_id,
            start=len(self.text),
            end=len(self.text),
            fields={
                "Name": remove_prefix(trainer_id, "TRAINER_").replace("_", " ")[:12],
                "Class": "Pkmn Trainer",
                "Pic": "Youngster",
                "Gender": "Male",
                "Music": "Male",
                "Double Battle": "No",
                "AI": "Check Bad Move",
            },
            pokemon=[PokemonEntry("Rattata", {"Level": "5"})],
        )
        add_trainer_definitions(trainer_id)
        backup(self.path)
        separator = "\n" if self.text.endswith("\n") else "\n\n"
        self.text += separator + format_trainer_block(trainer)
        self.path.write_text(self.text)
        build_trainer_parties(ROOT)
        self.load()
        return self.trainers[-1]


class PartyTab(ttk.Frame):
    def __init__(self, parent: ttk.Notebook, title: str, path: Path, trainer_pics: dict[str, Path], pic_choices: list[str], species_choices: list[str], move_choices: list[str], item_choices: list[str], ability_choices: list[str], species_ability_choices: dict[str, list[str]], type_choices: list[str], nature_choices: list[str], ball_choices: list[str], music_choices: list[str], ai_choices: list[str], class_choices: list[str] | None = None) -> None:
        super().__init__(parent)
        self.repo = PartyRepository(path)
        self.trainer_ids = c_defines(TRAINER_DEFINES, "TRAINER_")
        self.trainer_pics = trainer_pics
        self.pic_choices = pic_choices
        self.species_choices = species_choices
        self.move_choices = move_choices
        self.item_choices = item_choices
        self.ability_choices = ability_choices
        self.species_ability_choices = species_ability_choices
        self.type_choices = type_choices
        self.nature_choices = nature_choices
        self.ball_choices = ball_choices
        self.music_choices = music_choices
        self.ai_choices = ai_choices
        self.class_choices = class_choices or []
        self.current: TrainerBlock | None = None
        self.current_mon_index: int | None = None
        self.trainer_vars: dict[str, tk.StringVar] = {}
        self.trainer_item_vars: list[tk.StringVar] = []
        self.mon_vars: dict[str, tk.StringVar] = {}
        self.iv_vars: dict[str, tk.StringVar] = {}
        self.ev_vars: dict[str, tk.StringVar] = {}
        self.move_vars: list[tk.StringVar] = []
        self.held_item_var = tk.StringVar()
        self.ability_combo: ttk.Combobox | None = None
        self.trainer_image: tk.PhotoImage | None = None
        self.mon_current_image: tk.PhotoImage | None = None
        self.mon_images: list[tk.PhotoImage] = []
        self.loading_mon_form = False
        self.build_ui(title)
        self.refresh_trainers()

    def build_ui(self, title: str) -> None:
        menu = tk.Menu(self.winfo_toplevel())
        self.winfo_toplevel().config(menu=menu)
        menu.add_command(label="文件")
        menu.add_command(label="训练家")
        menu.add_command(label="设置")
        menu.add_command(label="帮助")

        outer = ttk.Frame(self)
        outer.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
        outer.columnconfigure(1, weight=1)
        outer.rowconfigure(0, weight=1)

        left = ttk.Frame(outer, width=170)
        left.grid(row=0, column=0, sticky="ns", padx=(0, 8))
        ttk.Label(left, text="#    训练家").pack(anchor="w")
        self.search = tk.StringVar()
        list_holder = ttk.Frame(left)
        list_holder.pack(fill=tk.BOTH, expand=True)
        self.trainer_list = tk.Listbox(list_holder, exportselection=False, width=24)
        self.trainer_list.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        list_scroll = ttk.Scrollbar(list_holder, orient=tk.VERTICAL, command=self.trainer_list.yview)
        list_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.trainer_list.configure(yscrollcommand=list_scroll.set)
        self.trainer_list.bind("<<ListboxSelect>>", self.on_trainer_select)
        self.trainer_list.bind("<MouseWheel>", lambda event: self.trainer_list.yview_scroll(-event.delta // 120, "units"))
        search = ttk.Entry(left, textvariable=self.search)
        search.pack(fill=tk.X, pady=(6, 0))
        search.bind("<KeyRelease>", lambda _event: self.refresh_trainers())
        buttons = ttk.Frame(left)
        buttons.pack(fill=tk.X, pady=(6, 0))
        ttk.Button(buttons, text="新建训练家", command=self.add_trainer).pack(side=tk.LEFT)
        ttk.Button(buttons, text="刷新", command=self.reload).pack(side=tk.LEFT, padx=6)

        right = ttk.Frame(outer)
        right.grid(row=0, column=1, sticky="nsew")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)

        top = ttk.LabelFrame(right, text=f"{title}：训练家")
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(0, weight=1)
        top.columnconfigure(1, weight=1)
        top.columnconfigure(2, weight=1)

        trainer_controls = ttk.Frame(top)
        trainer_controls.grid(row=0, column=0, columnspan=3, sticky="ew", padx=8, pady=(6, 2))
        ttk.Button(trainer_controls, text="保存训练家", command=self.save_current).pack(side=tk.LEFT)
        self.clone_button = ttk.Button(trainer_controls, text="克隆", command=self.clone_opponent_header)
        self.clone_button.pack(side=tk.LEFT, padx=6)

        basics = ttk.LabelFrame(top, text="基本信息")
        basics.grid(row=1, column=0, sticky="nsew", padx=8, pady=6)
        basics.columnconfigure(2, weight=1)
        ttk.Label(basics, text="立绘：").grid(row=0, column=0, sticky="w")
        self.trainer_preview = ttk.Label(basics, text="无预览", anchor=tk.CENTER, width=12)
        self.trainer_preview.grid(row=1, column=0, rowspan=4, padx=(0, 10), sticky="n")

        for key in TRAINER_FIELDS:
            self.trainer_vars[key] = tk.StringVar()
        pic_combo = ttk.Combobox(basics, textvariable=self.trainer_vars["Pic"], values=self.pic_choices, width=18)
        pic_combo.grid(row=0, column=1, columnspan=2, sticky="ew", pady=2)
        pic_combo.bind("<<ComboboxSelected>>", lambda _event: self.on_pic_selected())
        pic_combo.bind("<FocusOut>", lambda _event: self.on_pic_selected())
        ttk.Label(basics, text="名字：").grid(row=1, column=1, sticky="w")
        ttk.Entry(basics, textvariable=self.trainer_vars["Name"], width=22).grid(row=1, column=2, sticky="ew")
        ttk.Label(basics, text="性别：").grid(row=2, column=1, sticky="w")
        ttk.Radiobutton(basics, text="男", variable=self.trainer_vars["Gender"], value="Male").grid(row=2, column=2, sticky="w")
        ttk.Radiobutton(basics, text="女", variable=self.trainer_vars["Gender"], value="Female").grid(row=3, column=2, sticky="w")
        ttk.Label(basics, text="职业：").grid(row=4, column=1, sticky="w")
        ttk.Combobox(basics, textvariable=self.trainer_vars["Class"], values=self.class_choices).grid(row=4, column=2, sticky="ew")

        items = ttk.LabelFrame(top, text="携带道具")
        items.grid(row=1, column=1, sticky="nsew", padx=8, pady=6)
        for index in range(4):
            var = tk.StringVar()
            ttk.Combobox(items, textvariable=var, values=self.item_choices, width=22).grid(row=index, column=0, sticky="ew", padx=6, pady=3)
            self.trainer_item_vars.append(var)

        options = ttk.LabelFrame(top, text="选项")
        options.grid(row=1, column=2, sticky="nsew", padx=8, pady=6)
        ttk.Label(options, text="音乐：").grid(row=0, column=0, sticky="w")
        ttk.Combobox(options, textvariable=self.trainer_vars["Music"], values=self.music_choices, width=28).grid(row=0, column=1, sticky="ew", pady=2)
        ttk.Label(options, text="AI：").grid(row=1, column=0, sticky="w")
        ttk.Combobox(options, textvariable=self.trainer_vars["AI"], values=self.ai_choices, width=30).grid(row=1, column=1, sticky="ew", pady=2)
        ttk.Checkbutton(options, text="双打对战", variable=self.trainer_vars["Double Battle"], onvalue="Yes", offvalue="No").grid(row=2, column=0, columnspan=2, sticky="w")

        party_frame = ttk.LabelFrame(right, text="队伍")
        party_frame.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        party_frame.columnconfigure(0, weight=1)
        party_frame.columnconfigure(1, weight=1)
        party_frame.rowconfigure(1, weight=1)

        self.party_preview_frame = ttk.Frame(party_frame)
        self.party_preview_frame.grid(row=0, column=0, sticky="ew", padx=8, pady=8)

        party_left = ttk.Frame(party_frame)
        party_left.grid(row=1, column=0, sticky="nsew", padx=(8, 4), pady=(0, 8))
        party_left.columnconfigure(0, weight=1)
        party_left.columnconfigure(1, weight=1)
        party_left.rowconfigure(0, weight=1)
        self.party_list = tk.Listbox(party_left, exportselection=False, height=8)
        self.party_list.grid(row=0, column=0, columnspan=2, sticky="nsew")
        self.party_list.bind("<<ListboxSelect>>", self.on_mon_select)
        ttk.Button(party_left, text="+ 添加", command=self.add_pokemon).grid(row=1, column=0, sticky="ew", pady=(6, 0), padx=(0, 4))
        ttk.Button(party_left, text="- 移除", command=self.remove_pokemon).grid(row=1, column=1, sticky="ew", pady=(6, 0))

        mon_right = ttk.LabelFrame(party_frame, text="宝可梦")
        mon_right.grid(row=0, column=1, rowspan=2, sticky="nsew", padx=(4, 8), pady=8)
        mon_right.columnconfigure(1, weight=1)
        mon_right.columnconfigure(3, weight=1)
        ttk.Label(mon_right, text="种族：").grid(row=0, column=0, sticky="w", padx=6, pady=3)
        self.mon_title = tk.StringVar()
        self.mon_title.trace_add("write", self.on_mon_form_change)
        self.mon_title_combo = ttk.Combobox(mon_right, textvariable=self.mon_title, values=self.species_choices, width=16)
        self.mon_title_combo.grid(row=0, column=1, sticky="ew", padx=6, pady=3)
        self.mon_title_combo.bind("<<ComboboxSelected>>", lambda _event: self.update_mon_title_from_combo())
        self.mon_preview = ttk.Label(mon_right, text="无预览", anchor=tk.CENTER, width=12)
        self.mon_preview.grid(row=0, column=4, rowspan=5, padx=8, pady=3)

        ttk.Label(mon_right, text="携带道具：").grid(row=1, column=0, sticky="w", padx=6, pady=3)
        self.held_item_var.trace_add("write", self.on_mon_form_change)
        ttk.Combobox(mon_right, textvariable=self.held_item_var, values=self.item_choices, width=16).grid(row=1, column=1, sticky="ew", padx=6, pady=3)

        left_fields = ["Ability", "Level", "CFRU IV", "Nature", "Hidden Power Type"]
        for index, key in enumerate(left_fields):
            var = tk.StringVar()
            var.trace_add("write", self.on_mon_form_change)
            self.mon_vars[key] = var
            row = 2 + index
            ttk.Label(mon_right, text=f"{field_label(key)}：").grid(row=row, column=0, sticky="w", padx=6, pady=3)
            if key == "Ability":
                self.ability_combo = ttk.Combobox(mon_right, textvariable=var, values=self.ability_choices, width=16)
                self.ability_combo.grid(row=row, column=1, sticky="ew", padx=6, pady=3)
                self.ability_info = ttk.Label(mon_right, text="", foreground="#666666")
                self.ability_info.grid(row=row, column=2, columnspan=2, sticky="w", padx=(12, 4), pady=3)
            elif key == "Nature":
                ttk.Combobox(mon_right, textvariable=var, values=self.nature_choices, width=16).grid(row=row, column=1, sticky="ew", padx=6, pady=3)
            elif key == "Hidden Power Type":
                ttk.Combobox(mon_right, textvariable=var, values=self.type_choices, width=16).grid(row=row, column=1, sticky="ew", padx=6, pady=3)
            else:
                ttk.Entry(mon_right, textvariable=var, width=16).grid(row=row, column=1, sticky="ew", padx=6, pady=3)

        for key, row in (("Tera Type", 4),):
            var = tk.StringVar()
            var.trace_add("write", self.on_mon_form_change)
            self.mon_vars[key] = var
            ttk.Label(mon_right, text=f"{field_label(key)}：").grid(row=row, column=2, sticky="w", padx=(12, 4), pady=3)
            if key == "Tera Type":
                ttk.Combobox(mon_right, textvariable=var, values=self.type_choices, width=14).grid(row=row, column=3, sticky="ew", padx=4, pady=3)
            else:
                ttk.Entry(mon_right, textvariable=var, width=14).grid(row=row, column=3, sticky="ew", padx=4, pady=3)

        stats_frame = ttk.Frame(mon_right)
        stats_frame.grid(row=0, column=2, columnspan=2, sticky="w", padx=(12, 4), pady=3)
        ttk.Label(stats_frame, text="个体值：").grid(row=0, column=0, sticky="e", padx=(0, 3))
        ttk.Label(stats_frame, text="努力值：").grid(row=1, column=0, sticky="e", padx=(0, 3))
        for col, stat in enumerate(STAT_FIELDS):
            iv_var = tk.StringVar()
            ev_var = tk.StringVar()
            iv_var.trace_add("write", self.on_mon_form_change)
            ev_var.trace_add("write", self.on_mon_form_change)
            self.iv_vars[stat] = iv_var
            self.ev_vars[stat] = ev_var
            ttk.Entry(stats_frame, textvariable=iv_var, width=2).grid(row=0, column=col + 1, padx=1)
            ttk.Entry(stats_frame, textvariable=ev_var, width=3).grid(row=1, column=col + 1, padx=1, pady=(4, 0))

        move_rows = ((5, "招式1 - 招式2："), (6, "招式3 - 招式4："))
        for row, label_text in move_rows:
            ttk.Label(mon_right, text=label_text).grid(row=row, column=2, sticky="w", padx=(12, 4), pady=3)
        for index in range(4):
            var = tk.StringVar()
            var.trace_add("write", self.on_mon_form_change)
            combo = ttk.Combobox(mon_right, textvariable=var, values=self.move_choices, width=12)
            combo.grid(row=5 + (index // 2), column=3 + (index % 2), sticky="ew", padx=4, pady=3)
            self.move_vars.append(var)
        ttk.Button(mon_right, text="应用宝可梦修改", command=self.apply_mon_edit).grid(row=8, column=4, sticky="e", padx=6, pady=6)

    def refresh_trainers(self) -> None:
        self.trainer_ids = c_defines(TRAINER_DEFINES, "TRAINER_")
        query = self.search.get().lower()
        trainers = self.repo.trainers
        if "TRAINER_NONE" in self.trainer_ids and not any(trainer.trainer_id == "TRAINER_NONE" for trainer in trainers):
            trainers = [TrainerBlock("TRAINER_NONE", -1, -1, editable=False)] + trainers
        self.visible_trainers = [
            trainer for trainer in trainers
            if query in trainer.trainer_id.lower()
            or query in trainer.fields.get("Name", "").lower()
            or query in trainer.fields.get("Class", "").lower()
        ]
        self.trainer_list.delete(0, tk.END)
        for trainer in self.visible_trainers:
            trainer_number = self.trainer_ids.get(trainer.trainer_id)
            displayed_number = f"{trainer_number:03X}" if trainer_number is not None else "???"
            self.trainer_list.insert(tk.END, f"{displayed_number}  {trainer.label}")

    def reload(self) -> None:
        self.repo.load()
        self.refresh_trainers()
        self.update_clone_button()
        messagebox.showinfo("训练家队伍编辑器", "文件已重新加载。")

    def on_trainer_select(self, _event: object | None = None) -> None:
        selection = self.trainer_list.curselection()
        if not selection:
            return
        self.current = self.visible_trainers[selection[0]]
        for key in TRAINER_FIELDS:
            self.trainer_vars[key].set(self.current.fields.get(key, ""))
        items = [item.strip() for item in re.split(r"[,/]", self.current.fields.get("Items", "")) if item.strip()]
        for index, var in enumerate(self.trainer_item_vars):
            var.set(items[index] if index < len(items) else "")
        self.refresh_party()
        self.update_trainer_preview()
        self.update_clone_button()

    def update_clone_button(self) -> None:
        if self.current is None:
            self.clone_button.configure(text="克隆", state=tk.DISABLED)
            return
        if not self.current.editable:
            self.clone_button.configure(text="克隆", state=tk.DISABLED)
            return
        clone_header = find_opponent_header_clone(self.current.trainer_id)
        if clone_header is None:
            self.clone_button.configure(text="克隆", state=tk.NORMAL)
        else:
            self.clone_button.configure(text=f"已克隆：{clone_header}", state=tk.DISABLED)

    def refresh_party(self) -> None:
        self.party_list.delete(0, tk.END)
        self.current_mon_index = None
        if self.current is None:
            return
        for index, mon in enumerate(self.current.pokemon, start=1):
            level = mon.fields.get("Level", "")
            suffix = f" Lv{level}" if level else ""
            self.party_list.insert(tk.END, f"{index}. {self.mon_display_label(mon)}{suffix}")
        self.clear_mon_form()
        self.render_party_previews()

    def clear_mon_form(self) -> None:
        self.loading_mon_form = True
        self.mon_title.set("")
        self.held_item_var.set("")
        for var in self.mon_vars.values():
            var.set("")
        for var in self.iv_vars.values():
            var.set("")
        for var in self.ev_vars.values():
            var.set("")
        for var in self.move_vars:
            var.set("")
        self.mon_preview.configure(image="", text="无预览")
        if hasattr(self, "ability_info"):
            self.ability_info.configure(text="")
        self.loading_mon_form = False

    def on_mon_select(self, _event: object | None = None) -> None:
        if self.current is None:
            return
        selection = self.party_list.curselection()
        if not selection:
            return
        self.current_mon_index = selection[0]
        mon = self.current.pokemon[self.current_mon_index]
        self.loading_mon_form = True
        self.mon_title.set(to_zh("species", mon.title.split("@", 1)[0].strip()))
        self.update_ability_choices()
        self.held_item_var.set(to_zh("item", mon.held_item))
        for key in MON_SIMPLE_FIELDS:
            value = get_field_case_insensitive(mon.fields, key)
            kind = FIELD_TO_KIND.get(key)
            if kind:
                value = to_zh(kind, value)
            self.mon_vars[key].set(value)
        ivs = parse_stat_spread(get_field_case_insensitive(mon.fields, "IVs"))
        evs = parse_stat_spread(get_field_case_insensitive(mon.fields, "EVs"))
        for stat in STAT_FIELDS:
            self.iv_vars[stat].set(ivs.get(stat, ""))
            self.ev_vars[stat].set(evs.get(stat, ""))
        for index, var in enumerate(self.move_vars):
            var.set(format_move_name(mon.moves[index]) if index < len(mon.moves) else "")
        self.loading_mon_form = False
        self.update_mon_preview(mon)

    def update_ability_choices(self) -> None:
        if self.ability_combo is None:
            return
        species_title = to_en("species", self.mon_title.get().strip())
        species = PokemonEntry(species_title).species
        species_symbol = display_name_to_symbol(species, "SPECIES_")
        choices = self.species_ability_choices.get(species_symbol, self.ability_choices)
        current = self.mon_vars.get("Ability").get().strip() if "Ability" in self.mon_vars else ""
        if current and current not in choices:
            choices = choices + [current]
        self.ability_combo.configure(values=choices)
        self.update_ability_preview()

    def gather_trainer_fields(self) -> None:
        if self.current is None:
            return
        for key, var in self.trainer_vars.items():
            value = var.get().strip()
            if value or key in self.current.fields:
                self.current.fields[key] = value
        items = [var.get().strip() for var in self.trainer_item_vars if var.get().strip()]
        if items or "Items" in self.current.fields:
            self.current.fields["Items"] = ", ".join(to_en("item", item) for item in items)

    def save_current(self) -> None:
        if self.current is None:
            messagebox.showwarning("训练家队伍编辑器", "请先选择一个训练家。")
            return
        if not self.current.editable:
            messagebox.showwarning("训练家队伍编辑器", "TRAINER_NONE 为保留项，不可编辑。")
            return
        self.apply_mon_edit(show_warning=False, write_file=False)
        self.gather_trainer_fields()
        trainer_id = self.current.trainer_id
        try:
            self.repo.save_trainer(self.current)
        except Exception as exc:
            messagebox.showerror("保存失败", str(exc))
            return
        self.refresh_trainers()
        for index, trainer in enumerate(self.visible_trainers):
            if trainer.trainer_id == trainer_id:
                self.trainer_list.selection_set(index)
                self.trainer_list.see(index)
                self.on_trainer_select()
                break
        messagebox.showinfo("训练家队伍编辑器", "训练家已保存，生成文件已更新。已自动创建备份。")

    def add_trainer(self) -> None:
        trainer_id = simpledialog.askstring("新建训练家", "训练家 ID：", parent=self)
        if not trainer_id:
            return
        try:
            trainer = self.repo.add_trainer(trainer_id)
        except Exception as exc:
            messagebox.showerror("创建训练家失败", str(exc))
            return
        self.refresh_trainers()
        for index, visible in enumerate(self.visible_trainers):
            if visible.trainer_id == trainer.trainer_id:
                self.trainer_list.selection_set(index)
                self.on_trainer_select()
                break

    def clone_opponent_header(self) -> None:
        if self.current is None:
            messagebox.showwarning("训练家队伍编辑器", "请先选择一个训练家。")
            return
        if not self.current.editable:
            messagebox.showwarning("克隆", "TRAINER_NONE 为保留项，不可克隆。")
            return
        clone_header = find_opponent_header_clone(self.current.trainer_id)
        if clone_header is not None:
            self.update_clone_button()
            messagebox.showinfo("克隆", f"{self.current.trainer_id} 已被克隆为 {clone_header}。")
            return
        new_header = simpledialog.askstring(
            "克隆",
            f"输入将克隆 {self.current.trainer_id} 的新定义名：",
            parent=self,
        )
        if not new_header:
            return
        new_header = new_header.strip().upper()
        if not new_header.startswith("TRAINER_"):
            new_header = "TRAINER_" + new_header
        if not re.fullmatch(r"TRAINER_[A-Z0-9_]+", new_header):
            messagebox.showerror("克隆", "请使用类似 TRAINER_MY_CUSTOM_TRAINER_NAME 的定义名。")
            return

        text = OPPONENTS_HEADER.read_text(encoding="utf-8")
        if re.search(rf"^\s*#define\s+{re.escape(new_header)}\b", text, re.M):
            messagebox.showerror("克隆", f"{new_header} 已存在于 opponents.h 中。")
            return

        line = f"#define {new_header} {self.current.trainer_id}\n"
        marker = "#endif  // GUARD_CONSTANTS_OPPONENTS_H"
        backup(OPPONENTS_HEADER)
        if marker in text:
            text = re.sub(rf"\n*\s*{re.escape(marker)}", "\n" + line + marker, text, count=1)
        else:
            text = text.rstrip() + "\n" + line
        OPPONENTS_HEADER.write_text(text)
        self.update_clone_button()
        messagebox.showinfo("克隆", f"已添加到 opponents.h：\n{line.strip()}")

    def add_pokemon(self) -> None:
        if self.current is None:
            messagebox.showwarning("训练家队伍编辑器", "请先选择一个训练家。")
            return
        if not self.current.editable:
            messagebox.showwarning("训练家队伍编辑器", "TRAINER_NONE 为保留项，不能拥有队伍。")
            return
        species = simpledialog.askstring("添加宝可梦", "种族：", parent=self) or "Rattata"
        self.current.pokemon.append(PokemonEntry(title=species, fields={"Level": "5"}, moves=[]))
        self.refresh_party()
        last = len(self.current.pokemon) - 1
        self.party_list.selection_set(last)
        self.on_mon_select()

    def remove_pokemon(self) -> None:
        if self.current is None or not self.current.editable or self.current_mon_index is None:
            return
        del self.current.pokemon[self.current_mon_index]
        self.refresh_party()

    def apply_mon_edit(self, show_warning: bool = True, write_file: bool = True) -> None:
        if self.current is None or self.current_mon_index is None:
            if show_warning:
                messagebox.showwarning("训练家队伍编辑器", "请先选择一只宝可梦。")
            return
        self.update_current_mon_from_form()
        if not write_file:
            return
        if not self.current.editable:
            messagebox.showwarning("训练家队伍编辑器", "TRAINER_NONE 为保留项，不可编辑。")
            return
        trainer_id = self.current.trainer_id
        self.gather_trainer_fields()
        try:
            self.repo.save_trainer(self.current)
        except Exception as exc:
            messagebox.showerror("保存失败", str(exc))
            return
        self.refresh_trainers()
        for index, trainer in enumerate(self.visible_trainers):
            if trainer.trainer_id == trainer_id:
                self.trainer_list.selection_set(index)
                self.trainer_list.see(index)
                self.on_trainer_select()
                break

    def update_party_list_row(self, index: int) -> None:
        if self.current is None or index >= len(self.current.pokemon):
            return
        mon = self.current.pokemon[index]
        level = mon.fields.get("Level", "")
        suffix = f" Lv{level}" if level else ""
        self.party_list.delete(index)
        self.party_list.insert(index, f"{index + 1}. {self.mon_display_label(mon)}{suffix}")
        self.party_list.selection_clear(0, tk.END)
        self.party_list.selection_set(index)
        self.party_list.activate(index)
        self.party_list.see(index)

    def update_current_mon_from_form(self) -> None:
        if self.current is None or self.current_mon_index is None:
            return
        self.update_ability_choices()
        mon = self.current.pokemon[self.current_mon_index]
        title = self.mon_title.get().strip() or mon.title
        title = title.split("@", 1)[0].strip()
        title = to_en("species", title)
        held_item = to_en("item", self.held_item_var.get().strip())
        mon.title = f"{title} @ {held_item}" if held_item else title
        for key, var in self.mon_vars.items():
            value = var.get().strip()
            kind = FIELD_TO_KIND.get(key)
            if kind:
                value = to_en(kind, value)
            if value or key in mon.fields:
                set_field_case_insensitive(mon.fields, key, value)
        iv_values = {stat: self.iv_vars[stat].get().strip() for stat in STAT_FIELDS}
        ev_values = {stat: self.ev_vars[stat].get().strip() for stat in STAT_FIELDS}
        if any(iv_values.values()) or get_field_case_insensitive(mon.fields, "IVs"):
            set_field_case_insensitive(mon.fields, "IVs", format_stat_spread(iv_values))
        if any(ev_values.values()) or get_field_case_insensitive(mon.fields, "EVs"):
            set_field_case_insensitive(mon.fields, "EVs", format_stat_spread(ev_values))
        mon.moves = [to_en("move", remove_prefix(var.get().strip(), "- ").strip()) for var in self.move_vars if var.get().strip()]
        self.update_party_list_row(self.current_mon_index)
        self.update_mon_preview(mon)
        self.render_party_previews()

    def on_mon_form_change(self, *_args: object) -> None:
        if self.loading_mon_form:
            return
        self.update_current_mon_from_form()

    def update_mon_title_from_combo(self) -> None:
        self.update_current_mon_from_form()

    def make_palette_zero_transparent(self, image):
        if Image is None:
            return image
        transparent_rgb = None
        if image.mode == "P":
            palette = image.getpalette()
            if palette and len(palette) >= 3:
                transparent_rgb = tuple(palette[:3])
        if transparent_rgb is None:
            sample = image.convert("RGBA").getpixel((0, 0))
            transparent_rgb = sample[:3]

        rgba = image.convert("RGBA")
        pixels = rgba.load()
        width, height = rgba.size
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if (r, g, b) == transparent_rgb:
                    pixels[x, y] = (r, g, b, 0)
        return rgba

    def load_photo(self, path: Path, max_size: int, crop_pokemon_frame: bool = False) -> tk.PhotoImage | None:
        if Image is not None and ImageTk is not None:
            try:
                image = Image.open(path)
                if crop_pokemon_frame:
                    image = image.crop((0, 0, min(64, image.width), min(64, image.height)))
                image = self.make_palette_zero_transparent(image)
                width, height = image.size
                scale = max(1, min(3, max_size // max(width, height, 1)))
                if scale > 1:
                    nearest = getattr(getattr(Image, "Resampling", Image), "NEAREST")
                    image = image.resize((width * scale, height * scale), nearest)
                return ImageTk.PhotoImage(image)
            except Exception:
                pass

        try:
            image = tk.PhotoImage(file=str(path))
            if crop_pokemon_frame:
                image = image.copy().subsample(1, 1)
            factor = max(1, max(image.width(), image.height()) // max_size)
            if factor > 1:
                image = image.subsample(factor, factor)
            scale = max(1, min(3, max_size // max(image.width(), image.height(), 1)))
            if scale > 1:
                image = image.zoom(scale, scale)
            return image
        except tk.TclError:
            return None

    def on_pic_selected(self) -> None:
        self.sync_class_with_pic()
        self.update_trainer_preview()

    def sync_class_with_pic(self) -> None:
        pic = self.trainer_vars["Pic"].get().strip()
        if pic and pic in self.class_choices:
            self.trainer_vars["Class"].set(pic)

    def mon_display_label(self, mon: PokemonEntry) -> str:
        label = to_zh("species", mon.title.split("@", 1)[0].strip())
        if mon.held_item:
            label += f" @ {to_zh('item', mon.held_item)}"
        return label

    def update_ability_preview(self) -> None:
        if not hasattr(self, "ability_info"):
            return
        species_title = to_en("species", self.mon_title.get().strip())
        symbol = display_name_to_symbol(PokemonEntry(species_title).species, "SPECIES_")
        slot1, slot2, hidden = get_species_abilities_cached(symbol)
        if not (slot1 or slot2 or hidden):
            self.ability_info.configure(text="")
            return
        self.ability_info.configure(
            text=f"1:{ability_suffix_zh(slot1)}  2:{ability_suffix_zh(slot2)}  隐藏:{ability_suffix_zh(hidden)}"
        )

    def update_trainer_preview(self) -> None:
        pic = self.trainer_vars["Pic"].get().strip()
        path = self.trainer_pics.get(normalize_name(pic)) or self.trainer_pics.get(snake_name(pic))
        if path is None:
            self.trainer_image = None
            self.trainer_preview.configure(image="", text="无 ROM 素材")
            return
        image = self.load_photo(path, 96)
        if image is None:
            self.trainer_image = None
            self.trainer_preview.configure(image="", text="预览出错")
            return
        self.trainer_image = image
        self.trainer_preview.configure(image=self.trainer_image, text="")

    def update_mon_preview(self, mon: PokemonEntry) -> None:
        path = pokemon_preview_path(mon.species)
        if path is None:
            self.mon_preview.configure(image="", text="无 ROM 素材")
            return
        image = self.load_photo(path, 96, crop_pokemon_frame=True)
        if image is None:
            self.mon_preview.configure(image="", text="预览出错")
            return
        self.mon_current_image = image
        self.mon_preview.configure(image=self.mon_current_image, text="")

    def select_party_index(self, index: int) -> None:
        if self.current is None or index >= len(self.current.pokemon):
            return
        self.party_list.selection_clear(0, tk.END)
        self.party_list.selection_set(index)
        self.party_list.activate(index)
        self.party_list.see(index)
        self.on_mon_select()

    def render_party_previews(self) -> None:
        self.mon_images = []
        for child in self.party_preview_frame.winfo_children():
            child.destroy()
        if self.current is None:
            return
        for index, mon in enumerate(self.current.pokemon[:6]):
            path = pokemon_preview_path(mon.species)
            frame = ttk.Frame(self.party_preview_frame)
            frame.grid(row=0, column=index, padx=2, pady=3)
            frame.bind("<Button-1>", lambda _event, idx=index: self.select_party_index(idx))
            if path is not None:
                image = self.load_photo(path, 32, crop_pokemon_frame=True)
                if image is not None:
                    self.mon_images.append(image)
                    label = ttk.Label(frame, image=image, anchor=tk.CENTER)
                    label.pack()
                    label.bind("<Button-1>", lambda _event, idx=index: self.select_party_index(idx))
                else:
                    label = ttk.Label(frame, text="出错", width=5)
                    label.pack()
                    label.bind("<Button-1>", lambda _event, idx=index: self.select_party_index(idx))
            else:
                label = ttk.Label(frame, text="无素材", width=7)
                label.pack()
                label.bind("<Button-1>", lambda _event, idx=index: self.select_party_index(idx))
            number = ttk.Label(frame, text=str(index + 1))
            number.pack()
            number.bind("<Button-1>", lambda _event, idx=index: self.select_party_index(idx))


class TrainerPartyEditor(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("训练家队伍编辑器")
        self.geometry("1280x820")
        trainer_pics, pic_choices = load_trainer_pic_paths()
        species_choices = [to_zh("species", s) for s in load_species_choices()]
        move_choices = [to_zh("move", m) for m in load_move_choices()]
        item_choices = [to_zh("item", i) for i in load_item_choices()]
        ability_choices = load_ability_choices()
        species_ability_choices = load_species_ability_choices()
        type_choices = [to_zh("type", t) for t in load_type_choices()]
        nature_choices = [to_zh("nature", n) for n in load_nature_choices()]
        ball_choices = load_ball_choices(load_item_choices())
        music_choices = load_music_choices()
        ai_choices = load_ai_choices()
        class_choices = load_class_choices()
        notebook = ttk.Notebook(self)
        notebook.pack(fill=tk.BOTH, expand=True)
        notebook.add(PartyTab(notebook, "训练家", NORMAL_PARTY, trainer_pics, pic_choices, species_choices, move_choices, item_choices, ability_choices, species_ability_choices, type_choices, nature_choices, ball_choices, music_choices, ai_choices, class_choices), text="训练家")
        if HARD_PARTY.exists():
            notebook.add(PartyTab(notebook, "Hard Trainers", HARD_PARTY, trainer_pics, pic_choices, species_choices, move_choices, item_choices, ability_choices, species_ability_choices, type_choices, nature_choices, ball_choices, music_choices, ai_choices, class_choices), text="高难训练家")


if __name__ == "__main__":
    try:
        TrainerPartyEditor().mainloop()
    except Exception as exc:
        messagebox.showerror("训练家队伍编辑器", str(exc))
