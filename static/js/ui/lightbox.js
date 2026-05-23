import { $$ } from '../core/dom.js';

let previousFocus = null;
let lightboxEl = null;

export function initLightbox() {
    lightboxEl = document.getElementById('lightbox');
    if (!lightboxEl) return;

    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-labelledby', 'lb-info');

    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl) close();
    });

    const closeBtn = lightboxEl.querySelector('.close-btn');
    if (closeBtn) closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
        if (!lightboxEl.classList.contains('show')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') trapFocus(e);
    });
}

export function open(src, info) {
    if (!lightboxEl) return;
    previousFocus = document.activeElement;
    const img = document.getElementById('lb-img');
    if (img) img.src = src;
    const infoEl = document.getElementById('lb-info');
    if (infoEl) infoEl.textContent = info;
    lightboxEl.classList.add('show');
    const closeBtn = lightboxEl.querySelector('.close-btn');
    if (closeBtn) closeBtn.focus();
}

export function close() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('show');
    const img = document.getElementById('lb-img');
    if (img) img.src = '';
    if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
        previousFocus = null;
    }
}

function trapFocus(e) {
    const focusable = $$(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        lightboxEl,
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}
