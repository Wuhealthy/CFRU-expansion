# 火红物语图鉴 (pokedex_site)

「火红物语」ROM 的静态图鉴网站。纯 HTML/CSS/JS，无需构建，双击 `index.html` 即可使用（或任意静态服务器）。

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
部署时会给 `index.html` 里 css/js/数据的引用加内容版本号（如 `app.js?v=35ec3298`），
更新后浏览器直接取新文件，不会因 Pages 的 10 分钟缓存继续显示旧版。

## 功能

- **宝可梦图鉴**：主页面按图鉴编号只显示每个编号的默认形态（1025 只），按全国图鉴编号分成第一～第九世代，
  左侧目录可跳转（按种族值排序时为全体排名、不分世代，目录置灰并提示）；
  522 个特殊/地区形态在搜索或筛选时才显示，卡片带形态徽标
  - 搜索：名字 / 编号 / 形态（「超级进化」「超极巨化」「觉醒形态」「特殊形态」
    「地区形态」「阿罗拉」「伽勒尔」「洗翠」「帕底亚」）；名字只匹配名字表里的实际名字
    （含其中的字母，如「雷丘X」），不匹配 `VENOMOTH_MEGA` 这类内部常量名
  - 形态筛选：仅默认形态 / 全部形态 / 地区形态 / 特殊形态（含原始回归）/ 超级进化 / 超极巨化 / 觉醒形态
  - 属性筛选（数据来自 ROM 实际属性表）：多选时须同时具备所选属性（如 火+飞行）；输入搜索或选属性时各形态一并显示
  - 排序：默认按图鉴编号；可按六项种族值（HP、攻击、防御、特攻、特防、速度）排序，先从高到低，
    再点同一项切换为从低到高，卡片上显示该项数值；可与搜索、形态和属性筛选同时使用
- **宝可梦详情**：正面图、图鉴介绍、种族值条形图、特性（含隐藏特性）、
  身高体重/捕获率/努力值/携带道具、培育资料（性别比/蛋组/孵化步数/亲密度/成长速度）、
  进化链（官方图鉴样式：圆形头像、阶段、名字与属性；箭头上方写完整进化条件，如「等级32以上（与恶属性宝可梦同行）」，
  同一对宝可梦有多种方式时以「或」列出；超级进化/超极巨化/觉醒形态等从基础形态分出）、
  招式表（升级 / 招式学习器 / 教学招式 / 蛋招式）
- **招式图鉴**：按世代分组（第一～第九世代，对照神奇宝贝百科「招式列表」，世代内按官方编号；
  对不上官方列表的 11 个原创招式排在第九世代之后），左侧目录可跳转到各世代、可隐藏（记住选择）；
  属性/分类/类别筛选 + 搜索（按招式名），筛选后没有招式的世代在目录里置灰；点击查看详情；
  世代对照表存档在 `tools/move_gen_52poke.json`（百科有 Cloudflare 防护，提取时不联网）。
  威力不固定的招式（数据里威力为 1）显示「变化」；优先度按 s8 有符号读取（如吹飞 -6）；
  描述按 `assembly/data/attack_description_table.s` 的指针表位置对应招式编号；
  「类别」下拉按官方招式类别筛选（舞蹈类招式、拳击类招式、存在追加效果等，选项后附该类招式数量）；
  详情含招式性质（接触/守住/魔法反射/抢先/鹦鹉学舌/王者之证类道具/远程，成立为蓝色）与分类标签
  （名称与官方一致：啃咬类、拳击类、波动／波导类、连续招式、先制招式、存在追加效果、Z招式、极巨招式等 28 类，
  标注受哪些特性/道具影响）。性质取 `battle_moves.c` 的 flags，
  王者之证按引擎实际判定（造成伤害且不自带畏缩几率），分类取 `assembly/data/move_tables.json`，
  先制/追加效果/Z/极巨从招式数据推导（Z/极巨招式不计追加效果）。强行加成表 `gSheerForceBoostedMoves`
  并入「存在追加效果」，说明先写「除伤害外还带有附加效果」再写「受强行影响」；
  表里效果写在引擎中、`secondaryEffectChance` 为 0 的招式（击掌奇袭、掷锚等）只写「受强行影响」
- **特性图鉴**：368 个特性，按引入世代分组（第三～第九世代，对照神奇宝贝百科「特性列表」，存档在
  `tools/ability_gen_52poke.json`；对不上的 50 个原创特性排在最后），左侧目录可跳转；
  搜索（按特性名），点击查看持有该特性的宝可梦。图鉴 / 招式 / 特性三页目录的隐藏状态共用
- **属性相性表**：从 ROM `type_tables.h` 提取的实际克制关系（含星晶等新增属性）
- **简体 / 繁体切换**：顶栏右侧「简｜繁」，选择会记住。数据都是简体，繁体时浏览器端用 OpenCC
  （简→台湾繁体，只转字形不换用词）的精简词典实时转换；三个搜索框都会先把输入转回简体再匹配，简繁都能搜到。
  词典原文在 `tools/opencc/`（Apache-2.0），提取时只打包网站实际用到的字和词组；
  专有名词转错时在 `tools/extract_data.py` 的 `HANT_WORD_FIX` / `HANT_POST_FIX` 里加修正（如 尼多后、隆隆岩）

页面上的名字一律取自游戏实际文本，不显示内部常量名：
宝可梦 `Pokemon_Name_Table.string`；招式 `strings/attack_name_table.string`（按位置对应编号；
Z 招式取 `z_move_names.string`，极巨/超极巨招式按战斗文本加「极巨」「超极巨」前缀）；
特性 `strings/ability_name_table.string`；道具取 `src/Tables/item_tables.c` 的 `.name`
（支持 `CN("中文名")` 直写与旧字节格式按 `charmap.tbl` 解码；全道具中文名已直写，无需对照表）。

## 文件结构

```
pokedex_site/
├── index.html          # 入口
├── style.css
├── app.js              # SPA 逻辑 (hash 路由) + 精灵图解密渲染
├── data/data.js        # 提取器生成的数据 (window.PKDX)
├── sprites/front/      # 正面图 64x64 (XOR 加密 .js, base64 载荷)
├── sprites/icon/       # 图标 32x32 (同上加密)
├── tools/extract_data.py   # 数据提取 + 精灵图加密脚本
└── tools/opencc/       # OpenCC 简繁词典 (繁体切换用, Apache-2.0, 见 LICENSE)
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
  `strings/*.string`、常量表 `include/constants/*.h`、觉醒形态表 `src/mega.c`、
  道具表 `src/Tables/item_tables.c` + 字码表 `charmap.tbl`、道具中英对照 `道具名称_英-中.xlsx`
- `../../Dynamic-Pokemon-Expansion-Gen-9`：种族值 `src/Base_Stats.c`、进化/图鉴数据、
  中文名 `strings/Pokemon_Name_Table.string`、精灵图 `graphics/frontspr` 与 `graphics/pokeicon`；招式表全部以 DPE 为准
  （不用 CFRU 的 `src/Tables/level_up_learnsets.c`）：
  - 升级招式 `src/Learnsets.c`
  - 蛋招式 `src/Egg_Moves.c`，同一进化链（含超级进化等特殊形态）都沿用最初形态的表
  - 特殊形态（超级进化/超极巨化/觉醒形态/原始回归）在对战中变身出现，招式学习器/教学招式/蛋招式
    一律用同编号默认形态（本体）的表；其他特殊形态是独立物种，有 DPE 数据就照实际，为空时用本体的；
    地区形态有独立数据，不受影响
  - 招式学习器 / 教学招式的可学物种 `src/tm_compatibility`、`src/tutor_compatibility`：编号取文件名开头的数字
    （与 DPE 的 `scripts/tm_tutor.py` 一致），对应招式取 `src/TM_Tutor_Tables.c`；第 1–120 项为 TM01–TM120，
    121–128 项为 HM01–HM08（CFRU `src/config.h` 的 `NUM_TMS`）。文件名里的招式名与表不一致时写入 `data/report.txt`

```bash
cd tools
python extract_data.py        # 需要 Python3 + Pillow
```

运行后生成 `data/data.js`、加密精灵图 `.js`（默认删除明文 PNG）、`data/report.txt`（缺失项报告）。
注意：精灵图只有缺失时才重新复制，改了处理逻辑后先删除 `sprites/` 再运行。

默认形态判定：同一图鉴编号内，常量名是其他成员前缀者为默认形态（如 `MEOWTH` 之于 `MEOWTH_A`），
超级进化/超极巨化/觉醒/原始回归形态不参与；判定结果列在 `data/report.txt` 末尾，更新数据后可抽查。

## 已知小缺口

- 地区形态与默认形态共用图鉴编号，详情页的图鉴介绍/身高体重沿用默认形态的数据
- 进化条件按 CFRU `src/evolution.c` 的判定逻辑由 DPE 进化表参数生成；地点进化的编号按本作（火红）的
  `region_map_sections.h` 解释（DPE 写的是 Unbound 地名）。`EVO_COINS`、`EVO_MAUSHOLD_*`（DPE 独有）与
  `EVO_DAMAGE_LOCATION` 在 CFRU 的进化判定中没有实现，网站照 DPE 数据显示其设计条件
- 道具名：全道具中文名已直写进游戏道具表；若以后新增道具没写中文名，会列在
  `data/report.txt` 的「道具名未翻译」；「常量式名称残留」也应为 0
