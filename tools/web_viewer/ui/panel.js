export function setPanelText(elementId, text) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = text;
}

export function setPanelHtml(elementId, html) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.innerHTML = html;
}
