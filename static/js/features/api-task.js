import { SSEClient } from '../core/sse-client.js';
import { setStatus } from '../ui/status-badge.js';
import { toast } from '../ui/toast.js';

export class ValidationError extends Error {
    constructor(message, fieldId) {
        super(message);
        this.name = 'ValidationError';
        this.fieldId = fieldId;
    }
}

export class APITask {
    constructor({ endpoint, btnId, statusId, consoleId, resultId, busyLabel }) {
        this.endpoint = endpoint;
        this.btn = document.getElementById(btnId);
        this.statusEl = document.getElementById(statusId);
        this.consoleEl = document.getElementById(consoleId);
        this.resultEl = resultId ? document.getElementById(resultId) : null;
        this.busyLabel = busyLabel || '处理中…';
        this.originalBtnHTML = this.btn ? this.btn.innerHTML : '';
        this.client = null;
    }

    buildPayload() { return {}; }
    validate() { return true; }
    onSuccess(_data) {}
    onBeforeRun() {}

    async run() {
        this._clearErrors();
        let payload;
        try {
            const ok = this.validate();
            if (ok === false) return;
            payload = this.buildPayload();
        } catch (e) {
            if (e instanceof ValidationError) {
                this._showFieldError(e.fieldId, e.message);
            } else {
                toast.error('校验失败: ' + e.message);
            }
            return;
        }

        try { this.onBeforeRun(); } catch (e) { console.error(e); }

        this._setBusy(true);
        if (this.consoleEl) {
            this.consoleEl.style.display = 'block';
            this.consoleEl.innerHTML = '';
        }
        if (this.resultEl) this.resultEl.classList.remove('show');
        setStatus(this.statusEl, 'running');

        this.client = new SSEClient({ url: this.endpoint, payload });
        let finalResult = null;
        this.client
            .on('result', (data) => { finalResult = data; })
            .on('log', (text, level) => this._appendLog(text, level))
            .on('error', (err) => this._appendLog(err.message, 'error'))
            .on('done', (_data, ok) => {
                if (ok && finalResult) {
                    setStatus(this.statusEl, 'success');
                    try { this.onSuccess(finalResult); }
                    catch (e) { console.error(e); toast.error('结果处理异常'); }
                } else {
                    setStatus(this.statusEl, 'failed');
                }
                this._setBusy(false);
            });
        await this.client.start();
    }

    cancel() {
        if (this.client) this.client.abort();
    }

    _setBusy(busy) {
        if (!this.btn) return;
        this.btn.disabled = busy;
        if (busy) {
            this.btn.innerHTML = `<span class="progress-spinner" aria-hidden="true"></span> ${this.busyLabel}`;
        } else {
            this.btn.innerHTML = this.originalBtnHTML;
        }
    }

    _appendLog(text, level) {
        if (!this.consoleEl) return;
        const d = document.createElement('div');
        d.className = 'log-line ' + (level || 'log');
        d.textContent = text;
        this.consoleEl.appendChild(d);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }

    _clearErrors() {
        document.querySelectorAll('.form-group.error').forEach((el) => {
            el.classList.remove('error');
            const msg = el.querySelector('.error-msg');
            if (msg) msg.remove();
        });
    }

    _showFieldError(fieldId, message) {
        const input = fieldId ? document.getElementById(fieldId) : null;
        if (!input) {
            toast.error(message);
            return;
        }
        const group = input.closest('.form-group');
        if (!group) {
            toast.error(message);
            return;
        }
        group.classList.add('error');
        let msgEl = group.querySelector('.error-msg');
        if (!msgEl) {
            msgEl = document.createElement('span');
            msgEl.className = 'error-msg';
            msgEl.setAttribute('role', 'alert');
            group.appendChild(msgEl);
        }
        msgEl.textContent = message;
        input.focus();
    }
}

export function valueOf(id) {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
}

export function checkedOf(id) {
    const el = document.getElementById(id);
    return el ? !!el.checked : false;
}

export function numberOf(id, fallback) {
    const v = valueOf(id);
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
