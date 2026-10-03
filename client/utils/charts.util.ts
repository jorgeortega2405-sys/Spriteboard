export interface ChartDataPoint {
  label: string;
  value: number;
  formattedValue?: string;
}

export interface LineChartOptions {
  canvas: HTMLCanvasElement;
  data: ChartDataPoint[];
  fillColorEnd?: string;
  fillColorStart?: string;
  lineColor?: string;
  valueFormatter?: (val: number) => string;
}

export interface BarChartOptions {
  barColor?: string;
  canvas: HTMLCanvasElement;
  data: ChartDataPoint[];
  hoverColor?: string;
  maxValue?: number;
  valueFormatter?: (val: number) => string;
}

export interface ChartController {
  destroy: () => void;
  update: (data: ChartDataPoint[]) => void;
}

function setupCanvasDpr(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; dpr: number; height: number; width: number } | null {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement?.clientWidth || 400;
  const height = rect.height || 200;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(dpr, dpr);
  return { ctx, dpr, width, height };
}

export function createLineChart(options: LineChartOptions): ChartController {
  const { canvas, fillColorEnd = 'rgba(37, 99, 235, 0.0)', fillColorStart = 'rgba(37, 99, 235, 0.22)', lineColor = '#2563eb', valueFormatter = (v) => String(v) } = options;
  let currentData = [...options.data];
  let hoverIndex: number | null = null;
  let isDestroyed = false;
  const abortController = new AbortController();
  const { signal } = abortController;

  const render = () => {
    if (isDestroyed) return;
    const setup = setupCanvasDpr(canvas);
    if (!setup) return;
    const { ctx, height, width } = setup;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 44;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 32;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (currentData.length === 0) return;

    const values = currentData.map((d) => d.value);
    const maxVal = Math.max(1, ...values);
    const gridLines = 3;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (chartH / gridLines) * i;
      const v = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(valueFormatter(v), padLeft - 8, y);
    }

    const points: Array<{ x: number; y: number }> = currentData.map((d, i) => {
      const step = currentData.length > 1 ? chartW / (currentData.length - 1) : chartW / 2;
      const x = currentData.length > 1 ? padLeft + step * i : padLeft + chartW / 2;
      const y = padTop + chartH - (d.value / maxVal) * chartH;
      return { x, y };
    });

    if (points.length > 0) {
      const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      gradient.addColorStop(0, fillColorStart);
      gradient.addColorStop(1, fillColorEnd);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx = (p0.x + p1.x) / 2;
        ctx.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
      }
      ctx.lineTo(points[points.length - 1].x, padTop + chartH);
      ctx.lineTo(points[0].x, padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx = (p0.x + p1.x) / 2;
        ctx.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';

      points.forEach((pt, i) => {
        const isHovered = hoverIndex === i;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHovered ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#60a5fa' : lineColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillText(currentData[i].label, pt.x, padTop + chartH + 10);
      });

      if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length) {
        const pt = points[hoverIndex];
        const item = currentData[hoverIndex];
        const text = item.formattedValue || valueFormatter(item.value);

        ctx.font = 'bold 12px sans-serif';
        const textW = ctx.measureText(text).width;
        const boxW = textW + 16;
        const boxH = 26;
        const boxX = Math.max(padLeft, Math.min(width - padRight - boxW, pt.x - boxW / 2));
        const boxY = Math.max(4, pt.y - boxH - 10);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(boxX, boxY, boxW, boxH, 6);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
      }
    }
  };

  const handlePointerMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.x;
    const padLeft = 44;
    const padRight = 16;
    const chartW = rect.width - padLeft - padRight;
    if (currentData.length === 0 || chartW <= 0) return;

    const step = currentData.length > 1 ? chartW / (currentData.length - 1) : chartW;
    const relX = x - padLeft;
    const idx = Math.max(0, Math.min(currentData.length - 1, Math.round(relX / step)));

    if (hoverIndex !== idx) {
      hoverIndex = idx;
      render();
    }
  };

  const handlePointerLeave = () => {
    if (hoverIndex !== null) {
      hoverIndex = null;
      render();
    }
  };

  canvas.addEventListener('mousemove', handlePointerMove, { signal });
  canvas.addEventListener('mouseleave', handlePointerLeave, { signal });
  window.addEventListener('resize', render, { signal });

  render();

  return {
    destroy: () => {
      isDestroyed = true;
      abortController.abort();
    },
    update: (newData: ChartDataPoint[]) => {
      currentData = [...newData];
      render();
    },
  };
}

export function createBarChart(options: BarChartOptions): ChartController {
  const { barColor = '#2563eb', canvas, hoverColor = '#3b82f6', maxValue, valueFormatter = (v) => String(v) } = options;
  let currentData = [...options.data];
  let hoverIndex: number | null = null;
  let isDestroyed = false;
  const abortController = new AbortController();
  const { signal } = abortController;

  const render = () => {
    if (isDestroyed) return;
    const setup = setupCanvasDpr(canvas);
    if (!setup) return;
    const { ctx, height, width } = setup;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 48;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 32;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (currentData.length === 0) return;

    const computedMax = maxValue !== undefined ? maxValue : Math.max(1, ...currentData.map((d) => d.value));
    const maxVal = computedMax > 0 ? computedMax : 1;
    const gridLines = 3;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (chartH / gridLines) * i;
      const v = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(valueFormatter(v), padLeft - 8, y);
    }

    const n = currentData.length;
    const slotW = chartW / n;
    const maxBarW = 44;
    const barW = Math.min(maxBarW, slotW * 0.6);

    currentData.forEach((d, i) => {
      const isHovered = hoverIndex === i;
      const x = padLeft + slotW * i + (slotW - barW) / 2;
      const barH = (d.value / maxVal) * chartH;
      const y = padTop + chartH - barH;

      ctx.fillStyle = isHovered ? hoverColor : barColor;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, barW, Math.max(2, barH), [6, 6, 0, 0]);
      } else {
        ctx.rect(x, y, barW, Math.max(2, barH));
      }
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8';
      ctx.font = isHovered ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(d.label, padLeft + slotW * i + slotW / 2, padTop + chartH + 10);

      if (isHovered) {
        const text = d.formattedValue || valueFormatter(d.value);
        ctx.font = 'bold 12px sans-serif';
        const textW = ctx.measureText(text).width;
        const boxW = textW + 16;
        const boxH = 26;
        const boxX = Math.max(padLeft, Math.min(width - padRight - boxW, x + barW / 2 - boxW / 2));
        const boxY = Math.max(4, y - boxH - 8);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(boxX, boxY, boxW, boxH, 6);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
      }
    });
  };

  const handlePointerMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.x;
    const padLeft = 48;
    const padRight = 16;
    const chartW = rect.width - padLeft - padRight;
    if (currentData.length === 0 || chartW <= 0) return;

    const slotW = chartW / currentData.length;
    const relX = x - padLeft;
    const idx = Math.floor(relX / slotW);

    if (idx >= 0 && idx < currentData.length) {
      if (hoverIndex !== idx) {
        hoverIndex = idx;
        render();
      }
    } else if (hoverIndex !== null) {
      hoverIndex = null;
      render();
    }
  };

  const handlePointerLeave = () => {
    if (hoverIndex !== null) {
      hoverIndex = null;
      render();
    }
  };

  canvas.addEventListener('mousemove', handlePointerMove, { signal });
  canvas.addEventListener('mouseleave', handlePointerLeave, { signal });
  window.addEventListener('resize', render, { signal });

  render();

  return {
    destroy: () => {
      isDestroyed = true;
      abortController.abort();
    },
    update: (newData: ChartDataPoint[]) => {
      currentData = [...newData];
      render();
    },
  };
}