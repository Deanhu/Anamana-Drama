# VidStore 后台管理问题反馈登记表

> 本地草稿，字段结构需与钉钉在线表「VidStore 后台管理问题反馈」保持一致。
> 线上表当前字段顺序：场景 / 问题描述 / 期待结果 / bug级别 / 反馈人 / 输入时间 / 截图。
> 创建时间：2026-05-13
> 最近同步：2026-05-15

| 场景 | 问题描述 | 期待结果 | bug级别 | 反馈人 | 输入时间 | 截图 |
|------|----------|----------|---------|--------|----------|------|
| 状态流转 | 点击下线未出现二次确认 | 下线应弹确认：下线后 App 端将不再展示该漫剧，确定下线？ | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-50-50-283Z-offline-confirm-missing.png |
| 发布 | 草稿未能发布 | 填齐必填项后应能发布 | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-50-00-781Z-pe-publish-failed.png |
| 翻译 | 未找到一键翻译/翻译全部按钮 | §4.2 多语言区标题栏应提供一键翻译全部文本按钮 | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-49-07-531Z-batch-translate-missing.png |
| 详情页-基本信息 | 基本字段缺失：归属人 | 详情页应包含漫剧名称、SeriesId、作者、归属人、语言、剧来源、制作模式、横竖屏、类型、简介、Tag | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-48-22-377Z-detail-base-fields-missing.png |
| 详情页-基本信息 | 详情页缺少归属人字段 | 归属人应自动填入当前登录账号，并作为只读字段展示 | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-48-22-377Z-detail-owner-missing.png |
| 导航 | 无法进入任意剧集详情页 | 应能从列表页点击卡片进入详情 | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-48-154Z-detail-nav-failed.png |
| 发布 | 草稿未能发布 | 填齐必填项后应能发布 | P1 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-996Z-pe-publish-failed.png |
| 批量添加剧集 | 确认上传后未看到第 24 集或上传状态更新 | 确认上传后应新增第 24 集行，并显示上传/处理状态 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-51-57-784Z-video-upload-not-started.png |
| 字幕矩阵 | 已上传字幕未展示完整文件名/预览/替换/删除操作 | 已上传字幕单元格应展示文件名，hover 显示预览/替换/删除 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-51-19-249Z-subtitle-actions-missing.png |
| 语言管理 | 语言搜索面板缺少已选x/15计数 | §5.5 搜索面板顶部应显示已选x/15种语言 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-49-07-531Z-lang-search-panel-missing.png |
| 语言筛选 | 语言筛选语种与规格不一致，缺少 ZH、AR、HI、VI，额外出现 IT、SV、NL、FIL | 语言筛选应为 15 语言：EN/ZH/JA/KO/ES/FR/TH/PT/DE/AR/HI/ID/VI/TR/RU | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-48-40-681Z-language-options-mismatch.png |
| 网络资源 | 存在关键资源加载失败：https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap | 页面关键资源应稳定加载，不应出现 ERR_CONNECTION_RESET / EMPTY_RESPONSE | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-15T02-48-40-681Z-resource-failed.png |
| 标签管理 | 标签列表缺少表格 | §12.1 应以表格展示所有标签 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-376Z-tag-table-missing.png |
| 标签管理 | 未找到新建标签按钮 | §12.1 顶部应有新建标签按钮 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-376Z-tag-create-btn-missing.png |
| 标签管理 | 标签列表缺少编辑按钮 | §12.1 操作列应有编辑入口 | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-376Z-tag-edit-missing.png |
| 作者管理 | 作者列表缺少表格 | §13.1 应以表格展示头像/名称/类型/Title | P2 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-376Z-author-table-missing.png |
| 标签管理 | 标签列表缺少搜索框 | §12.1 顶部应有搜索框 | P3 | Dean | 2026-05-15 | qa/vidstore-acceptance/screenshots/2026-05-14T12-50-49-376Z-tag-search-missing.png |

## 新增 bug 填写规则

新增行必须按线上表字段顺序填写：

| 场景 | 问题描述 | 期待结果 | bug级别 | 反馈人 | 输入时间 | 截图 |
|------|----------|----------|---------|--------|----------|------|
| 示例：状态流转 | 示例：点击下线后未出现确认弹窗 | 示例：下线前应弹出二次确认，并说明 App 端不再展示 | P1 | Dean | YYYY-MM-DD | qa/vidstore-acceptance/screenshots/example.png |

规则：
- `bug级别` 只填 `P0` / `P1` / `P2` / `P3`，并按 `P0 → P1 → P2 → P3` 排列。
- `反馈人` 默认填 `Dean`。
- `输入时间` 使用 `YYYY-MM-DD`。
- `截图` 本地写相对路径；同步到钉钉表时必须把图片直接插入截图列，不能只填本地路径或压缩包链接。
- 新增后如果要同步线上，需同时写入文字字段并调用表格图片上传/插入能力。

## 字段说明

| 字段 | 填写规则 |
|------|----------|
| 场景 | 登录 / 列表页 / 创建漫剧 / 编辑基本信息 / 素材管理 / 多语言 / 剧集管理 / 字幕管理 / 状态流转 / 标签管理 / 作者管理 / 权限 / 操作手册 |
| 问题描述 | 实际看到的问题，必须可复现 |
| 期待结果 | 对照 demo/dev-spec.md v1.0.6、研发反馈决策表、操作手册后的正确表现 |
| bug级别 | P0 阻塞 / P1 主流程错误 / P2 体验或规格偏差 / P3 文案或轻微样式 |
| 反馈人 | 默认 Dean |
| 输入时间 | 发现或录入日期，格式 YYYY-MM-DD |
| 截图 | 本地保留相对路径；线上必须插入图片缩略图 |

## 分级标准

| 级别 | 定义 | 示例 |
|------|------|------|
| P0 阻塞 | 无法登录、无法进入 Drama、无法创建/保存/发布、数据丢失、页面白屏 | 登录失败、创建按钮无效、保存报错 |
| P1 主流程错误 | 核心业务规则不符合产品决策，但仍可继续操作 | 已下线仍可编辑、发布校验缺失、翻译自动触发 |
| P2 体验或规格偏差 | 与 demo/spec 不一致，影响效率或理解 | 筛选计数不对、完成度 chip 错误、二次确认文案不对 |
| P3 文案或轻微样式 | 不影响流程的小问题 | 文案错别字、间距轻微偏差 |
