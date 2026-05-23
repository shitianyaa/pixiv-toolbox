import { createEl } from '../core/dom.js';

let region = null;

const ICON = {
    success: '✓',
    error: '✕',
    info: 'i',
};

function ensureRegion() {
    if (region) return region;
    region = createEl('div', {
        class: 'toast-region',
        id: 'toast-region',
        role: 'region',
        'aria-live': 'polite',
        'aria-label': '通知区域',
    });
    document.body.appendChild(region);
    return region;
}

function show(kind, message, options = {}) {
    const root = ensureRegion();
    const duration = options.duration ?? (kind === 'error' ? 5000 : 3500);
    const closable = options.closable ?? (kind === 'error');

    const icon = createEl('span', { class: 'toast-icon', 'aria-hidden': 'true' }, ICON[kind] || 'i');
    const body = createEl('div', { class: 'toast-body' }, String(message));
    const children = [icon, body];

    let removeTimer = null;
    const dismiss = () => {
        if (removeTimer) clearTimeout(removeTimer);
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    if (closable) {
        const closeBtn = createEl('button', {
            class: 'toast-close',
            type: 'button',
            'aria-label': '关闭通知',
            onclick: dismiss,
        }, '✕');
        children.push(closeBtn);
    }

    const toast = createEl('div', {
        class: `toast ${kind}`,
        role: kind === 'error' ? 'alert' : 'status',
    }, children);

    root.appendChild(toast);

    if (duration > 0) {
        removeTimer = setTimeout(dismiss, duration);
    }
    return dismiss;
}

export const toast = {
    success: (msg, opts) => show('success', msg, opts),
    error: (msg, opts) => show('error', msg, opts),
    info: (msg, opts) => show('info', msg, opts),
};

export function initToastRegion() {
    ensureRegion();
}
