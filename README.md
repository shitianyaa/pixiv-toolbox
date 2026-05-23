# 🎆 蔚蓝 Pixiv 工具箱

一站式 Pixiv 图片搜索与下载的 Web 可视化工具，基于 Flask 构建，提供直观的浏览器 GUI 界面。

## ✨ 功能

- **🔑 Token 获取** — 通过 Playwright 自动化浏览器完成 Pixiv OAuth 登录，一键获取 `refresh_token`
- **📡 连通测试** — 自动检测 API 登录、排行榜拉取、标签搜索、R18 过滤、图片下载全流程
- **🔍 搜索预览** — 按标签搜索 Pixiv 作品，支持多种筛选条件（排序/时间段/排行榜/最低收藏数），文字列表与图卡画廊双视图
- **📥 高清下载** — 支持原图/大图/中图多种画质，自动检测本地代理

## 🚀 快速开始

### 环境要求

- Python 3.9+
- Chrome 或 Edge 浏览器（用于 Playwright 自动登录）

### 安装

```bash
cd pixiv-toolbox

# 安装依赖（Flask + Playwright + pixivpy-async）
pip install flask playwright
playwright install chromium

# pixivpy-async 位于上级目录，已通过 sys.path 自动引用
# 如独立使用，需单独安装: pip install pixivpy-async
```

### 启动

```bash
python app.py
```

浏览器访问 `http://127.0.0.1:5000`，首次启动会自动打开页面。

## 📁 项目结构

```
pixiv-toolbox/
├── app.py                 # Flask 主入口
├── token_fetcher.py       # Pixiv OAuth Token 获取（Playwright 自动化）
├── downloader.py          # Pixiv API 下载 & 搜索模块
├── templates/
│   └── index.html         # 单页前端模板
├── static/
│   ├── css/               # 样式文件（蔚蓝档案主题）
│   └── js/                # 前端脚本（ES Module 架构）
│       ├── main.js        # 入口
│       ├── core/          # 工具函数
│       ├── ui/            # UI 组件（Tab/Toast/Lightbox 等）
│       ├── features/      # 业务功能（Token/测试/搜索）
│       └── effects/       # 视觉效果（粒子动画）
└── downloads/             # 图片下载目录
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Flask (Python) |
| Pixiv API | pixivpy-async（异步） |
| 浏览器自动化 | Playwright |
| 前端 | 原生 HTML/CSS/JS (ES Module) |
| 设计主题 | 蔚蓝档案 (Blue Archive) 风格 |

## 📝 配置

- **代理地址**：支持 `http://`、`socks4://`、`socks5://`，留空则直连。工具会自动检测本地常见代理端口（7890/7897/10809 等）
- **浏览器路径**：设置环境变量 `PIXIV_BROWSER_PATH` 可指定自定义浏览器路径
- **下载目录**：默认为项目下的 `downloads/` 文件夹

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

本项目的开发离不开以下优秀开源项目：

| 项目 | 说明 | 许可证 |
|------|------|--------|
| [**pixiv-token**](https://github.com/piglig/pixiv-token) | Pixiv OAuth Token 自动获取工具，本项目 `token_fetcher.py` 的核心逻辑基于此项目移植并封装为 Flask Blueprint | MIT License © piglig |
| [**pixivpy-async**](https://github.com/Mikubill/pixivpy-async) | 异步 Pixiv API Python 库，本项目的搜索与下载功能依赖此库与 Pixiv API 交互 | Public Domain (Unlicense) © Mikubill |

感谢 [pixitrix](https://github.com/piglig) 和 [Mikubill](https://github.com/Mikubill) 的开源贡献！

### 素材说明

- `static/images/arona-bg.png` 背景图由 **GPT Image 2** 生成，蔚蓝档案风格。
