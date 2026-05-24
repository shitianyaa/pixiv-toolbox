import { createEl } from '../core/dom.js';
import { createDownloadProgress } from './progress.js';

let panel = null;

function ensurePanel() {
    if (panel) return panel;
    panel = createEl('div', { class: 'download-panel', id: 'download-panel' });
    document.body.appendChild(panel);
    return panel;
}

/**
 * Add a download entry to the floating panel.
 * Returns { update(bytes, total), done(), error(msg), remove() }
 */
export function addDownloadEntry(illustId, onCancel) {
    const p = ensurePanel();

    const titleEl = createEl('div', { class: 'dl-panel-title' }, [
        createEl('span', { class: 'dl-panel-id' }, `#${illustId}`),
    ]);
    const progress = createDownloadProgress(() => {
        if (onCancel) onCancel();
    });

    const entry = createEl('div', { class: 'dl-panel-entry' }, [titleEl, progress.el]);
    p.appendChild(entry);

    // Ensure panel is visible
    p.classList.add('show');

    return {
        update(bytes, total) {
            progress.update(bytes, total);
        },
        done() {
            progress.done();
            entry.classList.add('done');
            setTimeout(() => {
                entry.classList.add('fade-out');
                setTimeout(() => {
                    entry.remove();
                    if (!p.children.length) p.classList.remove('show');
                }, 400);
            }, 5000);
        },
        error(msg) {
            progress.error(msg);
            entry.classList.add('error');
            setTimeout(() => {
                entry.classList.add('fade-out');
                setTimeout(() => {
                    entry.remove();
                    if (!p.children.length) p.classList.remove('show');
                }, 400);
            }, 5000);
        },
        remove() {
            entry.classList.add('fade-out');
            setTimeout(() => {
                entry.remove();
                if (!p.children.length) p.classList.remove('show');
            }, 400);
        },
    };
}
