# Paper Library

一个以 GitHub Pages 托管、GitHub Issues 保存论文记录的个人阅读书架。

**在线书架：** https://co1dog.github.io/paper-library/

## 功能

- 标题、作者、期刊、主题、阅读笔记全文检索
- 研究主题筛选，卡片 / 列表视图
- 最近 30 天、重点收藏、有笔记的论文
- 原文链接、笔记详情、JSON 导出
- 桌面一屏横向书架，手机横滑轮播；右上角三横线菜单收纳辅助功能
- 无真实记录时展示明确标注的示例卡片，统计只计算真实记录

## 添加论文

1. 打开右上角三横线功能菜单，点击「添加论文」，填写标题、主题、原文链接、阅读笔记等。
2. 点击「继续到 GitHub 提交」，再点击生成的链接。
3. 用 **Co1dog** 登录 GitHub，在预填的新 Issue 中点击 **Create / Submit new issue**。
4. 回到网页，在功能菜单中点击「刷新 GitHub 论文」。

长笔记会提供「复制完整记录」按钮，将记录粘贴到 GitHub Issue 正文后提交。
表单草稿保存在当前浏览器中，**只有 GitHub 提交成功后才跨设备可见**。清空浏览器数据会移除未提交的表单草稿。

## 编辑、删除、恢复

在论文详情中点击「在 GitHub 编辑」，编辑 Issue 正文 JSON 中对应的字段并保存。
关闭 Issue 会将该条记录从书架中移除；重新打开可以恢复。
重点收藏通过 JSON 中 `"favorite": true` / `false` 管理。

## 数据与权限

- 这是公开书架。提交的文献信息和笔记会公开显示。
- 页面只读取仓库所有者 **Co1dog** 创建的开放 Issue，并要求正文包含 `<!-- paper-library:v1 -->` 和有效 JSON 代码块。
- 其他访客创建的 Issue 不会显示到书架。
- 不使用 GitHub Token，也不把登录凭证存到网页中。
- GitHub 公共 API 有读取速率限制。连接失败时网页会显示明确提示；稍后刷新即可。
- 每次最多读取 1000 条开放 Issue，超过会提示归档，不会静默遗漏。
- 导出只包含真实记录，不包括演示卡片。
- 保存文献信息、笔记和原文链接；本版本不上传或托管 PDF 文件。
- 网页字体使用 Google Fonts；无法连接时自动使用系统字体。

## 页面发布

仓库 Settings → Pages → Source 选择 **Deploy from a branch**，Branch 选择 **main**，目录选择 **/(root)**，Save。
之后修改 main 分支文件会触发 Pages 更新。

主体为 HTML / CSS / JavaScript，轮播使用预先构建的 React island。部署现有版本无需安装依赖或构建；修改轮播源码后的构建方法见下文。`.nojekyll` 禁用 Jekyll 处理。

## 记录格式

```markdown
<!-- paper-library:v1 -->

下面应有一个 json 代码块，其内容格式如下：
```

```json
{
  "title": "论文标题",
  "authors": "作者",
  "year": 2025,
  "venue": "期刊或会议",
  "topic": "研究主题",
  "url": "https://doi.org/...",
  "summary": "一句话收获",
  "notes": "阅读笔记",
  "readDate": "2026-10-23",
  "favorite": true
}
```

若迁移到其他仓库，请修改 `app.js` 中的 `OWNER` / `REPO`，以及 HTML 和本说明中的账号文案。

## 立体弧形书架

- 左侧显示阅读信息，右侧为大幅 3D 书架，桌面端一屏呈现。
- 当前文献前置，两侧沿更深的圆柱弧线后退、抬升和旋转；封面包含书脊、纸页厚度与投影。
- GSAP 驱动约 1.15 秒的轨道切换、抬升与回弹，并在鼠标移动时轻微调整视角。
- 轮播与完整列表共享搜索、主题、视图和排序结果，默认按最近阅读排列。
- 点击侧面卡片将其移到中间，点击中间卡片或「打开阅读笔记」查看笔记。
- 支持拖拽、左右键、触屏和横向触控板；普通纵向滚动仍滚动网页。
- 自动轮播默认关闭，可在功能菜单开启；手动开启后在悬停、键盘焦点、页面隐藏、轮播离屏或笔记弹窗开启时暂停。
- 尊重系统 prefers-reduced-motion，关闭自动与位移动效。
- 轮播与普通列表使用同一份 GitHub 数据。没有真实论文时清楚标注示例。
- 文献卡片为标题与主题生成的排版封面，不是论文 PDF 首页。

主体页面仍使用 HTML / CSS / JavaScript；立体轮播是独立 React island，采用 React Bits DepthCarousel + GSAP。生产 bundle 已提交到 assets/，GitHub Pages 直接发布根目录。

### 修改轮播源码

```sh
pnpm install --frozen-lockfile
pnpm run build
```

修改 src/ 后必须重新构建并提交 assets/。修改 app.js、style.css 等主体文件无需构建。依赖版本由 pnpm-lock.yaml 固定。组件来源、修改说明和许可证见 THIRD_PARTY_NOTICES.md 与 REACT_BITS_LICENSE.md。
