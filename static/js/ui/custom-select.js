import { $$, createEl, on } from '../core/dom.js';

let uid = 0;
const allWrappers = new Set();

export function initCustomSelects(root = document) {
    $$('select', root).forEach((select) => {
        if (select.dataset.enhanced) return;
        enhance(select);
    });

    document.addEventListener('click', () => {
        allWrappers.forEach((w) => w.close());
    });
}

function enhance(select) {
    select.dataset.enhanced = '1';
    select.classList.add('hidden-select');
    const baseId = select.id || `select-${++uid}`;
    const listId = `${baseId}-listbox`;

    const wrapper = createEl('div', { class: 'custom-select-wrapper' });
    const trigger = createEl('button', {
        type: 'button',
        class: 'custom-select-trigger',
        role: 'combobox',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        'aria-controls': listId,
        id: `${baseId}-trigger`,
    });
    const labelSpan = createEl('span', {}, select.options[select.selectedIndex]?.text || '');
    trigger.appendChild(labelSpan);

    const optionsEl = createEl('ul', {
        class: 'custom-options',
        role: 'listbox',
        id: listId,
        tabindex: '-1',
        'aria-label': select.getAttribute('aria-label') || labelFor(select) || '请选择',
    });

    const optionEls = Array.from(select.options).map((option, idx) => {
        const el = createEl('li', {
            class: 'custom-option' + (idx === select.selectedIndex ? ' selected' : ''),
            role: 'option',
            'aria-selected': idx === select.selectedIndex ? 'true' : 'false',
            id: `${listId}-opt-${idx}`,
            'data-index': String(idx),
        }, option.text);
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            pick(idx);
            api.close();
        });
        return el;
    });
    optionEls.forEach((el) => optionsEl.appendChild(el));

    select.parentNode.insertBefore(wrapper, select.nextSibling);
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsEl);

    let activeIndex = select.selectedIndex;

    const api = {
        open() {
            allWrappers.forEach((w) => w !== api && w.close());
            wrapper.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            activeIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
            setActive(activeIndex);
            optionsEl.focus();
        },
        close() {
            wrapper.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-activedescendant');
        },
        toggle() {
            wrapper.classList.contains('open') ? api.close() : api.open();
        },
    };
    allWrappers.add(api);

    function setActive(idx) {
        if (idx < 0 || idx >= optionEls.length) return;
        activeIndex = idx;
        optionEls.forEach((el, i) => el.classList.toggle('active', i === idx));
        trigger.setAttribute('aria-activedescendant', optionEls[idx].id);
        optionEls[idx].scrollIntoView({ block: 'nearest' });
    }

    function pick(idx) {
        if (idx < 0 || idx >= optionEls.length) return;
        select.selectedIndex = idx;
        labelSpan.textContent = optionEls[idx].textContent;
        optionEls.forEach((el, i) => {
            el.classList.toggle('selected', i === idx);
            el.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        });
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    on(trigger, 'click', (e) => {
        e.stopPropagation();
        api.toggle();
    });

    on(trigger, 'keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
            case 'Enter':
            case ' ':
                e.preventDefault();
                api.open();
                break;
            case 'Escape':
                api.close();
                break;
        }
    });

    on(optionsEl, 'keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActive(Math.min(activeIndex + 1, optionEls.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActive(Math.max(activeIndex - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                setActive(0);
                break;
            case 'End':
                e.preventDefault();
                setActive(optionEls.length - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                pick(activeIndex);
                api.close();
                trigger.focus();
                break;
            case 'Escape':
                e.preventDefault();
                api.close();
                trigger.focus();
                break;
            case 'Tab':
                api.close();
                break;
        }
    });

    on(optionsEl, 'click', (e) => e.stopPropagation());
}

function labelFor(select) {
    const id = select.id;
    if (!id) return null;
    const label = document.querySelector(`label[for="${id}"]`);
    return label ? label.textContent.trim() : null;
}
