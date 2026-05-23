"""Pixiv 可视化工具 — Flask GUI

浏览器打开 http://127.0.0.1:5000
"""

import io
import os
import sys
import threading
import time
import webbrowser

# ── 修正 Windows 编码 ──────────────────────────────────────────
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        sys.stdout = io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace"
        )
        sys.stderr = io.TextIOWrapper(
            sys.stderr.buffer, encoding="utf-8", errors="replace"
        )

from flask import Flask, render_template

from token_fetcher import token_bp
from downloader import downloader_bp, detect_local_proxy

# ── Flask 应用 ────────────────────────────────────────────────

IS_DEV = os.environ.get("FLASK_ENV", "development") != "production"
ASSET_VERSION = "dev" if IS_DEV else str(int(time.time()))

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.jinja_env.auto_reload = True

# 注册蓝图
app.register_blueprint(token_bp)
app.register_blueprint(downloader_bp)


@app.after_request
def add_header(r):
    """HTML页面不缓存；静态资源允许长期缓存(asset_version负责缓存失效)"""
    if r.headers.get("Content-Type", "").startswith("text/html"):
        r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        r.headers["Pragma"] = "no-cache"
        r.headers["Expires"] = "0"
    else:
        r.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return r


@app.route("/")
def index():
    auto_proxy = detect_local_proxy()
    # 在开发模式下使用动态时间戳作为版本号，绝对强力刷新浏览器缓存，防止加载旧的 CSS/JS 文件
    version = str(int(time.time())) if IS_DEV else ASSET_VERSION
    return render_template("index.html", auto_proxy=auto_proxy, asset_version=version)


# ── 启动 ──────────────────────────────────────────────────────

if __name__ == "__main__":
    port = 5000
    url = f"http://127.0.0.1:{port}"
    print(f"🌐 蔚蓝 Pixiv 工具箱已启动: {url}")
    from pathlib import Path

    print(f"   下载目录: {Path(__file__).resolve().parent / 'downloads'}")
    print("   按 Ctrl+C 退出")
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=port, debug=False)
