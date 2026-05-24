import { SSEClient } from '../core/sse-client.js';
import { addDownloadEntry } from '../ui/download-panel.js';
import { toast } from '../ui/toast.js';

const QUALITY_LABELS = {
    auto: '自动',
    original: '原图',
    large: '大图',
    medium: '中图',
};

function downloadSummary(d) {
    const qualities = d.qualities || [];
    const qualitySet = [...new Set(qualities)].filter(Boolean);
    const qualityText = qualitySet.map((q) => QUALITY_LABELS[q] || q).join('/') || '未知质量';
    const pages = Number(d.page_count || qualities.length || 1);
    return `${qualityText} · ${pages}页 · ${d.size_kb}KB`;
}

function downloadPaths(d) {
    return (d.paths || [d.path]).filter(Boolean);
}

export async function downloadIllust(illustId, btn) {
    const token = (document.getElementById('si-token')?.value || '').trim();
    const proxy = (document.getElementById('si-proxy')?.value || '').trim();
    const downloadQuality = (document.getElementById('si-download-quality')?.value || 'auto').trim();

    btn.disabled = true;
    btn.innerHTML = '<span class="progress-spinner" aria-hidden="true"></span> 下载中';
    btn.setAttribute('aria-busy', 'true');

    let client = null;

    // Add entry to floating panel
    const entry = addDownloadEntry(illustId, () => {
        if (client) client.abort();
    });

    client = new SSEClient({
        url: '/api/download-illust',
        payload: {
            refresh_token: token,
            proxy,
            illust_id: illustId,
            download_quality: downloadQuality,
        },
        timeout: 120000,
        exclusive: false,
    });

    client
        .on('message', (msg) => {
            if (msg.type === 'progress') {
                entry.update(msg.bytes, msg.total_bytes);
            }
        })
        .on('result', (data) => {
            entry.done();
            btn.textContent = '✓ ' + downloadSummary(data);
            btn.title = downloadPaths(data).join('\n');
            btn.classList.add('success');
            btn.removeAttribute('aria-busy');
            toast.success(`插画 ${illustId} 下载完成`);
        })
        .on('error', (err) => {
            if (err.type === 'aborted') {
                entry.remove();
                btn.textContent = '下载';
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.classList.remove('success');
                toast('下载已取消');
            } else {
                entry.error('✗ 失败');
                btn.textContent = '重试';
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                toast.error('下载失败: ' + (err.message || '未知错误'));
            }
        })
        .on('done', (_data, ok) => {
            if (ok) {
                setTimeout(() => {
                    btn.disabled = false;
                }, 2000);
            }
        });

    await client.start();
}
