# 横版物语图鉴 (pokedex_site)

「火红 横版物语」ROM 的静态图鉴网站。纯 HTML/CSS/JS，无需构建，双击 `index.html` 即可使用（或任意静态服务器）。

**线上地址**：<https://wuhealthy.github.io/CFRU-expansion/>（GitHub Pages，`gh-pages` 分支）

## 更新线上站点

```powershell
# 1. 重新提取数据
cd tools && python extract_data.py
# 2. 部署 (自动同步站点到 gh-pages 分支并推送, 网络不通时自动重试)
powershell -ExecutionPolicy Bypass -File tools\deploy_pages.ps1
# 3. (可选) 查询 Pages 构建状态
powershell -ExecutionPolicy Bypass -File tools\pages_status.ps1
```

部署脚本使用 GitHub Desktop 存在 Windows 凭据管理器里的 token，无需手动登录。

## 功能

- **宝可梦图鉴**：主页面按图鉴编号只显示每个编号的默认形态（1025 只）；
  522 个特殊/地区形态在搜索或筛选时才显示，卡片带形态徽标
  - 搜索：名字 / 编号 / 形态（「超级进化」「超极巨化」「觉醒形态」「特殊形态」
    「地区形态」「阿罗拉」「伽勒尔」「洗翠」「帕底亚」）；名字只匹配名字表里的实际名字
    （含其中的字母，如「雷丘X」），不匹配 `VENOMOTH_MEGA` 这类内部常量名
  - 形态筛选：仅默认形态 / 全部形态 / 地区形态 / 特殊形态（含原始回归）/ 超级进化 / 超极巨化 / 觉醒形态
  - 属性筛选（数据来自 ROM 实际属性表）：多选时须同时具备所选属性（如 火+飞行）；输入搜索或选属性时各形态一并显示
- **宝可梦详情**：正面图、图鉴介绍、种族值条形图、特性（含隐藏特性）、
  身高体重/捕获率/努力值/携带道具、培育资料（性别比/蛋组/孵化步数/亲密度/成长速度）、
  进化链（含超级进化/超极巨化等特殊形态）、招式表（升级 / 招式学习器 / 教学招式 / 蛋招式）
- **招式图鉴**：1002 个招式，属性/分类筛选 + 搜索（按招式名），点击查看详情
- **特性图鉴**：368 个特性，搜索（按特性名），点击查看持有该特性的宝可梦
- **属性相性表**：从 ROM `type_tables.h` 提取的实际克制关系（含星晶等新增属性）

页面上的名字一律取自游戏实际文本，不显示内部常量名：
宝可梦 `Pokemon_Name_Table.string`；招式 `strings/attack_name_table.string`（按位置对应编号；
Z 招式取 `z_move_names.string`，极巨/超极巨招式按战斗文本加「极巨」「超极巨」前缀）；
特性 `strings/ability_name_table.string`；道具 `src/Tables/item_tables.c` 的 `.name`（按 `charmap.tbl` 解码）。

## 文件结构

```
pokedex_site/
├── index.html          # 入口
├── style.css
├── app.js              # SPA 逻辑 (hash 路由) + 精灵图解密渲染
├── data/data.js        # 提取器生成的数据 (window.PKDX)
├── sprites/front/      # 正面图 64x64 (XOR 加密 .js, base64 载荷)
├── sprites/icon/       # 图标 32x32 (同上加密)
└── tools/extract_data.py   # 数据提取 + 精灵图加密脚本
```

## 图片加密说明

精灵图以 XOR 混淆 + base64 的形式存放在 `sprites/{front,icon}/NNN.js`，
明文 PNG 不落盘。页面用动态 `<script>` 载入后解密为 ImageBitmap，
再绘制到 canvas——因此：

- 页面中没有 `<img>` 元素，右键没有「图片另存为」；
- 全站禁用右键菜单与图片拖拽；
- 直接抓取 `sprites/**/*.js` 得到的是加密乱码；
- 密钥在 `app.js` 的 `SPR_KEY`（须与 `tools/extract_data.py` 的 `SPR_KEY` 一致）。

> 注意：浏览器中显示的内容在技术上无法做到绝对防拷贝——
> 截屏、开发者工具从内存导出位图等手段无法阻止，此方案用于抬高门槛。
> 调试时可用 `python tools/extract_data.py --keep-png` 保留明文 PNG。

## 重新生成数据

数据源在两个仓库（脚本内路径按相对位置查找，改名需同步修改）：

- `../`（CFRU-expansion）：招式数据 `src/Tables/battle_moves.c`、招式/特性/属性中文表
  `strings/*.string`、常量表 `include/constants/*.h`、觉醒形态表 `src/mega.c`
- `../../Dynamic-Pokemon-Expansion-Gen-9`：种族值 `src/Base_Stats.c`、学习技/蛋招/TM/进化/图鉴数据、
  中文名 `strings/Pokemon_Name_Table.string`、精灵图 `graphics/frontspr` 与 `graphics/pokeicon`

```bash
cd tools
python extract_data.py        # 需要 Python3 + Pillow
```

运行后生成 `data/data.js`、加密精灵图 `.js`（默认删除明文 PNG）、`data/report.txt`（缺失项报告）。
注意：精灵图只有缺失时才重新复制，改了处理逻辑后先删除 `sprites/` 再运行。

默认形态判定：同一图鉴编号内，常量名是其他成员前缀者为默认形态（如 `MEOWTH` 之于 `MEOWTH_A`），
超级进化/超极巨化/觉醒/原始回归形态不参与；判定结果列在 `data/report.txt` 末尾，更新数据后可抽查。

## 已知小缺口

- 卡空斯的超级进化（SPECIES_CASTFORM, id 385）无正面图源文件，详情页回退显示图标
- ROM 的 `Species_To_Pokdex_Table.c` 中 `RATICATE_MEGA`/`VENOMOTH_MEGA`/`GOLEM_MEGA` 的图鉴编号
  挂成了 #168/#53/#59，这几个形态在搜索结果里会显示在对应的错误编号下
- 地区形态与默认形态共用图鉴编号，详情页的图鉴介绍/身高体重沿用默认形态的数据
- 游戏道具表里多数道具是英文名（如 Passho Berry、Venusaurite）：`tools/extract_data.py` 的 `ITEM_ZH`
  有中文译名的显示中文，其余照游戏实际名字显示；`data/report.txt` 的「常量式名称残留」应为 0
