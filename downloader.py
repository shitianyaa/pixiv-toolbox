"""Pixiv 下载 & 搜索模块

提供 API 连通测试、标签搜索预览、作品下载等路由，
封装为 Flask Blueprint。
"""

import asyncio
import json
import random
import socket
import sys
import threading
import time
from pathlib import Path
from queue import Queue, Empty
from urllib.parse import quote, urlparse

from flask import Blueprint, request, jsonify, Response, send_from_directory

ROOT_DIR = Path(__file__).resolve().parents[1]
PIXIVPY_ASYNC_DIR = ROOT_DIR / "pixivpy-async"
if PIXIVPY_ASYNC_DIR.exists() and str(PIXIVPY_ASYNC_DIR) not in sys.path:
    sys.path.insert(0, str(PIXIVPY_ASYNC_DIR))

from pixivpy_async import AppPixivAPI  # noqa: E402
from pixivpy_async.client import PixivClient  # noqa: E402

# ── 常量 ──────────────────────────────────────────────────────
LOCAL_PROXY_PORTS = (7890, 7897, 10809, 10808, 20171)
DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)
SUPPORTED_PROXY_SCHEMES = ("http://", "socks4://", "socks5://")
PROXY_HELP = "代理地址仅支持 http://、socks4://、socks5://；留空则直连"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
DOWNLOAD_QUALITIES = {"auto", "original", "large", "medium"}
DOWNLOAD_QUALITY_ORDER = ("original", "large", "medium")

downloader_bp = Blueprint("downloader", __name__)


# ── 工具函数 ──────────────────────────────────────────────────


def detect_local_proxy() -> str:
    for port in LOCAL_PROXY_PORTS:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return f"http://127.0.0.1:{port}"
        except OSError:
            continue
    return ""


def normalize_proxy(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if "://" not in value:
        value = f"http://{value}"
    if not value.lower().startswith(SUPPORTED_PROXY_SCHEMES):
        raise ValueError(PROXY_HELP)
    return value


def optional_int(value):
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def normalize_download_quality(value: str) -> str:
    value = (value or "auto").strip().lower()
    if not value:
        value = "auto"
    if value not in DOWNLOAD_QUALITIES:
        raise ValueError("下载质量仅支持 auto、original、large、medium")
    return value


def _make_api(proxy: str):
    if proxy:
        return AppPixivAPI(proxy=proxy)
    return AppPixivAPI()


async def _fetch_image(image_url: str, proxy: str):
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.pixiv.net/"}
    async with PixivClient(proxy=proxy or None, timeout=30) as session:
        async with session.get(image_url, headers=headers) as res:
            if res.status != 200:
                raise RuntimeError(f"HTTP {res.status}")
            return await res.read(), res.content_type


async def _fetch_image_stream(image_url: str, proxy: str, on_progress=None):
    """Fetch image with optional progress callback: on_progress(bytes_downloaded, total_bytes)."""
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.pixiv.net/"}
    async with PixivClient(proxy=proxy or None, timeout=30) as session:
        async with session.get(image_url, headers=headers) as res:
            if res.status != 200:
                raise RuntimeError(f"HTTP {res.status}")
            total = int(res.headers.get("Content-Length", 0))
            chunks = []
            downloaded = 0
            async for chunk in res.content.iter_chunked(65536):
                chunks.append(chunk)
                downloaded += len(chunk)
                if on_progress:
                    on_progress(downloaded, total)
            body = b"".join(chunks)
            return body, res.content_type


def _image_ext_from_url(image_url: str) -> str:
    ext = Path(urlparse(image_url).path).suffix.lower()
    return ext if ext in IMAGE_EXTENSIONS else ".jpg"


def _pick_quality_candidates(available_urls: dict, download_quality: str):
    qualities = (
        DOWNLOAD_QUALITY_ORDER if download_quality == "auto" else (download_quality,)
    )
    return [
        (quality, available_urls.get(quality))
        for quality in qualities
        if available_urls.get(quality)
    ]


def _image_candidates(illust: dict, download_quality: str = "auto"):
    urls = []
    meta_pages = illust.get("meta_pages") or []
    if meta_pages:
        for index, page in enumerate(meta_pages):
            image_urls = page.get("image_urls") or {}
            candidates = _pick_quality_candidates(image_urls, download_quality)
            if candidates or download_quality != "auto":
                urls.append((index, candidates))
        return urls

    available_urls = {
        "original": (illust.get("meta_single_page") or {}).get("original_image_url"),
        "large": (illust.get("image_urls") or {}).get("large"),
        "medium": (illust.get("image_urls") or {}).get("medium"),
    }
    candidates = _pick_quality_candidates(available_urls, download_quality)
    if candidates:
        urls.append((0, candidates))
    return urls


async def _download_illust_original(
    illust: dict, proxy: str, download_quality: str = "auto", on_progress=None
):
    download_quality = normalize_download_quality(download_quality)
    illust_id = illust.get("id", "unknown")
    image_pages = _image_candidates(illust, download_quality)
    if not image_pages:
        raise RuntimeError(f"作品没有可下载的 {download_quality} 图片 URL")

    paths = []
    qualities = []
    total_size = 0
    page_count = len(image_pages)
    errors = []
    for page_index, candidates in image_pages:
        if not candidates:
            raise RuntimeError(
                f"作品第 {page_index + 1} 页没有可下载的 {download_quality} 图片 URL"
            )
        body = None
        selected_url = ""
        selected_quality = ""
        for quality, image_url in candidates:
            try:
                def _on_page_progress(downloaded, total):
                    if on_progress:
                        on_progress(page_index, page_count, downloaded, total)

                body, _content_type = await _fetch_image_stream(
                    image_url, proxy, _on_page_progress
                )
                selected_url = image_url
                selected_quality = quality
                break
            except Exception as e:
                errors.append(f"p{page_index} {quality}: {e}")
        if body is None:
            raise RuntimeError("图片下载失败；" + "；".join(errors[-3:]))

        ext = _image_ext_from_url(selected_url)
        page_suffix = f"_p{page_index}" if page_count > 1 else ""
        quality_suffix = (
            "" if selected_quality == "original" else f"_{selected_quality}"
        )
        save_path = (
            DOWNLOAD_DIR / f"pixiv_{illust_id}{page_suffix}{quality_suffix}{ext}"
        )
        save_path.write_bytes(body)
        paths.append(str(save_path))
        qualities.append(selected_quality)
        total_size += save_path.stat().st_size

    return {
        "paths": paths,
        "path": paths[0],
        "page_count": page_count,
        "size_kb": round(total_size / 1024, 1),
        "qualities": qualities,
        "original": all(quality == "original" for quality in qualities),
        "requested_quality": download_quality,
    }


def _sse_stream(queue: Queue, timeout: int = 120):
    while True:
        try:
            msg = queue.get(timeout=timeout)
        except Empty:
            yield f"data: {json.dumps({'type': 'error', 'msg': '⌛ 超时'})}\n\n"
            break
        yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
        if msg.get("type") == "done":
            break


def _sse_error(message: str):
    queue: Queue = Queue()
    queue.put({"type": "error", "msg": message})
    queue.put({"type": "done"})
    return Response(_sse_stream(queue, timeout=1), mimetype="text/event-stream")


def _run_async_worker(target_coro_factory, queue: Queue):
    def worker():
        try:
            if sys.platform == "win32":
                asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
            asyncio.run(target_coro_factory(queue))
        except Exception as e:
            queue.put({"type": "error", "msg": f"💥 异常: {e!r}"})
            queue.put({"type": "done"})

    threading.Thread(target=worker, daemon=True).start()


# ── 测试 API ──────────────────────────────────────────────────


@downloader_bp.route("/api/test-api", methods=["POST"])
def api_test_api():
    """连通测试：登录、排行榜、搜索、R18 过滤、下载（保存到文件）。"""
    data = request.get_json(force=True)
    token = data.get("refresh_token", "").strip()
    try:
        proxy = normalize_proxy(data.get("proxy", ""))
    except ValueError as e:
        return _sse_error(str(e))
    tag = data.get("tag", "").strip() or "原神"
    allow_r18 = bool(data.get("allow_r18", False))

    if not token:
        return jsonify({"ok": False, "error": "请输入 refresh_token"}), 400

    queue: Queue = Queue()

    async def run_tests(q: Queue):
        def stamp():
            return time.strftime("%H:%M:%S")

        def log(msg):
            q.put({"type": "log", "msg": f"[{stamp()}] {msg}"})

        def ok(msg):
            q.put({"type": "ok", "msg": f"[{stamp()}] ✅ {msg}"})

        def fail(msg):
            q.put({"type": "error", "msg": f"[{stamp()}] ❌ {msg}"})

        # Step 1: Login
        log(f"=== Step 1: 登录 ===  proxy = {proxy or '(none)'}")
        api = _make_api(proxy)
        t0 = time.time()
        try:
            await api.login(refresh_token=token)
        except Exception as e:
            fail(f"登录失败: {e!r}")
            q.put({"type": "done"})
            return
        ok(f"login OK ({time.time() - t0:.2f}s)")

        # Step 2: Ranking
        log("=== Step 2: 排行榜 ===")
        t0 = time.time()
        try:
            resp = await api.illust_ranking(mode="week")
            illusts = list(resp.get("illusts") or [])
            ok(f"排行榜返回 {len(illusts)} 个作品 ({time.time() - t0:.2f}s)")
        except Exception as e:
            fail(f"排行榜请求失败: {e!r}")
            q.put({"type": "done"})
            return

        if illusts:
            sample = illusts[0]
            log(f"  sample: id={sample.get('id')} title={sample.get('title')!r}")

        # Step 3: Search
        log(f"=== Step 3: 搜索 [{tag}] ===")
        t0 = time.time()
        search_illusts = []
        try:
            resp = await api.search_illust(
                tag, search_target="partial_match_for_tags", sort="date_desc"
            )
            search_illusts = list(resp.get("illusts") or [])
            ok(f"搜索返回 {len(search_illusts)} 个作品 ({time.time() - t0:.2f}s)")
        except Exception as e:
            fail(f"搜索请求失败: {e!r}")
            q.put({"type": "done"})
            return

        # Step 4: R18 filter
        log(f"=== Step 4: R18 过滤 === allow_r18 = {allow_r18}")
        if allow_r18:
            safe = illusts
            r18 = []
            log(f"  全部 {len(illusts)}，R18 已放行，不过滤")
        else:
            safe = [i for i in illusts if int(i.get("x_restrict", 0)) == 0]
            r18 = [i for i in illusts if int(i.get("x_restrict", 0)) > 0]
            log(f"  全部 {len(illusts)}, safe {len(safe)}, R18 {len(r18)}")
        ok("R18 过滤完成")

        # Step 5: Download
        download_pool = safe if not allow_r18 else illusts
        if not download_pool:
            fail("没有符合当前 R18 设置的可下载作品")
            q.put({"type": "done"})
            return

        illust = random.choice(download_pool)
        illust_id = illust.get("id", "unknown")
        title = illust.get("title", "untitled")
        log("=== Step 5: 下载测试图 ===")
        log(f"  choice: id={illust_id} title={title!r}")

        t0 = time.time()
        try:
            download_info = await _download_illust_original(illust, proxy)
            size_kb = download_info["size_kb"]
            quality = "原图" if download_info["original"] else "降级图"
            ok(
                f"{quality}下载 OK: {size_kb:.0f} KB / {download_info['page_count']} 页 ({time.time() - t0:.2f}s)"
            )
            for path in download_info["paths"]:
                log(f"  保存到: {path}")
        except Exception as e:
            fail(f"下载异常: {e!r}")
            q.put({"type": "done"})
            return

        q.put(
            {
                "type": "result",
                "data": {
                    "ranking_count": len(illusts),
                    "search_count": len(search_illusts),
                    "safe_count": len(safe),
                    "r18_count": len(r18),
                    "download_size_kb": round(size_kb, 1),
                    "download_path": download_info["path"],
                    "download_paths": download_info["paths"],
                    "download_page_count": download_info["page_count"],
                    "download_original": download_info["original"],
                    "download_qualities": download_info["qualities"],
                    "download_illust_id": illust_id,
                    "proxy": proxy,
                    "tag": tag,
                    "allow_r18": allow_r18,
                },
            }
        )
        q.put({"type": "done"})

    _run_async_worker(run_tests, queue)
    return Response(_sse_stream(queue), mimetype="text/event-stream")


# ── 搜索 & 预览 ──────────────────────────────────────────────


@downloader_bp.route("/api/search-preview", methods=["POST"])
def api_search_preview():
    """搜索标签，返回作品列表（含图片 URL）用于前端预览。"""
    data = request.get_json(force=True)
    token = data.get("refresh_token", "").strip()
    try:
        proxy = normalize_proxy(data.get("proxy", ""))
    except ValueError as e:
        return _sse_error(str(e))
    tag = data.get("tag", "").strip()
    allow_r18 = bool(data.get("allow_r18", False))
    page_size = min(max(int(data.get("page_size", 20)), 1), 30)
    search_target = data.get("search_target", "partial_match_for_tags")
    if search_target not in {
        "partial_match_for_tags",
        "exact_match_for_tags",
        "title_and_caption",
    }:
        search_target = "partial_match_for_tags"
    sort = data.get("sort", "date_desc")
    if sort not in {"date_desc", "date_asc"}:
        sort = "date_desc"
    duration = data.get("duration") or None
    if duration not in {
        None,
        "within_last_day",
        "within_last_week",
        "within_last_month",
    }:
        duration = None
    ranking_mode = data.get("ranking_mode", "day")
    if ranking_mode not in {
        "day",
        "week",
        "month",
        "day_male",
        "day_female",
        "week_original",
        "week_rookie",
        "day_manga",
    }:
        ranking_mode = "day"
    min_bookmarks = optional_int(data.get("min_bookmarks"))
    try:
        download_quality = normalize_download_quality(
            data.get("download_quality", "auto")
        )
    except ValueError:
        download_quality = "auto"

    if not token:
        return jsonify({"ok": False, "error": "请输入 refresh_token"}), 400

    queue: Queue = Queue()

    async def run_search(q: Queue):
        api = _make_api(proxy)
        try:
            await api.login(refresh_token=token)
        except Exception as e:
            q.put({"type": "error", "msg": f"登录失败: {e!r}"})
            q.put({"type": "done"})
            return

        try:
            if tag:
                resp = await api.search_illust(
                    tag,
                    search_target=search_target,
                    sort=sort,
                    duration=duration,
                    min_bookmarks=min_bookmarks,
                )
            else:
                resp = await api.illust_ranking(mode=ranking_mode)
        except Exception as e:
            q.put({"type": "error", "msg": f"请求失败: {e!r}"})
            q.put({"type": "done"})
            return

        illusts = list(resp.get("illusts") or [])

        # R18 过滤
        if not allow_r18:
            illusts = [i for i in illusts if int(i.get("x_restrict", 0)) == 0]

        illusts = illusts[:page_size]

        results = []
        for i in illusts:
            img_url = (i.get("image_urls") or {}).get("large") or (
                i.get("image_urls") or {}
            ).get("medium", "")
            # 用于大小查询的 URL：按用户选择的下载质量取
            meta_pages = i.get("meta_pages") or []
            if meta_pages:
                first_page_urls = meta_pages[0].get("image_urls") or {}
            else:
                first_page_urls = {
                    "original": (i.get("meta_single_page") or {}).get("original_image_url"),
                    "large": (i.get("image_urls") or {}).get("large"),
                    "medium": (i.get("image_urls") or {}).get("medium"),
                }
            candidates = _pick_quality_candidates(first_page_urls, download_quality)
            download_url = candidates[0][1] if candidates else img_url
            results.append(
                {
                    "id": i.get("id"),
                    "title": i.get("title", ""),
                    "author": (i.get("user") or {}).get("name", ""),
                    "author_id": (i.get("user") or {}).get("id"),
                    "image_url": img_url,
                    "download_url": download_url,
                    "preview_url": f"/api/proxy-image?url={quote(img_url, safe='')}&proxy={quote(proxy, safe='')}",
                    "x_restrict": int(i.get("x_restrict", 0)),
                    "width": i.get("width"),
                    "height": i.get("height"),
                    "page_count": i.get("page_count", 1),
                    "create_date": i.get("create_date", ""),
                    "total_view": i.get("total_view", 0),
                    "total_bookmarks": i.get("total_bookmarks", 0),
                }
            )

        q.put(
            {
                "type": "result",
                "data": {
                    "illusts": results,
                    "total": len(results),
                    "tag": tag or "(排行榜)",
                    "allow_r18": allow_r18,
                    "mode": "search" if tag else "ranking",
                    "ranking_mode": ranking_mode,
                    "search_target": search_target,
                    "sort": sort,
                    "duration": duration,
                    "min_bookmarks": min_bookmarks,
                },
            }
        )
        q.put({"type": "done"})

    _run_async_worker(run_search, queue)
    return Response(_sse_stream(queue, timeout=60), mimetype="text/event-stream")


# ── 下载单张作品 ──────────────────────────────────────────────


@downloader_bp.route("/api/download-illust", methods=["POST"])
def api_download_illust():
    """下载指定作品图片到本地，通过 SSE 推送进度。"""
    data = request.get_json(force=True)
    token = data.get("refresh_token", "").strip()
    try:
        proxy = normalize_proxy(data.get("proxy", ""))
        download_quality = normalize_download_quality(
            data.get("download_quality", "auto")
        )
    except ValueError as e:
        return _sse_error(str(e))
    illust_id = data.get("illust_id")

    if not token or not illust_id:
        return _sse_error("缺少参数")

    queue: Queue = Queue()

    async def run_download(q: Queue):
        api = _make_api(proxy)
        try:
            await api.login(refresh_token=token)
        except Exception as e:
            q.put({"type": "error", "msg": f"登录失败: {e!r}"})
            q.put({"type": "done"})
            return

        try:
            detail = await api.illust_detail(illust_id)
        except Exception as e:
            q.put({"type": "error", "msg": f"获取作品详情失败: {e!r}"})
            q.put({"type": "done"})
            return

        illust = detail.get("illust", {})
        q.put({"type": "log", "msg": f"开始下载作品 {illust_id}…"})

        def on_progress(page_index, page_count, downloaded, total):
            q.put({
                "type": "progress",
                "page": page_index + 1,
                "page_count": page_count,
                "bytes": downloaded,
                "total_bytes": total,
            })

        try:
            download_info = await _download_illust_original(
                illust, proxy, download_quality, on_progress=on_progress
            )
        except Exception as e:
            q.put({"type": "error", "msg": f"下载失败: {e!r}"})
            q.put({"type": "done"})
            return

        q.put({"type": "result", "data": {"ok": True, **download_info}})
        q.put({"type": "done"})

    _run_async_worker(run_download, queue)
    return Response(_sse_stream(queue, timeout=120), mimetype="text/event-stream")


# ── 图片代理 ─────────────────────────────────────────────────


@downloader_bp.route("/api/proxy-image")
def api_proxy_image():
    """通过后端代理读取 Pixiv 图片，避免浏览器直接请求和 Referer 限制。"""
    image_url = request.args.get("url", "").strip()
    try:
        proxy = normalize_proxy(request.args.get("proxy", ""))
    except ValueError as e:
        return Response(str(e), status=400)

    if not image_url.startswith(("https://i.pximg.net/", "https://i-f.pximg.net/")):
        return Response("invalid image url", status=400)

    try:
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        body, content_type = asyncio.run(_fetch_image(image_url, proxy))
        return Response(
            body,
            mimetype=content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as e:
        return Response(f"image proxy failed: {e}", status=502)


# ── 图片大小查询 ──────────────────────────────────────────────


async def _head_image(image_url: str, proxy: str):
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.pixiv.net/"}
    async with PixivClient(proxy=proxy or None, timeout=10) as session:
        async with session.head(image_url, headers=headers, allow_redirects=True) as res:
            size = res.headers.get("Content-Length")
            return int(size) if size else None


@downloader_bp.route("/api/image-size")
def api_image_size():
    """HEAD 请求获取图片文件大小（Content-Length）。"""
    image_url = request.args.get("url", "").strip()
    try:
        proxy = normalize_proxy(request.args.get("proxy", ""))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not image_url.startswith(("https://i.pximg.net/", "https://i-f.pximg.net/")):
        return jsonify({"error": "invalid image url"}), 400

    try:
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        size_bytes = asyncio.run(_head_image(image_url, proxy))
        return jsonify({"size_bytes": size_bytes})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ── 静态文件服务 ──────────────────────────────────────────────


@downloader_bp.route("/downloads/<path:filename>")
def serve_download(filename):
    """提供下载目录里的文件给前端预览。"""
    return send_from_directory(str(DOWNLOAD_DIR), filename)
