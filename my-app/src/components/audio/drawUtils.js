// src/audio/drawUtils.js

export function drawGenericWave(ctx, width, height, intensity = 1) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(200, 200, 200, ${0.7 * intensity})`;
  ctx.beginPath();
  const steps = 300;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const t = (i / steps) * Math.PI * 4;
    const y =
      height / 2 +
      Math.sin(t) * (height * 0.25 * intensity) +
      (Math.random() - 0.5) * (height * 0.06 * intensity);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
