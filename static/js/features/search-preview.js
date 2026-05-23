import { APITask, ValidationError, valueOf, checkedOf, numberOf } from './api-task.js';
import { esc } from '../core/escape.js';
import { open as openLightbox } from '../ui/lightbox.js';
import { downloadIllust } from './download.js';

const PROXY_PATTERN = /^(https?|socks[45]?):\/\/[^\s]+$/i;

let lastIllusts = [];
let currentView = 'list';

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
