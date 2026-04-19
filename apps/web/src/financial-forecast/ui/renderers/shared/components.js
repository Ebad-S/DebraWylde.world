export function badge(kind, text) {
  return `<span class="ff-badge ff-badge--${kind}">${text}</span>`;
}

export function panel(title, content, extraClass = "") {
  return `<section class="ff-panel ${extraClass}"><h3>${title}</h3>${content}</section>`;
}

export function statCard(label, value, helper = "") {
  return `
    <article class="ff-stat-card">
      <p class="ff-stat-card__label">${label}</p>
      <p class="ff-stat-card__value">${value}</p>
      ${helper ? `<p class="ff-stat-card__helper">${helper}</p>` : ""}
    </article>
  `;
}
