import { createEl } from '../core/dom.js';

export function renderInlineProgress(text = '处理中') {
    return createEl('span', { class: 'progress-inline' }, [
        createEl('span', { class: 'progress-spinner', 'aria-hidden': 'true' }),
        createEl('span', {}, text),
    ]);
}

export function renderProgressBar(text = '') {
    return createEl('span', { class: 'progress-inline' }, [
        createEl('span', { class: 'progress-bar', role: 'progressbar', 'aria-label': text || '加载中' }),
        text ? createEl('span', {}, text) : null,
    ].filter(Boolean));
}

function formatBytes(bytes) {
    if (bytes == null || bytes < 0) return '...';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Creates a determinate progress bar with cancel button.
 * Returns { el, update(bytes, total), done(), cancel() }
 */
export function createDownloadProgress(onCancel) {
    const barFill = createEl('span', { class: 'progress-bar-fill' });
    const bar = createEl('span', { class: 'progress-bar-det', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [barFill]);
    const textEl = createEl('span', { class: 'progress-text' }, '0%');
    const cancelBtn = createEl('button', { type: 'button', class: 'progress-cancel', 'aria-label': '取消下载', title: '取消' }, '✕');
    const el = createEl('span', { class: 'progress-inline progress-download' }, [bar, textEl, cancelBtn]);

    cancelBtn.addEventListener('click', () => {
        if (onCancel) onCancel();
    });

    return {
        el,
        update(bytes, total) {
            const pct = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : 0;
            barFill.style.width = pct + '%';
            bar.setAttribute('aria-valuenow', String(pct));
            if (total > 0) {
                textEl.textContent = `${formatBytes(bytes)} / ${formatBytes(total)} (${pct}%)`;
            } else {
                textEl.textContent = `${formatBytes(bytes)}`;
            }
        },
        done() {
            cancelBtn.remove();
            barFill.style.width = '100%';
            textEl.textContent = '✓ 完成';
            el.classList.add('done');
        },
        error(msg) {
            cancelBtn.remove();
            textEl.textContent = msg || '✗ 失败';
            el.classList.add('error');
        },
    };
}
