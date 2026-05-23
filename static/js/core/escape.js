const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ESCAPE_MAP[m]);
}

export function formatBytes(kb) {
    if (kb == null) return '';
    if (kb < 1024) return `${kb}KB`;
    return `${(kb / 1024).toFixed(2)}MB`;
}
