export function formatMoney(value) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

export function formatNumber(value, digits = 0) {
  return Number(value || 0).toFixed(digits);
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
