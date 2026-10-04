import { BoardElementAnimation, BoardElementEffect } from '../types.js';

export function applyElementEffect(ctx: CanvasRenderingContext2D, effect?: BoardElementEffect): void {
  if (!effect || effect.type === 'none') {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.filter = 'none';
    return;
  }

  if (effect.type === 'shadow') {
    const angleRad = ((effect.direction !== undefined ? effect.direction : 45) * Math.PI) / 180;
    const dist = effect.offset !== undefined ? effect.offset : 20;
    ctx.shadowOffsetX = Math.cos(angleRad) * dist;
    ctx.shadowOffsetY = Math.sin(angleRad) * dist;
    ctx.shadowBlur = effect.blur !== undefined ? effect.blur : 16;
    if (effect.opacity !== undefined && effect.color && effect.color.startsWith('#')) {
      const hex = effect.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${effect.opacity})`;
    } else {
      ctx.shadowColor = effect.color || 'rgba(0, 0, 0, 0.45)';
    }
  } else if (effect.type === 'glow') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = effect.blur !== undefined ? effect.blur : 24;
    ctx.shadowColor = effect.color || '#3b82f6';
  } else if (effect.type === 'neon') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const intensityFactor = (effect.intensity !== undefined ? effect.intensity : 100) / 100;
    ctx.shadowBlur = Math.round(30 * intensityFactor);
    ctx.shadowColor = effect.color || '#00e5ff';
  } else if (effect.type === 'echo') {
    const angleRad = ((effect.direction !== undefined ? effect.direction : 30) * Math.PI) / 180;
    const dist = effect.offset !== undefined ? effect.offset : 12;
    ctx.shadowOffsetX = Math.cos(angleRad) * dist;
    ctx.shadowOffsetY = Math.sin(angleRad) * dist;
    ctx.shadowBlur = 0;
    ctx.shadowColor = effect.color || '#6366f1';
  } else if (effect.type === 'glitch') {
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = -2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = effect.color || '#06b6d4';
  } else if (effect.type === 'radioactive') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00ff66';
    ctx.filter = 'hue-rotate(90deg) saturate(1.8)';
  } else if (effect.type === 'midnight') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#1e3a8a';
    ctx.filter = 'hue-rotate(200deg) contrast(1.2)';
  } else if (effect.type === 'malibu') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#06b6d4';
    ctx.filter = 'hue-rotate(180deg) saturate(1.4)';
  } else if (effect.type === 'sunset') {
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 8;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f97316';
    ctx.filter = 'hue-rotate(330deg) saturate(1.5)';
  }
}

export function applyElementAnimation(
  ctx: CanvasRenderingContext2D,
  el: any,
  anim: BoardElementAnimation,
  elapsedMs: number,
  elementIndex = 0,
  slideDurationMs = 5000
): { isFinished: boolean } {
  if (!anim || anim.type === 'none') {
    return { isFinished: true };
  }

  const baseDurationMs = anim.duration !== undefined && anim.duration > 0
    ? anim.duration * 1000
    : (anim.speed === 'slow' ? 1400 : (anim.speed === 'fast' ? 400 : 750));

  const trigger = anim.trigger || 'enter';
  const delayMs = anim.type === 'sequence' ? elementIndex * 120 : 0;
  const tElapsed = Math.max(0, elapsedMs - delayMs);

  let rawProgress = 1;
  let isFinished = false;

  if (trigger === 'enter') {
    rawProgress = Math.min(1, tElapsed / baseDurationMs);
    isFinished = rawProgress >= 1;
  } else if (trigger === 'exit') {
    const exitStartMs = Math.max(0, slideDurationMs - baseDurationMs);
    if (elapsedMs < exitStartMs) {
      rawProgress = 1;
      isFinished = false;
    } else {
      rawProgress = Math.max(0, 1 - (elapsedMs - exitStartMs) / baseDurationMs);
      isFinished = rawProgress <= 0;
    }
  } else if (trigger === 'both') {
    const exitStartMs = Math.max(baseDurationMs + delayMs + 100, slideDurationMs - baseDurationMs);
    if (elapsedMs < baseDurationMs + delayMs) {
      rawProgress = Math.min(1, tElapsed / baseDurationMs);
      isFinished = false;
    } else if (elapsedMs >= exitStartMs) {
      rawProgress = Math.max(0, 1 - (elapsedMs - exitStartMs) / baseDurationMs);
      isFinished = rawProgress <= 0;
    } else {
      rawProgress = 1;
      isFinished = false;
    }
  }

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const cl = Math.max(0, Math.min(1, t));
    return 1 + c3 * Math.pow(cl - 1, 3) + c1 * Math.pow(cl - 1, 2);
  };

  const progress = easeOutCubic(rawProgress);

  const hasBox = typeof el.x === 'number' && typeof el.y === 'number' && typeof el.width === 'number' && typeof el.height === 'number';
  const cx = hasBox ? el.x + el.width / 2 : (el.x || 0);
  const cy = hasBox ? el.y + el.height / 2 : (el.y || 0);
  const baseAlpha = el.opacity !== undefined ? el.opacity : 1;

  if (anim.type === 'rise') {
    const offsetY = (1 - progress) * 50;
    ctx.translate(0, offsetY);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'pan') {
    const offsetX = (1 - progress) * -70;
    ctx.translate(offsetX, 0);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'fade') {
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'pop') {
    const scale = 0.2 + easeOutBack(rawProgress) * 0.8;
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0, scale), Math.max(0, scale));
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 1.5);
  } else if (anim.type === 'diagonal') {
    ctx.translate((1 - progress) * -50, (1 - progress) * -50);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'blur') {
    ctx.globalAlpha = baseAlpha * rawProgress;
    if (rawProgress < 1) {
      const b = Math.round((1 - rawProgress) * 12);
      ctx.filter = ctx.filter && ctx.filter !== 'none' ? `${ctx.filter} blur(${b}px)` : `blur(${b}px)`;
    }
  } else if (anim.type === 'sequence') {
    const offsetY = (1 - progress) * 40;
    ctx.translate(0, offsetY);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'wipe') {
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.01, progress), 1);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'curtain') {
    ctx.translate(cx, cy);
    ctx.scale(1, Math.max(0.01, progress));
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'drift') {
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 2);
    const tSec = elapsedMs / 1000;
    const dx = Math.sin(tSec * 2.5 + elementIndex) * 8;
    const dy = Math.cos(tSec * 2.0 + elementIndex) * 6;
    ctx.translate(dx, dy);
    isFinished = false;
  } else if (anim.type === 'tectonic') {
    ctx.globalAlpha = baseAlpha * rawProgress;
    if (rawProgress < 1) {
      const shake = Math.sin(rawProgress * Math.PI * 8) * (1 - rawProgress) * 12;
      ctx.translate(shake, (1 - progress) * 40);
    }
  } else if (anim.type === 'roll') {
    const angle = (1 - progress) * -Math.PI;
    const scale = 0.4 + progress * 0.6;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'neon') {
    if (rawProgress < 1) {
      const flicker = (Math.sin(rawProgress * Math.PI * 6) > 0 ? 1 : 0.3) * rawProgress;
      ctx.globalAlpha = baseAlpha * flicker;
    } else {
      const pulse = 0.85 + Math.sin(elapsedMs / 300) * 0.15;
      ctx.globalAlpha = baseAlpha * pulse;
      isFinished = false;
    }
  } else if (anim.type === 'scrapbook') {
    const angle = (1 - progress) * -0.2;
    const scale = 1.3 - progress * 0.3;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'stomp') {
    const scale = rawProgress < 0.8
      ? 2.2 - (rawProgress / 0.8) * 1.2
      : 1.0 + Math.sin(((rawProgress - 0.8) / 0.2) * Math.PI) * 0.15;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 2);
  }

  return { isFinished };
}
