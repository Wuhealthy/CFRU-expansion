#!/usr/bin/env python3
"""随机训练家定制配置池编辑器。

编辑 src/Tables/random_trainer_configs.party（与训练家编辑器同样的宝可梦配置选项：
特性/性格/个体值/努力值/太晶属性/觉醒力量属性/配招/携带道具），保存后自动调用
scripts/random_mon_config.py 重新生成 src/Tables/random_trainer_configs.h。

复用 trainer_editor.py 的名称映射、选项加载与 Showdown 解析逻辑（即"从训练家编辑器
单独抽出的宝可梦配置"）。运行：python useful_scripts/random_config_editor.py
"""
from __future__ import annotations

import re
import string  # noqa: F401 必须在加入scripts路径前预载:scripts/string.py会遮蔽标准库string(ntpath依赖)
import tempfile  # noqa: F401 同上,trainer_editor模块级调用tempfile.gettempdir()
import sys
from pathlib import Path

import tkinter as tk
from tkinter import messagebox, ttk

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "src/Tables/random_trainer_configs.party"

sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "useful_scripts"))

import trainer_editor as te  # noqa: E402 复用训练家编辑器的宝可梦配置部件
import random_mon_config  # noqa: E402 保存后重新生成C头文件

# 配置池字段(与训练家编辑器的宝可梦配置一致;等级由随机训练家逻辑决定,不提供;Group=双打组合)
FORM_FIELDS = ["Ability", "Nature", "Tera Type", "Hidden Power Type", "Group"]
STAT_FIELDS = te.STAT_FIELDS
ABILITY_DEFAULT = "Random All"
NATURE_DEFAULT = "Hardy"
TERA_DEFAULT = "Random"


class ConfigRepository:
    """random_trainer_configs.party 的读写:每个 === RANDOMMON_* === 块即一只定制宝可梦。"""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.configs: list[te.PokemonEntry] = []
        self.load()

    def load(self) -> None:
        self.configs = []
        if not self.path.exists():
            return
        text = self.path.read_text(encoding="utf-8")
        masked = re.sub(r"/\*.*?\*/", lambda match: re.sub(r"[^\r\n]", " ", match.group(0)), text, flags=re.S)
        pattern = re.compile(r"^===\s+(RANDOMMON_[A-Z0-9_]+)\s+===\s*$", re.M)
        matches = list(pattern.finditer(masked))
        for index, match in enumerate(matches):
            block_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            body = te.strip_comments(text[match.end():block_end])
            mon = te.parse_pokemon(body)
            if mon is not None:
                self.configs.append(mon)

    def save(self) -> None:
        lines = [
            "/* 随机训练家定制配置池(Showdown格式)。由 scripts/random_mon_config.py 解析,",
            "   生成 src/Tables/random_trainer_configs.h。可用 useful_scripts/random_config_editor.py 编辑。",
            "   字段与训练家编辑器的宝可梦配置一致;等级由随机训练家逻辑决定,不在此配置。",
            "   注: Item 留空表示保留随机道具;招式为 MOVE_NONE 的格子保留等级生成的招式。 */",
            "",
        ]
        blocks = []
        used_ids: dict[str, int] = {}
        for mon in self.configs:
            species_symbol = te.display_name_to_symbol(mon.species, "SPECIES_")
            block_id = "RANDOMMON_" + re.sub(r"[^A-Z0-9]", "", te.remove_prefix(species_symbol, "SPECIES_"))
            #同物种多条配置:重复ID自动加序号后缀
            count = used_ids.get(block_id, 0)
            used_ids[block_id] = count + 1
            if count:
                block_id = f"{block_id}_{count + 1}"
            blocks.append(f"=== {block_id} ===\n{te.format_mon(mon)}")
        content = "\n".join(lines) + ("\n\n".join(blocks) + "\n" if blocks else "")
        self.path.write_text(content, encoding="utf-8")


class ConfigEditorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("随机训练家配置编辑器")
        self.geometry("1080x680")
        self.repo = ConfigRepository(CONFIG_FILE)

        self.species_choices = [te.to_zh("species", s) for s in te.load_species_choices()]
        self.move_choices = [te.to_zh("move", m) for m in te.load_move_choices()]
        self.item_choices = [te.to_zh("item", i) for i in te.load_item_choices()]
        self.ability_choices = te.load_ability_choices()
        self.type_choices = [te.to_zh("type", t) for t in te.load_type_choices()]
        self.nature_choices = [te.to_zh("nature", n) for n in te.load_nature_choices()]

        self.mon_vars = {key: tk.StringVar() for key in FORM_FIELDS}
        self.iv_vars = {stat: tk.StringVar() for stat in STAT_FIELDS}
        self.ev_vars = {stat: tk.StringVar() for stat in STAT_FIELDS}
        self.mon_title = tk.StringVar()
        self.held_item_var = tk.StringVar()
        self.move_vars = [tk.StringVar() for _ in range(4)]
        self.current_index: int | None = None
        self.current_image: tk.PhotoImage | None = None
        self.loading_form = False

        for var in [self.mon_title, self.held_item_var, *self.mon_vars.values(),
                    *self.iv_vars.values(), *self.ev_vars.values(), *self.move_vars]:
            var.trace_add("write", self.on_form_change)

        self.build_ui()
        self.refresh_list()

    # ---------- 界面 ----------
    def build_ui(self) -> None:
        outer = ttk.Frame(self)
        outer.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
        outer.columnconfigure(1, weight=1)
        outer.rowconfigure(0, weight=1)

        left = ttk.Frame(outer, width=220)
        left.grid(row=0, column=0, sticky="ns", padx=(0, 8))
        ttk.Label(left, text="配置条目").pack(anchor="w")
        self.search = tk.StringVar()
        search = ttk.Entry(left, textvariable=self.search)
        search.pack(fill=tk.X, pady=(4, 4))
        search.bind("<KeyRelease>", lambda _event: self.refresh_list())
        list_holder = ttk.Frame(left)
        list_holder.pack(fill=tk.BOTH, expand=True)
        self.config_list = tk.Listbox(list_holder, exportselection=False, width=28)
        self.config_list.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll = ttk.Scrollbar(list_holder, orient=tk.VERTICAL, command=self.config_list.yview)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.config_list.configure(yscrollcommand=scroll.set)
        self.config_list.bind("<<ListboxSelect>>", self.on_config_select)
        self.config_list.bind("<MouseWheel>", lambda event: self.config_list.yview_scroll(-event.delta // 120, "units"))
        buttons = ttk.Frame(left)
        buttons.pack(fill=tk.X, pady=(6, 0))
        ttk.Button(buttons, text="新建", command=self.add_config).pack(side=tk.LEFT)
        ttk.Button(buttons, text="删除", command=self.remove_config).pack(side=tk.LEFT, padx=4)
        ttk.Button(buttons, text="刷新", command=self.reload).pack(side=tk.LEFT)
        ttk.Button(left, text="保存全部并生成头文件", command=self.save_all).pack(fill=tk.X, pady=(8, 0))
        self.status_label = ttk.Label(left, text="", foreground="#666666", wraplength=200)
        self.status_label.pack(fill=tk.X, pady=(4, 0))

        form = ttk.LabelFrame(outer, text="宝可梦配置(与训练家编辑器相同)")
        form.grid(row=0, column=1, sticky="nsew")
        form.columnconfigure(1, weight=1)
        form.columnconfigure(3, weight=1)

        ttk.Label(form, text="种族：").grid(row=0, column=0, sticky="w", padx=6, pady=3)
        self.title_combo = ttk.Combobox(form, textvariable=self.mon_title, values=self.species_choices, width=16)
        self.title_combo.grid(row=0, column=1, sticky="ew", padx=6, pady=3)
        self.title_combo.bind("<<ComboboxSelected>>", lambda _event: self.fill_default_stats())
        self.mon_preview = ttk.Label(form, text="无预览", anchor=tk.CENTER, width=12)
        self.mon_preview.grid(row=0, column=3, rowspan=5, padx=8, pady=3)

        ttk.Label(form, text="携带道具：").grid(row=1, column=0, sticky="w", padx=6, pady=3)
        ttk.Combobox(form, textvariable=self.held_item_var, values=self.item_choices, width=16).grid(row=1, column=1, sticky="ew", padx=6, pady=3)

        ttk.Label(form, text="特性：").grid(row=2, column=0, sticky="w", padx=6, pady=3)
        self.ability_combo = ttk.Combobox(form, textvariable=self.mon_vars["Ability"], values=self.ability_choices, width=16)
        self.ability_combo.grid(row=2, column=1, sticky="ew", padx=6, pady=3)
        self.ability_info = ttk.Label(form, text="", foreground="#666666")
        self.ability_info.grid(row=2, column=2, columnspan=2, sticky="w", padx=(12, 4), pady=3)

        ttk.Label(form, text="性格：").grid(row=3, column=0, sticky="w", padx=6, pady=3)
        ttk.Combobox(form, textvariable=self.mon_vars["Nature"], values=self.nature_choices, width=16).grid(row=3, column=1, sticky="ew", padx=6, pady=3)
        ttk.Label(form, text="太晶属性：").grid(row=3, column=2, sticky="w", padx=(12, 4), pady=3)
        self.tera_combo = ttk.Combobox(form, textvariable=self.mon_vars["Tera Type"], values=["随机"] + self.type_choices, width=14)
        self.tera_combo.grid(row=3, column=3, sticky="ew", padx=4, pady=3)

        ttk.Label(form, text="隐藏力量属性：").grid(row=4, column=0, sticky="w", padx=6, pady=3)
        ttk.Combobox(form, textvariable=self.mon_vars["Hidden Power Type"], values=self.type_choices, width=16).grid(row=4, column=1, sticky="ew", padx=6, pady=3)
        ttk.Label(form, text="双打组合(Group)：").grid(row=4, column=2, sticky="w", padx=(12, 4), pady=3)
        ttk.Entry(form, textvariable=self.mon_vars["Group"], width=14).grid(row=4, column=3, sticky="ew", padx=4, pady=3)

        stats_frame = ttk.Frame(form)
        stats_frame.grid(row=5, column=0, columnspan=2, sticky="w", padx=6, pady=3)
        ttk.Label(stats_frame, text="个体值：").grid(row=0, column=0, sticky="e", padx=(0, 3))
        ttk.Label(stats_frame, text="努力值：").grid(row=1, column=0, sticky="e", padx=(0, 3))
        for col, stat in enumerate(STAT_FIELDS):
            ttk.Label(stats_frame, text=stat).grid(row=0, column=col + 1, padx=1)
            ttk.Entry(stats_frame, textvariable=self.iv_vars[stat], width=3).grid(row=1, column=col + 1, padx=1)
            ttk.Entry(stats_frame, textvariable=self.ev_vars[stat], width=3).grid(row=2, column=col + 1, padx=1, pady=(2, 0))

        ttk.Label(form, text="招式(留空=保留等级招式)：").grid(row=6, column=0, columnspan=2, sticky="w", padx=6, pady=(8, 0))
        for index, var in enumerate(self.move_vars):
            ttk.Combobox(form, textvariable=var, values=self.move_choices, width=14).grid(
                row=7 + index // 2, column=0 + index % 2, sticky="ew", padx=6, pady=3)

        ttk.Button(form, text="应用修改", command=self.apply_edit).grid(row=9, column=2, sticky="e", padx=6, pady=8)

    # ---------- 列表 ----------
    def display_label(self, mon: te.PokemonEntry) -> str:
        label = te.to_zh("species", mon.species)
        if mon.held_item:
            label += f" @ {te.to_zh('item', mon.held_item)}"
        group = te.get_field_case_insensitive(mon.fields, "Group")
        if group:
            label += f" [{group}]"
        return label

    def refresh_list(self) -> None:
        query = self.search.get().strip().lower()
        self.config_list.delete(0, tk.END)
        for mon in self.repo.configs:
            label = self.display_label(mon)
            if not query or query in label.lower():
                self.config_list.insert(tk.END, label)
        self.visible = [mon for mon in self.repo.configs if not query or query in self.display_label(mon).lower()]

    def on_config_select(self, _event: object | None = None) -> None:
        selection = self.config_list.curselection()
        if not selection or not self.visible:
            return
        mon = self.visible[selection[0]]
        self.current_index = self.repo.configs.index(mon)
        self.load_form(mon)

    def reload(self) -> None:
        self.repo.load()
        self.refresh_list()

    def add_config(self) -> None:
        mon = te.PokemonEntry(title="Poochyena")
        self.repo.configs.append(mon)
        self.refresh_list()
        self.config_list.selection_set(len(self.config_list) - 1)
        self.config_list.see(len(self.config_list) - 1)
        self.on_config_select()

    def remove_config(self) -> None:
        if self.current_index is None:
            messagebox.showinfo("提示", "请先选择要删除的配置条目")
            return
        del self.repo.configs[self.current_index]
        self.current_index = None
        self.clear_form()
        self.refresh_list()

    # ---------- 表单 ----------
    def clear_form(self) -> None:
        self.loading_form = True
        self.mon_title.set("")
        self.held_item_var.set("")
        for var in self.mon_vars.values():
            var.set("")
        for var in list(self.iv_vars.values()) + list(self.ev_vars.values()) + self.move_vars:
            var.set("")
        self.ability_info.configure(text="")
        self.mon_preview.configure(image="", text="无预览")
        self.current_image = None
        self.loading_form = False

    def load_form(self, mon: te.PokemonEntry) -> None:
        self.loading_form = True
        self.mon_title.set(te.to_zh("species", mon.species))
        self.held_item_var.set(te.to_zh("item", mon.held_item))
        for key in FORM_FIELDS:
            value = te.get_field_case_insensitive(mon.fields, key)
            if key == "Tera Type":
                value = "随机" if not value or value == TERA_DEFAULT else te.to_zh("type", value)
            elif key == "Nature":
                value = te.to_zh("nature", value or NATURE_DEFAULT)
            self.mon_vars[key].set(value)
        ivs = te.parse_stat_spread(te.get_field_case_insensitive(mon.fields, "IVs"))
        evs = te.parse_stat_spread(te.get_field_case_insensitive(mon.fields, "EVs"))
        for stat in STAT_FIELDS:
            self.iv_vars[stat].set(ivs.get(stat, "31"))
            self.ev_vars[stat].set(evs.get(stat, "0"))
        for index in range(4):
            move = mon.moves[index] if index < len(mon.moves) else ""
            self.move_vars[index].set(te.to_zh("move", move))
        self.loading_form = False
        self.update_ability_preview()
        self.update_preview(mon.species)

    def gather_form(self) -> te.PokemonEntry:
        species = te.to_en("species", self.mon_title.get().strip())
        item = te.to_en("item", self.held_item_var.get().strip())
        title = f"{species} @ {item}" if item else species
        fields: dict[str, str] = {}
        ability = self.mon_vars["Ability"].get().strip() or ABILITY_DEFAULT
        fields["Ability"] = ability
        nature = te.to_en("nature", self.mon_vars["Nature"].get().strip() or NATURE_DEFAULT)
        fields["Nature"] = nature
        tera = self.mon_vars["Tera Type"].get().strip()
        if tera and tera != "随机":
            fields["Tera Type"] = te.to_en("type", tera)
        hp_type = self.mon_vars["Hidden Power Type"].get().strip()
        if hp_type:
            fields["Hidden Power Type"] = te.to_en("type", hp_type)
        group = self.mon_vars["Group"].get().strip()
        if group:
            fields["Group"] = group
        ivs = {stat: self.iv_vars[stat].get().strip() for stat in STAT_FIELDS}
        if not all(value == "31" for value in ivs.values()):
            fields["IVs"] = te.format_stat_spread(ivs)
        evs = {stat: self.ev_vars[stat].get().strip() for stat in STAT_FIELDS}
        if not all(value in ("", "0") for value in evs.values()):
            fields["EVs"] = te.format_stat_spread(evs)
        moves = [te.to_en("move", var.get().strip()) for var in self.move_vars if var.get().strip()]
        return te.PokemonEntry(title=title, fields=fields, moves=moves)

    def apply_edit(self) -> None:
        if self.current_index is None:
            messagebox.showinfo("提示", "请先在左侧选择配置条目")
            return
        mon = self.gather_form()
        if not mon.species:
            messagebox.showwarning("提示", "种族不能为空")
            return
        if len(mon.moves) > 4:
            messagebox.showwarning("提示", "招式最多4个")
            return
        self.repo.configs[self.current_index] = mon
        self.refresh_list()
        self.update_ability_preview()
        self.update_preview(mon.species)
        self.status("已应用修改(保存后写入文件并生成头文件)")

    def on_form_change(self, *_args: object) -> None:
        if self.loading_form:
            return
        # 与训练家编辑器一致:表单变化即实时刷新特性说明与预览,数据在"应用修改"时收集
        self.update_ability_preview()
        species = te.to_en("species", self.mon_title.get().strip())
        if species:
            self.update_preview(te.PokemonEntry(species).species)

    def fill_default_stats(self) -> None:
        self.loading_form = True
        for stat in STAT_FIELDS:
            if not self.iv_vars[stat].get().strip():
                self.iv_vars[stat].set("31")
            if not self.ev_vars[stat].get().strip():
                self.ev_vars[stat].set("0")
        if not self.mon_vars["Ability"].get().strip():
            self.mon_vars["Ability"].set(ABILITY_DEFAULT)
        if not self.mon_vars["Nature"].get().strip():
            self.mon_vars["Nature"].set(te.to_zh("nature", NATURE_DEFAULT))
        self.loading_form = False
        self.update_ability_preview()
        species = te.to_en("species", self.mon_title.get().strip())
        if species:
            self.update_preview(te.PokemonEntry(species).species)

    def update_ability_preview(self) -> None:
        species_title = te.to_en("species", self.mon_title.get().strip())
        if not species_title:
            self.ability_info.configure(text="")
            return
        symbol = te.display_name_to_symbol(te.PokemonEntry(species_title).species, "SPECIES_")
        slot1, slot2, hidden = te.get_species_abilities_cached(symbol)
        if not (slot1 or slot2 or hidden):
            self.ability_info.configure(text="")
            return
        self.ability_info.configure(
            text=f"1:{te.ability_suffix_zh(slot1)}  2:{te.ability_suffix_zh(slot2)}  隐藏:{te.ability_suffix_zh(hidden)}"
        )

    # ---------- 预览(与训练家编辑器相同逻辑) ----------
    def make_palette_zero_transparent(self, image):
        if te.Image is None:
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

    def load_photo(self, path: Path, max_size: int) -> tk.PhotoImage | None:
        if te.Image is not None and te.ImageTk is not None:
            try:
                image = te.Image.open(path)
                image = image.crop((0, 0, min(64, image.width), min(64, image.height)))
                image = self.make_palette_zero_transparent(image)
                width, height = image.size
                scale = max(1, min(3, max_size // max(width, height, 1)))
                if scale > 1:
                    nearest = getattr(getattr(te.Image, "Resampling", te.Image), "NEAREST")
                    image = image.resize((width * scale, height * scale), nearest)
                return te.ImageTk.PhotoImage(image)
            except Exception:
                pass
        try:
            image = tk.PhotoImage(file=str(path))
            factor = max(1, max(image.width(), image.height()) // max_size)
            if factor > 1:
                image = image.subsample(factor, factor)
            scale = max(1, min(3, max_size // max(image.width(), image.height(), 1)))
            if scale > 1:
                image = image.zoom(scale, scale)
            return image
        except tk.TclError:
            return None

    def update_preview(self, species: str) -> None:
        path = te.pokemon_preview_path(species)
        if path is None:
            self.mon_preview.configure(image="", text="无 ROM 素材")
            return
        image = self.load_photo(path, 96)
        if image is None:
            self.mon_preview.configure(image="", text="预览出错")
            return
        self.current_image = image
        self.mon_preview.configure(image=self.current_image, text="")

    # ---------- 保存 ----------
    def save_all(self) -> None:
        try:
            for mon in self.repo.configs:
                if not mon.species:
                    raise ValueError("存在种族为空的配置条目")
            self.repo.save()
            random_mon_config.build()
            self.status(f"已保存 {len(self.repo.configs)} 条配置并生成 random_trainer_configs.h")
        except Exception as exc:
            messagebox.showerror("随机训练家配置编辑器", str(exc))

    def status(self, text: str) -> None:
        self.status_label.configure(text=text)


if __name__ == "__main__":
    try:
        ConfigEditorApp().mainloop()
    except Exception as exc:
        messagebox.showerror("随机训练家配置编辑器", str(exc))
