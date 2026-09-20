import { BoardChartElement, DEFAULT_CHART_PALETTES } from './board.types.js';

export function formatChartNumber(
  value: number,
  decimals = 0,
  style: 'comma' | 'dot' | 'normal' = 'normal',
  abbrev: 'kmb' | 'none' = 'none',
  prefix = '',
  suffix = ''
): string {
  let num = value;
  let unit = '';

  if (abbrev === 'kmb') {
    if (Math.abs(num) >= 1_000_000_000) {
      num = num / 1_000_000_000;
      unit = 'B';
    } else if (Math.abs(num) >= 1_000_000) {
      num = num / 1_000_000;
      unit = 'M';
    } else if (Math.abs(num) >= 1_000) {
      num = num / 1_000;
      unit = 'K';
    }
  }

  let formatted = num.toFixed(Math.max(0, decimals));

  if (style === 'comma') {
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  } else if (style === 'dot') {
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formatted = parts.join(',');
  }

  return `${prefix}${formatted}${unit}${suffix}`;
}

export function computeNiceScale(
  minVal: number,
  maxVal: number,
  maxTicks = 5
): { max: number; min: number; step: number; ticks: number[] } {
  if (minVal === maxVal) {
    if (maxVal === 0) {
      return { max: 10, min: 0, step: 2, ticks: [0, 2, 4, 6, 8, 10] };
    }
    maxVal = maxVal > 0 ? maxVal * 1.2 : 0;
    minVal = minVal < 0 ? minVal * 1.2 : 0;
  }

  const range = maxVal - minVal;
  const rawStep = range / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / Math.pow(10, exponent);

  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  const step = niceFraction * Math.pow(10, exponent);
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;

  const ticks: number[] = [];
  for (let val = niceMin; val <= niceMax + step * 0.0001; val += step) {
    ticks.push(Number(val.toFixed(6)));
  }

  return { max: niceMax, min: niceMin, step, ticks };
}

function drawRoundedRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  if (h <= 0 || w <= 0) return;
  const r = Math.min(radius, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawRoundedRectRight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  if (h <= 0 || w <= 0) return;
  const r = Math.min(radius, h / 2, w);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

export function drawChart(ctx: CanvasRenderingContext2D, el: BoardChartElement): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(el.x, el.y, el.width, el.height, 12);
  } else {
    ctx.rect(el.x, el.y, el.width, el.height);
  }
  ctx.fill();
  ctx.stroke();

  let curY = el.y + 18;
  const leftX = el.x + 20;
  const rightX = el.x + el.width - 20;
  const availW = rightX - leftX;

  if (el.title) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.title, leftX, curY);
    curY += 22;
  }

  if (el.subtitle) {
    ctx.fillStyle = '#64748b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.subtitle, leftX, curY);
    curY += 18;
  }

  const defaultPalette = el.palette && el.palette.length > 0 ? el.palette : DEFAULT_CHART_PALETTES.canva.colors;
  const numRows = el.data?.length || 0;
  const seriesCount = Math.max(1, el.series?.length || 1);

  if (el.showLegend) {
    curY += 6;
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    const legendItems: Array<{ color: string; label: string }> = [];
    if (el.chartType === 'pie' || el.chartType === 'donut' || el.chartType === 'bar-categorical' || el.chartType === 'bar-categorical-horizontal' || el.colorBy === 'category') {
      for (let i = 0; i < numRows; i++) {
        const row = el.data[i];
        const color = row.color || defaultPalette[i % defaultPalette.length];
        legendItems.push({ color, label: row.label || `Item ${i + 1}` });
      }
    } else {
      for (let s = 0; s < seriesCount; s++) {
        const ser = el.series[s];
        const color = ser?.color || defaultPalette[s % defaultPalette.length];
        legendItems.push({ color, label: ser?.name || `Serie ${s + 1}` });
      }
    }

    let totalLegendW = 0;
    const itemWidths: number[] = [];
    for (const item of legendItems) {
      const w = 12 + 6 + ctx.measureText(item.label).width + 16;
      itemWidths.push(w);
      totalLegendW += w;
    }

    let legX = Math.max(leftX, leftX + (availW - totalLegendW) / 2);
    for (let i = 0; i < legendItems.length; i++) {
      const item = legendItems[i];
      if (legX + itemWidths[i] > rightX) {
        legX = leftX;
        curY += 20;
      }
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legX + 6, curY + 6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legX + 16, curY + 6);
      legX += itemWidths[i];
    }
    curY += 24;
  }

  let botY = el.y + el.height - 18;
  if (el.sourceText) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Fuente: ${el.sourceText}`, rightX, botY);
    botY -= 16;
  }

  const plotTop = curY + 10;
  const isHorizontal =
    el.chartType === 'bar-horizontal' ||
    el.chartType === 'bar-categorical-horizontal' ||
    el.chartType === 'bar-grouped-horizontal' ||
    el.chartType === 'bar-stacked-horizontal' ||
    el.chartType === 'bar-stacked-100-horizontal';

  const isPieOrDonut = el.chartType === 'pie' || el.chartType === 'donut';

  if (isPieOrDonut) {
    drawPieOrDonutChart(ctx, el, leftX, plotTop, availW, botY - plotTop, defaultPalette);
    ctx.restore();
    return;
  }

  const decimals = el.decimals !== undefined ? el.decimals : 0;
  const numStyle = el.numberFormatStyle || 'normal';
  const numAbbrev = el.numberAbbreviation || 'none';
  const prefix = el.prefix || '';
  const suffix = el.suffix || '';

  if (isHorizontal) {
    drawHorizontalBarChart(
      ctx,
      el,
      leftX,
      plotTop,
      rightX,
      botY,
      defaultPalette,
      decimals,
      numStyle,
      numAbbrev,
      prefix,
      suffix
    );
  } else {
    drawVerticalChart(
      ctx,
      el,
      leftX,
      plotTop,
      rightX,
      botY,
      defaultPalette,
      decimals,
      numStyle,
      numAbbrev,
      prefix,
      suffix
    );
  }

  ctx.restore();
}

function drawVerticalChart(
  ctx: CanvasRenderingContext2D,
  el: BoardChartElement,
  leftX: number,
  plotTop: number,
  rightX: number,
  botY: number,
  palette: string[],
  decimals: number,
  numStyle: 'comma' | 'dot' | 'normal',
  numAbbrev: 'kmb' | 'none',
  prefix: string,
  suffix: string
): void {
  const is100Stacked = el.chartType === 'bar-stacked-100-vertical';
  const isStacked = el.chartType === 'bar-stacked-vertical' || is100Stacked;
  const isGrouped = el.chartType === 'bar-grouped-vertical';
  const isLine = el.chartType === 'line';
  const isArea = el.chartType === 'area';
  const numRows = el.data?.length || 0;
  const seriesCount = Math.max(1, el.series?.length || 1);

  let minVal = el.yAxisMin !== undefined ? el.yAxisMin : 0;
  let maxVal = el.yAxisMax !== undefined ? el.yAxisMax : 0;

  if (is100Stacked) {
    minVal = 0;
    maxVal = 100;
  } else {
    for (let i = 0; i < numRows; i++) {
      const vals = el.data[i].values || [];
      if (isStacked) {
        let sum = 0;
        for (let s = 0; s < seriesCount; s++) {
          sum += Math.max(0, vals[s] || 0);
        }
        if (sum > maxVal) maxVal = sum;
      } else {
        for (let s = 0; s < seriesCount; s++) {
          const v = vals[s] !== undefined ? vals[s] : 0;
          if (v > maxVal) maxVal = v;
          if (v < minVal) minVal = v;
        }
      }
    }
  }

  if (maxVal === 0 && minVal === 0) maxVal = 100;
  const scale = computeNiceScale(minVal, maxVal, 5);

  let yAxisLabelW = 0;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (el.showYAxisLabels !== false) {
    for (const tick of scale.ticks) {
      const label = formatChartNumber(tick, decimals, numStyle, numAbbrev, prefix, is100Stacked ? '%' : suffix);
      const w = ctx.measureText(label).width;
      if (w > yAxisLabelW) yAxisLabelW = w;
    }
    yAxisLabelW += 10;
  }

  const yTitleH = el.showYAxisTitle && el.yAxisTitle ? 18 : 0;
  const xTitleH = el.showXAxisTitle && el.xAxisTitle ? 20 : 0;
  const xLabelsH = el.showXAxisLabels !== false ? 24 : 8;

  const plotX = leftX + yAxisLabelW + yTitleH;
  const plotW = Math.max(20, rightX - plotX);
  const plotH = Math.max(20, botY - plotTop - xLabelsH - xTitleH);
  const plotBottom = plotTop + plotH;

  if (el.showYAxisTitle && el.yAxisTitle) {
    ctx.save();
    ctx.translate(leftX + 12, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.yAxisTitle, 0, 0);
    ctx.restore();
  }

  const valRange = scale.max - scale.min || 1;
  const zeroY = plotBottom - ((0 - scale.min) / valRange) * plotH;

  for (const tick of scale.ticks) {
    const ty = plotBottom - ((tick - scale.min) / valRange) * plotH;
    if (el.showGridLines !== false) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, ty);
      ctx.lineTo(rightX, ty);
      ctx.stroke();
    }
    if (el.showYAxisLabels !== false) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = formatChartNumber(tick, decimals, numStyle, numAbbrev, prefix, is100Stacked ? '%' : suffix);
      ctx.fillText(label, plotX - 8, ty);
    }
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, plotTop);
  ctx.lineTo(plotX, plotBottom);
  ctx.lineTo(rightX, plotBottom);
  ctx.stroke();

  if (numRows === 0) return;

  const colW = plotW / numRows;
  const barRadius = el.barRadius !== undefined ? el.barRadius : 8;

  if (isLine || isArea) {
    for (let s = 0; s < seriesCount; s++) {
      const color = el.series?.[s]?.color || palette[s % palette.length];
      const pts: Array<{ val: number; x: number; y: number }> = [];

      for (let i = 0; i < numRows; i++) {
        const val = el.data[i].values?.[s] || 0;
        const px = plotX + (i + 0.5) * colW;
        const py = plotBottom - ((val - scale.min) / valRange) * plotH;
        pts.push({ val, x: px, y: py });
      }

      if (isArea && pts.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, zeroY);
        ctx.lineTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.lineTo(pts[pts.length - 1].x, zeroY);
        ctx.closePath();
        ctx.fillStyle = `${color}22`;
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      for (const pt of pts) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (el.showDataLabels) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const txt = formatChartNumber(pt.val, decimals, numStyle, numAbbrev, prefix, suffix);
          ctx.fillText(txt, pt.x, pt.y - 8);
        }
      }
    }
  } else {
    for (let i = 0; i < numRows; i++) {
      const row = el.data[i];
      const slotX = plotX + i * colW;
      const slotPad = colW * 0.15;
      const barAreaW = colW - slotPad * 2;

      if (isStacked) {
        let stackedY = plotBottom;
        const total = is100Stacked
          ? row.values?.reduce((acc, v) => acc + Math.max(0, v || 0), 0) || 1
          : 1;

        for (let s = 0; s < seriesCount; s++) {
          const rawVal = row.values?.[s] || 0;
          const val = is100Stacked ? ((rawVal || 0) / total) * 100 : rawVal;
          const barH = (val / valRange) * plotH;
          const color = el.series?.[s]?.color || palette[s % palette.length];
          const isTop = s === seriesCount - 1;

          ctx.fillStyle = color;
          if (isTop) {
            drawRoundedRectTop(ctx, slotX + slotPad, stackedY - barH, barAreaW, barH, barRadius);
          } else {
            ctx.fillRect(slotX + slotPad, stackedY - barH, barAreaW, barH);
          }
          ctx.fill();

          if (el.showDataLabels && val > 0 && barH > 14) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const displayVal = is100Stacked ? `${Math.round(val)}%` : formatChartNumber(rawVal, decimals, numStyle, numAbbrev, prefix, suffix);
            ctx.fillText(displayVal, slotX + slotPad + barAreaW / 2, stackedY - barH / 2);
          }
          stackedY -= barH;
        }
      } else if (isGrouped) {
        const groupBarW = barAreaW / seriesCount;
        for (let s = 0; s < seriesCount; s++) {
          const val = row.values?.[s] || 0;
          const barH = ((val - scale.min) / valRange) * plotH;
          const barX = slotX + slotPad + s * groupBarW;
          const barY = plotBottom - barH;
          const color = el.series?.[s]?.color || palette[s % palette.length];

          ctx.fillStyle = color;
          drawRoundedRectTop(ctx, barX + 1, barY, groupBarW - 2, barH, barRadius);
          ctx.fill();

          if (el.showDataLabels) {
            drawDataLabel(
              ctx,
              val,
              barX + groupBarW / 2,
              barY,
              barH,
              el.dataLabelPosition || 'auto',
              decimals,
              numStyle,
              numAbbrev,
              prefix,
              suffix
            );
          }
        }
      } else {
        const val = row.values?.[0] !== undefined ? row.values[0] : 0;
        const barH = ((val - scale.min) / valRange) * plotH;
        const barX = slotX + slotPad;
        const barY = plotBottom - barH;
        const isCategorical = el.chartType === 'bar-categorical' || el.colorBy === 'category';
        const color = isCategorical
          ? row.color || palette[i % palette.length]
          : el.series?.[0]?.color || palette[0];

        ctx.fillStyle = color;
        drawRoundedRectTop(ctx, barX, barY, barAreaW, barH, barRadius);
        ctx.fill();

        if (el.showDataLabels) {
          drawDataLabel(
            ctx,
            val,
            barX + barAreaW / 2,
            barY,
            barH,
            el.dataLabelPosition || 'auto',
            decimals,
            numStyle,
            numAbbrev,
            prefix,
            suffix
          );
        }
      }
    }
  }

  if (el.showXAxisLabels !== false) {
    ctx.fillStyle = '#334155';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < numRows; i++) {
      const label = el.data[i]?.label || `Cat ${i + 1}`;
      const px = plotX + (i + 0.5) * colW;
      ctx.fillText(label, px, plotBottom + 8);
    }
  }

  if (el.showXAxisTitle && el.xAxisTitle) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(el.xAxisTitle, plotX + plotW / 2, plotBottom + xLabelsH + 2);
  }
}

function drawHorizontalBarChart(
  ctx: CanvasRenderingContext2D,
  el: BoardChartElement,
  leftX: number,
  plotTop: number,
  rightX: number,
  botY: number,
  palette: string[],
  decimals: number,
  numStyle: 'comma' | 'dot' | 'normal',
  numAbbrev: 'kmb' | 'none',
  prefix: string,
  suffix: string
): void {
  const is100Stacked = el.chartType === 'bar-stacked-100-horizontal';
  const isStacked = el.chartType === 'bar-stacked-horizontal' || is100Stacked;
  const isGrouped = el.chartType === 'bar-grouped-horizontal';
  const numRows = el.data?.length || 0;
  const seriesCount = Math.max(1, el.series?.length || 1);

  let minVal = 0;
  let maxVal = 0;

  if (is100Stacked) {
    maxVal = 100;
  } else {
    for (let i = 0; i < numRows; i++) {
      const vals = el.data[i].values || [];
      if (isStacked) {
        let sum = 0;
        for (let s = 0; s < seriesCount; s++) {
          sum += Math.max(0, vals[s] || 0);
        }
        if (sum > maxVal) maxVal = sum;
      } else {
        for (let s = 0; s < seriesCount; s++) {
          const v = vals[s] !== undefined ? vals[s] : 0;
          if (v > maxVal) maxVal = v;
        }
      }
    }
  }
  if (maxVal === 0) maxVal = 100;
  const scale = computeNiceScale(minVal, maxVal, 5);

  let yLabelW = 0;
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (el.showYAxisLabels !== false) {
    for (let i = 0; i < numRows; i++) {
      const label = el.data[i]?.label || `Cat ${i + 1}`;
      const w = ctx.measureText(label).width;
      if (w > yLabelW) yLabelW = w;
    }
    yLabelW += 12;
  }

  const yTitleH = el.showYAxisTitle && el.yAxisTitle ? 18 : 0;
  const xTitleH = el.showXAxisTitle && el.xAxisTitle ? 20 : 0;
  const xLabelsH = el.showXAxisLabels !== false ? 24 : 8;

  const plotX = leftX + yLabelW + yTitleH;
  const plotW = Math.max(20, rightX - plotX);
  const plotH = Math.max(20, botY - plotTop - xLabelsH - xTitleH);
  const plotBottom = plotTop + plotH;

  if (el.showYAxisTitle && el.yAxisTitle) {
    ctx.save();
    ctx.translate(leftX + 12, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.yAxisTitle, 0, 0);
    ctx.restore();
  }

  const valRange = scale.max - scale.min || 1;

  for (const tick of scale.ticks) {
    const tx = plotX + ((tick - scale.min) / valRange) * plotW;
    if (el.showGridLines !== false) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, plotTop);
      ctx.lineTo(tx, plotBottom);
      ctx.stroke();
    }
    if (el.showXAxisLabels !== false) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = formatChartNumber(tick, decimals, numStyle, numAbbrev, prefix, is100Stacked ? '%' : suffix);
      ctx.fillText(label, tx, plotBottom + 8);
    }
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, plotTop);
  ctx.lineTo(plotX, plotBottom);
  ctx.lineTo(rightX, plotBottom);
  ctx.stroke();

  if (numRows === 0) return;

  const rowH = plotH / numRows;
  const barRadius = el.barRadius !== undefined ? el.barRadius : 8;

  for (let i = 0; i < numRows; i++) {
    const row = el.data[i];
    const slotY = plotTop + i * rowH;
    const slotPad = rowH * 0.15;
    const barAreaH = rowH - slotPad * 2;

    if (el.showYAxisLabels !== false) {
      ctx.fillStyle = '#334155';
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.label || `Cat ${i + 1}`, plotX - 8, slotY + rowH / 2);
    }

    if (isStacked) {
      let curStackedX = plotX;
      const total = is100Stacked
        ? row.values?.reduce((acc, v) => acc + Math.max(0, v || 0), 0) || 1
        : 1;

      for (let s = 0; s < seriesCount; s++) {
        const rawVal = row.values?.[s] || 0;
        const val = is100Stacked ? ((rawVal || 0) / total) * 100 : rawVal;
        const barW = (val / valRange) * plotW;
        const color = el.series?.[s]?.color || palette[s % palette.length];
        const isRightmost = s === seriesCount - 1;

        ctx.fillStyle = color;
        if (isRightmost) {
          drawRoundedRectRight(ctx, curStackedX, slotY + slotPad, barW, barAreaH, barRadius);
        } else {
          ctx.fillRect(curStackedX, slotY + slotPad, barW, barAreaH);
        }
        ctx.fill();

        if (el.showDataLabels && val > 0 && barW > 24) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const displayVal = is100Stacked ? `${Math.round(val)}%` : formatChartNumber(rawVal, decimals, numStyle, numAbbrev, prefix, suffix);
          ctx.fillText(displayVal, curStackedX + barW / 2, slotY + slotPad + barAreaH / 2);
        }
        curStackedX += barW;
      }
    } else if (isGrouped) {
      const groupBarH = barAreaH / seriesCount;
      for (let s = 0; s < seriesCount; s++) {
        const val = row.values?.[s] || 0;
        const barW = ((val - scale.min) / valRange) * plotW;
        const barY = slotY + slotPad + s * groupBarH;
        const color = el.series?.[s]?.color || palette[s % palette.length];

        ctx.fillStyle = color;
        drawRoundedRectRight(ctx, plotX, barY + 1, barW, groupBarH - 2, barRadius);
        ctx.fill();

        if (el.showDataLabels) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const txt = formatChartNumber(val, decimals, numStyle, numAbbrev, prefix, suffix);
          ctx.fillText(txt, plotX + barW + 6, barY + groupBarH / 2);
        }
      }
    } else {
      const val = row.values?.[0] !== undefined ? row.values[0] : 0;
      const barW = ((val - scale.min) / valRange) * plotW;
      const barY = slotY + slotPad;
      const isCategorical = el.chartType === 'bar-categorical-horizontal' || el.colorBy === 'category';
      const color = isCategorical
        ? row.color || palette[i % palette.length]
        : el.series?.[0]?.color || palette[0];

      ctx.fillStyle = color;
      drawRoundedRectRight(ctx, plotX, barY, barW, barAreaH, barRadius);
      ctx.fill();

      if (el.showDataLabels) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const txt = formatChartNumber(val, decimals, numStyle, numAbbrev, prefix, suffix);
        ctx.fillText(txt, plotX + barW + 8, barY + barAreaH / 2);
      }
    }
  }

  if (el.showXAxisTitle && el.xAxisTitle) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(el.xAxisTitle, plotX + plotW / 2, plotBottom + xLabelsH + 2);
  }
}

function drawPieOrDonutChart(
  ctx: CanvasRenderingContext2D,
  el: BoardChartElement,
  leftX: number,
  plotTop: number,
  availW: number,
  availH: number,
  palette: string[]
): void {
  const isDonut = el.chartType === 'donut';
  const numRows = el.data?.length || 0;
  if (numRows === 0) return;

  let total = 0;
  for (let i = 0; i < numRows; i++) {
    total += Math.max(0, el.data[i].values?.[0] || 0);
  }
  if (total === 0) total = 1;

  const cx = leftX + availW / 2;
  const cy = plotTop + availH / 2;
  const outerR = Math.max(20, Math.min(availW, availH) / 2 - 16);
  const innerR = isDonut ? outerR * 0.58 : 0;

  let startAngle = -Math.PI / 2;

  for (let i = 0; i < numRows; i++) {
    const row = el.data[i];
    const val = Math.max(0, row.values?.[0] || 0);
    const sliceAngle = (val / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const color = row.color || palette[i % palette.length];

    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    if (innerR > 0) {
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    } else {
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (el.showDataLabels && sliceAngle > 0.25) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = innerR > 0 ? (innerR + outerR) / 2 : outerR * 0.65;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pct = `${Math.round((val / total) * 100)}%`;
      ctx.fillText(pct, lx, ly);
    }

    startAngle = endAngle;
  }
}

function drawDataLabel(
  ctx: CanvasRenderingContext2D,
  val: number,
  x: number,
  y: number,
  h: number,
  pos: 'auto' | 'inside' | 'outside',
  decimals: number,
  numStyle: 'comma' | 'dot' | 'normal',
  numAbbrev: 'kmb' | 'none',
  prefix: string,
  suffix: string
): void {
  const txt = formatChartNumber(val, decimals, numStyle, numAbbrev, prefix, suffix);
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';

  if (pos === 'inside' || (pos === 'auto' && h >= 26)) {
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(txt, x, y + 6);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'bottom';
    ctx.fillText(txt, x, y - 6);
  }
}
