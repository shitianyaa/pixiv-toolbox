export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(el, event, handler, options) {
    if (!el) return () => {};
    el.addEventListener(event, handler, options);
    return () => el.removeEventListener(event, handler, options);
}

export function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') el.className = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === false || value == null) continue;
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, value);
    }
    for (const child of [].concat(children)) {
        if (child == null) continue;
        el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
}
