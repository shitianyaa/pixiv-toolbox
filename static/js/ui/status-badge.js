import { createEl } from '../core/dom.js';

const STATUS_TEXT = {
    running: '执行中…',
    success: '已完成',
    failed: '任务失败',
    aborted: '已中断',
};

export function setStatus(el, kind, customText) {
    if (!el) return;
    if (!kind) {
        el.innerHTML = '';
        return;
    }
    const text = customText || STATUS_TEXT[kind] || kind;
    const dot = createEl('span', {
        class: `dot ${kind}${kind === 'running' ? ' pulse' : ''}`,
        'aria-hidden': 'true',
    });
    const badge = createEl('span', {
        class: `status-badge ${kind}`,
        role: 'status',
        'aria-live': 'polite',
    }, [dot, text]);
    el.innerHTML = '';
    el.appendChild(badge);
}
