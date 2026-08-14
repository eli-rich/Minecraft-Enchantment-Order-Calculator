export const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const selected = (condition: boolean) => (condition ? ' selected' : '');
export const checked = (condition: boolean) => (condition ? ' checked' : '');
