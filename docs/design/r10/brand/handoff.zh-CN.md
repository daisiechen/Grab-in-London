# Fancy Logo交接 · BRAND-0.1.0

**两个独立Logo候选，推荐A；Owner尚未选定，未命名冻结，不替换现有UI。** [原生Figma比较入口](https://www.figma.com/design/8qCNU0sacee6OWP4hQF230?node-id=2-77)；[24/32px对照](https://www.figma.com/design/8qCNU0sacee6OWP4hQF230?node-id=2-132)；[使用规则](https://www.figma.com/design/8qCNU0sacee6OWP4hQF230?node-id=2-171)。

[品牌brief](brand-brief.zh-CN.md)记录范围与来源；[manifest](artifact-manifest.json)固定输入/节点/资产哈希；[实际节点读回](figma-readback.json)与[PNG尺寸/透明度核对](png-verification.json)是作者证据，不是Owner批准或商标认证。

## 可编辑源与可用资产

| 方向 | 图形与组合字标 | iOS图标源 |
| --- | --- | --- |
| A 空位邀请 | [单色图形](assets/a-mark-forest.svg)／[反白图形](assets/a-mark-inverse.svg)／[橙色空位点缀](assets/a-mark-accent.svg)；[组合字标](assets/a-lockup-forest.svg)／[反白组合](assets/a-lockup-inverse.svg) | [1024 SVG](assets/a-app-icon-1024.svg)／[1024 PNG](assets/a-app-icon-1024.png) |
| B 空椅 | [单色图形](assets/b-mark-forest.svg)／[反白图形](assets/b-mark-inverse.svg)；[组合字标](assets/b-lockup-forest.svg)／[反白组合](assets/b-lockup-inverse.svg) | [1024 SVG](assets/b-app-icon-1024.svg)／[1024 PNG](assets/b-app-icon-1024.png) |

小尺寸透明PNG：[A 24](assets/a-mark-24.png)、[A 32](assets/a-mark-32.png)、[B 24](assets/b-mark-24.png)、[B 32](assets/b-mark-32.png)。[组合预览](evidence/comparison.png)与[实际小尺寸预览](evidence/small-sizes.png)便于快速审阅。

Figma中是原生VECTOR＋可编辑Fancy文本及组件实例，不是生成图或整UI贴图。分发SVG把字标转为向量轮廓，避免接收者缺字体导致变化；Figma仍保留Arial Bold的可编辑文本，不打包或分发字体文件。图形与App图标SVG同样可编辑，不依赖外链图片、字体或脚本。

## 用法与小尺寸边界

- 图形最小24px；组合字标最小120px宽。24/32px已按真实尺寸查看单色/反白，桌椅、椅腿仍可分辨。该检查不证明16px/favicon或任意背景均可读；小于24px不继续缩图，另选满足最小宽度的既有字标布局。
- 外部留白至少图形高度的1/4：128单位图形周围至少32单位；留白由摆放容器预留，不假定SVG自身viewBox已经含全量保护区。
- 单色为森林绿，反白为品牌奶油白；A可选朱橙空位点缀，App图标用柑橘绿空位。背景采用足够对比的单色，不做渐变、阴影或临时换色。
- 不拉伸、旋转、描边改造、加装饰、拆开桌椅相对关系或把文字塞进App图标；字标与符号按交付组合间距使用。
- 两份App图标均为1024×1024、不透明、完整方形源；四角是森林绿，不预烘焙iOS设备圆角或外框。系统mask与商店资产检查属于后续真实构建，不是本次已提交商店。

## 作者实际检查

已创建并读回独立Figma文件：11个Logo相关组件，实际向量/文本/实例，图像填充0；字体为Arial，颜色绑定既有同值品牌变量。数量只作定位，不作设计质量阈值。

已查看组合与24/32px截图；针对PJ指出的A耳机/Q联想做过一次几何精修，改为横向桌面＋分离椅位。导出后核对11个SVG和6个PNG。小图最初下载工具带灰画布，已改用原生PNG透明导出，现4份小图为透明背景；2份App图标全像素不透明、四角森林绿。无图像生成或外部剪贴素材，无真实App/UI改动。

使用`python3 -m unittest discover -s tests -p 'test_brand_r10.py' -v`检查资产哈希、SVG有效/安全、源尺寸/颜色、PNG尺寸及原生候选边界。测试和作者视觉检查不代表Owner选择、商标唯一性、完整品牌研究或真实iOS图标验收。

## 交给DS唯一writer

UX-1可将本文件/manifest作为DS-0.1.0的独立品牌候选引用，不复制成另一份可变真源；当前正常界面继续使用已认可Demo字标。收到明确的Logo选择后再由唯一writer引用所选组件/资产及其版本，不在本包自动改所有页面。跨文件未发布组件若不能直接导入，可在选择后从交付SVG重建链接并记录来源，不能假称已发布共享库。

Figma源文件仍可编辑，原生命名版本未创建；本包以节点与导出哈希定位当前候选。未检查商标/域名或与全部品牌的相似性，未作已注册/唯一原创承诺。未触发业务代码、QA或发布。
