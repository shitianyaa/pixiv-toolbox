import { APITask, ValidationError, valueOf, checkedOf } from './api-task.js';
import { esc } from '../core/escape.js';

const PROXY_PATTERN = /^(https?|socks[45]?):\/\/[^\s]+$/i;

export class ConnectivityTestTask extends APITask {
    constructor() {
        super({
            endpoint: '/api/test-api',
            btnId: 'btn-test',
            statusId: 'test-status',
            consoleId: 'test-console',
            resultId: 'test-result',
            busyLabel: '测试中…',
        });
    }

    validate() {
        const token = valueOf('ti-token');
        if (!token) throw new ValidationError('请输入 refresh_token', 'ti-token');
        if (token.length < 20) throw new ValidationError('refresh_token 看上去格式不正确（长度过短）', 'ti-token');
        const proxy = valueOf('ti-proxy');
        if (proxy && !PROXY_PATTERN.test(proxy)) {
            throw new ValidationError('代理地址格式不正确，示例: http://127.0.0.1:7890', 'ti-proxy');
        }
        return true;
    }

    buildPayload() {
        return {
            refresh_token: valueOf('ti-token'),
            proxy: valueOf('ti-proxy'),
            tag: valueOf('ti-tag'),
            allow_r18: checkedOf('ti-r18'),
        };
    }

    onSuccess(d) {
        const summary = document.getElementById('test-summary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-item"><div class="value">${d.ranking_count}</div><div class="label">排行列表拉取</div></div>
                <div class="summary-item"><div class="value">${d.search_count}</div><div class="label">标签检索数目</div></div>
                <div class="summary-item"><div class="value">${d.safe_count}</div><div class="label">全年龄作品</div></div>
                <div class="summary-item"><div class="value">${d.r18_count}</div><div class="label">R18作品数</div></div>
                <div class="summary-item"><div class="value">${d.download_size_kb}KB</div><div class="label">测试下载大小</div></div>`;
        }
        const info = document.getElementById('test-download-info');
        if (info && d.download_path) {
            const paths = (d.download_paths || [d.download_path])
                .map((p) => `<code style="color:var(--primary)">${esc(p)}</code>`)
                .join('<br>');
            info.innerHTML = `📁 ${d.download_original === false ? '已保存降级压缩图' : '已保存高清原始图片'}：<br>${paths}`;
        }
        this.resultEl?.classList.add('show');
    }
}
