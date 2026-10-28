# 伦敦片区边界数据（来源、授权与生成方法）

日期：2026-10-28（Europe/London）｜负责人：Claude Code｜状态：数据已接入真实 API，数据来源待用户确认

## 1. 用途

真实 API 在确认餐厅（`confirmVenue`）时，用服务端核验过的坐标查片区多边形，得出饭局的片区代码 `areaCode`（如 `soho`）。发现页按这个代码给饭局分组，插画地图上的片区标记也靠它。之前 API 没有加载任何片区数据，所有饭局的片区都是 `unknown`（QA-F24 一直挂着的外部关口）。

- 数据文件：[`apps/api/data/london-areas.v1.json`](../../apps/api/data/london-areas.v1.json)，`kind: verified`，版本 `ons-lsoa21-hocl-msoa-names-central-v1`，修订号 1。
- 加载位置：`apps/api/src/venues/london-areas.ts`，由 `apps/api/src/main.ts` 传给 `buildServer` 的 `areaPolygons`。测试环境仍按各自需要注入自己的样例数据。
- 生成脚本：[`scripts/build-london-areas.mjs`](../../scripts/build-london-areas.mjs)。用 `node scripts/build-london-areas.mjs` 重新生成，用 `--check` 核对仓库内的文件和重新生成的结果一致。脚本需要联网下载源数据，并通过 `npx` 运行固定版本 `mapshaper@0.7.71`（只在构建时使用，不进入产品依赖）。
- 客户端名称表：[`packages/client/src/london-area-names.ts`](../../packages/client/src/london-area-names.ts)，由同一个脚本生成。iOS（`areaName`）和 Web（`areaName`）用它显示片区名，例如 “King’s Cross & Bloomsbury North”。接口契约没有改动：契约只传代码，名称表放在客户端。

## 2. 数据来源与授权

| 内容 | 来源 | 授权 | 用法 |
| --- | --- | --- | --- |
| 边界 | ONS「Lower layer Super Output Areas (December 2021) Boundaries EW BGC」（20 m 概化、按海岸线裁切） | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) | 可以商用、修改和再发布，条件是注明来源 |
| 片区名 | 英国下议院图书馆 [MSOA Names](https://houseofcommonslibrary.github.io/msoanames/) 2.3 版（2026-02-13 发布） | [Open Parliament Licence v3.0](https://www.parliament.uk/site-information/copyright/open-parliament-licence) | 可以在产品中使用，条件是注明来源，并尽量附上授权链接 |

- ONS 原始入口：[Open Geography Portal](https://geoportal.statistics.gov.uk/)。云端构建环境连不上 ONS 门户，所以脚本从公开镜像 [drkane/geo-lookups](https://github.com/drkane/geo-lookups) 读取同一份 ONS 数据。镜像固定在提交 `e20a072d5fc0918437abaa3622be63f40b71d9dd`，按行政区拆分，保留 ONS 的字段（`LSOA21CD`、`GlobalID` 等），说明中写明数据来自 ONS Geoportal、按 OGL v3.0 使用。脚本会逐个核对文件的 SHA-256，对不上就停止。
- 片区名从下议院图书馆网站的源仓库读取（[houseofcommonslibrary.github.io](https://github.com/houseofcommonslibrary/houseofcommonslibrary.github.io) 的 `msoanames/MSOA-Names-2.3.csv`），同样核对 SHA-256。
- 没有使用 OpenStreetMap：它的数据库授权 ODbL 有相同方式共享的要求，而上面两个来源都没有这项要求，完全够用。

### 必须标注的来源说明

数据文件的 `attribution` 字段保存以下原文。凡是展示或再发布这份数据的地方，都要带上这两句：

> Source: Office for National Statistics licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2021.
>
> Area names: House of Commons Library MSOA Names 2.3, licensed under the Open Parliament Licence v3.0.

- 仓库（公开）：数据文件、本文和生成脚本都带有来源说明，已满足要求。
- App：只显示片区名，不显示边界。片区名来自下议院图书馆数据，按 Open Parliament Licence 的要求，应在 App 内注明来源。**建议上线前在设置页的“关于／法律信息”里加入上面两句及授权链接**。这项需要用户确认文案位置，本轮没有改界面。如果以后在地图上画出边界，同一位置也要注明 ONS 来源。

## 3. 覆盖范围与粒度

- **首发范围**：伦敦市中心的 9 个内伦敦行政区，即 City of London、Westminster、Camden、Islington、Hackney、Tower Hamlets、Southwark、Lambeth、Kensington and Chelsea。理由：Demo 插画地图和产品定位都以伦敦市中心（West End）为中心，这 9 个区覆盖了 Zone 1 和最常见的约饭街区；扩展到整个大伦敦约有 1,000 个 MSOA，会超出 API 上限（256 个片区、10,000 个点）。范围外的餐厅仍按 `unknown` 处理，卡片显示 “London”，不猜测片区。
- **粒度**：以 2021 年 MSOA（每个约 7,000–10,000 名居民）为单位，并使用下议院图书馆给每个 MSOA 起的街区名（如 Shoreditch、Angel、Canary Wharf）。MSOA 由完整的 LSOA 拼成，脚本先把各 LSOA 归到对应的组，再合并成片区。
- **West End 细分**：在 MSOA 这一级，Soho 和 Fitzrovia 西部是同一个片区（“Fitzrovia West & Soho”），Covent Garden、St James's 和 Mayfair 也是同一个（“Strand, St James & Mayfair”），插画地图上的 4 个标记分不开。所以这几处改用 LSOA（每个约 1,500 名居民）按下表拼成街区。表中每个 LSOA 的归属，按它包含的代表性地标确定：

| 片区代码 | 名称 | 组成 LSOA（2021） | 核对用地标 |
| --- | --- | --- | --- |
| `soho` | Soho | Westminster 013B、013G | Soho Square、Old Compton Street、Carnaby Street |
| `fitzrovia` | Fitzrovia | Westminster 013A、013D；Camden 026A、026B | Fitzroy Square、Charlotte Street |
| `covent-garden` | Covent Garden | Westminster 018A、018B；Camden 028C、028D | Covent Garden Piazza、Seven Dials |
| `st-jamess` | St James’s | Westminster 018C | St James's Square |
| `mayfair` | Mayfair | Westminster 018D、011E | Berkeley Square、Mount Street |

被拆开的 MSOA 剩下的部分改名：Westminster 011 改为 Marylebone，Camden 026 改为 Bloomsbury West，Camden 028 改为 Holborn & Bloomsbury South。

- **代码规则**：片区代码由名称生成，转成小写，去掉撇号，`&`、逗号和空格都换成连字符。例如 “St James’s” 变成 `st-jamess`，“King's Cross & Bloomsbury North” 变成 `kings-cross-bloomsbury-north`。生成结果与 App 已有的 `soho`、`fitzrovia`、`covent-garden`、`st-jamess` 完全一致，插画地图标记不需要改。

## 4. 已知近似

LSOA 的边界沿街道划分，但不完全等于大家习惯的街区边界。下面这些情况属于数据本身的近似，不是代码问题：

- 唐人街（Gerrard Street、Lisle Street）和 Leicester Square 归入 `covent-garden`。Westminster 的选区也把它们和 Covent Garden 划在一起。
- Oxford Street 以北的 Newman Street、Rathbone Place（属于 Westminster 一侧的 Fitzrovia）归入 `soho`；Hanover Square、Savile Row 和 Piccadilly Circus 也归入 `soho`。
- Trafalgar Square、Whitehall 北段和 St James's Park 归入 `st-jamess`；Green Park 归入 `mayfair`。
- Warren Street、UCL 一带归入 Bloomsbury West。
- 边界经过 25 m 概化（见下节），紧贴分界街道的餐厅可能被归到马路对面的片区。

如果要更精确（例如把唐人街单独列出），需要更细的 Output Area 边界，或者由产品方自行划定街区。后者是我们自己画的数据，要单独记录出处。

## 5. 生成方法与规模

1. 下载 9 个区的 LSOA 2021 边界（共 1,158 个 LSOA）和 MSOA 名称表，并核对 SHA-256。
2. 按 MSOA 或上表的街区给每个 LSOA 分组。同一个代码只能来自一个 MSOA 或一个街区，否则脚本停止。
3. 用 mapshaper 合并（`-dissolve`），再在共享边上概化（`-simplify interval=25 keep-shapes`，Visvalingam 加权算法）并清理（`-clean`）。相邻片区共用同一条简化后的边，不会出现缝隙或重叠。坐标保留 6 位小数（约 0.1 m）。
4. 输出前检查：片区数不超过 256，环上的点总数不超过 10,000，并且插画地图需要的 4 个代码都在。

当前结果：232 个片区，其中 2 个由多块组成（`millwall-south`、`pimlico-south`），没有内洞；共 9,574 个点；文件 228.9 KiB，gzip 后约 62 KiB。API 启动时编译约 25 ms，单次查询约 0.1 ms。

## 6. 版本与更新

- 改动片区划分或名称时，必须把 `VERSION` 改成新版本或把 `REVISION` 加 1，然后重新生成。API 会用新的修订号更新餐厅的片区；已发布饭局的片区保持不变（规则见 `area-mapping.api.test.ts`）。
- ONS 或下议院图书馆发布新版本时，更新脚本里的提交号、URL 和 SHA-256，并在本文记录。
- 测试：`apps/api/src/venues/london-areas.unit.test.ts` 检查数据文件能按 production 规则编译、没有超出上限、来源说明齐全、地标归属正确、范围外的点为 `unknown`，以及客户端名称表与数据一致。`area-mapping.api.test.ts` 用这份数据走一遍真实 HTTP 的确认餐厅和发布饭局流程。
