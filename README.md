# Paper Library

在线书架：https://co1dog.github.io/paper-library/

## 在网站中上传

右上角菜单 → **添加论文** → 选择原文 PDF 和中文解读 HTML → 检查首页封面与文献信息 → **上传并加入书架**。文件不再需要手动上传到 GitHub 网页，也无需手动创建 Issue。

首次使用，在「连接书架 / 上传授权」中连接 fine-grained personal access token：Resource owner 选择 **Co1dog**，Repository access 只选择 **paper-library**，Contents 设为 **Read and write**，Metadata 保持默认只读。授权码只在当前页面内存中使用，不保存到 localStorage、sessionStorage、URL 或仓库；刷新或关闭页面后需要重新连接。不要通过聊天发送授权码。

- 原文和解读每个文件最多 60 MB；自选封面最多 5 MB。
- 本地托管的 PDF.js 从原文第一页生成封面，PDF 保持原始字节；无法生成时可选择 PNG / JPG。
- HTML 需要是完整阅读页，图像和脚本应内嵌或使用在线地址。
- 这是公开书架，上传的文件和笔记公开可见。请上传确认可以公开分享的原文和可信解读。
- 文件、封面和目录放入同一次提交；并行修改通过非强制更新保留。重复论文会被提示，失败不会显示为成功。
- 保存后书架立即显示新记录；公开阅读入口在 GitHub Pages 发布完成后可用。

## 展示与阅读

纯黑背景、大幅背景标题、真实封面和 Wheel / List 双视图沿用现有设计。轮盘支持滚轮、双轴触控板、拖动、方向键和惯性吸附。中文使用 Noto Serif SC / 系统宋体，英文使用托管的 Anthropic Serif。

搜索入口独立放在右上角菜单图标旁；添加、上传授权、自动轮播、JSON 导出和刷新仍在三横线菜单中。详情采用站内阅读室，切换原文 PDF 与完整中文解读；期刊来源保留独立入口。无真实记录时的示例均有标注，且不计入真实统计。

轮盘只挂载当前位置附近最多 7 张封面，通常约 5 张处于可见区域；转到下方时渐隐并回收，角度步长与相邻封面间距保持原方案。桌面鼠标悬停时有轻微抬升和随指针倾斜的 3D 效果，移开复位；触屏和减少动态效果偏好下关闭悬停动画。当前论文和下一篇的背景标题都能点击打开对应详情。

## 关键词和中英文搜索

关键词按「信号 / 测量、数据资源、AI 模型、方法 / 重点」分组。现有论文使用 fMRI、ECoG、眼动、有数据集、JEPA、LLM、HMM、ISC、ISFC 等标签；具体口径见 papers/KEYWORDS.md。

复选框采用 **AND**：例如勾选「ECoG + 有数据集」找到 Podcast 数据集论文。支持中文、英文、大小写不敏感和中英混合搜索；旧的主题保留在 searchTerms 中用于搜索，不再全部显示为筛选按钮。
保留性能优化：每帧只计算可见圆弧，合并滚轮与拖动输入，复用静态封面，避免无效阴影。尊重 prefers-reduced-motion，自动轮播默认关闭。

## 资料与来源

`papers/library.json` 保存目录。每条记录关联 `papers/<id>/original.pdf`、`reading.html`、`cover.png`。原有仓库所有者创建、带 `<!-- paper-library:v1 -->` 的开放 Issue 继续兼容；同一 DOI / URL 不重复统计。已迁入目录的记录以目录为准。

2026-11-03 从 Papers 文件夹选取 6 篇完整 xray 解读，排除草稿、备份、QA 测试件和网页抓取件，并匹配各自原文：

- Nastase et al. (2019)，ISC 方法：38 页同行评审稿，含机构封面。
- Chen et al. (2016)，Minutes versus Hours：2015 Advance Access 版本，14 页。
- Nastase et al. (2021)，Narratives fMRI：出版社版本，22 页。
- Zada et al. (2025)，Podcast ECoG：出版社版本，9 页。
- Balestriero & LeCun (2026)，Platonic / JEPAs：arXiv v1，37 页。
- Xiao et al. (2026)，Brain-guided reasoning：arXiv v1，63 页；解读沿用该预印本页码。

加上先前的 Nau et al. (2025)，共 7 篇。各目录 README 登记原文版本、来源和 SHA-256。源文件未修改；公开解读副本移除源机器绝对路径，保留图像、公式、交互与证据范围。原文版权与许可属于所标注的作者和出版方，中文解读为独立阅读材料。

## 开发与验证

主体为原生 HTML / CSS / JavaScript modules；轮播为 React Bits + GSAP island，生产 bundle 已提交。GitHub Pages 发布 main 分支根目录，`.nojekyll` 禁用 Jekyll。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

主体文件无需构建。修改 src/ 后重新构建并提交 assets/。上传核心位于 upload-core.js，界面与 PDF 封面生成位于 upload.js。测试覆盖字节传输、账户权限、原子提交、并发合并、重复论文和失败状态。

组件和字体许可见 THIRD_PARTY_NOTICES.md、REACT_BITS_LICENSE.md；PDF.js 的 Apache-2.0 许可保存在 assets/vendor/pdfjs/LICENSE。视觉构图参考 [CRL Library](https://crl-2026.webflow.io/library)，以独立 React / CSS / GSAP 实现。

## 云端笔记与快速阅读

中文解读顶部的「连接 GitHub」使用现有 `Contents: Read and write` 仓库授权。编辑后约 2 秒自动保存；「立即同步」可立刻保存，另一浏览器打开论文时会读取云端记录。授权码仍只保留在当前页面内存，刷新后若要继续写入需要重新连接；读取公开笔记不需要授权。

笔记以 JSON 保存到独立的 `reading-notes` 分支，路径为 `annotations/<paper-id>.json`，避免每次自动保存都触发 GitHub Pages 部署。该分支会在第一次保存时创建。笔记与本书架一样公开。同步暂时失败时会保留本机草稿，重新连接或点击重试后再保存。并行编辑采用逐条合并；同一条的不同修改会保留为两个版本。

现有解读通过 `python3 scripts/prepare_readers.py` 生成 `view.html`：共享字体与脚本可缓存，原图按需加载。`reading.html` 与原文 PDF 保持原始文件，导出 HTML 副本时仍使用完整原版。以后从网站上传的新 HTML 即使尚未生成 `view.html`，也可以照常阅读和同步笔记；运行上述脚本可为新增论文生成轻量阅读入口。

PDF 首页不再等待其他页的尺寸解析，后续页面继续按阅读位置渲染。支持字节范围请求的服务器会按需传输 PDF 数据。
