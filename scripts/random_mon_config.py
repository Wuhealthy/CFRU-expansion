#!/usr/bin/env python3
"""Generate the random-trainer custom config pool from a Showdown-style party file.

Data file: src/Tables/random_trainer_configs.party
Output:    src/Tables/random_trainer_configs.h (struct TrainerRandomMonConfig + sTrainerRandomMonConfigs)

Field semantics (same options as the trainer editor's Pokemon config):
  Title line:  Species @ Item (Item optional; empty item keeps the random item)
  Ability:     Hidden / Ability 1 / Ability 2 / Random 1 2 / Random All
  Nature:      any NATURE_* name (default Hardy)
  IVs:         per-stat spread (default 31 across the board)
  EVs:         per-stat spread (default 0)
  Tera Type:   any TYPE_* name or "Random" (default Random)
  Hidden Power Type: any TYPE_* name (default: derived from IVs)
  Moves:       "- Move" lines, at most 4; empty slots keep level-based moves
Levels are decided by the random trainer logic, so there is no Level field.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from trainer_party import PartyError, Symbols  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "src" / "Tables" / "random_trainer_configs.party"
CONFIG_OUT = ROOT / "src" / "Tables" / "random_trainer_configs.h"

SUPPORTED_FIELDS = ("Ability", "Nature", "IVs", "EVs", "Tera Type", "Hidden Power Type", "Group")
SUPPORTED_ABILITY = {
    "hidden": "Ability_Hidden",
    "ability1": "Ability_1",
    "ability2": "Ability_2",
    "random12": "Ability_Random_1_2",
    "randomall": "Ability_RandomAll",
}
ABILITY_DEFAULT = "Random All"
NATURE_DEFAULT = "Hardy"


def strip_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def parse_configs(text: str) -> list[dict]:
    """Parse one Showdown-style mon block per === RANDOMMON_* === header."""
    text = strip_comments(text)
    headers = list(re.finditer(r"(?m)^===\s+(RANDOMMON_[A-Z0-9_]+)\s+===\s*$", text))
    configs: list[dict] = []
    for number, header in enumerate(headers):
        #同一物种可有多条配置,允许重复块ID(仅作注释标识,不参与匹配)
        block_id = header.group(1)
        end = headers[number + 1].start() if number + 1 < len(headers) else len(text)
        lines = [line.strip() for line in text[header.end():end].splitlines() if line.strip()]
        if not lines:
            raise PartyError(f"{block_id}: block is empty")
        title = lines[0]
        if title.startswith("- ") or ":" in title:
            raise PartyError(f"{block_id}: first line must be 'Species @ Item'")
        config = {"block_id": block_id, "title": title, "fields": {}, "moves": []}
        for line in lines[1:]:
            if line.startswith("- "):
                config["moves"].append(line[2:].strip())
            elif ":" in line:
                key, value = line.split(":", 1)
                config["fields"][key.strip()] = value.strip()
            else:
                raise PartyError(f"{block_id}: invalid line: {line}")
        unsupported = [key for key in config["fields"] if key not in SUPPORTED_FIELDS]
        if unsupported:
            raise PartyError(f"{block_id}: unsupported fields (Level is decided by the random trainer): {', '.join(unsupported)}")
        configs.append(config)
    return configs


def stat_spread(value: str, default: int) -> list[int]:
    spread = [default] * 6
    if not value.strip():
        return spread
    for part in value.split("/"):
        match = re.fullmatch(r"\s*(\d+)\s+([A-Za-z]+)\s*", part)
        if not match or match.group(2).lower() not in trainer_party_stat_aliases:
            raise PartyError(f"Invalid stat spread component: {part.strip()}")
        spread[trainer_party_stat_aliases[match.group(2).lower()]] = int(match.group(1))
    return spread


# Mirrors trainer_party.STAT_ALIASES ordering (HP, Atk, Def, SpA, SpD, Spe).
trainer_party_stat_aliases = {
    "hp": 0, "atk": 1, "attack": 1, "def": 2, "defense": 2,
    "spa": 3, "spatk": 3, "spattack": 3, "spd": 4,
    "spdef": 4, "spdefense": 4, "spe": 5, "speed": 5,
}


def resolve_title(title: str, symbols: Symbols) -> tuple[str, str]:
    species_text, _, item_text = title.partition("@")
    species = symbols.get("species", species_text.strip())
    item = symbols.get("item", item_text.strip(), "ITEM_NONE")
    return species, item


def render_config(config: dict, symbols: Symbols) -> str:
    block_id = config["block_id"]
    species, item = resolve_title(config["title"], symbols)
    fields = config["fields"]
    moves = [symbols.get("move", move) for move in config["moves"]]
    if len(moves) > 4:
        raise PartyError(f"{block_id}: a Pokemon can have at most 4 moves")
    moves += ["MOVE_NONE"] * (4 - len(moves))

    ability = SUPPORTED_ABILITY.get(re.sub(r"[^A-Z0-9]", "", fields.get("Ability", ABILITY_DEFAULT), flags=re.I).lower())
    if ability is None:
        raise PartyError(f"{block_id}: Ability must be Hidden, Ability 1, Ability 2, Random 1 2, or Random All")
    nature = symbols.get("nature", fields.get("Nature", NATURE_DEFAULT))
    ivs = stat_spread(fields.get("IVs", ""), 31)
    evs = stat_spread(fields.get("EVs", ""), 0)

    tera_text = fields.get("Tera Type", "").strip()
    if tera_text and re.sub(r"[^A-Z0-9]", "", tera_text, flags=re.I).lower() == "random":
        tera = "TERA_TYPE_RANDOM"
    elif tera_text:
        tera = symbols.get("type", tera_text)
    else:
        tera = "TERA_TYPE_RANDOM"

    if "Hidden Power Type" in fields:
        hidden_power = f"HIDDEN_POWER_TYPE({symbols.get('type', fields['Hidden Power Type'])})"
    else:
        hidden_power = "0"

    lines = [
        f"    // {block_id}",
        "    {",
        f"        .species = {species},",
        f"        .heldItem = {item},",
        f"        .moves = {{{', '.join(moves)}}},",
        f"        .ability = {ability},",
        f"        .nature = {nature},",
        f"        .ivSpread = {{{', '.join(map(str, ivs))}}},",
        f"        .evSpread = {{{', '.join(map(str, evs))}}},",
        f"        .teraType = {tera},",
        f"        .hiddenPowerType = {hidden_power},",
        "    },",
    ]
    return "\n".join(lines)


EMPTY_CONFIG = """    //占位条目:配置池为空时保持数组非空,SPECIES_NONE永不命中
    {
        .species = SPECIES_NONE,
        .heldItem = ITEM_NONE,
        .moves = {MOVE_NONE, MOVE_NONE, MOVE_NONE, MOVE_NONE},
        .ability = Ability_1,
        .nature = NATURE_HARDY,
        .ivSpread = {0, 0, 0, 0, 0, 0},
        .evSpread = {0, 0, 0, 0, 0, 0},
        .teraType = TERA_TYPE_RANDOM,
        .hiddenPowerType = 0,
    },"""


def build_combos(configs: list[dict], symbols: Symbols) -> list[tuple[str, str]]:
    """Group字段相同的两条配置组成一个双打组合;返回[(物种A, 物种B, 下标A, 下标B), ...]。"""
    species_list = [resolve_title(config["title"], symbols)[0] for config in configs]
    groups: dict[str, list[int]] = {}
    for index, config in enumerate(configs):
        group = config["fields"].get("Group", "").strip()
        if group:
            groups.setdefault(group, []).append(index)
    combos: list[tuple[str, str]] = []
    for group, indices in groups.items():
        if len(indices) != 2:
            raise PartyError(f"Group '{group}' must contain exactly 2 configs (got {len(indices)})")
        combos.append((species_list[indices[0]], species_list[indices[1]], str(indices[0]), str(indices[1])))
    return combos


def generate(configs: list[dict], symbols: Symbols) -> str:
    combos = build_combos(configs, symbols)
    body = "\n".join(render_config(config, symbols) for config in configs) if configs else EMPTY_CONFIG
    if combos:
        combo_entries = "\n".join(
            f"    {{.species = {{{species_a}, {species_b}}}, .configIndex = {{{index_a}, {index_b}}}}},"
            for species_a, species_b, index_a, index_b in combos
        )
        combo_block = "\n".join([
            "#if NUM_TRAINER_RANDOM_DOUBLES_COMBOS > 0",
            "static const struct TrainerRandomDoublesCombo sTrainerRandomDoublesCombos[] =",
            "{",
            combo_entries,
            "};",
            "#endif",
            "",
        ])
    else:
        combo_block = ""
    header = "\n".join([
        "/* Auto-generated by scripts/random_mon_config.py. Do not edit. */",
        "/* 数据源: src/Tables/random_trainer_configs.party (可用 useful_scripts/random_config_editor.py 编辑) */",
        "",
        "#ifndef TERA_TYPE_RANDOM",
        "#define TERA_TYPE_RANDOM 0xFF",
        "#endif",
        "",
        "struct TrainerRandomMonConfig",
        "{",
        "    u16 species;",
        "    u16 heldItem; //ITEM_NONE=保留随机道具",
        "    u16 moves[4]; //MOVE_NONE的格子保留等级生成的招式",
        "    u8 ability; //Ability_Hidden / Ability_1 / Ability_2 / Ability_Random_1_2 / Ability_RandomAll",
        "    u8 nature;",
        "    u8 ivSpread[6];",
        "    u8 evSpread[6];",
        "    u8 teraType; //TERA_TYPE_RANDOM=按新物种重新随机",
        "    u8 hiddenPowerType; //HIDDEN_POWER_TYPE(TYPE_*)编码,0=按个体值推导",
        "};",
        "",
        "static const struct TrainerRandomMonConfig sTrainerRandomMonConfigs[] =",
        "{",
        body,
        "};",
        "",
        f"#define NUM_TRAINER_RANDOM_DOUBLES_COMBOS {len(combos)}",
        "",
        "struct TrainerRandomDoublesCombo",
        "{",
        "    u16 species[2];",
        "    u8 configIndex[2]; //sTrainerRandomMonConfigs下标",
        "};",
        "",
        combo_block.rstrip("\n") if combo_block else "",
        "",
    ])
    return header


def build(root: Path = ROOT) -> int:
    config_file = root / CONFIG_FILE.relative_to(ROOT)
    if not config_file.exists():
        configs = []
    else:
        configs = parse_configs(config_file.read_text(encoding="utf-8"))
    header = generate(configs, Symbols(root))
    (root / CONFIG_OUT.relative_to(ROOT)).write_text(header, encoding="utf-8")
    print(f"Generated {len(configs)} random trainer config(s).")
    return 0


def main(argv: list[str] | None = None) -> int:
    del argv  # kept for symmetry with trainer_party.py
    try:
        return build()
    except (OSError, PartyError, ValueError) as exc:
        print(f"random_mon_config: error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
