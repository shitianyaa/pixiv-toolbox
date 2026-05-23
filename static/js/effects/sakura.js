const PETAL_COLOR = '#93c5fd';

let canvas = null;
let ctx = null;
let petals = [];
let rafId = null;
let prefersReducedMotion = false;
let width = 0;
let height = 0;

/* 使用简单椭圆代替贝塞尔曲线，省去 save/restore 开销 */
class Petal {
    constructor() { this.reset(); this.y = Math.random() * height; }
    reset() {
        this.x = Math.random() * width;
        this.y = -Math.random() * 200;
        this.size = Math.random() * 6 + 3;
        this.speedX = Math.random() * 0.6 + 0.5;
        this.speedY = Math.random() * 0.5 + 0.3;
        this.rotation = Math.random() * 6.28;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.4 + 0.25;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        if (this.y > height + 20 || this.x > width + 20) this.reset();
    }
}

function animate() {
    if (document.hidden) { rafId = null; return; }
    ctx.clearRect(0, 0, width, height);
    const TWO_PI = Math.PI * 2;
    for (let i = 0, len = petals.length; i < len; i++) {
        const p = petals[i];
        p.update();
        ctx.globalAlpha = p.opacity;
        ctx.setTransform(
            Math.cos(p.rotation), Math.sin(p.rotation),
            -Math.sin(p.rotation), Math.cos(p.rotation),
            p.x, p.y
        );
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, TWO_PI);
        ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(animate);
}

function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PETAL_COLOR;
    const TWO_PI = Math.PI * 2;
    for (const p of petals) {
        ctx.globalAlpha = p.opacity;
        ctx.setTransform(
            Math.cos(p.rotation), Math.sin(p.rotation),
            -Math.sin(p.rotation), Math.cos(p.rotation),
            p.x, p.y
        );
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, TWO_PI);
        ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
}

function onResize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

export function initSakura(canvasId = 'sakura') {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = PETAL_COLOR;

    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = matchMedia('(max-width: 768px)').matches;
    const lowEnd = (navigator.hardwareConcurrency || 4) < 4;
    const petalCount = prefersReducedMotion ? 15 : (lowEnd ? 15 : isMobile ? 25 : 35);

    petals = [];
    for (let i = 0; i < petalCount; i++) petals.push(new Petal());

    window.addEventListener('resize', onResize);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && rafId === null && !prefersReducedMotion) {
            rafId = requestAnimationFrame(animate);
        }
    });

    if (prefersReducedMotion) {
        drawStatic();
    } else {
        animate();
    }
}
