# 横版物语图鉴 (pokedex_site)

「火红 横版物语」ROM 的静态图鉴网站。纯 HTML/CSS/JS，无需构建，双击 `index.html` 即可使用（或任意静态服务器）。

## 功能

- **宝可梦图鉴**：1549 只宝可梦（含全部形态）卡片列表，按图鉴编号排序
  - 搜索：中文名 / 编号 / 英文名
  - 属性筛选（数据来自 ROM 实际属性表）
- **宝可梦详情**：正面图、图鉴介绍、种族值条形图、特性（含隐藏特性）、
  身高体重/捕获率/努力值/携带道具、培育资料（性别比/蛋组/孵化步数/亲密度/成长速度）、
  进化链（含超级进化/极巨化等特殊形态）、招式表（升级 / 招式学习器 / 教学招式 / 蛋招式）
- **招式图鉴**：1002 个招式，属性/分类筛选 + 搜索，点击查看详情
- **特性图鉴**：368 个特性，点击查看持有该特性的宝可梦
- **属性相性表**：从 ROM `type_tables.h` 提取的实际克制关系（含星晶等新增属性）

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

## 已知小缺口

- 卡空斯的超级进化（SPECIES_CASTFORM, id 385）无正面图源文件，详情页回退显示图标
- 2 个物种无图鉴编号（图鉴区按编号排序时自动归入「其他形态」区）
- 部分稀有携带道具名为英文回退（`tools/extract_data.py` 中 `ITEM_ZH` 可继续补翻译）
