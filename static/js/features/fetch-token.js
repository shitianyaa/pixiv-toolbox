import { APITask, ValidationError, valueOf, checkedOf } from './api-task.js';

const PROXY_PATTERN = /^(https?|socks[45]?):\/\/[^\s]+$/i;

export class FetchTokenTask extends APITask {
    constructor() {
        super({
            endpoint: '/api/fetch-token',
            btnId: 'btn-fetch',
            statusId: 'fetch-status',
            consoleId: 'fetch-console',
            resultId: 'fetch-result',
            busyLabel: '启动中…',
        });
    }

    validate() {
        const username = valueOf('fi-username');
        if (!username) throw new ValidationError('请输入 Pixiv 账号', 'fi-username');
        const password = valueOf('fi-password');
        if (!password) throw new ValidationError('请输入 Pixiv 密码', 'fi-password');
        const proxy = valueOf('fi-proxy');
        if (proxy && !PROXY_PATTERN.test(proxy)) {
            throw new ValidationError('代理地址格式不正确，示例: http://127.0.0.1:7890', 'fi-proxy');
        }
        return true;
    }

    buildPayload() {
        return {
            username: valueOf('fi-username'),
            password: valueOf('fi-password'),
            proxy: valueOf('fi-proxy'),
            show_browser: checkedOf('fi-show-browser'),
        };
    }

    onSuccess(d) {
        const refresh = document.getElementById('res-refresh');
        const access = document.getElementById('res-access');
        if (refresh) refresh.value = d.refresh_token || '';
        if (access) access.value = d.access_token || '';
        this.resultEl?.classList.add('show');
        const proxy = valueOf('fi-proxy');
        const tiToken = document.getElementById('ti-token');
        const siToken = document.getElementById('si-token');
        if (tiToken) tiToken.value = d.refresh_token || '';
        if (siToken) siToken.value = d.refresh_token || '';
        const tiProxy = document.getElementById('ti-proxy');
        const siProxy = document.getElementById('si-proxy');
        if (tiProxy) tiProxy.value = proxy;
        if (siProxy) siProxy.value = proxy;
    }
}
