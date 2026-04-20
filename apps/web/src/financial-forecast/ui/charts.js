function pathFromValues(values, width, height, min, max) {
  if (!values.length) return "";
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function zeroLineY(min, max, height) {
  if (min >= 0) return height;
  if (max <= 0) return 0;
  const span = Math.max(1, max - min);
  return height - ((0 - min) / span) * height;
}

export function renderLineChart(container, series, labels, options = {}) {
  if (!container) return;
  const data = (Array.isArray(series) ? series : []).map((value) => Number(value || 0));
  if (!data.length) {
    container.innerHTML = `<div class="ff-chart-empty">No chart data yet.</div>`;
    return;
  }

  const width = 640;
  const height = 240;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const path = pathFromValues(data, width, height, min, max);
  const stroke = options.stroke || "#C6A16E";
  const zeroY = zeroLineY(min, max, height);

  container.innerHTML = `
    <svg class="ff-chart-svg" viewBox="0 0 ${width} ${height + 40}" role="img" aria-label="${options.title || "Chart"}" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(242,237,230,0.35)" />
      <line x1="0" y1="0" x2="0" y2="${height}" stroke="rgba(242,237,230,0.2)" />
      ${min < 0 ? `<line x1="0" y1="${zeroY.toFixed(2)}" x2="${width}" y2="${zeroY.toFixed(2)}" stroke="rgba(242,237,230,0.25)" stroke-dasharray="4 4" />` : ""}
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />
      <text x="0" y="${height + 22}" fill="#CFC6BB" font-size="12">${labels?.[0] || "Start"}</text>
      <text x="${width - 20}" y="${height + 22}" fill="#CFC6BB" font-size="12" text-anchor="end">${labels?.[labels.length - 1] || "End"}</text>
      <text x="0" y="12" fill="#CFC6BB" font-size="12">${Math.round(max).toLocaleString()}</text>
      <text x="0" y="${height}" fill="#CFC6BB" font-size="12">${Math.round(min).toLocaleString()}</text>
    </svg>
  `;
}

export function renderBarChart(container, values, labels, options = {}) {
  if (!container) return;
  const data = (Array.isArray(values) ? values : []).map((value) => Number(value || 0));
  if (!data.length) {
    container.innerHTML = `<div class="ff-chart-empty">No chart data yet.</div>`;
    return;
  }

  const width = 640;
  const height = 220;
  const bottomPad = 28;
  const topPad = 10;
  const plotHeight = height - topPad - bottomPad;
  const barWidth = width / data.length;
  const fill = options.fill || "#C6A16E";
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const span = Math.max(1, max - min);
  const zeroY = topPad + (max / span) * plotHeight;

  const bars = data
    .map((value, index) => {
      const x = index * barWidth + 6;
      const w = Math.max(3, barWidth - 12);
      const ratio = Math.abs(value) / span;
      const h = ratio * plotHeight;
      const y = value >= 0 ? zeroY - h : zeroY;
      const label = labels?.[index] ?? "";
      return `
        <rect class="ff-bar-rect" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"></rect>
        <text class="ff-bar-label" x="${(x + w / 2).toFixed(2)}" y="${height - 10}" text-anchor="middle" fill="#CFC6BB" font-size="11">${label}</text>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg class="ff-chart-svg ff-chart-bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.title || "Bar Chart"}" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
      <line x1="0" y1="${zeroY.toFixed(2)}" x2="${width}" y2="${zeroY.toFixed(2)}" stroke="rgba(242,237,230,0.35)" />
      ${bars}
      <text x="2" y="${topPad + 10}" fill="#CFC6BB" font-size="11">${Math.round(max).toLocaleString()}</text>
    </svg>
  `;
}

export function renderMultiLineChart(container, seriesList, labels, options = {}) {
  if (!container) return;
  const series = (seriesList || []).filter((s) => Array.isArray(s?.values) && s.values.length);
  if (!series.length) {
    container.innerHTML = `<div class="ff-chart-empty">No chart data yet.</div>`;
    return;
  }
  const width = 640;
  const height = 240;
  const flat = series.flatMap((s) => s.values.map((v) => Number(v || 0)));
  const min = Math.min(...flat, 0);
  const max = Math.max(...flat, 0);
  const zeroY = zeroLineY(min, max, height);

  const paths = series
    .map((s, index) => {
      const path = pathFromValues(s.values.map((v) => Number(v || 0)), width, height, min, max);
      const stroke = s.stroke || ["#C6A16E", "#8ED6A6", "#86A8FF", "#E7B6D2", "#EFC389"][index % 5];
      return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" data-series="${s.label || ""}" />`;
    })
    .join("");

  const legend = series
    .map((s, index) => {
      const stroke = s.stroke || ["#C6A16E", "#8ED6A6", "#86A8FF", "#E7B6D2", "#EFC389"][index % 5];
      return `<g transform="translate(${12 + index * 150}, ${height + 14})"><rect width="18" height="3" y="0" fill="${stroke}" /><text x="24" y="5" fill="#CFC6BB" font-size="11">${(s.label || "").slice(0, 18)}</text></g>`;
    })
    .join("");

  const sampleLen = series[0].values.length;
  const xForIndex = (idx) => (idx / Math.max(1, sampleLen - 1)) * width;
  const yForValue = (v) => height - ((Number(v || 0) - min) / Math.max(1, max - min)) * height;

  const markers = (options.markers || [])
    .filter((m) => Number.isFinite(m?.index) && m.index >= 0 && m.index < sampleLen)
    .map((m) => {
      const x = xForIndex(m.index);
      const y = Number.isFinite(m.value) ? yForValue(m.value) : zeroY;
      const color = m.color || "#E97B7B";
      const label = (m.label || "").slice(0, 24);
      const labelX = Math.min(Math.max(x + 6, 40), width - 6);
      const labelAnchor = x > width - 120 ? "end" : "start";
      const labelXAnchored = labelAnchor === "end" ? Math.min(x - 6, width - 6) : labelX;
      return `
        <g class="ff-chart-marker">
          <line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${height}" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity="0.75" />
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" fill="${color}" stroke="#1b1120" stroke-width="1.5" />
          ${label ? `<text x="${labelXAnchored.toFixed(2)}" y="14" fill="${color}" font-size="11" text-anchor="${labelAnchor}">${label}</text>` : ""}
        </g>`;
    })
    .join("");

  container.innerHTML = `
    <svg class="ff-chart-svg" viewBox="0 0 ${width} ${height + 40}" role="img" aria-label="${options.title || "Multi Line Chart"}" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(242,237,230,0.35)" />
      ${min < 0 ? `<line x1="0" y1="${zeroY.toFixed(2)}" x2="${width}" y2="${zeroY.toFixed(2)}" stroke="rgba(242,237,230,0.25)" stroke-dasharray="4 4" />` : ""}
      ${paths}
      ${markers}
      <text x="0" y="12" fill="#CFC6BB" font-size="11">${Math.round(max).toLocaleString()}</text>
      <text x="0" y="${height}" fill="#CFC6BB" font-size="11">${Math.round(min).toLocaleString()}</text>
      ${legend}
      <text x="0" y="${height + 28}" fill="#CFC6BB" font-size="10">${labels?.[0] || "Start"}</text>
      <text x="${width - 20}" y="${height + 28}" fill="#CFC6BB" font-size="10" text-anchor="end">${labels?.[labels.length - 1] || "End"}</text>
    </svg>
  `;
}
