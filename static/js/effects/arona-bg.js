export function initAronaBg() {
    const canvas = document.getElementById('arona-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    // Throttled Resize handling
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initStarField(); // Reinitialize stars to fit new screen bounds
        }, 150);
    });

    // ── 1. Star Field Data Initialization ──────────────────────
    let staticStars = [];
    let breathingStars = [];
    let crossStars = [];
    let nebulas = [];
    const shootingStars = [];
    const stardustTrail = [];

    function initStarField() {
        staticStars = [];
        breathingStars = [];
        crossStars = [];
        nebulas = [];

        // Static background micro-stars (High density, very faint)
        const staticCount = Math.floor((width * height) / 12000);
        for (let i = 0; i < staticCount; i++) {
            staticStars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 0.8 + 0.3,
                opacity: Math.random() * 0.35 + 0.05
            });
        }

        // Breathing/twinkling stars (Medium density, interactive pulse)
        const breathingCount = Math.floor((width * height) / 25000);
        for (let i = 0; i < breathingCount; i++) {
            breathingStars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.5 + 0.6,
                baseOpacity: Math.random() * 0.5 + 0.2,
                pulseSpeed: Math.random() * 0.03 + 0.01,
                angle: Math.random() * Math.PI * 2
            });
        }

        // Anime-style Cross/Flare Stars (Low density, very prominent)
        const crossCount = 6;
        for (let i = 0; i < crossCount; i++) {
            crossStars.push({
                x: Math.random() * width,
                y: Math.random() * (height * 0.7), // Concentrate in upper 70% of screen
                size: Math.random() * 1.5 + 1.2,
                baseOpacity: Math.random() * 0.4 + 0.4,
                pulseSpeed: Math.random() * 0.02 + 0.005,
                angle: Math.random() * Math.PI * 2,
                rotation: Math.random() * Math.PI,
                rotSpeed: (Math.random() * 0.002 + 0.001) * (Math.random() > 0.5 ? 1 : -1)
            });
        }

        // Nebula cloud glows (3 massive soft gradient clouds)
        nebulas = [
            {
                x: width * 0.2,
                y: height * 0.3,
                radius: Math.min(width, height) * 0.35,
                color: 'rgba(0, 191, 255, 0.04)', // Cyan glow
                targetX: width * 0.2,
                targetY: height * 0.3,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05
            },
            {
                x: width * 0.7,
                y: height * 0.2,
                radius: Math.min(width, height) * 0.4,
                color: 'rgba(79, 70, 229, 0.03)', // Indigo glow
                targetX: width * 0.7,
                targetY: height * 0.2,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05
            },
            {
                x: width * 0.5,
                y: height * 0.6,
                radius: Math.min(width, height) * 0.3,
                color: 'rgba(14, 165, 233, 0.035)', // Light blue glow
                targetX: width * 0.5,
                targetY: height * 0.6,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05
            }
        ];
    }

    initStarField();

    // ── 2. Interactive Mouse Stardust Trail ──────────────────
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseActive = false;

    window.addEventListener('mousemove', (e) => {
        mouseActive = true;
        const x = e.clientX;
        const y = e.clientY;

        // Calculate velocity based on movement distance to determine particle count
        const dist = Math.hypot(x - lastMouseX, y - lastMouseY);
        
        if (dist > 3) {
            // Spawn 1-2 stardust sparkles per motion
            const count = dist > 20 ? 2 : 1;
            for (let i = 0; i < count; i++) {
                stardustTrail.push({
                    x: x + (Math.random() - 0.5) * 8,
                    y: y + (Math.random() - 0.5) * 8,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8 - 0.2, // Drifts slightly upwards
                    size: Math.random() * 2.0 + 0.8,
                    color: Math.random() > 0.45 ? 'rgba(0, 191, 255, 0.8)' : 'rgba(255, 255, 255, 0.9)', // Blue/White mix
                    opacity: 1.0,
                    decay: Math.random() * 0.015 + 0.01
                });
            }
        }

        lastMouseX = x;
        lastMouseY = y;
    });

    // ── 3. Shooting Star Spawning ────────────────────────────
    function spawnShootingStar() {
        if (Math.random() > 0.003) return; // Rare probability per frame (around once every ~5-8 seconds)
        
        const startX = Math.random() * (width * 0.8);
        const startY = Math.random() * (height * 0.3);
        shootingStars.push({
            x: startX,
            y: startY,
            length: Math.random() * 100 + 60,
            speed: Math.random() * 4 + 5,
            angle: Math.PI / 6 + (Math.random() * 0.1), // ~30 degrees down-right
            opacity: 1.0,
            width: Math.random() * 1.5 + 1.0
        });
    }

    // ── 4. Drawing Helpers ───────────────────────────────────
    function drawCrossStar(ctx, x, y, size, rotation, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        // 1. Draw glowing background aura
        const radGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 5);
        radGlow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        radGlow.addColorStop(0.3, `rgba(0, 191, 255, ${opacity * 0.65})`);
        radGlow.addColorStop(0.6, `rgba(0, 191, 255, ${opacity * 0.2})`);
        radGlow.addColorStop(1, 'rgba(0, 191, 255, 0)');
        
        ctx.fillStyle = radGlow;
        ctx.beginPath();
        ctx.arc(0, 0, size * 5, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw sharp flare lines (Horizontal & Vertical crosses)
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.95})`;
        ctx.lineWidth = size * 0.22;
        
        ctx.beginPath();
        // Horizontal Flare Line
        ctx.moveTo(-size * 6, 0);
        ctx.lineTo(size * 6, 0);
        // Vertical Flare Line
        ctx.moveTo(0, -size * 6);
        ctx.lineTo(0, size * 6);
        ctx.stroke();
        
        ctx.restore();
    }

    // ── 5. Main Loop ─────────────────────────────────────────
    function animate() {
        // 清除画布，保持 Canvas 透明，使底层的阿罗娜高清壁纸得以完整呈现
        ctx.clearRect(0, 0, width, height);

        // A. Draw Nebula Clouds (Slowly drift around target coordinates)
        nebulas.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;

            // Constrain movement inside slightly padded screen edges
            if (n.x < 0 || n.x > width) n.vx *= -1;
            if (n.y < 0 || n.y > height) n.vy *= -1;

            const radialGlow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            radialGlow.addColorStop(0, n.color);
            // 提取 rgb 色值，渐变淡出至透明的相同颜色，防止在透明 Canvas 上渲染出脏环
            const fadeColor = n.color.substring(0, n.color.lastIndexOf(',')) + ', 0)';
            radialGlow.addColorStop(1, fadeColor);

            ctx.fillStyle = radialGlow;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // B. Draw Static Micro-Stars (Using simple rects for massive CPU performance save)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        staticStars.forEach(s => {
            ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });

        // C. Draw Breathing Stars
        breathingStars.forEach(s => {
            s.angle += s.pulseSpeed;
            const currentOpacity = s.baseOpacity + Math.sin(s.angle) * 0.25;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, currentOpacity)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // D. Draw Rotating Anime Cross-Stars
        crossStars.forEach(s => {
            s.angle += s.pulseSpeed;
            s.rotation += s.rotSpeed;
            const currentOpacity = s.baseOpacity + Math.sin(s.angle) * 0.3;
            
            drawCrossStar(ctx, s.x, s.y, s.size, s.rotation, Math.max(0.1, currentOpacity));
        });

        // E. Draw Shooting Stars
        spawnShootingStar();
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const ss = shootingStars[i];
            ss.x += Math.cos(ss.angle) * ss.speed;
            ss.y += Math.sin(ss.angle) * ss.speed;
            ss.opacity -= 0.012; // Gradual fadeout

            if (ss.opacity <= 0 || ss.x > width + 10 || ss.y > height + 10) {
                shootingStars.splice(i, 1);
                continue;
            }

            // Draw line with linear gradient representing tail fading
            const trailStartX = ss.x - Math.cos(ss.angle) * ss.length;
            const trailStartY = ss.y - Math.sin(ss.angle) * ss.length;

            const ssGlow = ctx.createLinearGradient(ss.x, ss.y, trailStartX, trailStartY);
            ssGlow.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
            ssGlow.addColorStop(0.2, `rgba(0, 191, 255, ${ss.opacity * 0.8})`);
            ssGlow.addColorStop(1, 'rgba(0, 191, 255, 0)');

            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(trailStartX, trailStartY);
            ctx.strokeStyle = ssGlow;
            ctx.lineWidth = ss.width;
            ctx.stroke();
        }

        // F. Draw Interactive Mouse Stardust
        for (let i = stardustTrail.length - 1; i >= 0; i--) {
            const p = stardustTrail[i];
            p.x += p.vx;
            p.y += p.vy;
            p.opacity -= p.decay;
            p.size -= 0.015; // Shrink as it dies

            if (p.opacity <= 0 || p.size <= 0) {
                stardustTrail.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0; // Reset global alpha

        requestAnimationFrame(animate);
    }

    animate();
}
