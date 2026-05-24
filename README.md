<div align="center">

# Pixiv Toolbox

### 検索 · 保存 · 管理

**A beautiful, anime-inspired Pixiv search & download Web GUI — built on Flask, Playwright, and pixivpy-async.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Playwright](https://img.shields.io/badge/Playwright-Browser%20Auto-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/python/)
[![Stars](https://img.shields.io/github/stars/shitianyaa/pixiv-toolbox?style=social)](https://github.com/shitianyaa/pixiv-toolbox/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/shitianyaa/pixiv-toolbox)](https://github.com/shitianyaa/pixiv-toolbox/commits)

**English** · [简体中文](./README.zh-CN.md)

<img src="docs/screenshot-token.png" alt="Pixiv Toolbox preview" width="820">

</div>

---

**Pixiv Toolbox** is a self-hosted Web GUI that bundles everything you need to work with Pixiv from a browser tab — OAuth refresh-token capture, API connectivity testing, tag search with rich filters, gallery preview, and multi-quality image download. It is designed for **anime / ACG fans** who want a tool that is *actually nice to look at*, and for **Python developers** who want a clean reference on top of `pixivpy-async`.

What sets it apart:

- **Aesthetics first** — a Blue Archive-inspired theme with Arona artwork, sakura accents, and a custom canvas background, instead of yet another bootstrap dashboard.
- **One-stop workflow** — login, test, search, and download all live in a single page; no CLI gymnastics, no copy-pasting tokens across scripts.
- **Zero-config networking** — local proxies (Clash, V2Ray, Shadowsocks) are auto-detected; HTTP / SOCKS4 / SOCKS5 all supported.

## ✨ Features

- 🔐 **One-click OAuth login** — Playwright drives a real browser to capture your Pixiv `refresh_token`; captcha-friendly with optional visible window.
- 🎌 **Anime-inspired UI** — Blue Archive themed by default, with a sakura alt-theme, animated canvas background, and bilingual JP/CN typography.
- 🔍 **Powerful tag search** — filter by date range, ranking mode, sort order, minimum bookmarks, and R-18 toggle.
- 🖼️ **Gallery & list preview** — switch between card grid and structured list views in one click.
- 📥 **Multi-quality download** — pick original / large / medium; downloads go to `downloads/` by default.
- 🌐 **Proxy auto-detect** — Clash (7890 / 7897), V2Ray (10809), and other common local ports are detected automatically; manual override supported.
- ⚡ **Connectivity self-test** — verify your token, ranking fetch, search, and download pipeline in one click before doing real work.
- 🧩 **Single-page architecture** — Flask blueprints + vanilla ES modules; no heavy frontend framework, easy to fork and theme.

## 📸 Screenshots

<table>
  <tr>
    <td align="center"><strong>Token Helper</strong></td>
    <td align="center"><strong>Connectivity Test</strong></td>
    <td align="center"><strong>Search Preview</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshot-token.png" alt="Token helper" width="280"></td>
    <td><img src="docs/screenshot-test.png" alt="Connectivity test" width="280"></td>
    <td><img src="docs/screenshot-search.png" alt="Search preview" width="280"></td>
  </tr>
</table>

## 🚀 Quick Start

### Requirements

- **Python** 3.9 or newer
- A modern browser: Chrome, Edge, or the bundled Playwright Chromium
- A valid **Pixiv account** (you provide the credentials; nothing is uploaded)

### Install

```bash
git clone https://github.com/shitianyaa/pixiv-toolbox.git
cd pixiv-toolbox
pip install -r requirements.txt
playwright install chromium
```

### Run

```bash
python app.py
```

Then open <http://127.0.0.1:5000> — the page also opens automatically on startup.

### First-time setup (recommended flow)

1. **Get Token** tab → enter your Pixiv account → click *Start*. A browser window will pop up; complete any captcha and the `refresh_token` is captured automatically.
2. **Connectivity Test** tab → paste the token → run the full pipeline check (login, ranking fetch, tag search, R-18 filter, image download).
3. **Search Preview** tab → start searching by tag, tune filters, and download what you like.

## ⚙️ Configuration

| Option | How to set | Default |
| --- | --- | --- |
| **Proxy** | UI form field | auto-detected (Clash / V2Ray / SS) |
| **Browser path** | env `PIXIV_BROWSER_PATH` | system Chrome / Edge / Playwright Chromium |
| **Download directory** | hardcoded — fork to change | `./downloads/` |
| **Dev / asset cache** | env `FLASK_ENV=production` to lock asset version | `development` |

Proxy supports `http://`, `socks4://`, `socks5://`. `https://` proxies are not supported.

## 🏗️ Project Structure

```text
pixiv-toolbox/
├── app.py                 # Flask entrypoint, blueprint registration
├── token_fetcher.py       # Pixiv OAuth refresh-token helper (Playwright)
├── downloader.py          # pixivpy-async wrapper: search + download + proxy detect
├── templates/
│   └── index.html         # Single-page Web UI
├── static/
│   ├── css/               # Tokens, layout, components, themes
│   ├── js/                # core / features / ui / effects (ES modules)
│   └── images/            # UI assets (Arona background, etc.)
├── docs/                  # Screenshots and docs assets
└── downloads/             # Local image output
```

**Data flow:** `Browser → Playwright login → refresh_token → pixivpy-async → Pixiv API → local storage`

## 🛠️ Tech Stack

| Layer | Tech |
| --- | --- |
| Backend | Flask 3 + blueprints |
| Pixiv API | [pixivpy-async](https://github.com/Mikubill/pixivpy-async) |
| Browser automation | [Playwright](https://playwright.dev/python/) |
| Frontend | Vanilla HTML / CSS / JavaScript (ES modules), Noto Sans SC + Outfit |
| Theming | CSS custom properties, swappable themes (`theme.ba.css`, `theme.sakura.css`) |

## 🎨 Themes

Pixiv Toolbox ships with **two themes** out of the box:

- **Blue Archive** (default) — Arona background, blue/cyan palette, JP kanji accents
- **Sakura** — soft pink / cream palette, ideal for daylight use

Themes are plain CSS files under `static/css/`. PRs for new themes (Genshin, Honkai: Star Rail, Arknights…) are very welcome.

## 🤝 Contributing

Issues, PRs, and theme contributions are welcome. If you find a bug or have a feature idea:

1. Open an [Issue](https://github.com/shitianyaa/pixiv-toolbox/issues) with steps to reproduce or your use case.
2. For PRs, please keep the change focused — one feature or fix per PR.
3. Theme PRs only need to touch `static/css/theme.*.css` and (optionally) add a background to `static/images/`.

## ⚠️ Notes

- Use your own Pixiv account and follow Pixiv's terms of service.
- **Keep your `refresh_token` private.** Never paste it into issues, screenshots, logs, or public chat.
- If Pixiv prompts for captcha or extra verification, enable *Show browser window* and finish the challenge manually.
- This is a **personal-use tool**, not a scraper — don't hammer the API.

## 📜 License

Released under the [MIT License](LICENSE).

## 🙏 Acknowledgements

| Project | Usage | License |
| --- | --- | --- |
| [pixiv-token](https://github.com/piglig/pixiv-token) | The core OAuth token flow in `token_fetcher.py` is adapted and wrapped for Flask. | MIT |
| [pixivpy-async](https://github.com/Mikubill/pixivpy-async) | Async Pixiv API client powering search and download. | Unlicense |
| [Blue Archive](https://bluearchive.nexon.com/) | Arona artwork & visual inspiration for the default theme. | © Nexon / Yostar — fan-use only |

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=shitianyaa/pixiv-toolbox&type=Date)](https://star-history.com/#shitianyaa/pixiv-toolbox&Date)

---

<div align="center">

**English** · [简体中文](./README.zh-CN.md)

Made with 🎨 by [@shitianyaa](https://github.com/shitianyaa) · If this project helped you, please consider giving it a ⭐

</div>
