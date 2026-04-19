function buildPath(data, width, height, min, max) {
  if (!data.length) return "";
  const span = Math.max(1, max - min);
  return data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function renderLineChart(container, series, labels, options = {}) {
  if (!container) return;
  const data = Array.isArray(series) ? series : [];
  if (!data.length) {
    container.innerHTML = `<div class="ff-chart-empty">No chart data yet.</div>`;
    return;
  }

  const width = 640;
  const height = 240;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const path = buildPath(data, width, height, min, max);
  const stroke = options.stroke || "#C6A16E";

  container.innerHTML = `
    <svg class="ff-chart-svg" viewBox="0 0 ${width} ${height + 40}" role="img" aria-label="${options.title || "Chart"}">
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(242,237,230,0.35)" />
      <line x1="0" y1="0" x2="0" y2="${height}" stroke="rgba(242,237,230,0.2)" />
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />
      <text x="0" y="${height + 22}" fill="#CFC6BB" font-size="12">${labels?.[0] || "Start"}</text>
      <text x="${width - 20}" y="${height + 22}" fill="#CFC6BB" font-size="12" text-anchor="end">${labels?.[labels.length - 1] || "End"}</text>
      <text x="0" y="12" fill="#CFC6BB" font-size="12">${Math.round(max)}</text>
      <text x="0" y="${height}" fill="#CFC6BB" font-size="12">${Math.round(min)}</text>
    </svg>
  `;
}

export function renderBarChart(container, values, labels, options = {}) {
  if (!container) return;
  const data = Array.isArray(values) ? values : [];
  if (!data.length) {
    container.innerHTML = `<div class="ff-chart-empty">No chart data yet.</div>`;
    return;
  }

  const max = Math.max(...data, 1);
  const bars = data
    .map((value, index) => {
      const heightPct = (Math.max(0, value) / max) * 100;
      return `<div class="ff-bar" style="height:${heightPct}%"><span>${labels[index] || `Q${index + 1}`}</span></div>`;
    })
    .join("");

  container.innerHTML = `<div class="ff-bars">${bars}</div>`;
}
