import { $$ } from '../core/dom.js';

export function initTabs(rootSelector = '.tabs') {
    const tablist = document.querySelector(rootSelector);
    if (!tablist) return;
    const tabs = $$('.tab-btn', tablist);

    tabs.forEach((tab, index) => {
        const targetName = tab.dataset.target;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        tab.setAttribute('tabindex', tab.classList.contains('active') ? '0' : '-1');
        if (targetName) tab.setAttribute('aria-controls', `panel-${targetName}`);
        tab.id = tab.id || `tab-${targetName}`;

        const panel = document.getElementById(`panel-${targetName}`);
        if (panel) {
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
            panel.setAttribute('tabindex', '0');
        }

        tab.addEventListener('click', () => activate(tabs, tab));
        tab.addEventListener('keydown', (e) => onKeydown(e, tabs, index));
    });

    tablist.setAttribute('role', 'tablist');
}

function activate(tabs, target) {
    tabs.forEach((tab) => {
        const active = tab === target;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');

        const targetName = tab.dataset.target;
        const panel = targetName ? document.getElementById(`panel-${targetName}`) : null;
        if (panel) panel.classList.toggle('active', active);
    });
}

function onKeydown(event, tabs, index) {
    let nextIndex = null;
    switch (event.key) {
        case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
        case 'ArrowLeft':  nextIndex = (index - 1 + tabs.length) % tabs.length; break;
        case 'Home':       nextIndex = 0; break;
        case 'End':        nextIndex = tabs.length - 1; break;
        default: return;
    }
    event.preventDefault();
    const next = tabs[nextIndex];
    activate(tabs, next);
    next.focus();
}
