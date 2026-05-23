import { initTabs } from './ui/tabs.js';
import { initToastRegion, toast } from './ui/toast.js';
import { initAronaBg } from './effects/arona-bg.js';

initAronaBg();
initToastRegion();

/* 自定义 select / lightbox / 搜索视图 — 首屏非关键，延迟加载 */
function initDeferredUI() {
    return Promise.all([
        import('./ui/custom-select.js'),
        import('./ui/lightbox.js'),
        import('./features/search-preview.js'),
    ]).then(([csMod, lbMod, spMod]) => {
        csMod.initCustomSelects();
        lbMod.initLightbox();
        spMod.initSearchView();
    });
}

function initCopyButtons() {
    document.querySelectorAll('[data-copy-target]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.copyTarget;
            const target = document.getElementById(targetId);
            if (!target) return;
            const value = target.value || target.textContent || '';
            if (!value) return;
            navigator.clipboard.writeText(value).then(() => {
                const originalText = btn.dataset.originalText || btn.textContent;
                btn.dataset.originalText = originalText;
                btn.textContent = '已复制 ✓';
                btn.classList.add('copied');
                btn.setAttribute('aria-live', 'polite');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(() => toast.error('复制失败，请手动选择'));
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCopyButtons();

    /* 首次加载时触发卡片入场动画（仅一次） */
    requestAnimationFrame(() => {
        document.querySelectorAll('.card').forEach((card, i) => {
            setTimeout(() => card.classList.add('animate-in'), 200 + i * 80);
        });
    });

    /* 延迟初始化非首屏UI */
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => initDeferredUI());
    } else {
        setTimeout(initDeferredUI, 100);
    }

    /* 按需动态导入 — 仅在按钮点击时加载对应模块 */
    document.getElementById('btn-fetch')?.addEventListener('click', async () => {
        const { FetchTokenTask } = await import('./features/fetch-token.js');
        new FetchTokenTask().run();
    });
    document.getElementById('btn-test')?.addEventListener('click', async () => {
        const { ConnectivityTestTask } = await import('./features/connectivity-test.js');
        new ConnectivityTestTask().run();
    });
    document.getElementById('btn-search')?.addEventListener('click', async () => {
        const { SearchPreviewTask } = await import('./features/search-preview.js');
        new SearchPreviewTask().run();
    });
});
