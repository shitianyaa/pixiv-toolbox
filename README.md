# Pixiv Toolbox

A Flask-based Pixiv image search and downloader Web GUI with OAuth token helper, gallery preview, proxy detection, and multi-quality downloads.

中文：一个带 Web 界面的 Pixiv 搜索、预览、Token 获取与图片下载工具。

## Features

- **OAuth token helper**: use Playwright to complete Pixiv login in a browser and capture `refresh_token`.
- **Connectivity test**: verify API login, ranking fetch, tag search, R18 filtering, and image download workflow.
- **Search preview**: search Pixiv works by tag with sorting, date range, ranking mode, and minimum bookmark filters.
- **Gallery and list views**: switch between image cards and structured text results.
- **Image downloader**: download original, large, or medium images with automatic local proxy detection.

## Quick Start

### Requirements

- Python 3.9+
- Chrome, Edge, or Playwright Chromium for browser-based login

### Install

```bash
cd pixiv-toolbox
pip install -r requirements.txt
playwright install chromium
```

### Run

```bash
python app.py
```

Open `http://127.0.0.1:5000` in your browser. The app also tries to open the page automatically on startup.

## Screenshots

Screenshots are not committed yet. Recommended additions:

- `docs/screenshot-home.png`
- `docs/screenshot-search.png`
- `docs/social-preview.png`

## Configuration

- **Proxy**: supports `http://`, `socks4://`, and `socks5://`. Leave empty to connect directly. The app can detect common local proxy ports such as `7890`, `7897`, and `10809`.
- **Browser path**: set `PIXIV_BROWSER_PATH` to use a custom browser executable.
- **Download directory**: defaults to `downloads/` under the project root.

## Project Structure

```text
pixiv-toolbox/
├── app.py                 # Flask entrypoint
├── token_fetcher.py       # Pixiv OAuth token helper with Playwright
├── downloader.py          # Pixiv API search and download module
├── templates/
│   └── index.html         # Single-page Web UI
├── static/
│   ├── css/               # Styles
│   ├── js/                # Frontend ES modules
│   └── images/            # UI assets
└── downloads/             # Local download output
```

## Tech Stack

| Layer | Tech |
| --- | --- |
| Backend | Flask |
| Pixiv API | pixivpy-async |
| Browser automation | Playwright |
| Frontend | HTML, CSS, JavaScript ES modules |

## Notes

- Use your own Pixiv account and follow Pixiv's terms when searching or downloading content.
- Keep your `refresh_token` private. Do not paste it into issues, screenshots, logs, or public chat.
- If Pixiv requires a captcha or additional verification, enable the visible browser window and finish the login manually.

## License

This project is released under the [MIT License](LICENSE).

## Acknowledgements

| Project | Usage | License |
| --- | --- | --- |
| [pixiv-token](https://github.com/piglig/pixiv-token) | The core OAuth token flow in `token_fetcher.py` is adapted and wrapped for Flask usage. | MIT License |
| [pixivpy-async](https://github.com/Mikubill/pixivpy-async) | Async Pixiv API library used for search and download features. | Unlicense |
