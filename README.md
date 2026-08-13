# Anamana Drama Admin

漫剧（Comic Drama）项目的**运营内部后台**——B 端管理系统，不是 C 端 App。

本仓库只承载"漫剧后台管理"这一条线：HTML 原型、验收测试、研发对接文档。

## 目录结构

```
.
├── demo/          # HTML 原型 + 研发说明 dev-spec
│   ├── drama-list.html        # 剧集列表页
│   ├── drama-detail.html      # 剧集详情/编辑页
│   ├── tag-list.html          # 标签列表页
│   ├── tag-detail.html        # 标签详情页
│   ├── author-list.html       # 作者列表页
│   ├── author-detail.html     # 作者详情页
│   └── dev-spec.md            # 研发说明 & 关键约束（当前 v1.0.7）
├── qa/            # Playwright 验收测试
│   └── vidstore-acceptance/
│       ├── *.js               # 各场景验收脚本
│       ├── 验收checklist.md
│       └── bug-report-*.md
├── docs/          # 研发对接文档
│   ├── 研发反馈决策表-v1.0.4.md
│   └── VidStore-后台管理问题反馈-本地登记表.md
├── archive/       # demo 历史打包归档（v1.0.2 ~ v1.0.7）
└── CLAUDE.md      # 协作约定
```

## 当前阶段（P0）

漫剧**剧集管理**：剧集上传、信息配置、多语言配置。

## 运行验收测试

```bash
cd qa/vidstore-acceptance
npm install
node readonly-check.js        # 按需运行各脚本
```

测试默认 headless 运行，不弹浏览器窗口。screenshots/ 和 reports/ 是运行产物，不进 git。

## 版本对应

- `demo/dev-spec.md` 记录 v1.0.0 ~ v1.0.7 的演进
- v1.0.8（剧集视频/字幕文件识别规则）是独立钉钉文档，不在本仓库
- 历史打包见 `archive/`
