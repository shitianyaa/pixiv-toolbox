let primaryController = null;

export class SSEClient {
    constructor({ url, payload, timeout = 60000, parsePrefix = 'data: ', exclusive = true } = {}) {
        this.url = url;
        this.payload = payload;
        this.timeout = timeout;
        this.parsePrefix = parsePrefix;
        this.exclusive = exclusive;
        this.handlers = {
            message: null,
            log: null,
            result: null,
            done: null,
            error: null,
        };
        this.controller = null;
        this.timeoutId = null;
        this.finalResult = null;
    }

    on(event, handler) {
        this.handlers[event] = handler;
        return this;
    }

    abort() {
        if (this.controller) this.controller.abort();
    }

    _resetTimeout() {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            if (this.controller) this.controller.abort();
        }, this.timeout);
    }

    async start() {
        if (this.exclusive && primaryController) primaryController.abort();
        this.controller = new AbortController();
        if (this.exclusive) primaryController = this.controller;
        this._resetTimeout();

        let receivedDone = false;
        try {
            const resp = await fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.payload),
                signal: this.controller.signal,
            });
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                this._resetTimeout();
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith(this.parsePrefix)) continue;
                    let msg;
                    try {
                        msg = JSON.parse(line.slice(this.parsePrefix.length));
                    } catch {
                        continue;
                    }
                    this._dispatch(msg);
                    if (msg.type === 'done') {
                        receivedDone = true;
                        break outer;
                    }
                }
            }

            try { await reader.cancel(); } catch {}
            this._cleanup();
            const ok = receivedDone && this.finalResult != null;
            this._fire('done', this.finalResult, ok);
        } catch (err) {
            this._cleanup();
            if (err.name === 'AbortError') {
                this._fire('error', { type: 'aborted', message: '请求已中断（可能因切换任务或 60 秒无响应超时）' });
            } else {
                this._fire('error', { type: 'network', message: '连接后台发生异常: ' + err });
            }
            this._fire('done', null, false);
        }
    }

    _dispatch(msg) {
        this._fire('message', msg);
        if (msg.type === 'result') {
            this.finalResult = msg.data;
            this._fire('result', msg.data);
            this._fire('log', msg.msg || '', 'result');
        } else if (msg.type !== 'done') {
            const level = msg.type === 'ok' || msg.type === 'error' ? msg.type : 'log';
            this._fire('log', msg.msg || '', level);
        }
    }

    _fire(event, ...args) {
        const h = this.handlers[event];
        if (!h) return;
        try { h(...args); } catch (e) { console.warn(`SSE handler ${event} threw:`, e); }
    }

    _cleanup() {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (primaryController === this.controller) primaryController = null;
        this.controller = null;
        this.timeoutId = null;
    }
}
