import { APITask, ValidationError, valueOf, checkedOf, numberOf } from './api-task.js';
import { esc } from '../core/escape.js';
import { open as openLightbox } from '../ui/lightbox.js';
import { downloadIllust } from './download.js';

const PROXY_PATTERN = /^(https?|socks[45]?):\/\/[^\s]+$/i;

let lastIllusts = [];
let currentView = 'list';

// ── Size cache (localStorage) ──────────────────────────────────

const SIZE_CACHE_PREFIX = 'pixiv_size_v3_';
const sizeCache = new Map();

// 清理旧版本缓存
try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pixiv_size_') && !key.startsWith(SIZE_CACHE_PREFIX)) {
            localStorage.removeItem(key);
        }
    }
} catch {}

function getCachedSize(illustId) {
    if (sizeCache.has(illustId)) return sizeCache.get(illustId);
    const raw = localStorage.getItem(SIZE_CACHE_PREFIX + illustId);
    if (raw != null) {
        const size = Number(raw);
        sizeCache.set(illustId, size);
        return size;
    }
    return null;
}

function setCachedSize(illustId, sizeBytes) {
    sizeCache.set(illustId, sizeBytes);
    try {
        localStorage.setItem(SIZE_CACHE_PREFIX + illustId, String(sizeBytes));
    } catch { /* quota exceeded, ignore */ }
}

function formatBytes(bytes) {
    if (bytes == null || bytes <= 0) return null;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Lazy size loading (IntersectionObserver) ───────────────────

let sizeObserver = null;

function ensureSizeObserver() {
    if (sizeObserver) return sizeObserver;

    sizeObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target;
            sizeObserver.unobserve(el);
            loadSizeForLabel(el);
        }
    }, { rootMargin: '200px' });

    return sizeObserver;
}

async function loadSizeForLabel(el) {
    const cacheKey = el.dataset.cacheKey;
    const imageUrl = el.dataset.imageUrl;
    const qualityPrefix = el.dataset.qualityPrefix || '';
    const proxy = (document.getElementById('si-proxy')?.value || '').trim();

    // Check cache first
    const cached = getCachedSize(cacheKey);
    if (cached != null) {
        el.textContent = qualityPrefix ? `${qualityPrefix} ${formatBytes(cached)}` : formatBytes(cached);
        return;
    }

    el.textContent = '...';
    try {
        const url = `/api/image-size?url=${encodeURIComponent(imageUrl)}&proxy=${encodeURIComponent(proxy)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.size_bytes != null) {
            setCachedSize(cacheKey, data.size_bytes);
            el.textContent = qualityPrefix ? `${qualityPrefix} ${formatBytes(data.size_bytes)}` : formatBytes(data.size_bytes);
        } else {
            el.textContent = '?';
        }
    } catch {
        el.textContent = '?';
    }
}

function observeSizeLabel(el) {
    ensureSizeObserver().observe(el);
}

// ── Search Preview Task ────────────────────────────────────────

export class SearchPreviewTask extends APITask {
    constructor() {
        super({
            endpoint: '/api/search-preview',
            btnId: 'btn-search',
            statusId: 'search-status',
            consoleId: 'search-console',
            resultId: null,
            busyLabel: '检索中…',
        });
    }

    validate() {
        const token = valueOf('si-token');
        if (!token) throw new ValidationError('请输入 refresh_token', 'si-token');
        if (token.length < 20) throw new ValidationError('refresh_token 看上去格式不正确（长度过短）', 'si-token');
        const proxy = valueOf('si-proxy');
        if (proxy && !PROXY_PATTERN.test(proxy)) {
            throw new ValidationError('代理地址格式不正确，示例: socks5://127.0.0.1:10808', 'si-proxy');
        }
        const minBookmarks = valueOf('si-min-bookmarks');
        if (minBookmarks && !/^\d+$/.test(minBookmarks)) {
            throw new ValidationError('最低收藏数应为非负整数', 'si-min-bookmarks');
        }
        const pageSize = numberOf('si-page-size', 20);
        if (pageSize < 1 || pageSize > 30) {
            throw new ValidationError('返回数量应在 1–30 之间', 'si-page-size');
        }
        return true;
    }

    buildPayload() {
        return {
            refresh_token: valueOf('si-token'),
            proxy: valueOf('si-proxy'),
            tag: valueOf('si-tag'),
            allow_r18: checkedOf('si-r18'),
            page_size: numberOf('si-page-size', 20),
            search_target: valueOf('si-target'),
            sort: valueOf('si-sort'),
            duration: valueOf('si-duration'),
            ranking_mode: valueOf('si-ranking-mode'),
            min_bookmarks: valueOf('si-min-bookmarks'),
            download_quality: valueOf('si-download-quality'),
        };
    }

    onBeforeRun() {
        document.getElementById('search-gallery').innerHTML = '';
        document.getElementById('search-list').innerHTML = '';
        document.getElementById('search-gallery').style.display = 'none';
        document.getElementById('search-list').style.display = 'none';
        document.getElementById('search-toolbar').style.display = 'none';
        if (this.consoleEl) this.consoleEl.style.display = 'none';
        lastIllusts = [];
    }

    onSuccess(d) {
        // 成功获取结果时，立即隐藏调试日志台，保持界面清爽
        if (this.consoleEl) this.consoleEl.style.display = 'none';

        const illusts = d.illusts || [];
        lastIllusts = illusts;
        const list = document.getElementById('search-list');
        const toolbar = document.getElementById('search-toolbar');
        const note = document.getElementById('search-note');
        if (!illusts.length) {
            list.style.display = 'block';
            list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">未搜索到匹配的作品</p>';
            return;
        }
        note.textContent = `拉取成功，共 ${illusts.length} 项作品。下载按钮会按当前下载质量保存，并支持多页全保存。`;
        toolbar.style.display = 'flex';
        renderList(illusts);
        switchResultView('list');
    }
}

export function initSearchView() {
    const viewList = document.getElementById('view-list');
    const viewGrid = document.getElementById('view-grid');
    if (viewList) viewList.addEventListener('click', () => switchResultView('list'));
    if (viewGrid) viewGrid.addEventListener('click', () => switchResultView('grid'));
}

const QUALITY_SHORT = { original: '原图', large: '大图', medium: '中图' };

function createSizeLabel(illust) {
    const label = document.createElement('span');
    label.className = 'size-label';
    label.dataset.illustId = String(illust.id);

    // 多页作品跳过大小查询，显示提示
    const pages = Number(illust.page_count || 1);
    if (pages > 1) {
        label.textContent = `${pages}页`;
        label.classList.add('multi-page');
        return label;
    }

    // 用下载 URL（按用户选择的质量），不是预览图
    const imageUrl = illust.download_url || illust.image_url || '';
    label.dataset.imageUrl = imageUrl;

    const quality = (document.getElementById('si-download-quality')?.value || 'auto').trim();
    // auto 模式下实际取到的可能是 original/large/medium，从 URL 推断
    const actualQuality = inferQuality(imageUrl);
    const qualityPrefix = QUALITY_SHORT[actualQuality] || '';
    label.dataset.qualityPrefix = qualityPrefix;

    const cacheKey = `${illust.id}_${actualQuality || quality}`;
    label.dataset.cacheKey = cacheKey;

    const cached = getCachedSize(cacheKey);
    if (cached != null) {
        label.textContent = qualityPrefix ? `${qualityPrefix} ${formatBytes(cached)}` : formatBytes(cached);
    } else {
        label.textContent = '...';
        if (imageUrl) observeSizeLabel(label);
    }
    return label;
}

function inferQuality(url) {
    if (!url) return '';
    if (url.includes('/img-original/')) return 'original';
    if (url.includes('c/600x1200') || url.includes('_master1200')) return 'large';
    if (url.includes('c/540x540') || url.includes('_square1200')) return 'medium';
    // fallback: check path patterns
    if (url.includes('_p0.')) return 'original';
    return 'large';
}

function renderList(illusts) {
    const list = document.getElementById('search-list');
    list.innerHTML = '';
    illusts.forEach((il, index) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        const pages = Number(il.page_count || 1);
        row.innerHTML = `
            <div class="result-index">#${index + 1}<br>ID ${il.id}</div>
            <div class="result-main">
                <div class="result-title" title="${esc(il.title)}">${esc(il.title)}</div>
                <div class="result-meta">
                    <span>${esc(il.author)}</span>
                    <span>${il.width || '?'}×${il.height || '?'}</span>
                    <span>${pages} 页</span>
                    <span>👁 访问 ${il.total_view || 0}</span>
                    <span>♥ 收藏 ${il.total_bookmarks || 0}</span>
                    ${il.x_restrict > 0 ? '<span class="r18-tag">R18</span>' : ''}
                </div>
            </div>
            <div class="result-actions"></div>`;

        // Insert size label into meta
        const meta = row.querySelector('.result-meta');
        const sizeLabel = createSizeLabel(il);
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'size-meta';
        sizeSpan.textContent = '📦 ';
        sizeSpan.appendChild(sizeLabel);
        meta.appendChild(sizeSpan);

        const actions = row.querySelector('.result-actions');
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'mini-btn';
        previewBtn.textContent = '预览';
        previewBtn.addEventListener('click', () => previewIllust(index));
        const dlBtn = document.createElement('button');
        dlBtn.type = 'button';
        dlBtn.className = 'mini-btn';
        dlBtn.textContent = '下载';
        dlBtn.addEventListener('click', () => downloadIllust(il.id, dlBtn));
        actions.append(previewBtn, dlBtn);
        list.appendChild(row);
    });
}

function renderGrid(illusts) {
    const gal = document.getElementById('search-gallery');
    gal.innerHTML = '';
    illusts.forEach((il, index) => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${il.title} — ${il.author}`);
        const imageSrc = il.preview_url || il.image_url;
        card.innerHTML = `
            ${il.x_restrict > 0 ? '<span class="badge-r18" aria-label="R18 限制级内容">R18</span>' : ''}
            <button type="button" class="dl-btn" aria-label="下载插画">下载</button>
            <img src="${imageSrc}" alt="${esc(il.title)}" loading="lazy" decoding="async" width="220" height="220" onerror="this.style.background='#FFF0F2';this.style.height='200px';">
            <div class="info">
                <div class="title" title="${esc(il.title)}">${esc(il.title)}</div>
                <div class="meta"><span>${esc(il.author)}</span><span>♥ ${il.total_bookmarks || 0}</span></div>
            </div>`;

        // Insert size label into meta
        const meta = card.querySelector('.info .meta');
        const sizeLabel = createSizeLabel(il);
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'size-meta';
        sizeSpan.appendChild(sizeLabel);
        meta.appendChild(sizeSpan);

        const dlBtn = card.querySelector('.dl-btn');
        dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadIllust(il.id, dlBtn);
        });
        card.addEventListener('click', () => previewIllust(index));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                previewIllust(index);
            }
        });
        gal.appendChild(card);
    });
}

function switchResultView(view) {
    currentView = view;
    document.getElementById('view-list').classList.toggle('active', view === 'list');
    document.getElementById('view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('view-list').setAttribute('aria-pressed', view === 'list');
    document.getElementById('view-grid').setAttribute('aria-pressed', view === 'grid');
    document.getElementById('search-list').style.display = view === 'list' ? 'block' : 'none';
    document.getElementById('search-gallery').style.display = view === 'grid' ? 'grid' : 'none';
    if (view === 'grid') renderGrid(lastIllusts);
}

function previewIllust(index) {
    const il = lastIllusts[index];
    if (!il) return;
    const imageSrc = il.preview_url || il.image_url;
    openLightbox(imageSrc, `${il.title} — ${il.author}  (ID: ${il.id})`);
}
