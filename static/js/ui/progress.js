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
