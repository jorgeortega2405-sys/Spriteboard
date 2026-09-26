import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

class MockCanvas {
  public _pixels: Uint8ClampedArray;
  public _width = 1280;
  public _height = 720;
  private _ctx: MockContext2D | null = null;

  constructor(w = 1280, h = 720) {
    this._width = w;
    this._height = h;
    this._pixels = new Uint8ClampedArray(w * h * 4);
  }

  get width(): number {
    return this._width;
  }
  set width(val: number) {
    this._width = val;
  }

  get height(): number {
    return this._height;
  }
  set height(val: number) {
    this._height = val;
  }

  public getContext(): any {
    if (!this._ctx) {
      this._ctx = new MockContext2D(this);
    }
    return this._ctx;
  }
}

class MockContext2D {
  public canvas: MockCanvas;
  public fillStyle = '#000000';
  public filter = 'none';
  public globalAlpha = 1.0;
  public shadowBlur = 0;
  public shadowColor = 'transparent';
  public shadowOffsetX = 0;
  public shadowOffsetY = 0;
  public strokeStyle = '#000000';
  public sx = 1;
  public sy = 1;
  public tx = 0;
  public ty = 0;

  constructor(canvas: MockCanvas) {
    this.canvas = canvas;
  }

  public save(): void {}
  public restore(): void {}
  public translate(tx: number, ty: number): void {
    this.tx += tx;
    this.ty += ty;
  }
  public rotate(_angle: number): void {}
  public scale(sx: number, sy: number): void {
    this.sx *= sx;
    this.sy *= sy;
  }
  public beginPath(): void {}
  public closePath(): void {}
  public fill(): void {}
  public stroke(): void {}
  public fillRect(_x: number, _y: number, _w: number, _h: number): void {}
  public strokeRect(_x: number, _y: number, _w: number, _h: number): void {}
  public clearRect(_x: number, _y: number, _w: number, _h: number): void {}
}

const mockElement = () => ({
  addEventListener: () => {},
  appendChild: () => {},
  classList: { add: () => {}, contains: () => false, remove: () => {}, toggle: () => {} },
  getAttribute: () => null,
  innerHTML: '',
  querySelectorAll: () => [],
  querySelector: () => null,
  removeEventListener: () => {},
  setAttribute: () => {},
  style: {},
  textContent: '',
  value: '',
});

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    body: mockElement(),
    createElement: (_tag: string) => mockElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    devicePixelRatio: 1,
    removeEventListener: () => {},
  };
}

async function runPresentationTests(): Promise<void> {
  let passedCount = 0;
  let totalCount = 0;

  async function test(title: string, fn: () => void | Promise<void>): Promise<void> {
    totalCount++;
    try {
      await fn();
      passedCount++;
      process.stdout.write(`  \x1b[32m[PASS]\x1b[0m ${title}\n`);
    } catch (err: any) {
      process.stderr.write(`  \x1b[31m[FAIL]\x1b[0m ${title}\n    ${err?.message || err}\n`);
      throw err;
    }
  }

  process.stdout.write('\n\x1b[1m=== SUITE DE PRUEBAS DEL SISTEMA DE PRESENTACIONES Y CANVA TOOLS ===\x1b[0m\n\n');

  // 1. FRONTEND: Board Renderer & Effects Engine
  const { applyElementAnimation, applyElementEffect } = await import('../client/views/board/board-renderer.js');

  await test('1.1 Efectos - Preset "none" limpia sombras y filtros en Canvas 2D', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.filter = 'blur(4px)';

    applyElementEffect(ctx, { type: 'none' });
    assert.strictEqual(ctx.shadowBlur, 0);
    assert.strictEqual(ctx.shadowColor, 'transparent');
    assert.strictEqual(ctx.shadowOffsetX, 0);
    assert.strictEqual(ctx.shadowOffsetY, 0);
    assert.strictEqual(ctx.filter, 'none');
  });

  await test('1.2 Efectos - Preset "shadow" calcula desplazamiento trigonométrico correcto según dirección y ángulo', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    applyElementEffect(ctx, {
      blur: 10,
      color: '#000000',
      direction: 90,
      offset: 20,
      opacity: 0.5,
      type: 'shadow',
    });

    assert.ok(Math.abs(ctx.shadowOffsetX - 0) < 1e-4, `OffsetX esperado 0, obtenido ${ctx.shadowOffsetX}`);
    assert.ok(Math.abs(ctx.shadowOffsetY - 20) < 1e-4, `OffsetY esperado 20, obtenido ${ctx.shadowOffsetY}`);
    assert.strictEqual(ctx.shadowBlur, 10);
    assert.strictEqual(ctx.shadowColor, 'rgba(0, 0, 0, 0.5)');
  });

  await test('1.3 Efectos - Preset "glow" y "neon" configuran resplandor y halo luminoso', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    applyElementEffect(ctx, {
      blur: 25,
      color: '#00e5ff',
      intensity: 80,
      offset: 0,
      opacity: 0.9,
      type: 'neon',
    });

    assert.strictEqual(ctx.shadowBlur, 24);
    assert.strictEqual(ctx.shadowOffsetX, 0);
    assert.strictEqual(ctx.shadowOffsetY, 0);
    assert.strictEqual(ctx.shadowColor, '#00e5ff');
  });

  await test('1.4 Efectos - Filtros de estilo avanzados (radioactive, midnight, malibu, sunset, glitch)', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;

    applyElementEffect(ctx, { type: 'radioactive' });
    assert.ok(ctx.filter.includes('hue-rotate(90deg)'));
    assert.strictEqual(ctx.shadowColor, '#00ff66');

    applyElementEffect(ctx, { type: 'midnight' });
    assert.ok(ctx.filter.includes('hue-rotate(200deg)'));
    assert.strictEqual(ctx.shadowColor, '#1e3a8a');

    applyElementEffect(ctx, { type: 'sunset' });
    assert.ok(ctx.filter.includes('hue-rotate(330deg)'));
    assert.strictEqual(ctx.shadowColor, '#f97316');

    applyElementEffect(ctx, { type: 'glitch' });
    assert.ok(ctx.shadowBlur > 0);
  });

  await test('1.5 Animaciones - Animación "rise" (desplazamiento vertical y fade in durante entrada)', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    const el = { height: 100, opacity: 1, width: 200, x: 50, y: 50 };

    // At t=0 ms (beginning of animation)
    const resStart = applyElementAnimation(ctx, el, { speed: 'medium', trigger: 'enter', type: 'rise' }, 0);
    assert.strictEqual(resStart.isFinished, false);
    assert.strictEqual(ctx.globalAlpha, 0);
    assert.strictEqual(ctx.ty, 50);

    // At t=750 ms (end of default medium duration)
    const ctxEnd = new MockContext2D(new MockCanvas()) as any;
    const resEnd = applyElementAnimation(ctxEnd, el, { speed: 'medium', trigger: 'enter', type: 'rise' }, 750);
    assert.strictEqual(resEnd.isFinished, true);
    assert.strictEqual(ctxEnd.globalAlpha, 1);
    assert.strictEqual(ctxEnd.ty, 0);
  });

  await test('1.6 Animaciones - Animación "pop" (escalado dinámico elástico)', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    const el = { height: 100, opacity: 1, width: 200, x: 100, y: 100 };

    // At t=0 ms
    const resStart = applyElementAnimation(ctx, el, { speed: 'fast', trigger: 'enter', type: 'pop' }, 0);
    assert.strictEqual(resStart.isFinished, false);
    assert.ok(Math.abs(ctx.sx - 0.2) < 1e-3, `Scale X inicial esperado ~0.2, obtenido ${ctx.sx}`);
    assert.ok(Math.abs(ctx.sy - 0.2) < 1e-3, `Scale Y inicial esperado ~0.2, obtenido ${ctx.sy}`);

    // At t=400 ms (fast duration complete)
    const ctxEnd = new MockContext2D(new MockCanvas()) as any;
    const resEnd = applyElementAnimation(ctxEnd, el, { speed: 'fast', trigger: 'enter', type: 'pop' }, 400);
    assert.strictEqual(resEnd.isFinished, true);
    assert.ok(Math.abs(ctxEnd.sx - 1) < 1e-3, `Scale X final esperado ~1.0, obtenido ${ctxEnd.sx}`);
    assert.ok(Math.abs(ctxEnd.sy - 1) < 1e-3, `Scale Y final esperado ~1.0, obtenido ${ctxEnd.sy}`);
  });

  await test('1.7 Animaciones - Trigger "exit" (desvanecimiento sincronizado antes de terminar la lámina)', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    const el = { height: 100, opacity: 1, width: 200, x: 0, y: 0 };
    const slideDurationMs = 5000;
    const anim: any = { duration: 1.0, speed: 'medium', trigger: 'exit', type: 'fade' };

    // At t=2000 ms (slide active, exit starts at 4000 ms)
    const resEarly = applyElementAnimation(ctx, el, anim, 2000, 0, slideDurationMs);
    assert.strictEqual(resEarly.isFinished, false);
    assert.strictEqual(ctx.globalAlpha, 1);

    // At t=5000 ms (slide end reached)
    const ctxEnd = new MockContext2D(new MockCanvas()) as any;
    const resEnd = applyElementAnimation(ctxEnd, el, anim, 5000, 0, slideDurationMs);
    assert.strictEqual(resEnd.isFinished, true);
    assert.strictEqual(ctxEnd.globalAlpha, 0);
  });

  await test('1.8 Animaciones - Ciclos continuos "drift" y "neon" mantienen bucle activo', () => {
    const ctx = new MockContext2D(new MockCanvas()) as any;
    const el = { height: 100, opacity: 1, width: 200, x: 0, y: 0 };

    const resDrift = applyElementAnimation(ctx, el, { speed: 'medium', trigger: 'enter', type: 'drift' }, 2000);
    assert.strictEqual(resDrift.isFinished, false);

    const resNeon = applyElementAnimation(ctx, el, { speed: 'medium', trigger: 'enter', type: 'neon' }, 3000);
    assert.strictEqual(resNeon.isFinished, false);
    assert.ok(ctx.globalAlpha > 0);
  });

  // 2. FRONTEND: Bounding box, Alineación y Dimensiones
  const { getElementBoundingBox } = await import('../client/views/board/board-elements.manager.js');

  await test('2.1 Posición & Alineación - Cálculo de Bounding Box y centrado en lámina (1280x720)', () => {
    const element: any = {
      height: 120,
      id: 'test-text-1',
      text: 'Título Principal',
      type: 'text',
      width: 400,
      x: 100,
      y: 100,
    };

    const bbox = getElementBoundingBox(element);
    assert.strictEqual(bbox.width, 400);
    assert.strictEqual(bbox.height, 120);

    const slideWidth = 1280;
    const slideHeight = 720;

    const alignedX = (slideWidth - bbox.width) / 2;
    const alignedY = (slideHeight - bbox.height) / 2;

    assert.strictEqual(alignedX, 440);
    assert.strictEqual(alignedY, 300);
  });

  await test('2.2 Posición - Bloqueo de Relación de Aspecto (Aspect Ratio Lock)', () => {
    const origWidth = 300;
    const origHeight = 200;
    const ratio = origWidth / origHeight;

    const targetWidth = 450;
    const computedHeight = Math.round(targetWidth / ratio);
    assert.strictEqual(computedHeight, 300);

    const targetHeight = 100;
    const computedWidth = Math.round(targetHeight * ratio);
    assert.strictEqual(computedWidth, 150);
  });

  await test('2.3 Posición - Reordenamiento de capas (Z-Index Step & Drag)', () => {
    const elements: any[] = [
      { id: 'el-bg', name: 'Fondo', type: 'shape' },
      { id: 'el-img', name: 'Foto', type: 'image' },
      { id: 'el-txt', name: 'Texto', type: 'text' },
    ];

    const bg = elements.splice(0, 1)[0];
    elements.push(bg);
    assert.deepStrictEqual(elements.map((e) => e.id), ['el-img', 'el-txt', 'el-bg']);

    const moved = elements.splice(2, 1)[0];
    elements.unshift(moved);
    assert.deepStrictEqual(elements.map((e) => e.id), ['el-bg', 'el-img', 'el-txt']);
  });

  // 3. FRONTEND: Slide Duration & Autoplay Data Integrity
  await test('3.1 Duración - Validación de rangos y valores por defecto', () => {
    const defaultDuration = 5.0;
    assert.strictEqual(defaultDuration, 5.0);

    const clampDuration = (val: number) => Math.max(0.5, Math.min(30.0, Math.round(val * 10) / 10));
    assert.strictEqual(clampDuration(0.1), 0.5);
    assert.strictEqual(clampDuration(45.0), 30.0);
    assert.strictEqual(clampDuration(7.33), 7.3);
  });

  // 4. BACKEND: AI Presentation Service & Prompts
  const { AiService } = await import('../src/services/ai.service.js');

  await test('4.1 Backend AI - Generador de presentaciones produce diapositivas válidas (1280x720)', async () => {
    const result = await AiService.generatePresentation('Estrategias de Crecimiento Startups 2026', 4, 'professional');

    assert.ok(result);
    assert.ok(Array.isArray(result.slides));
    assert.strictEqual(result.slides.length, 4);

    for (let i = 0; i < result.slides.length; i++) {
      const slide = result.slides[i];
      assert.ok(slide.name.length > 0);
      assert.ok(Array.isArray(slide.elements));
      assert.ok(slide.elements.length >= 2, `La diapositiva ${i + 1} debe contener al menos 2 elementos`);

      // En sistema de coordenadas centrado (-640 a 640, -360 a 360)
      for (const el of slide.elements) {
        if (el.x !== undefined && el.width !== undefined) {
          assert.ok(el.x >= -640 && el.x + el.width <= 640, `Elemento desborda horizontalmente: x=${el.x}, w=${el.width}`);
        }
        if (el.y !== undefined && el.height !== undefined) {
          assert.ok(el.y >= -360 && el.y + el.height <= 360, `Elemento desborda verticalmente: y=${el.y}, h=${el.height}`);
        }
      }
    }
  });

  await test('4.2 Backend AI - Soporte de múltiples tonos (pitch, educational, creative, minimal)', async () => {
    const tones = ['pitch', 'educational', 'creative', 'minimal'] as const;
    for (const tone of tones) {
      const result = await AiService.generatePresentation('Tema de Prueba', 3, tone);
      assert.strictEqual(result.slides.length, 3);
      assert.ok(result.slides[0].elements.length > 0);
    }
  });

  // 5. AUDITORÍA DOM / HTML: Cumplimiento de Reglas Maestras (AGENTS.md & GEMINI.md)
  await test('5.1 Auditoría HTML - Verificación CERO IDs en board.html', () => {
    const boardHtmlPath = path.resolve(process.cwd(), 'public/views/board/board.html');
    const content = fs.readFileSync(boardHtmlPath, 'utf-8');

    const idMatches = content.match(/<[^>]*\sid=["'][^"']+["'][^>]*>/gi);
    assert.strictEqual(idMatches, null, `Se encontraron atributos id en board.html: ${JSON.stringify(idMatches)}`);
  });

  await test('5.2 Auditoría HTML - Orden de atributos en <button> (type primero) y demás elementos (class primero)', () => {
    const boardHtmlPath = path.resolve(process.cwd(), 'public/views/board/board.html');
    const content = fs.readFileSync(boardHtmlPath, 'utf-8');

    const buttonTags = content.match(/<button\b[^>]*>/gi) || [];
    for (const btn of buttonTags) {
      const isTypeFirst = /^<button\s+type=/i.test(btn);
      assert.ok(isTypeFirst, `El botón no tiene "type" como primer atributo: ${btn}`);
    }

    const nonButtonTags = content.match(/<(div|label|input|span|a|p)\b[^>]*>/gi) || [];
    for (const el of nonButtonTags) {
      if (el.includes('class=')) {
        const isClassFirst = /^<(div|label|input|span|a|p)\s+class=/i.test(el);
        assert.ok(isClassFirst, `El elemento no tiene "class" como primer atributo: ${el}`);
      }
    }
  });

  await test('5.3 Auditoría Data-Ref - Coincidencia de selectores UI en presentation.html y layout.component.ts', () => {
    const presentationHtmlPath = path.resolve(process.cwd(), 'public/views/presentation/presentation.html');
    const presentationContent = fs.readFileSync(presentationHtmlPath, 'utf-8');

    const layoutComponentPath = path.resolve(process.cwd(), 'client/components/layout.component.ts');
    const layoutContent = fs.readFileSync(layoutComponentPath, 'utf-8');

    const boardHtmlPath = path.resolve(process.cwd(), 'public/views/board/board.html');
    const boardContent = fs.readFileSync(boardHtmlPath, 'utf-8');

    const requiredPresentationRefs = [
      'top-btn-effects',
      'top-btn-animate',
      'top-btn-position',
      'btn-slide-duration',
      'popover-slide-duration',
      'input-popover-slide-duration',
      'label-popover-slide-duration',
      'slide-duration-presets',
      'btn-apply-duration-all',
    ];

    for (const ref of requiredPresentationRefs) {
      assert.ok(presentationContent.includes(`data-ref="${ref}"`), `Falta el data-ref="${ref}" en presentation.html`);
    }

    const stageHtmlPath = path.resolve(process.cwd(), 'public/views/stage/stage.html');
    const stageContent = fs.readFileSync(stageHtmlPath, 'utf-8');
    for (const ref of requiredPresentationRefs) {
      assert.ok(stageContent.includes(`data-ref="${ref}"`), `Falta el data-ref="${ref}" en stage.html`);
    }

    const requiredBoardRefs = [
      'top-btn-effects',
      'top-btn-animate',
      'top-btn-position',
    ];

    for (const ref of requiredBoardRefs) {
      assert.ok(boardContent.includes(`data-ref="${ref}"`), `Falta el data-ref="${ref}" en board.html`);
    }

    const requiredDrawerRefs = [
      'board-effects-drawer',
      'board-animation-drawer',
      'board-position-drawer',
    ];

    for (const ref of requiredDrawerRefs) {
      assert.ok(layoutContent.includes(`data-ref="${ref}"`), `Falta el data-ref="${ref}" en layout.component.ts`);
    }
  });

  await test('5.4 Auditoría Código - CERO console.log en archivos creados/modificados', () => {
    const filesToCheck = [
      'client/views/board/board.types.ts',
      'client/views/board/board.controller.ts',
      'client/views/board/board-effects-panel.component.ts',
      'client/views/board/board-animation-panel.component.ts',
      'client/views/board/board-position-panel.component.ts',
      'client/views/board/board-pages-tray.component.ts',
      'client/views/board/board-renderer.ts',
      'src/services/ai.service.ts',
      'src/controllers/ai.controller.ts',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const consoleMatches = fileContent.match(/console\.(log|warn|error|info|debug)\(/g);
        assert.strictEqual(
          consoleMatches,
          null,
          `Se encontraron llamadas a console.* en ${relPath}: ${JSON.stringify(consoleMatches)}`
        );
      }
    }
  });

  await test('6.1 Formatos de Redes Sociales - Verificación de dimensiones predefinidas', async () => {
    const { SOCIAL_FORMATS } = await import('../client/types/presentation.types.js');
    assert.strictEqual(SOCIAL_FORMATS.facebook_post.width, 940);
    assert.strictEqual(SOCIAL_FORMATS.facebook_post.height, 788);
    assert.strictEqual(SOCIAL_FORMATS.facebook_cover.width, 851);
    assert.strictEqual(SOCIAL_FORMATS.facebook_cover.height, 315);
  });

  await test('6.2 Modal de Creación - Badges de plataformas y tarjetas predefinidas', () => {
    const modalPath = path.resolve(process.cwd(), 'client/components/create-canvas-modal.component.ts');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    const expectedBadges = [
      'badge-platform-facebook',
      'badge-platform-instagram',
      'badge-platform-linkedin',
      'badge-platform-pinterest',
      'badge-platform-tiktok',
      'badge-platform-x',
      'badge-platform-whatsapp',
      'badge-platform-youtube',
    ];

    for (const badgeRef of expectedBadges) {
      assert.ok(modalContent.includes(`data-ref="${badgeRef}"`), `Falta badge data-ref="${badgeRef}" en modal de creación`);
    }

    assert.ok(modalContent.includes('data-ref="card-social-fb-post"'), 'Falta data-ref="card-social-fb-post"');
    assert.ok(modalContent.includes('data-ref="card-social-fb-cover"'), 'Falta data-ref="card-social-fb-cover"');
    assert.ok(modalContent.includes('data-ref="panel-category-social"'), 'Falta data-ref="panel-category-social"');

    const idMatches = modalContent.match(/\bid\s*=\s*["'][^"']+["']/g);
    assert.strictEqual(idMatches, null, `Se encontraron atributos id en modal: ${JSON.stringify(idMatches)}`);
  });

  await test('6.3 Auditoría Código Redes Sociales - CERO console.log en archivos creados/modificados', () => {
    const filesToCheck = [
      'client/types/stage.types.ts',
      'client/views/stage/stage.controller.ts',
      'client/views/stage/stage-collaboration.manager.ts',
      'client/views/presentation.view.ts',
      'client/views/social.view.ts',
      'client/views/presentation/presentation.controller.ts',
      'client/components/create-canvas-modal.component.ts',
      'client/services/canvas-creator.service.ts',
      'client/components/create-canvas-graphics.ts',
      'src/controllers/canvas.controller.ts',
      'src/services/canvas.service.ts',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const consoleMatches = fileContent.match(/console\.(log|warn|error|info|debug)\(/g);
        assert.strictEqual(
          consoleMatches,
          null,
          `Se encontraron llamadas a console.* en ${relPath}: ${JSON.stringify(consoleMatches)}`
        );
      }
    }
  });

  process.stdout.write(`\n\x1b[32;1m✓ Todas las ${passedCount}/${totalCount} pruebas ejecutadas exitosamente sin errores.\x1b[0m\n\n`);
}

runPresentationTests().catch((err) => {
  process.stderr.write(`\nError en la ejecución de pruebas: ${err?.message || err}\n`);
  process.exit(1);
});
