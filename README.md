# dsh-anydoc

DeepSeek Harness 插件：把 [anydoc](https://github.com/firecrawl/anydoc)（Firecrawl 开源的 Rust 文档转换引擎）封装进 DSH，将 Word / PowerPoint / Excel / OpenDocument / RTF / EPUB / CSV / PDF 转换为 **GitHub 风格 Markdown**。

引擎以原生 N-API 二进制**内置在插件里，完全离线可用**——不需要网络、不需要 npm 安装、不需要 Rust 工具链。

## 功能

- **Agent 工具**
  - `convert_document_to_markdown(file, format?, output?)` — 转换文档并返回（或写入文件）Markdown
  - `detect_document_format(file)` — 从内容识别文件格式，不转换
- **Skill** — `convert-documents-to-markdown`：教会 Agent 何时以及如何使用上述工具
- **Web 面板**（网页版 `web` 与桌面端 `desktop` 两个 profile 都可用）：设置 → **Anydoc 文档转换**
  - 支持**拖拽上传**：把文件直接拖入面板，或点击顶部的虚线拖拽区选择文件
  - 拖拽与 DSH 自带的上传功能**互不冲突**：指针位于面板内时，面板在 `window` 捕获阶段接管拖拽事件，DSH 的全屏上传遮罩不会弹出
  - 可选指定格式 → 「转换为 Markdown」
  - 结果支持 **预览 / Markdown 源码 / 复制**
  - 对话中工具调用的结果卡片
- **Web API**（同源保护）：`/_dsh/anydoc/health`、`/_dsh/anydoc/convert`、`/_dsh/anydoc/format`

## 支持的格式

| 类型 | 扩展名 |
|---|---|
| Word | `.doc` `.docx` `.docm` |
| PowerPoint | `.ppt` `.pps` `.pot` `.pptx` `.pptm` `.ppsx` `.ppsm` |
| Excel | `.xls` `.xlsx` `.xlsm` `.xlsb` |
| OpenDocument | `.odt` `.ods` `.odp` |
| 其他 | `.rtf` `.epub` `.csv` `.pdf` |

格式从文件内容自动识别；CSV 等无签名格式需显式传 `format`（或依赖扩展名）。

## 环境要求

- Windows x64
- Node.js ≥ 20（与 DSH Web 当前使用的版本一致即可）
- 其他平台：当前构建不支持（`engine.js` 会明确报错；如需支持，见「升级引擎 / 更换平台」）

## 目录结构

```
dsh-anydoc/
├── package.json           # dsh.bundle.patch + dsh.client(web) 声明；零外部依赖
├── cordis.patch.yml       # 把 anydoc 条目挂进 profile 配置层
├── LICENSE                # MIT
├── README.md
├── lib/
│   ├── index.js           # Cordis 插件入口 apply(ctx, config)
│   ├── engine.js          # createRequire 直接加载内置二进制
│   ├── tools.js           # 两个 Agent 工具的 defineTool 定义
│   ├── skill.js           # convert-documents-to-markdown 技能注册
│   ├── web.js             # /_dsh/anydoc/* 路由（webServer 服务）
│   └── client.js          # 浏览器面板（window.__ModuleLoader__ 格式；捕获阶段拦截拖拽）
├── vendor/anydoc/
│   └── anydoc.win32-x64-msvc.node   # 编译好的转换引擎（约 8 MB）
├── assets/skill/SKILL.md  # 技能指令
└── install.ps1            # 离线安装到本机 DSH profile 的辅助脚本
```

## 安装

### 方式一：`dsh plugin`（推荐）

```bash
# 从 GitHub 安装
dsh plugin --profile web add github:laksdjfi/dsh-anydoc

# 发布到 npm 之后
dsh plugin --profile web add dsh-anydoc
```

`dsh plugin` 会在该 profile 目录下调用 pnpm 安装，并在装好后把 `dsh-anydoc` 自动写进 profile 的
`dsh.profile.bundles`。本插件没有任何 `install` / `prepare` 脚本，所以不会触发 pnpm 的 `allowBuilds`
构建授权。

**生效方式**：网页版（`web`）重启 `dsh web`；桌面端（`desktop`）的组合里带 `dsh-hmr`，改完
`package.json` 当场重组，通常**不用重启**。

> 桌面端 profile 由应用自己持有，CLI 的 `dsh plugin --profile desktop` 不管理它；请用应用内侧边栏
> 「插件」页，或用下面的 `install.ps1 -Profile desktop`。

### 方式二：离线安装脚本（无网络时）

在插件目录下执行（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

脚本会把插件复制到 `%USERPROFILE%\.dsh\profiles\<Profile>\node_modules\dsh-anydoc`，并在 profile 的
`package.json` 中注册 `dsh.profile.bundles` 与 `dependencies`。目标 profile 用 `-Profile` 指定（默认 `web`）：

```powershell
# 桌面端 App（Electron，应用自有的 desktop profile）
powershell -ExecutionPolicy Bypass -File install.ps1 -Profile desktop
# 自定义 profile / DSH_HOME
powershell -ExecutionPolicy Bypass -File install.ps1 -Profile webtest
powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome D:\data\.dsh
```

0.1.7 实测：装完 `/_dsh/anydoc/health` 立即可用，会话里立刻出现转换工具。

> 网页版与桌面端是**两个互不相通的 profile**：一边装了另一边不会有。

### 方式三：手动

1. 把整个 `dsh-anydoc` 文件夹复制到 `%USERPROFILE%\.dsh\profiles\<Profile>\node_modules\dsh-anydoc`；
2. 编辑 `%USERPROFILE%\.dsh\profiles\<Profile>\package.json`：
   - `dependencies` 增加 `"dsh-anydoc": "file:node_modules/dsh-anydoc"`
   - `dsh.profile.bundles` 追加 `"dsh-anydoc"`
3. 重启该 profile（桌面端 `desktop` 通常会自动重组）。

> 之后执行 `dsh plugin`（pnpm）时，pnpm 可能清理手动放入 profile `node_modules` 的包，重新执行一次
> `install.ps1` 即可。

## 使用

**Web 面板**：设置 → **Anydoc 文档转换** → 把文件**拖入面板**（或点击顶部虚线拖拽区选择文件）→（可选选格式）→ 转换为 Markdown → 预览/复制。
面板顶部有常驻的虚线拖拽区（带上传图标）；拖入时整个面板高亮为蓝色遮罩「松开鼠标，导入文件」，松手后文件即被选中。

**Agent 工具**：在对话中让 Agent「把 `xxx.docx` 转成 Markdown」，Agent 会调用
`convert_document_to_markdown`；大文档可传 `output` 参数让工具写入文件。

**Skill**：对话中可加载 `convert-documents-to-markdown`。

## 升级引擎 / 更换平台

内置引擎是 `@firecrawl/anydoc` v0.2.3 的 N-API 绑定（Windows x64 MSVC）。

1. 下载新版本二进制（浏览器打开直链）：
   `https://unpkg.com/@firecrawl/anydoc-win32-x64-msvc@<版本>/anydoc.win32-x64-msvc.node`
2. 替换 `vendor/anydoc/anydoc.win32-x64-msvc.node`；
3. 同步更新 `lib/engine.js` 与 `lib/web.js` 中的 `ANYDOC_VERSION`（health 接口会返回该版本号）。

要支持其他平台：把对应平台的 `@firecrawl/anydoc-<platform>-<arch>` 二进制放入
`vendor/anydoc/`，并在 `lib/engine.js` 中按 `process.platform/arch` 选择（参考 anydoc 官方的
NAPI-RS 平台包命名）。

## 已知限制

- 仅支持 Windows x64；其他平台需自行补充二进制（见上）。
- 扫描版 / 纯图片 PDF 需要 OCR，anydoc 不做 OCR，会以 `Unsupported` 失败（可用 Firecrawl Parse 托管 API）。
- 拖拽上传一次只取第一个文件；面板同时保留「选择文件」按钮作为备选。
- 若拖拽起点在面板外（例如先经过聊天区），DSH 的全屏上传遮罩可能先出现；只要在面板区域内松手，文件仍会进入面板（面板在捕获阶段拦截了 `drop`），遮罩随后自动消失。

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| `exports is not defined` | 曾因 client bundle 在 factory 内裸用 `exports` 导致；DSH 的 client 模块系统调用 factory 时只传 `require`，要求 factory **返回**导出对象（`return { inject, apply }`）。已修复；**不要往 bundle 里放 CJS 文件**。 |
| 面板改动不生效 | `lib/client.js` 由服务端按内容哈希（`?rev=`）提供，改完复制进 profile 后**刷新界面**即可；仅当面板整体消失或未注册时，才需要重启该 profile（网页版重启 `dsh web`，桌面端重启 App）。 |
| 拖文件到面板却弹出 DSH 自己的上传遮罩 | 那是 DSH Web 聊天附件的全局拖拽（`dsh-client-ui-attachment` 在 `document` 上监听，拖入任意位置都弹全屏遮罩）。面板在 `window` **捕获阶段**拦截面板区域内的 `dragenter/dragover/drop`（`preventDefault` + `stopImmediatePropagation`），刷新后即可正常使用；若仍复现，确认加载的是最新 bundle（见上行）。 |
| 转换报 `anydoc: ...` | 错误码含义：`Unsupported`（未知格式/图片 PDF）、`Encrypted`（加密）、`Malformed`（无有效内容）、`ResourceLimit`（超安全限制）。 |

## 版本记录

### 0.1.1 — 2026-09-27

- `package.json` 补齐 `repository` / `homepage` / `bugs`；README 增加
  `dsh plugin --profile web add github:laksdjfi/dsh-anydoc` 安装方式（本插件没有 `install` / `prepare`
  脚本，因此不会触发 pnpm 的 `allowBuilds` 构建授权）。
- 安装说明区分 profile：网页版 `web` 与桌面端 `desktop`（应用自有 profile，2 个 profile 互不相通），
  并写明桌面端带 `dsh-hmr`、通常无需重启。
- `install.ps1`：完成提示不再引用机器专属的 `launcher\restart-dsh.ps1`；按 `-Profile` 给出对应的重启/验证方式；
  文件改为 **UTF-8 with BOM**，避免 Windows PowerShell 5.1 按 ANSI 解析导致中文乱码。
- `dsh.client.inject`：移除 0.1.5 之后已不存在的 `@deepseek-ai/dsh-client-runtime`，改为客户端实际
  `require` 的 `@deepseek-ai/dsh-client-ui-primitives`。
- 已在 DSH 0.1.7-rc.1（桌面端）与 0.1.5-rc.2（网页端）两个 profile 上安装验证。

### 0.1.0 — 2026-08-23

- 首个版本：Agent 工具（`convert_document_to_markdown` / `detect_document_format`）、
  `convert-documents-to-markdown` skill、设置内的拖拽转换面板、`/_dsh/anydoc/*` 同源 API；
  内置 `@firecrawl/anydoc` v0.2.3 的 Windows x64 N-API 引擎，完全离线可用。

## License

[MIT](LICENSE)。anydoc 本身为 MIT（© Firecrawl）。
