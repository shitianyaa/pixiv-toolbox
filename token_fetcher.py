"""Pixiv OAuth Token 获取模块

基于 https://github.com/shitianyaa/pixiv-token 的 PixivTokenFetcher，
封装为 Flask Blueprint，提供 /api/fetch-token SSE 接口。
"""

import base64
import hashlib
import json
import os
import re
import secrets
import sys
import threading
import time
from queue import Queue, Empty
from urllib.parse import unquote

import requests
from flask import Blueprint, request, jsonify, Response
from playwright.sync_api import sync_playwright, TimeoutError as PwTimeoutError

# ── Pixiv OAuth 常量 ──────────────────────────────────────────
PIXIV_CLIENT_ID = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
PIXIV_CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
PIXIV_TOKEN_URL = "https://oauth.secure.pixiv.net/auth/token"
REDIRECT_URI = "https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
API_UA = "PixivAndroidApp/5.0.234 (Android 11; Pixel 5)"
CALLBACK_URL_PREFIX = "pixiv://account/login"
CONSOLE_CODE_PREFIX = "[PIXIV-CODE]"
CONSOLE_CALLBACK_PREFIX = "[PIXIV-CALLBACK]"

EMAIL_SELECTORS = [
    "input[autocomplete^='username']",
    "input[placeholder*='メールアドレス']",
    "input[type='email']",
]
PASSWORD_SELECTORS = [
    "input[autocomplete^='current-password']",
    "input[placeholder*='パスワード']",
    "input[type='password']",
]
SKIP_BUTTON_TEXTS = ["Remind me later", "Skip", "あとで", "スキップ"]
DEFAULT_BROWSER_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]
SUPPORTED_PROXY_SCHEMES = ("http://", "socks4://", "socks5://")
PROXY_HELP = "代理地址仅支持 http://、socks4://、socks5://；留空则直连"


def normalize_proxy(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if "://" not in value:
        value = f"http://{value}"
    if not value.lower().startswith(SUPPORTED_PROXY_SCHEMES):
        raise ValueError(PROXY_HELP)
    return value


# ══════════════════════════════════════════════════════════════
#  PixivTokenFetcher（移植自 pixiv-token 仓库）
# ══════════════════════════════════════════════════════════════


class PixivTokenFetcher:
    def __init__(self, username: str, password: str, headless=True, proxy: str = ""):
        self.headless = headless
        self.username = username
        self.password = password
        self.proxy = normalize_proxy(proxy)
        self.code_verifier = secrets.token_urlsafe(64)
        self.code_challenge = (
            base64.urlsafe_b64encode(
                hashlib.sha256(self.code_verifier.encode()).digest()
            )
            .rstrip(b"=")
            .decode("ascii")
        )

    def _launch_args(self):
        args = ["--disable-blink-features=AutomationControlled"]
        if not self.proxy:
            args.append("--no-proxy-server")
        return args

    def _browser_executable_path(self):
        configured_path = os.getenv("PIXIV_BROWSER_PATH")
        if configured_path and os.path.exists(configured_path):
            return configured_path
        for browser_path in DEFAULT_BROWSER_PATHS:
            if os.path.exists(browser_path):
                return browser_path
        return None

    def _get_login_url(self):
        return (
            "https://app-api.pixiv.net/web/v1/login?"
            f"code_challenge={self.code_challenge}&"
            "code_challenge_method=S256&client=pixiv-android"
        )

    def _extract_code(self, value: str):
        if not value:
            return None
        candidates = [value]
        try:
            candidates.append(unquote(value))
        except Exception:
            pass
        for candidate in candidates:
            if CALLBACK_URL_PREFIX in candidate:
                candidate = candidate[candidate.find(CALLBACK_URL_PREFIX) :]
            match = re.search(r"(?:^|[?&])code=([^&#\s\"'<>)]*)", candidate)
            if match:
                return unquote(match.group(1))
        return None

    def _read_manual_code(self):
        if not sys.stdin.isatty():
            return None
        print("\n未自动捕获到 code。")
        print(
            "如果浏览器地址或 Network 里有 pixiv://account/login?code=...，可以粘贴完整 URL。"
        )
        manual_value = input("Paste callback URL or code: ").strip()
        if not manual_value:
            return None
        extracted_code = self._extract_code(manual_value)
        if extracted_code:
            return extracted_code
        if re.fullmatch(r"[A-Za-z0-9_-]+", manual_value):
            return manual_value
        return None

    def _callback_capture_script(self):
        return r"""
(() => {
    const CODE_PREFIX = "[PIXIV-CODE]";
    const CALLBACK_PREFIX = "[PIXIV-CALLBACK]";
    const seen = new Set();
    function capture(value, source) {
        if (!value || typeof value !== "string") return;
        if (seen.has(source + value)) return;
        seen.add(source + value);
        const candidates = [value];
        try { candidates.push(decodeURIComponent(value)); } catch (_) {}
        for (const candidate of candidates) {
            const callbackMatch = candidate.match(/pixiv:\/\/account\/login[^\s"'<>)]*/i);
            const target = callbackMatch ? callbackMatch[0] : candidate;
            const codeMatch = target.match(/[?&]code=([^&#\s"'<>)]*)/);
            if (!codeMatch) continue;
            const code = decodeURIComponent(codeMatch[1]);
            console.log(CODE_PREFIX + code);
            console.log(CALLBACK_PREFIX + target);
            window.__PIXIV_OAUTH_CODE__ = code;
            break;
        }
    }
    function scan() {
        capture(location.href, "location.href");
        for (const entry of performance.getEntries()) capture(entry.name, "performance");
        for (const el of document.querySelectorAll("a[href], form[action]")) capture(el.href || el.action, "dom");
    }
    function patch(object, name, getValue) {
        try {
            const original = object[name];
            if (typeof original !== "function") return;
            object[name] = function (...args) { capture(String(getValue(args) || ""), name); return original.apply(this, args); };
        } catch (_) {}
    }
    patch(window, "open", args => args[0]);
    patch(Location.prototype, "assign", args => args[0]);
    patch(Location.prototype, "replace", args => args[0]);
    patch(history, "pushState", args => args[2]);
    patch(history, "replaceState", args => args[2]);
    document.addEventListener("click", event => { const link = event.target?.closest?.("a[href]"); if (link) capture(link.href, "click"); }, true);
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "action"] });
    setInterval(scan, 250);
    scan();
})();
"""

    def _slow_type(self, page, selector: str, text: str, delay: float = 0.08):
        page.focus(selector)
        for char in text:
            page.keyboard.insert_text(char)
            time.sleep(delay)

    def _find_input(self, page, selectors: list, timeout=3000):
        for selector in selectors:
            try:
                el = page.wait_for_selector(selector, timeout=timeout)
                if el and el.is_visible():
                    return selector
            except PwTimeoutError:
                continue
        return None

    def _perform_login(self, page):
        email_selector = self._find_input(page, EMAIL_SELECTORS)
        if not email_selector:
            print("⚠️ Username input not found")
            return
        self._slow_type(page, email_selector, self.username)
        print("📧 Username input completed")

        pwd_selector = self._find_input(page, PASSWORD_SELECTORS)
        if not pwd_selector:
            page.keyboard.press("Enter")
            time.sleep(2)
            pwd_selector = self._find_input(page, PASSWORD_SELECTORS)
        if not pwd_selector:
            print("⚠️ Password input not found")
            return
        self._slow_type(page, pwd_selector, self.password)
        print("🔒 Password input completed")

        login_btn = page.locator("button:has-text('ログイン')")
        if login_btn.count() > 0:
            login_btn.first.click()
        else:
            page.keyboard.press("Enter")
        print("🔑 Login submitted")

    def _skip_security_prompts(self, page):
        for btn_text in SKIP_BUTTON_TEXTS:
            btn = page.locator(f"button:has-text('{btn_text}')")
            if btn.count() > 0 and btn.first.is_visible():
                print(f"  Clicking '{btn_text}' to skip security prompt")
                btn.first.click()
                time.sleep(1)
                return True
        return False

    def fetch_code(self):
        with sync_playwright() as p:
            launch_options = {
                "headless": self.headless,
                "args": self._launch_args(),
            }
            browser_path = self._browser_executable_path()
            if browser_path:
                launch_options["executable_path"] = browser_path
            if self.proxy:
                launch_options["proxy"] = {"server": self.proxy}

            browser = p.chromium.launch(**launch_options)
            context = browser.new_context(
                user_agent=BROWSER_UA,
                viewport={"width": 1280, "height": 720},
                locale="ja-JP",
            )
            context.add_init_script(self._callback_capture_script())
            page = context.new_page()
            cdp_session = context.new_cdp_session(page)
            cdp_session.send("Network.enable")
            cdp_session.send("Page.enable")

            captured_code = {"value": None}

            def try_capture(value, source):
                if captured_code["value"]:
                    return
                code = self._extract_code(value)
                if not code:
                    return
                captured_code["value"] = code
                print(f"✅ Code captured from {source}:", code, flush=True)
                try:
                    page.close()
                except Exception:
                    pass

            def on_request_will_be_sent(event):
                try_capture(event.get("request", {}).get("url", ""), "cdp request")
                try_capture(event.get("documentURL", ""), "cdp document")

            def on_console(message):
                text = message.text
                if text.startswith(CONSOLE_CODE_PREFIX):
                    try_capture(
                        "code=" + text[len(CONSOLE_CODE_PREFIX) :], "console script"
                    )
                elif text.startswith(CONSOLE_CALLBACK_PREFIX):
                    try_capture(text[len(CONSOLE_CALLBACK_PREFIX) :], "console script")

            def on_page_navigation(event):
                try_capture(event.get("url", ""), "cdp navigation")

            cdp_session.on("Network.requestWillBeSent", on_request_will_be_sent)
            cdp_session.on("Page.frameScheduledNavigation", on_page_navigation)
            cdp_session.on("Page.frameRequestedNavigation", on_page_navigation)
            page.on("request", lambda request: try_capture(request.url, "request"))
            page.on("response", lambda response: try_capture(response.url, "response"))
            page.on(
                "framenavigated",
                lambda frame: try_capture(frame.url, "frame navigation"),
            )
            page.on("console", on_console)

            print("🚀 Opening Pixiv login page...")
            login_url = self._get_login_url()
            page.goto(login_url)
            self._perform_login(page)

            for _ in range(60):
                if captured_code["value"] or page.is_closed():
                    break
                try:
                    self._skip_security_prompts(page)
                except Exception:
                    pass
                time.sleep(1)

            if not captured_code["value"]:
                print("⌛ Timeout: Code not captured.")
                captured_code["value"] = self._read_manual_code()

            browser.close()
            return captured_code["value"]

    def exchange_token(self, code):
        session = requests.Session()
        session.trust_env = False
        resp = session.post(
            PIXIV_TOKEN_URL,
            data={
                "client_id": PIXIV_CLIENT_ID,
                "client_secret": PIXIV_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": self.code_verifier,
                "redirect_uri": REDIRECT_URI,
                "include_policy": "true",
            },
            headers={"User-Agent": API_UA},
            proxies={"http": self.proxy, "https": self.proxy} if self.proxy else None,
        )
        return resp.json()


# ══════════════════════════════════════════════════════════════
#  Flask Blueprint
# ══════════════════════════════════════════════════════════════

token_bp = Blueprint("token", __name__)


@token_bp.route("/api/fetch-token", methods=["POST"])
def api_fetch_token():
    """启动一个线程跑 PixivTokenFetcher，通过 SSE 推送日志。"""
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    headless = not data.get("show_browser", False)
    try:
        proxy = normalize_proxy(data.get("proxy", ""))
    except ValueError as e:
        message = str(e)

        def sse_error():
            yield f"data: {json.dumps({'type': 'error', 'msg': message}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

        return Response(sse_error(), mimetype="text/event-stream")

    if not username or not password:
        return jsonify({"ok": False, "error": "请输入账号和密码"}), 400

    queue: Queue = Queue()

    def worker():
        try:
            queue.put({"type": "log", "msg": "🚀 正在启动浏览器…"})

            fetcher = PixivTokenFetcher(
                username, password, headless=headless, proxy=proxy
            )

            # 重定向 print 到队列，实时推送给前端
            import builtins

            _orig_print = builtins.print

            def hijack_print(*args, **kwargs):
                msg = " ".join(str(a) for a in args)
                queue.put({"type": "log", "msg": msg})
                _orig_print(*args, **kwargs)

            builtins.print = hijack_print
            try:
                code = fetcher.fetch_code()
            finally:
                builtins.print = _orig_print

            if not code:
                queue.put({"type": "error", "msg": "❌ 未能获取到 authorization code"})
                queue.put({"type": "done"})
                return

            queue.put({"type": "log", "msg": f"✅ code = {code}"})
            queue.put({"type": "log", "msg": "🔄 正在用 code 换取 token…"})

            token_info = fetcher.exchange_token(code)

            access_token = token_info.get("access_token", "")
            refresh_token = token_info.get("refresh_token", "")

            if refresh_token:
                queue.put(
                    {"type": "log", "msg": f"🎟️ Access Token: {access_token[:20]}..."}
                )
                queue.put(
                    {
                        "type": "result",
                        "data": {
                            "access_token": access_token,
                            "refresh_token": refresh_token,
                            "expires_in": token_info.get("expires_in"),
                        },
                    }
                )
            else:
                err_desc = (
                    token_info.get("error_description")
                    or token_info.get("error")
                    or str(token_info)
                )
                queue.put({"type": "error", "msg": f"❌ 换取 token 失败: {err_desc}"})

        except Exception as e:
            queue.put({"type": "error", "msg": f"💥 异常: {e!r}"})
        finally:
            queue.put({"type": "done"})

    threading.Thread(target=worker, daemon=True).start()

    def sse_stream():
        while True:
            try:
                msg = queue.get(timeout=120)
            except Empty:
                yield f"data: {json.dumps({'type': 'error', 'msg': '⌛ 超时'})}\n\n"
                break
            yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
            if msg.get("type") == "done":
                break

    return Response(sse_stream(), mimetype="text/event-stream")
