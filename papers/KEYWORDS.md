# 书架关键词

每篇保留 3–5 个有辨识度的标签，按四组展示。分组由 search-core.js 管理，中文、英文与常见缩写共用搜索别名。

- 信号 / 测量：论文实际使用或主要讲解的 EEG、fMRI、ECoG、MEG、眼动等测量。
- 数据资源：「有数据集」表示论文新发布或公开数据集。单纯复用已有数据不加此标签。
- AI 模型：JEPA、LLM 等模型类别。
- 方法 / 重点：HMM、ISC、ISFC、编码模型等主要方法，以及少量区分研究内容的重点。

| 论文 | 展示标签 | 核对依据 |
| --- | --- | --- |
| Nau 2025 | fMRI、眼动、有数据集、HMM | 原文 Methods；p.12 Data availability 公开两套眼动数据、眼区体素数据与回忆转写 |
| Narratives 2021 | fMRI、有数据集、ISC | 论文题目、数据描述与技术验证 |
| Podcast 2025 | ECoG、有数据集、LLM、编码模型 | 论文题目与特征编码分析，中文解读第 7 节 Ridge |
| Chen 2016 | fMRI、ISC、ISFC、情景记忆 | 实验设计；中文解读第 7 节 / 本地原文 p.8 海马–皮层 ISFC |
| ISC 2019 | fMRI、ISC、ISFC | 方法论文与中文解读第 6 节 |
| JEPA 2026 | JEPA、表示学习、跨模态对齐 | 论文训练目标与跨模态实验 |
| Brain-guided 2026 | fMRI、LLM、脑引导、推理 | 论文方法与本地原文 p.18 Data Availability；神经数据为复用数据 |

原先的自然叙事、事件记忆、NeuroAI 等主题保留在 searchTerms 中用于全文检索，不再全部作为筛选按钮出现。目录的 keywordSchema: 2 用于防止部署切换时旧缓存覆盖新分类；上传新论文会保留此版本字段。
