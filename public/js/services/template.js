const templateCache = new Map();

/**
 * Carga un archivo HTML de vista o componente y lo retorna como elemento del DOM
 * @param {string} url - Ruta del archivo HTML (ej: '/views/auth/login.html')
 * @returns {Promise<HTMLElement>}
 */
export async function loadTemplate(url) {
  let html = templateCache.get(url);
  if (!html) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error al cargar la plantilla: ${url} (${res.status})`);
    }
    html = await res.text();
    templateCache.set(url, html);
  }

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const element = template.content.firstElementChild;
  if (!element) {
    throw new Error(`Plantilla vacía o inválida: ${url}`);
  }

  return element.cloneNode(true);
}
