/* share.js — Web Share API, clipboard fallback, share-card rendering */
(function (global) {

  function buildShareText(answer) {
    return `🔮 Магический шар сказал мне: "${answer}"`;
  }

  async function shareAnswer(answer, url) {
    const text = buildShareText(answer);
    if (navigator.share) {
      try {
        await navigator.share({ text, url: url || location.href, title: 'Магический шар' });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        return copyToClipboard(text);
      }
    }
    return copyToClipboard(text);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return 'copied';
      }
      // legacy fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return 'copied';
    } catch (e) {
      return 'failed';
    }
  }

  // ---- share card rendering on canvas ----
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line = test;
      }
    }
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return lines.length * lineHeight;
  }

  function renderCard(canvas, { question, answer, rarity, themeColors }) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const colors = themeColors || { a: '#6a5cff', b: '#4fd0ff' };

    // background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0715');
    bg.addColorStop(1, '#050311');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // glow orb
    const glow = ctx.createRadialGradient(W / 2, H * 0.34, 10, W / 2, H * 0.34, W * 0.6);
    glow.addColorStop(0, hexA(colors.a, 0.55));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ball
    const cx = W / 2, cy = H * 0.34, r = W * 0.28;
    const ballGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    ballGrad.addColorStop(0, hexA('#ffffff', 0.5));
    ballGrad.addColorStop(0.4, hexA(colors.a, 0.9));
    ballGrad.addColorStop(1, hexA(colors.b, 0.95));
    ctx.beginPath();
    ctx.fillStyle = ballGrad;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // inner window
    ctx.beginPath();
    ctx.fillStyle = '#08060f';
    ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 34px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.a;
    ctx.shadowBlur = 20;
    wrapText(ctx, answer, cx, cy + 10, r * 0.95, 40);
    ctx.shadowBlur = 0;

    // header
    ctx.textAlign = 'left';
    ctx.font = '700 30px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔮 МАГИЧЕСКИЙ ШАР', 60, 90);

    // question label
    let y = H * 0.68;
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = '#9d92c9';
    ctx.fillText('Вопрос:', 60, y);
    y += 38;
    ctx.font = '500 26px sans-serif';
    ctx.fillStyle = '#e8e2ff';
    y += wrapText(ctx, '«' + (question || 'мысленный вопрос') + '»', 60, y, W - 120, 34);

    y += 20;
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = '#9d92c9';
    ctx.fillText('Ответ:', 60, y);
    y += 38;
    ctx.font = '700 28px sans-serif';
    ctx.fillStyle = '#ffffff';
    wrapText(ctx, '«' + answer + '»', 60, y, W - 120, 36);

    // footer rarity badge
    if (rarity && rarity !== 'common') {
      ctx.font = '700 20px sans-serif';
      ctx.fillStyle = colors.a;
      ctx.textAlign = 'right';
      ctx.fillText(rarity.toUpperCase(), W - 60, H - 60);
    }
    ctx.textAlign = 'left';
    ctx.font = '400 18px sans-serif';
    ctx.fillStyle = '#5c5480';
    ctx.fillText('magicalball.app', 60, H - 60);
  }

  function hexA(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return `rgba(120,100,255,${alpha})`;
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename || 'magic-ball.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  global.MBShare = { shareAnswer, copyToClipboard, renderCard, downloadCanvas, buildShareText };
})(window);
