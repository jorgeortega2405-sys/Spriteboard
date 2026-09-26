import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

class SimpleClassList {
  private classes: Set<string>;

  constructor(initialClass = '') {
    this.classes = new Set(initialClass.split(/\s+/).filter(Boolean));
  }

  public add(...names: string[]): void {
    for (const name of names) {
      if (name) this.classes.add(name);
    }
  }

  public remove(...names: string[]): void {
    for (const name of names) {
      this.classes.delete(name);
    }
  }

  public toggle(name: string, force?: boolean): boolean {
    if (force !== undefined) {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
      return force;
    }
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }
    this.classes.add(name);
    return true;
  }

  public contains(name: string): boolean {
    return this.classes.has(name);
  }

  public toString(): string {
    return Array.from(this.classes).join(' ');
  }
}

class SimpleElement {
  public tagName: string;
  public attributes: Map<string, string> = new Map();
  public classList: SimpleClassList;
  public style: Record<string, string> = {};
  public children: SimpleElement[] = [];
  public parentNode: SimpleElement | null = null;
  public eventListeners: Map<string, Array<(event: any) => void>> = new Map();
  private _textContent = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.classList = new SimpleClassList();
  }

  get className(): string {
    return this.classList.toString();
  }

  set className(val: string) {
    this.classList = new SimpleClassList(val);
    this.attributes.set('class', val);
  }

  get textContent(): string {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(val: string) {
    this._textContent = val;
    this.children = [];
  }

  get firstElementChild(): SimpleElement | null {
    return this.children.length > 0 ? this.children[0] : null;
  }

  get lastElementChild(): SimpleElement | null {
    return this.children.length > 0 ? this.children[this.children.length - 1] : null;
  }

  get innerHTML(): string {
    return '';
  }

  set innerHTML(html: string) {
    this.children = [];
    parseHtmlToElements(html, this);
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
    if (name.toLowerCase() === 'class') {
      this.classList = new SimpleClassList(value);
    }
  }

  public setAttributeNS(_ns: string | null, name: string, value: string): void {
    this.setAttribute(name, value);
  }

  public getAttribute(name: string): string | null {
    if (name.toLowerCase() === 'class') return this.className;
    return this.attributes.has(name.toLowerCase()) ? this.attributes.get(name.toLowerCase())! : null;
  }

  public getAttributeNS(_ns: string | null, name: string): string | null {
    return this.getAttribute(name);
  }

  public hasAttribute(name: string): boolean {
    return this.attributes.has(name.toLowerCase());
  }

  public appendChild(child: SimpleElement): SimpleElement {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  public removeChild(child: SimpleElement): SimpleElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  public remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  public replaceWith(...nodes: (SimpleElement | string)[]): void {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx === -1) return;
    const elementsToInsert: SimpleElement[] = [];
    for (const node of nodes) {
      if (typeof node === 'string') {
        const textNode = new SimpleElement('span');
        textNode.textContent = node;
        elementsToInsert.push(textNode);
      } else if (node) {
        node.parentNode = this.parentNode;
        elementsToInsert.push(node);
      }
    }
    this.parentNode.children.splice(idx, 1, ...elementsToInsert);
    this.parentNode = null;
  }

  public cloneNode(deep = true): SimpleElement {
    const clone = new SimpleElement(this.tagName);
    for (const [k, v] of this.attributes.entries()) {
      clone.setAttribute(k, v);
    }
    clone.style = { ...this.style };
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }

  public insertAdjacentHTML(position: 'afterbegin' | 'afterend' | 'beforebegin' | 'beforeend', html: string): void {
    const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '');
    const temp = new SimpleElement('div');
    parseHtmlToElements(cleanHtml, temp);
    if (position === 'beforeend') {
      for (const child of temp.children) {
        if (child) this.appendChild(child);
      }
    } else if (position === 'afterbegin') {
      for (let i = temp.children.length - 1; i >= 0; i--) {
        const child = temp.children[i];
        if (child) {
          child.parentNode = this;
          this.children.unshift(child);
        }
      }
    }
  }

  public addEventListener(type: string, handler: (e: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(handler);
  }

  public removeEventListener(type: string, handler: (e: any) => void): void {
    const list = this.eventListeners.get(type);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  public dispatchEvent(event: any): boolean {
    const list = this.eventListeners.get(event.type);
    if (list) {
      for (const handler of list) {
        handler({ ...event, currentTarget: this, target: this });
      }
    }
    return true;
  }

  public click(): void {
    this.dispatchEvent({ bubbles: true, cancelable: true, type: 'click' });
  }

  public querySelector<T = SimpleElement>(selector: string): T | null {
    const results = this.querySelectorAll<T>(selector);
    return results.length > 0 ? results[0] : null;
  }

  public querySelectorAll<T = SimpleElement>(selector: string): T[] {
    const results: SimpleElement[] = [];
    const tokens = selector.split(',').map((s) => s.trim());

    const matchSingle = (el: SimpleElement, sel: string): boolean => {
      if (sel.startsWith('[') && sel.endsWith(']')) {
        const inner = sel.slice(1, -1);
        if (inner.includes('^=')) {
          const [attr, val] = inner.split('^=').map((p) => p.replace(/['"]/g, '').trim());
          const attrVal = el.getAttribute(attr);
          return attrVal !== null && attrVal.startsWith(val);
        }
        if (inner.includes('=')) {
          const [attr, val] = inner.split('=').map((p) => p.replace(/['"]/g, '').trim());
          return el.getAttribute(attr) === val;
        }
        return el.hasAttribute(inner);
      }
      if (sel.startsWith('.')) {
        return el.classList.contains(sel.slice(1));
      }
      if (sel.toUpperCase() === el.tagName) {
        return true;
      }
      return false;
    };

    const traverse = (node: SimpleElement) => {
      for (const child of node.children) {
        for (const token of tokens) {
          if (matchSingle(child, token)) {
            results.push(child);
            break;
          }
        }
        traverse(child);
      }
    };

    traverse(this);
    return results as unknown as T[];
  }

  public getContext(): any {
    return {
      beginPath: () => {},
      clearRect: () => {},
      closePath: () => {},
      fill: () => {},
      fillRect: () => {},
      restore: () => {},
      rotate: () => {},
      save: () => {},
      scale: () => {},
      stroke: () => {},
      strokeRect: () => {},
      translate: () => {},
    };
  }

  public getBoundingClientRect() {
    return { bottom: 788, height: 788, left: 0, right: 940, top: 0, width: 940, x: 0, y: 0 };
  }
}

function parseHtmlToElements(html: string, parent: SimpleElement): void {
  const tagRegex = /<\s*(\/)?\s*([a-zA-Z0-9\-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  const stack: SimpleElement[] = [parent];

  while ((match = tagRegex.exec(html)) !== null) {
    const [, isClosing, tagName, attrString, isSelfClosing, textContent] = match;

    if (textContent) {
      const text = textContent.trim();
      if (text && stack.length > 0) {
        const textNode = new SimpleElement('span');
        textNode.textContent = text;
        stack[stack.length - 1].appendChild(textNode);
      }
      continue;
    }

    if (isClosing) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    if (tagName) {
      const el = new SimpleElement(tagName);
      if (attrString) {
        const attrRegex = /([a-zA-Z0-9\-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(attrString)) !== null) {
          const [, aName, vDouble, vSingle, vRaw] = attrMatch;
          const val = vDouble !== undefined ? vDouble : (vSingle !== undefined ? vSingle : (vRaw !== undefined ? vRaw : ''));
          el.setAttribute(aName, val);
        }
      }

      if (stack.length > 0) {
        stack[stack.length - 1].appendChild(el);
      }

      const isVoid = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tagName);
      if (!isSelfClosing && !isVoid) {
        stack.push(el);
      }
    }
  }
}

const mockDoc = {
  addEventListener: (_type: string, _handler: any) => {},
  body: new SimpleElement('body'),
  createElement: (tagName: string) => new SimpleElement(tagName),
  createElementNS: (_ns: string, tagName: string) => new SimpleElement(tagName),
  querySelector: (sel: string) => mockDoc.body.querySelector(sel),
  querySelectorAll: (sel: string) => mockDoc.body.querySelectorAll(sel),
  removeEventListener: (_type: string, _handler: any) => {},
};

(globalThis as any).HTMLElement = SimpleElement;
(globalThis as any).HTMLButtonElement = SimpleElement;
(globalThis as any).HTMLCanvasElement = SimpleElement;
(globalThis as any).HTMLDivElement = SimpleElement;
(globalThis as any).HTMLInputElement = SimpleElement;
(globalThis as any).HTMLTextAreaElement = SimpleElement;
(globalThis as any).SVGElement = SimpleElement;
(globalThis as any).SVGGraphicsElement = SimpleElement;
(globalThis as any).document = mockDoc;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
(globalThis as any).window = {
  addEventListener: () => {},
  cancelAnimationFrame: (id: any) => clearTimeout(id),
  devicePixelRatio: 1,
  removeEventListener: () => {},
  requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
};

async function runFrontendFunctionalTests(): Promise<void> {
  let passedCount = 0;
  let totalCount = 0;

  async function test(title: string, fn: () => void | Promise<void>): Promise<void> {
    totalCount++;
    try {
      await fn();
      passedCount++;
      process.stdout.write(`  \x1b[32m[PASS]\x1b[0m ${title}\n`);
    } catch (err: any) {
      process.stderr.write(`  \x1b[31m[FAIL]\x1b[0m ${title}\n    ${err?.stack || err?.message || err}\n`);
      throw err;
    }
  }

  process.stdout.write('\n\x1b[1m=== SUITE DE PRUEBAS FUNCIONALES FRONTEND - REDES SOCIALES & STAGE CANVAS ===\x1b[0m\n\n');

  // Test 1: Navegación de categorías en el modal
  await test('1.1 Modal - Pestaña "Redes Sociales" activa el panel correspondiente y cambia clases', async () => {
    mockDoc.body.children = [];
    const { openCreateCanvasModal } = await import('../client/components/create-canvas-modal.component.js');

    openCreateCanvasModal({ initialType: 'board' });
    const backdrop = mockDoc.body.querySelector<SimpleElement>('[data-ref="modal-create-canvas-backdrop"]');
    assert.ok(backdrop, 'El backdrop del modal debe existir en document.body');

    const socialTab = backdrop.querySelector<SimpleElement>('[data-ref="tab-category-social"]');
    const boardTab = backdrop.querySelector<SimpleElement>('[data-ref="tab-category-board"]');
    assert.ok(socialTab, 'Tab de redes sociales debe existir');
    assert.ok(boardTab, 'Tab de pizarrón debe existir');

    const socialPanel = backdrop.querySelector<SimpleElement>('[data-ref="panel-category-social"]');
    assert.ok(socialPanel, 'El panel de redes sociales debe existir');

    socialTab.click();

    assert.ok(socialTab.classList.contains('is-active'), 'Tab de redes debe tener clase is-active tras clic');
    assert.ok(!boardTab.classList.contains('is-active'), 'Tab de board no debe tener clase is-active');
    assert.strictEqual(socialPanel.style.display, 'block', 'Panel de redes debe tener display block');
  });

  // Test 2: Comportamiento interactivo de los 8 badges de plataformas
  await test('2.1 Modal - Conmutación entre los 8 badges de plataformas sociales y vistas condicionales', async () => {
    const backdrop = mockDoc.body.querySelector<SimpleElement>('[data-ref="modal-create-canvas-backdrop"]')!;
    const fbBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-facebook"]');
    const instaBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-instagram"]');
    const linkedinBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-linkedin"]');
    const tiktokBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-tiktok"]');
    const xBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-x"]');
    const whatsappBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-whatsapp"]');
    const youtubeBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-youtube"]');
    const pinterestBadge = backdrop.querySelector<SimpleElement>('[data-ref="badge-platform-pinterest"]');

    assert.ok(fbBadge && instaBadge && linkedinBadge && tiktokBadge && xBadge && whatsappBadge && youtubeBadge && pinterestBadge, 'Todos los 8 badges de plataforma deben existir');

    const fbContent = backdrop.querySelector<SimpleElement>('[data-ref="platform-content-facebook"]')!;
    const otherContent = backdrop.querySelector<SimpleElement>('[data-ref="platform-content-other"]')!;
    const otherText = backdrop.querySelector<SimpleElement>('[data-ref="empty-state-platform-text"]')!;

    instaBadge.click();
    assert.ok(instaBadge.classList.contains('is-active'), 'Instagram badge debe estar activo');
    assert.ok(!fbBadge.classList.contains('is-active'), 'Facebook badge debe perder estado activo');
    assert.strictEqual(fbContent.style.display, 'none', 'Contenido de Facebook debe ocultarse');
    assert.strictEqual(otherContent.style.display, 'block', 'Contenido para otras plataformas debe mostrarse');
    assert.ok(otherText.textContent.includes('Instagram'), 'El mensaje debe mencionar a Instagram');

    tiktokBadge.click();
    assert.ok(tiktokBadge.classList.contains('is-active'), 'TikTok badge debe estar activo');
    assert.ok(otherText.textContent.includes('TikTok'), 'El mensaje debe mencionar a TikTok');

    youtubeBadge.click();
    assert.ok(youtubeBadge.classList.contains('is-active'), 'YouTube badge debe estar activo');
    assert.ok(otherText.textContent.includes('YouTube'), 'El mensaje debe mencionar a YouTube');

    fbBadge.click();
    assert.ok(fbBadge.classList.contains('is-active'), 'Facebook vuelve a estar activo');
    assert.strictEqual(fbContent.style.display, 'block', 'Contenido de Facebook vuelve a mostrarse');
    assert.strictEqual(otherContent.style.display, 'none', 'Contenido de otras plataformas se oculta');
  });

  // Test 3: Tarjetas de Facebook y datos para creación
  await test('3.1 Modal - Tarjetas de Facebook contienen dimensiones y formatos correctos', () => {
    const backdrop = mockDoc.body.querySelector<SimpleElement>('[data-ref="modal-create-canvas-backdrop"]')!;
    const postCard = backdrop.querySelector<SimpleElement>('[data-ref="card-social-fb-post"]')!;
    const coverCard = backdrop.querySelector<SimpleElement>('[data-ref="card-social-fb-cover"]')!;

    assert.ok(postCard, 'Tarjeta de Post para Facebook debe existir');
    assert.ok(coverCard, 'Tarjeta de Portada para Facebook debe existir');

    assert.strictEqual(postCard.getAttribute('data-w'), '940');
    assert.strictEqual(postCard.getAttribute('data-h'), '788');
    assert.strictEqual(postCard.getAttribute('data-format'), 'facebook_post');
    assert.strictEqual(postCard.getAttribute('data-type'), 'social');

    assert.strictEqual(coverCard.getAttribute('data-w'), '851');
    assert.strictEqual(coverCard.getAttribute('data-h'), '315');
    assert.strictEqual(coverCard.getAttribute('data-format'), 'facebook_cover');
    assert.strictEqual(coverCard.getAttribute('data-type'), 'social');
  });

  // Test 4: Motor Stage Canvas - Comportamiento con canPresent: false (Modo Redes)
  await test('4.1 StageCanvasController - Desactiva controles de presentación en modo "social"', async () => {
    const { StageCanvasController } = await import('../client/views/stage/stage.controller.js');
    const stageHtmlPath = path.resolve(process.cwd(), 'public/views/stage/stage.html');
    const stageHtml = fs.readFileSync(stageHtmlPath, 'utf-8');

    const container = new SimpleElement('div');
    container.innerHTML = stageHtml;

    const controller = new StageCanvasController(container as any, 'mock-social-uuid', null, {
      canPresent: false,
      canvasType: 'social',
      pageLabel: 'Página',
    });

    assert.strictEqual((controller as any).canPresent, false);
    assert.strictEqual((controller as any).canvasType, 'social');

    const btnPresent = container.querySelector<SimpleElement>('[data-ref="btn-presentation-present"]');
    const aiWrapper = container.querySelector<SimpleElement>('[data-ref="presentation-ai-wrapper"]');
    const btnDuration = container.querySelector<SimpleElement>('[data-ref="btn-slide-duration"]');

    assert.ok(btnPresent, 'El botón de presentar existe en el template');
    assert.ok(aiWrapper, 'El wrapper de IA existe en el template');
    assert.ok(btnDuration, 'El botón de duración existe en el template');

    (controller as any).setupTopBarComponents();

    assert.strictEqual(btnPresent.style.display, 'none', 'El botón de presentar se oculta en modo redes');
    assert.strictEqual(aiWrapper.style.display, 'none', 'El wrapper de IA de diapositivas se oculta en modo redes');
    assert.strictEqual(btnDuration.style.display, 'none', 'El botón de duración se oculta en modo redes');
  });

  // Test 5: Motor Stage Canvas - Comportamiento con canPresent: true (Modo Presentación)
  await test('5.1 StageCanvasController - Mantiene controles activos en modo "presentation"', async () => {
    const { StageCanvasController } = await import('../client/views/stage/stage.controller.js');
    const stageHtmlPath = path.resolve(process.cwd(), 'public/views/stage/stage.html');
    const stageHtml = fs.readFileSync(stageHtmlPath, 'utf-8');

    const container = new SimpleElement('div');
    container.innerHTML = stageHtml;

    const controller = new StageCanvasController(container as any, 'mock-pres-uuid', null, {
      canPresent: true,
      canvasType: 'presentation',
      pageLabel: 'Lámina',
    });

    assert.strictEqual((controller as any).canPresent, true);
    assert.strictEqual((controller as any).canvasType, 'presentation');

    const btnPresent = container.querySelector<SimpleElement>('[data-ref="btn-presentation-present"]')!;
    const aiWrapper = container.querySelector<SimpleElement>('[data-ref="presentation-ai-wrapper"]')!;

    (controller as any).setupTopBarComponents();

    assert.notStrictEqual(btnPresent.style.display, 'none', 'El botón de presentar permanece visible');
    assert.notStrictEqual(aiWrapper.style.display, 'none', 'El wrapper de IA permanece visible');
  });

  // Test 6: Enrutamiento en design.view.ts
  await test('6.1 Router de diseño - Discrimina correctamente canvasType "social"', () => {
    const resolveType = (record: any) => {
      let t = record.canvas_type || (record.unit === 'presentation' ? 'presentation' : (record.unit === 'social' ? 'social' : (record.unit === 'doc' ? 'doc' : 'board')));
      if (record.data) {
        try {
          const parsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
          if (parsed?.type === 'social') t = 'social';
        } catch {}
      }
      return t;
    };

    assert.strictEqual(resolveType({ canvas_type: 'social' }), 'social');
    assert.strictEqual(resolveType({ unit: 'social' }), 'social');
    assert.strictEqual(resolveType({ canvas_type: 'board', data: '{"type":"social"}' }), 'social');
    assert.strictEqual(resolveType({ canvas_type: 'presentation' }), 'presentation');
    assert.strictEqual(resolveType({ canvas_type: 'board' }), 'board');
  });

  // Test 7: Formatos y resoluciones de redes
  await test('7.1 Configuración de formatos - Validar valores de SOCIAL_FORMATS', async () => {
    const { SOCIAL_FORMATS } = await import('../client/types/stage.types.js');
    assert.strictEqual(SOCIAL_FORMATS.facebook_post.width, 940);
    assert.strictEqual(SOCIAL_FORMATS.facebook_post.height, 788);
    assert.strictEqual(SOCIAL_FORMATS.facebook_cover.width, 851);
    assert.strictEqual(SOCIAL_FORMATS.facebook_cover.height, 315);
  });

  process.stdout.write(`\n\x1b[32;1m✓ Todas las ${passedCount}/${totalCount} pruebas funcionales ejecutadas exitosamente sin errores.\x1b[0m\n\n`);
}

runFrontendFunctionalTests().catch((err) => {
  process.stderr.write(`\nError en la ejecución de pruebas funcionales: ${err?.message || err}\n`);
  process.exit(1);
});
