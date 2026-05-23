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
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="progress-spinner" aria-hidden="true"></span> 下载中';
    btn.setAttribute('aria-busy', 'true');

    try {
        const resp = await fetch('/api/download-illust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                refresh_token: token,
                proxy,
                illust_id: illustId,
                download_quality: downloadQuality,
            }),
        });
        const data = await resp.json();
        if (data.ok) {
            btn.textContent = '✓ ' + downloadSummary(data);
            btn.title = downloadPaths(data).join('\n');
            btn.classList.add('success');
            btn.removeAttribute('aria-busy');
            toast.success(`插画 ${illustId} 下载完成`);
        } else {
            btn.textContent = '重试';
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            toast.error('下载未成功: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        btn.textContent = originalText || '重试';
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        toast.error('下载异常: ' + e.message);
    }
}
