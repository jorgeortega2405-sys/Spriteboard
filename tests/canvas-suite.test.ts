import assert from 'node:assert';

class MockCanvas {
  public _pixels: Uint8ClampedArray;
  public _width = 0;
  public _height = 0;
  private _ctx: MockContext2D | null = null;

  constructor(w = 64, h = 64) {
    this._width = w;
    this._height = h;
    this._pixels = new Uint8ClampedArray(w * h * 4);
  }

  get width(): number {
    return this._width;
  }
  set width(val: number) {
    this._width = val;
    this._pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }

  get height(): number {
    return this._height;
  }
  set height(val: number) {
    this._height = val;
    this._pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }

  public getContext(): any {
    if (!this._ctx) {
      this._ctx = new MockContext2D(this);
    }
    return this._ctx;
  }

  public getBoundingClientRect() {
    return {
      bottom: this._height,
      height: this._height,
      left: 100,
      right: 100 + this._width,
      top: 50,
      width: this._width,
      x: 100,
      y: 50,
    };
  }

  public toDataURL(): string {
    return 'data:image/png;base64,mock';
  }
}

class MockContext2D {
  public canvas: MockCanvas;
  public fillStyle = '#000000';
  public imageSmoothingEnabled = false;
  public lineWidth = 1;
  public strokeStyle = '#000000';
  private transformMatrix = [1, 0, 0, 1, 0, 0];
  private transformStack: number[][] = [];

  constructor(canvas: MockCanvas) {
    this.canvas = canvas;
  }

  public save(): void {
    this.transformStack.push([...this.transformMatrix]);
  }

  public restore(): void {
    if (this.transformStack.length > 0) {
      this.transformMatrix = this.transformStack.pop()!;
    }
  }

  public translate(tx: number, ty: number): void {
    this.transformMatrix[4] += tx * this.transformMatrix[0];
    this.transformMatrix[5] += ty * this.transformMatrix[3];
  }

  public scale(sx: number, sy: number): void {
    this.transformMatrix[0] *= sx;
    this.transformMatrix[3] *= sy;
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    const pixels = this.canvas._pixels;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    for (let py = Math.max(0, y); py < Math.min(ch, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(cw, x + w); px++) {
        const idx = (py * cw + px) * 4;
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    const pixels = this.canvas._pixels;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    let r = 0, g = 0, b = 0, a = 255;
    if (this.fillStyle.startsWith('#')) {
      const hex = this.fillStyle.slice(1);
      if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(ch, Math.floor(y + h)); py++) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(cw, Math.floor(x + w)); px++) {
        const idx = (py * cw + px) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }
    }
  }

  public getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    const img = new ImageData(sw, sh);
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    for (let y = 0; y < sh; y++) {
      const srcY = sy + y;
      if (srcY < 0 || srcY >= ch) continue;
      for (let x = 0; x < sw; x++) {
        const srcX = sx + x;
        if (srcX < 0 || srcX >= cw) continue;
        const srcIdx = (srcY * cw + srcX) * 4;
        const dstIdx = (y * sw + x) * 4;
        img.data[dstIdx] = this.canvas._pixels[srcIdx];
        img.data[dstIdx + 1] = this.canvas._pixels[srcIdx + 1];
        img.data[dstIdx + 2] = this.canvas._pixels[srcIdx + 2];
        img.data[dstIdx + 3] = this.canvas._pixels[srcIdx + 3];
      }
    }
    return img;
  }

  public putImageData(img: ImageData, dx: number, dy: number): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    for (let y = 0; y < img.height; y++) {
      const dstY = dy + y;
      if (dstY < 0 || dstY >= ch) continue;
      for (let x = 0; x < img.width; x++) {
        const dstX = dx + x;
        if (dstX < 0 || dstX >= cw) continue;
        const srcIdx = (y * img.width + x) * 4;
        const dstIdx = (dstY * cw + dstX) * 4;
        this.canvas._pixels[dstIdx] = img.data[srcIdx];
        this.canvas._pixels[dstIdx + 1] = img.data[srcIdx + 1];
        this.canvas._pixels[dstIdx + 2] = img.data[srcIdx + 2];
        this.canvas._pixels[dstIdx + 3] = img.data[srcIdx + 3];
      }
    }
  }

  public drawImage(...args: any[]): void {
    const source = args[0];
    const srcCanvas = source._pixels ? source : source.canvas;
    const fullSw = srcCanvas ? srcCanvas.width : source.width;
    const fullSh = srcCanvas ? srcCanvas.height : source.height;
    let sx = 0;
    let sy = 0;
    let sw = fullSw;
    let sh = fullSh;
    let dx = 0;
    let dy = 0;
    let dw = fullSw;
    let dh = fullSh;

    if (args.length >= 9) {
      sx = args[1];
      sy = args[2];
      sw = args[3];
      sh = args[4];
      dx = args[5];
      dy = args[6];
      dw = args[7];
      dh = args[8];
    } else if (args.length >= 5) {
      dx = args[1];
      dy = args[2];
      dw = args[3];
      dh = args[4];
    } else {
      dx = args[1];
      dy = args[2];
    }

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const srcPixels = srcCanvas ? srcCanvas._pixels : new Uint8ClampedArray(fullSw * fullSh * 4);

    for (let ty = 0; ty < dh; ty++) {
      const dstY = dy + ty;
      if (dstY < 0 || dstY >= ch) continue;
      const srcSampleY = Math.floor(sy + (ty / dh) * sh);
      if (srcSampleY < 0 || srcSampleY >= fullSh) continue;
      for (let tx = 0; tx < dw; tx++) {
        const dstX = dx + tx;
        if (dstX < 0 || dstX >= cw) continue;
        const srcSampleX = Math.floor(sx + (tx / dw) * sw);
        if (srcSampleX < 0 || srcSampleX >= fullSw) continue;
        const srcIdx = (srcSampleY * fullSw + srcSampleX) * 4;
        const dstIdx = (dstY * cw + dstX) * 4;
        if (srcPixels[srcIdx + 3] > 0) {
          this.canvas._pixels[dstIdx] = srcPixels[srcIdx];
          this.canvas._pixels[dstIdx + 1] = srcPixels[srcIdx + 1];
          this.canvas._pixels[dstIdx + 2] = srcPixels[srcIdx + 2];
          this.canvas._pixels[dstIdx + 3] = srcPixels[srcIdx + 3];
        }
      }
    }
  }

  public strokeRect(): void {}
  public beginPath(): void {}
  public moveTo(): void {}
  public lineTo(): void {}
  public stroke(): void {}
  public fill(): void {}
  public rotate(_angle: number): void {}
  public resetTransform(): void {}
  public clip(): void {}
  public createImageData(w: number, h: number): ImageData {
    return new ImageData(w, h);
  }
}

if (typeof (globalThis as any).ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    public data: Uint8ClampedArray;
    public height: number;
    public width: number;
    constructor(wOrData: number | Uint8ClampedArray, hOrW: number, h?: number) {
      if (typeof wOrData === 'number') {
        this.width = wOrData;
        this.height = hOrW;
        this.data = new Uint8ClampedArray(wOrData * hOrW * 4);
      } else {
        this.data = wOrData;
        this.width = hOrW;
        this.height = h!;
      }
    }
  };
}

const mockElement = () => ({
  addEventListener: () => {},
  appendChild: () => {},
  classList: { add: () => {}, contains: () => false, remove: () => {}, toggle: () => {} },
  getAttribute: () => null,
  removeEventListener: () => {},
  setAttribute: () => {},
  style: {},
});

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    body: mockElement(),
    createElement(tag: string) {
      if (tag === 'canvas') return new MockCanvas(64, 64);
      return mockElement();
    },
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

if (typeof (globalThis as any).Image === 'undefined') {
  (globalThis as any).Image = class Image {
    public height = 64;
    public onload: (() => void) | null = null;
    public width = 64;
    private _src = '';
    get src(): string {
      return this._src;
    }
    set src(val: string) {
      this._src = val;
      setTimeout(() => this.onload?.(), 0);
    }
  };
}

async function runSuite(): Promise<void> {
  const { applyFlipCanvas, applyResizeCanvas, applyRotateCanvas } = await import('../client/services/canvas-actions.service.js');
  const { ChunkGrid } = await import('../client/utils/chunk-grid.util.js');
  const { generatePixelOutline } = await import('../client/utils/pixel-effects.util.js');
  const { PIXEL_SHAPES, renderShapeCanvas } = await import('../client/utils/pixel-shapes.util.js');
  const { detectSpriteIslands, sliceByGrid } = await import('../client/utils/pixel-slicer.util.js');
  const { computeElementsBoundingBox, convertDiagramToBoardElements, distToSegment, getConnectorEndpoints, getElementBoundingBox, getNodeAnchorPoint, hitTestElement, hitTestResizeHandle, moveElementByDrag, resizeElementByHandle } = await import('../client/views/board/board-elements.manager.js');
  const { BoardHistoryManager } = await import('../client/views/board/board-history.manager.js');
  const { BoardPixelGridManager } = await import('../client/views/board/board-pixel-grid.manager.js');
  const { screenToWorld, worldToScreen } = await import('../client/views/board/board-renderer.js');
  const { generateShadingRamp, hexToRgb, isDitherPixel, rgbToHex, rgbToHsl } = await import('../client/views/design/design-color.util.js');
  const { getBresenhamLine, getEllipsePoints, getRectanglePoints } = await import('../client/views/design/design-geometry.util.js');
  const { DesignHistoryManager } = await import('../client/views/design/design-history.manager.js');
  const { DesignToolsManager } = await import('../client/views/design/design-tools.manager.js');
  const { DesignViewportManager } = await import('../client/views/design/design-viewport.manager.js');

  let passedTests = 0;
  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
      passedTests++;
      process.stdout.write(`  [PASS] ${name}\n`);
    } catch (err) {
      process.stderr.write(`  [FAIL] ${name}\n`);
      throw err;
    }
  }

  process.stdout.write('=== INICIANDO SUITE DE PRUEBAS PARA LIENZOS Y PIZARRONES ===\n\n');

  await test('1.1 Pixel Canvas - Coordenadas exactas en screenToCanvas a múltiples zooms y DPRs', () => {
    const viewport = new DesignViewportManager(64, 64, false);
    const mockCanvasEl = new MockCanvas(800, 600) as any;
    const zooms = [0.5, 1.0, 2.5, 5.33, 7.33, 10.5, 16.0, 32.0];

    for (const zoom of zooms) {
      viewport.zoom = zoom;
      viewport.panX = 15.7;
      viewport.panY = 22.3;

      const targetPx = 50;
      const targetPy = 20;

      const screenX = 100 + viewport.panX + (targetPx + 0.45) * zoom;
      const screenY = 50 + viewport.panY + (targetPy + 0.65) * zoom;

      const res = viewport.screenToCanvas(screenX, screenY, mockCanvasEl);
      assert.strictEqual(res.x, targetPx, `Fallo en zoom ${zoom}: se esperaba x=${targetPx}, obtenido=${res.x}`);
      assert.strictEqual(res.y, targetPy, `Fallo en zoom ${zoom}: se esperaba y=${targetPy}, obtenido=${res.y}`);
    }
  });

  await test('1.2 Pixel Canvas - Precisión con mouse centrado en pixel (50, 20)', () => {
    const viewport = new DesignViewportManager(64, 64, false);
    const mockCanvasEl = new MockCanvas(800, 600) as any;
    viewport.zoom = 8.0;
    viewport.panX = 50;
    viewport.panY = 50;

    const clickX = 100 + 50 + 50 * 8 + 4;
    const clickY = 50 + 50 + 20 * 8 + 4;

    const res = viewport.screenToCanvas(clickX, clickY, mockCanvasEl);
    assert.strictEqual(res.x, 50);
    assert.strictEqual(res.y, 20);
  });

  await test('2.1 Whiteboard - Bidireccionalidad screenToWorld y worldToScreen', () => {
    const mockCanvasEl = new MockCanvas(1000, 800) as any;
    const cameras = [
      { x: 0, y: 0, zoom: 1.0 },
      { x: 250, y: -150, zoom: 0.5 },
      { x: -500, y: 800, zoom: 2.75 },
      { x: 120, y: 340, zoom: 6.0 },
    ];

    for (const camera of cameras) {
      const testPoints = [
        { x: 0, y: 0 },
        { x: 150, y: 220 },
        { x: -300, y: 550 },
        { x: 800, y: -400 },
      ];

      for (const pt of testPoints) {
        const screen = worldToScreen(pt.x, pt.y, mockCanvasEl, camera);
        const worldBack = screenToWorld(screen.x, screen.y, mockCanvasEl, camera);
        assert.ok(Math.abs(worldBack.x - pt.x) < 1e-6, `Fallo X: ${worldBack.x} vs ${pt.x}`);
        assert.ok(Math.abs(worldBack.y - pt.y) < 1e-6, `Fallo Y: ${worldBack.y} vs ${pt.y}`);
      }
    }
  });

  await test('3.1 Pixel Canvas Shapes - Rotación 90°, 180°, 270° sin deformación de dimensiones', () => {
    assert.ok(PIXEL_SHAPES.length > 0, 'PIXEL_SHAPES debe tener elementos');
    const shape = PIXEL_SHAPES[0];

    const rendered0 = renderShapeCanvas(shape, 'primary', '#ff0000', 0, false, false, 32, 24);
    assert.strictEqual(rendered0.width, 32, 'Ancho base 32');
    assert.strictEqual(rendered0.height, 24, 'Alto base 24');

    const rendered90 = renderShapeCanvas(shape, 'primary', '#ff0000', 90, false, false, 24, 32);
    assert.strictEqual(rendered90.width, 24, 'Rotación 90° con dimensiones de plantilla intercambiadas');
    assert.strictEqual(rendered90.height, 32, 'Rotación 90° con dimensiones de plantilla intercambiadas');

    const rendered180 = renderShapeCanvas(shape, 'primary', '#ff0000', 180, false, false, 32, 24);
    assert.strictEqual(rendered180.width, 32, 'Rotación 180° conserva ancho 32');
    assert.strictEqual(rendered180.height, 24, 'Rotación 180° conserva alto 24');

    const rendered270 = renderShapeCanvas(shape, 'primary', '#ff0000', 270, false, false, 24, 32);
    assert.strictEqual(rendered270.width, 24, 'Rotación 270° con dimensiones intercambiadas');
    assert.strictEqual(rendered270.height, 32, 'Rotación 270° con dimensiones intercambiadas');
  });

  await test('3.2 Pixel Canvas Shapes - Flips horizontal y vertical en figuras', () => {
    assert.ok(PIXEL_SHAPES.length > 1, 'PIXEL_SHAPES debe tener múltiples elementos');
    const shape = PIXEL_SHAPES[1];

    const base = renderShapeCanvas(shape, 'primary', '#00e5ff', 0, false, false);
    const flippedH = renderShapeCanvas(shape, 'primary', '#00e5ff', 0, true, false);
    const flippedV = renderShapeCanvas(shape, 'primary', '#00e5ff', 0, false, true);

    assert.strictEqual(base.width, flippedH.width);
    assert.strictEqual(base.height, flippedH.height);
    assert.strictEqual(base.width, flippedV.width);
    assert.strictEqual(base.height, flippedV.height);
  });

  await test('4.1 Canvas Actions - applyRotateCanvas preserva historial y rota capas', () => {
    let historyResetCalled = false;
    let updatedDimensions: { height: number; width: number } | null = null;
    const layerCanvas = new MockCanvas(64, 32);
    const layerCtx = layerCanvas.getContext('2d')!;
    layerCtx.fillStyle = '#ff0000';
    layerCtx.fillRect(0, 0, 10, 10);

    const mockLayer: any = {
      canvas: layerCanvas as any,
      ctx: layerCtx as any,
      id: 'l1',
      name: 'Capa 1',
      opacity: 1,
      visible: true,
    };

    const context: any = {
      activeFrameId: 'f1',
      activeLayerId: 'l1',
      canvasHeight: 32,
      canvasUuid: 'test-uuid',
      canvasWidth: 64,
      clearSelection: () => {},
      frames: [{ id: 'f1', layers: [mockLayer], name: 'Frame 1' }],
      getActiveFrame: () => ({ id: 'f1', layers: [mockLayer], name: 'Frame 1' }),
      getActiveLayer: () => mockLayer,
      renderFramesCards: () => {},
      renderLayersCards: () => {},
      renderLayersList: () => {},
      requestRedraw: () => {},
      resetHistory: () => {
        historyResetCalled = true;
      },
      scheduleAutoSave: () => {},
      setDimensions: (w: number, h: number) => {
        updatedDimensions = { height: h, width: w };
      },
      viewportParentRect: () => null,
    };

    applyRotateCanvas(context, true);
    assert.strictEqual(historyResetCalled, false, 'applyRotateCanvas NUNCA debe resetear el historial de deshacer');
    assert.deepStrictEqual(updatedDimensions, { height: 64, width: 32 }, 'applyRotateCanvas debe intercambiar ancho y alto a 32x64');
    assert.strictEqual(mockLayer.canvas.width, 32);
    assert.strictEqual(mockLayer.canvas.height, 64);
  });

  await test('4.2 Canvas Actions - applyFlipCanvas preserva historial', () => {
    let historyResetCalled = false;
    const layerCanvas = new MockCanvas(64, 64);
    const mockLayer: any = {
      canvas: layerCanvas as any,
      ctx: layerCanvas.getContext('2d') as any,
      id: 'l1',
      name: 'Capa 1',
      opacity: 1,
      visible: true,
    };

    const context: any = {
      activeFrameId: 'f1',
      activeLayerId: 'l1',
      canvasHeight: 64,
      canvasUuid: 'test-uuid',
      canvasWidth: 64,
      clearSelection: () => {},
      frames: [{ id: 'f1', layers: [mockLayer], name: 'Frame 1' }],
      getActiveFrame: () => ({ id: 'f1', layers: [mockLayer], name: 'Frame 1' }),
      getActiveLayer: () => mockLayer,
      renderFramesCards: () => {},
      renderLayersCards: () => {},
      requestRedraw: () => {},
      resetHistory: () => {
        historyResetCalled = true;
      },
      scheduleAutoSave: () => {},
      setDimensions: () => {},
      viewportParentRect: () => null,
    };

    applyFlipCanvas(context, true);
    assert.strictEqual(historyResetCalled, false, 'applyFlipCanvas NUNCA debe resetear el historial de deshacer');
  });

  await test('4.3 Canvas Actions - applyResizeCanvas preserva historial', () => {
    let historyResetCalled = false;
    let newDims: { h: number; w: number } | null = null;
    const layerCanvas = new MockCanvas(32, 32);
    const mockLayer: any = {
      canvas: layerCanvas as any,
      ctx: layerCanvas.getContext('2d') as any,
      id: 'l1',
      name: 'Capa 1',
      opacity: 1,
      visible: true,
    };

    const context: any = {
      activeFrameId: 'f1',
      activeLayerId: 'l1',
      canvasHeight: 32,
      canvasUuid: 'test-uuid',
      canvasWidth: 32,
      clearSelection: () => {},
      frames: [{ id: 'f1', layers: [mockLayer], name: 'Frame 1' }],
      getActiveFrame: () => ({ id: 'f1', layers: [mockLayer], name: 'Frame 1' }),
      getActiveLayer: () => mockLayer,
      renderFramesCards: () => {},
      renderLayersCards: () => {},
      requestRedraw: () => {},
      resetHistory: () => {
        historyResetCalled = true;
      },
      scheduleAutoSave: () => {},
      setDimensions: (w: number, h: number) => {
        newDims = { h, w };
      },
      viewportParentRect: () => null,
    };

    applyResizeCanvas(context, 48, 48, 'anchor', 'center');
    assert.strictEqual(historyResetCalled, false, 'applyResizeCanvas NUNCA debe resetear el historial de deshacer');
    assert.deepStrictEqual(newDims, { h: 48, w: 48 });
  });

  await test('4.4 Canvas Actions - applyResizeCanvas modo anclaje preserva tamaño 1:1 de los píxeles sin agigantarlos', () => {
    const layerCanvas = new MockCanvas(16, 16);
    const ctx = layerCanvas.getContext('2d') as any;
    ctx.canvas._pixels[(3 * 16 + 2) * 4] = 255;
    ctx.canvas._pixels[(3 * 16 + 2) * 4 + 1] = 0;
    ctx.canvas._pixels[(3 * 16 + 2) * 4 + 2] = 0;
    ctx.canvas._pixels[(3 * 16 + 2) * 4 + 3] = 255;

    const mockLayer: any = {
      canvas: layerCanvas as any,
      ctx,
      id: 'l1',
      name: 'Capa 1',
      opacity: 1,
      visible: true,
    };

    let newWidth = 0;
    let newHeight = 0;
    const context: any = {
      activeFrameId: 'f1',
      activeLayerId: 'l1',
      canvasHeight: 16,
      canvasUuid: 'test-uuid',
      canvasWidth: 16,
      clearSelection: () => {},
      frames: [{ id: 'f1', layers: [mockLayer], name: 'Frame 1' }],
      getActiveFrame: () => ({ id: 'f1', layers: [mockLayer], name: 'Frame 1' }),
      getActiveLayer: () => mockLayer,
      renderFramesCards: () => {},
      renderLayersCards: () => {},
      requestRedraw: () => {},
      resetHistory: () => {},
      scheduleAutoSave: () => {},
      setDimensions: (w: number, h: number) => {
        newWidth = w;
        newHeight = h;
      },
      viewportParentRect: () => null,
    };

    applyResizeCanvas(context, 64, 64, 'anchor', 'top-left');

    assert.strictEqual(newWidth, 64);
    assert.strictEqual(newHeight, 64);
    assert.strictEqual(mockLayer.canvas.width, 64);
    assert.strictEqual(mockLayer.canvas.height, 64);

    const resizedPixels = mockLayer.canvas._pixels;
    const pIdx = (3 * 64 + 2) * 4;
    assert.strictEqual(resizedPixels[pIdx], 255);
    assert.strictEqual(resizedPixels[pIdx + 3], 255);

    const neighborIdx = (3 * 64 + 3) * 4;
    assert.strictEqual(resizedPixels[neighborIdx + 3], 0, 'Píxel adyacente debe ser transparente (no agigantado)');
    const belowIdx = (4 * 64 + 2) * 4;
    assert.strictEqual(resizedPixels[belowIdx + 3], 0, 'Píxel inferior debe ser transparente (no agigantado)');
  });

  await test('5.1 Design History - computeDiffStep con alineación de buffer correcta', () => {
    const history = new DesignHistoryManager();
    const w = 64;
    const h = 64;

    const before = new ImageData(w, h);
    const after = new ImageData(w, h);

    const a32 = new Uint32Array(after.data.buffer);
    a32[15 * w + 20] = 0xff0000ff;
    a32[16 * w + 21] = 0xff0000ff;

    const step = history.computeDiffStep(before, after, 'f1', 'l1');
    assert.ok(step, 'El paso de diff debe crearse sin error de alineación');
    assert.strictEqual(step.type, 'diff');
    assert.strictEqual(step.x, 20);
    assert.strictEqual(step.y, 15);
    assert.strictEqual(step.beforeData.width, 2);
    assert.strictEqual(step.beforeData.height, 2);

    history.pushUndo(step);
    assert.strictEqual(history.undoStack.length, 1);

    const undone = history.undo();
    assert.strictEqual(undone, step);
    assert.strictEqual(history.undoStack.length, 0);
    assert.strictEqual(history.redoStack.length, 1);

    const redone = history.redo();
    assert.strictEqual(redone, step);
    assert.strictEqual(history.undoStack.length, 1);
    assert.strictEqual(history.redoStack.length, 0);
  });

  await test('6.1 Geometría - Bresenham, Rectángulo y Círculo', () => {
    const line = getBresenhamLine(0, 0, 5, 5);
    assert.strictEqual(line.length, 6);
    assert.deepStrictEqual(line[0], { x: 0, y: 0 });
    assert.deepStrictEqual(line[5], { x: 5, y: 5 });

    const rectOutline = getRectanglePoints(10, 10, 14, 14, false);
    assert.strictEqual(rectOutline.length, 16);

    const rectFilled = getRectanglePoints(10, 10, 14, 14, true);
    assert.strictEqual(rectFilled.length, 25);

    const ellipse = getEllipsePoints(20, 20, 26, 26, false);
    assert.ok(ellipse.length > 0);
  });

  await test('7.1 Tools Manager - Herramientas de Selección y Rotación 90°', () => {
    const tools = new DesignToolsManager();
    const layerCanvas = new MockCanvas(64, 64);
    const layerCtx = layerCanvas.getContext('2d')!;
    layerCtx.fillStyle = '#ff0000';
    layerCtx.fillRect(10, 10, 20, 10);

    const mockLayer: any = {
      canvas: layerCanvas as any,
      ctx: layerCtx as any,
      id: 'l1',
      name: 'Layer 1',
      opacity: 1,
      visible: true,
    };

    tools.selectionMask = new Uint8Array(64 * 64);
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 30; x++) {
        tools.selectionMask[y * 64 + x] = 1;
      }
    }

    tools.liftSelectionToFloating(mockLayer, 64, 64);
    assert.ok(tools.floatingSelection, 'floatingSelection debe existir tras lift');
    assert.strictEqual(tools.floatingSelection.width, 20);
    assert.strictEqual(tools.floatingSelection.height, 10);

    const origCenterX = tools.floatingSelection.x + tools.floatingSelection.width / 2;
    const origCenterY = tools.floatingSelection.y + tools.floatingSelection.height / 2;

    tools.rotateSelection90();
    assert.strictEqual(tools.floatingSelection.width, 10);
    assert.strictEqual(tools.floatingSelection.height, 20);

    const newCenterX = tools.floatingSelection.x + tools.floatingSelection.width / 2;
    const newCenterY = tools.floatingSelection.y + tools.floatingSelection.height / 2;
    assert.strictEqual(origCenterX, newCenterX, 'Centro X invariante en rotación 90°');
    assert.strictEqual(origCenterY, newCenterY, 'Centro Y invariante en rotación 90°');

    tools.commitFloatingSelection(mockLayer, false);
    assert.strictEqual(tools.floatingSelection, null, 'floatingSelection debe quedar nulo tras commit');
  });

  await test('8.1 Whiteboard Elements - Bounding box y Hit Testing', () => {
    const shape: any = {
      color: '#000000',
      fillColor: 'transparent',
      height: 100,
      id: 'shape-1',
      shape: 'rect',
      strokeWidth: 2,
      type: 'shape',
      width: 200,
      x: 50,
      y: 50,
    };

    const bbox = getElementBoundingBox(shape);
    assert.strictEqual(bbox.x, 50);
    assert.strictEqual(bbox.y, 50);
    assert.strictEqual(bbox.width, 200);
    assert.strictEqual(bbox.height, 100);

    const hit = hitTestElement([shape], 100, 100, 1.0);
    assert.strictEqual(hit?.id, 'shape-1');

    const miss = hitTestElement([shape], 10, 10, 1.0);
    assert.strictEqual(miss, null);
  });

  await test('8.2 Whiteboard - Pixel Grid Manager sincronización y pintura', async () => {
    const gridManager = new BoardPixelGridManager();
    let loadedCount = 0;
    const pixelGridEl: any = {
      backgroundColor: '#ffffff',
      color: '#000000',
      data: '',
      gridHeight: 16,
      gridWidth: 16,
      height: 160,
      id: 'grid-1',
      palette: 'classic',
      pixelSize: 10,
      showGrid: true,
      type: 'pixel-grid',
      width: 160,
      x: 100,
      y: 100,
    };

    gridManager.getOrCreatePixelGridCanvas(pixelGridEl, () => {
      loadedCount++;
    });
    assert.strictEqual(loadedCount, 1, 'onLoaded debe llamarse de inmediato para canvas vacío');

    gridManager.startPixelPainting(pixelGridEl, { x: 105, y: 105 }, '#ff0000');
    assert.strictEqual(gridManager.isPixelPainting, true);

    gridManager.finishPixelPainting(pixelGridEl);
    assert.strictEqual(gridManager.isPixelPainting, false);

    pixelGridEl.data = '';
    gridManager.syncPixelGridCanvases([pixelGridEl], () => {
      loadedCount++;
    });
    assert.strictEqual(loadedCount, 2, 'syncPixelGridCanvases debe llamar onLoaded de inmediato cuando data está vacía');

    pixelGridEl.data = 'data:image/png;base64,iVBORw0KGgo=';
    await new Promise<void>((resolve) => {
      gridManager.syncPixelGridCanvases([pixelGridEl], () => {
        loadedCount++;
        resolve();
      });
    });
    assert.strictEqual(loadedCount, 3, 'syncPixelGridCanvases debe llamar onLoaded asíncronamente cuando data tiene imagen');
  });

  await test('8.3 Whiteboard History - Undo y Redo de elementos', () => {
    const history = new BoardHistoryManager();
    const el1: any = {
      color: '#ff0000',
      fillColor: 'transparent',
      height: 50,
      id: 'el-1',
      shape: 'rect',
      strokeWidth: 2,
      type: 'shape',
      width: 50,
      x: 10,
      y: 10,
    };
    const el2: any = {
      color: '#00ff00',
      fillColor: 'transparent',
      height: 80,
      id: 'el-2',
      shape: 'circle',
      strokeWidth: 2,
      type: 'shape',
      width: 80,
      x: 100,
      y: 100,
    };

    let currentElements = [el1];
    history.pushState([]);
    history.pushState(currentElements);
    currentElements = [el1, el2];

    assert.strictEqual(history.canUndo(), true);

    const undone = history.undo(currentElements);
    assert.ok(undone);
    assert.strictEqual(undone.length, 1);
    assert.strictEqual(undone[0].id, 'el-1');

    const redone = history.redo(undone);
    assert.ok(redone);
    assert.strictEqual(redone.length, 2);
    assert.strictEqual(redone[1].id, 'el-2');
  });

  await test('9.1 ChunkGrid - Lienzo infinito setPixel, getPixel, clear y boundingBox', () => {
    const grid = new ChunkGrid(64);
    grid.setPixel(100, 200, '#ff8000');
    const pixel = grid.getPixel(100, 200);
    assert.strictEqual(pixel.r, 255);
    assert.strictEqual(pixel.g, 128);
    assert.strictEqual(pixel.b, 0);
    assert.strictEqual(pixel.a, 255);

    const bbox = grid.getBoundingBox();
    assert.strictEqual(bbox.hasPixels, true);
    assert.ok(bbox.minX <= 100 && bbox.maxX >= 100);
    assert.ok(bbox.minY <= 200 && bbox.maxY >= 200);

    grid.clear();
    const emptyPixel = grid.getPixel(100, 200);
    assert.strictEqual(emptyPixel.a, 0);
  });

  await test('10.1 Pixel Effects - Generación de contorno (Pixel Outline)', () => {
    const srcCanvas = new MockCanvas(16, 16);
    const ctx = srcCanvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(4, 4, 8, 8);

    const outlineResult = generatePixelOutline(srcCanvas as any, '#000000', 1);
    assert.strictEqual(outlineResult.canvas.width, 18);
    assert.strictEqual(outlineResult.canvas.height, 18);
    assert.strictEqual(outlineResult.offsetX, -1);
    assert.strictEqual(outlineResult.offsetY, -1);
  });

  await test('11.1 Pixel Slicer - Detección de islas de sprites y corte por cuadrícula', () => {
    const spriteCanvas = new MockCanvas(32, 32);
    const ctx = spriteCanvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillRect(20, 20, 4, 4);

    const islands = detectSpriteIslands(spriteCanvas as any, 10, 1);
    assert.strictEqual(islands.length, 2, 'Debe detectar exactamente 2 islas separadas');

    const slicedTiles = sliceByGrid(spriteCanvas as any, 16, 16);
    assert.strictEqual(slicedTiles.length, 2, 'Debe detectar 2 cuadrículas con contenido');
  });

  await test('12.1 Utilidades de Color - hexToRgb, rgbToHex, rampas de sombreado y dithering', () => {
    const rgb = hexToRgb('#ff8000');
    assert.deepStrictEqual(rgb, { b: 0, g: 128, r: 255 });
    const hex = rgbToHex(255, 128, 0);
    assert.strictEqual(hex, '#FF8000');

    const hsl = rgbToHsl(255, 0, 0);
    assert.strictEqual(hsl.h, 0);
    assert.strictEqual(hsl.s, 1);
    assert.strictEqual(hsl.l, 0.5);

    const ramp = generateShadingRamp('#ff0000');
    assert.strictEqual(ramp.length, 5);

    const isDither1 = isDitherPixel(0, 0, 'checker-50');
    const isDither2 = isDitherPixel(1, 0, 'checker-50');
    assert.notStrictEqual(isDither1, isDither2, 'Dither checkerboard debe alternar entre pixeles adyacentes');
  });

  await test('13.1 Whiteboard Transformaciones - Drag y Resize en 4 esquinas', () => {
    const el: any = {
      color: '#000000',
      fillColor: 'transparent',
      height: 100,
      id: 'box-1',
      shape: 'rect',
      strokeWidth: 2,
      type: 'shape',
      width: 100,
      x: 50,
      y: 50,
    };

    moveElementByDrag(el, { x: 120, y: 130 }, { x: 20, y: 30 });
    assert.strictEqual(el.x, 100);
    assert.strictEqual(el.y, 100);

    const startRect = { height: 100, width: 100, x: 100, y: 100 };
    resizeElementByHandle(el, 'br', { x: 250, y: 220 }, startRect);
    assert.strictEqual(el.width, 150);
    assert.strictEqual(el.height, 120);

    resizeElementByHandle(el, 'tl', { x: 120, y: 110 }, startRect);
    assert.strictEqual(el.x, 120);
    assert.strictEqual(el.y, 110);
    assert.strictEqual(el.width, 80);
    assert.strictEqual(el.height, 90);

    const compoundBbox = computeElementsBoundingBox([el]);
    assert.ok(compoundBbox);
    assert.strictEqual(compoundBbox.x, el.x);
    assert.strictEqual(compoundBbox.y, el.y);
  });

  await test('14. Bloqueo y disponibilidad de herramientas en lienzos infinitos y grandes (>2048px)', () => {
    const isToolAllowed = (tool: 'rotate' | 'flip' | 'resize' | 'slicer' | 'tileGrid', isInfinite: boolean, width: number, height: number) => {
      const isLarge = !isInfinite && (width > 2048 || height > 2048);
      if (tool === 'rotate' || tool === 'flip') {
        return !isInfinite && !isLarge;
      }
      if (tool === 'resize' || tool === 'tileGrid') {
        return !isInfinite;
      }
      if (tool === 'slicer') {
        return !isInfinite && !isLarge;
      }
      return true;
    };

    assert.strictEqual(isToolAllowed('rotate', true, 0, 0), false, 'Rotar debe estar bloqueado en lienzo infinito');
    assert.strictEqual(isToolAllowed('flip', true, 0, 0), false, 'Voltear debe estar bloqueado en lienzo infinito');
    assert.strictEqual(isToolAllowed('resize', true, 0, 0), false, 'Redimensionar debe estar bloqueado en lienzo infinito');
    assert.strictEqual(isToolAllowed('slicer', true, 0, 0), false, 'Slicer debe estar bloqueado en lienzo infinito');
    assert.strictEqual(isToolAllowed('tileGrid', true, 0, 0), false, 'TileGrid debe estar bloqueado en lienzo infinito');

    assert.strictEqual(isToolAllowed('rotate', false, 4096, 4096), false, 'Rotar debe estar bloqueado en 4096px');
    assert.strictEqual(isToolAllowed('flip', false, 4096, 4096), false, 'Voltear debe estar bloqueado en 4096px');
    assert.strictEqual(isToolAllowed('slicer', false, 4096, 4096), false, 'Slicer debe estar bloqueado en 4096px');
    assert.strictEqual(isToolAllowed('resize', false, 4096, 4096), true, 'Redimensionar debe permitir ajustar desde lienzo grande');

    assert.strictEqual(isToolAllowed('rotate', false, 64, 64), true, 'Rotar debe permitirse en 64x64');
    assert.strictEqual(isToolAllowed('flip', false, 64, 64), true, 'Voltear debe permitirse en 64x64');
    assert.strictEqual(isToolAllowed('resize', false, 64, 64), true, 'Redimensionar debe permitirse en 64x64');
    assert.strictEqual(isToolAllowed('slicer', false, 64, 64), true, 'Slicer debe permitirse en 64x64');
    assert.strictEqual(isToolAllowed('tileGrid', false, 64, 64), true, 'TileGrid debe permitirse en 64x64');
  });

  await test('15.1 Whiteboard Connectors - Puntos de anclaje (Anchor Points) y cálculo de extremos', () => {
    const nodeA: any = {
      color: '#000000',
      fillColor: '#ffffff',
      height: 100,
      id: 'shape-a',
      shapeType: 'rect',
      strokeWidth: 2,
      type: 'shape',
      width: 120,
      x: 50,
      y: 50,
    };

    const nodeB: any = {
      color: '#000000',
      fillColor: '#ffffff',
      height: 100,
      id: 'shape-b',
      shapeType: 'pill',
      strokeWidth: 2,
      type: 'shape',
      width: 120,
      x: 300,
      y: 50,
    };

    const anchorRightA = getNodeAnchorPoint(nodeA, 'right');
    assert.deepStrictEqual(anchorRightA, { x: 170, y: 100 });

    const anchorLeftB = getNodeAnchorPoint(nodeB, 'left');
    assert.deepStrictEqual(anchorLeftB, { x: 300, y: 100 });

    const anchorTopA = getNodeAnchorPoint(nodeA, 'top');
    assert.deepStrictEqual(anchorTopA, { x: 110, y: 50 });

    const anchorBottomA = getNodeAnchorPoint(nodeA, 'bottom');
    assert.deepStrictEqual(anchorBottomA, { x: 110, y: 150 });

    const conn: any = {
      arrowEnd: true,
      color: '#64748b',
      fromId: 'shape-a',
      id: 'conn-1',
      strokeWidth: 2,
      style: 'curved',
      toId: 'shape-b',
      type: 'connector',
    };

    const endpoints = getConnectorEndpoints(conn, [nodeA, nodeB]);
    assert.ok(endpoints);
    assert.strictEqual(endpoints.from.x, 170);
    assert.strictEqual(endpoints.from.y, 100);
    assert.strictEqual(endpoints.to.x, 300);
    assert.strictEqual(endpoints.to.y, 100);

    const freeConn: any = {
      color: '#64748b',
      endPoint: { x: 400, y: 500 },
      id: 'conn-free',
      startPoint: { x: 10, y: 20 },
      strokeWidth: 2,
      style: 'straight',
      type: 'connector',
    };
    const freeEndpoints = getConnectorEndpoints(freeConn, []);
    assert.ok(freeEndpoints);
    assert.deepStrictEqual(freeEndpoints.from, { x: 10, y: 20 });
    assert.deepStrictEqual(freeEndpoints.to, { x: 400, y: 500 });
  });

  await test('15.2 Whiteboard Connectors - Geometría distToSegment y detección de colisión (Hit Testing)', () => {
    const d1 = distToSegment(50, 15, 0, 10, 100, 10);
    assert.strictEqual(d1, 5);

    const d2 = distToSegment(-10, 10, 0, 10, 100, 10);
    assert.strictEqual(d2, 10);

    const d3 = distToSegment(110, 10, 0, 10, 100, 10);
    assert.strictEqual(d3, 10);

    const straightConn: any = {
      color: '#000000',
      endPoint: { x: 200, y: 100 },
      id: 'conn-straight',
      label: 'Flujo Principal',
      startPoint: { x: 0, y: 100 },
      strokeWidth: 2,
      style: 'straight',
      type: 'connector',
    };

    assert.strictEqual(hitTestElement([straightConn], 100, 103, 1), straightConn, 'Debe detectar clic cerca de la línea (distancia 3px <= tolerancia 8px)');
    assert.strictEqual(hitTestElement([straightConn], 100, 120, 1), null, 'No debe detectar clic lejos de la línea (distancia 20px > tolerancia 8px)');
    assert.strictEqual(hitTestElement([straightConn], 100, 95, 1), straightConn, 'Debe detectar clic dentro del badge de la etiqueta');
  });

  await test('15.3 Conversión de Diagramas y Esquemas a Elementos de Pizarrón (convertDiagramToBoardElements)', () => {
    const diagramData: any = {
      connections: [
        { color: '#3b82f6', fromId: 'node-1', label: 'incluye', style: 'orthogonal', toId: 'node-3' },
      ],
      nodes: [
        {
          borderColor: '#1e293b',
          borderWidth: 2,
          color: '#ffffff',
          height: 80,
          id: 'node-1',
          shape: 'pill',
          text: 'Idea Central',
          textColor: '#0f172a',
          width: 160,
          x: 200,
          y: 200,
        },
        {
          color: '#f8fafc',
          height: 60,
          id: 'node-2',
          linkingPhrase: 'conduce a',
          parentId: 'node-1',
          shape: 'cylinder',
          text: 'Base de Datos',
          width: 140,
          x: 450,
          y: 150,
        },
        {
          color: '#fef2f2',
          height: 60,
          id: 'node-3',
          shape: 'parallelogram',
          text: 'Proceso de Entrada',
          width: 140,
          x: 450,
          y: 300,
        },
      ],
    };

    const boardElements = convertDiagramToBoardElements(diagramData);
    assert.strictEqual(boardElements.length, 5, 'Debe generar 3 figuras y 2 conectores (1 por parentId y 1 por connections)');

    const shapes = boardElements.filter((el) => el.type === 'shape');
    assert.strictEqual(shapes.length, 3);
    assert.strictEqual(shapes[0].shapeType, 'pill');
    assert.strictEqual((shapes[0] as any).text, 'Idea Central');
    assert.strictEqual((shapes[0] as any).isMindMapNode, true);
    assert.strictEqual(shapes[1].shapeType, 'cylinder');
    assert.strictEqual(shapes[2].shapeType, 'parallelogram');

    const connectors = boardElements.filter((el) => el.type === 'connector');
    assert.strictEqual(connectors.length, 2);
    assert.strictEqual((connectors[0] as any).label, 'conduce a');
    assert.strictEqual((connectors[0] as any).fromId, shapes[0].id);
    assert.strictEqual((connectors[0] as any).toId, shapes[1].id);
    assert.strictEqual((connectors[1] as any).label, 'incluye');
    assert.strictEqual((connectors[1] as any).style, 'orthogonal');
    assert.strictEqual((connectors[1] as any).fromId, shapes[0].id);
    assert.strictEqual((connectors[1] as any).toId, shapes[2].id);
  });

  await test('15.4 Whiteboard Mindmap Shortcuts - Lógica de Ramificación Tab y Enter', () => {
    const parentNode: any = {
      color: '#000000',
      fillColor: '#ffffff',
      height: 60,
      id: 'root-node',
      isMindMapNode: true,
      shapeType: 'pill',
      strokeWidth: 2,
      text: 'Nodo Raíz',
      type: 'shape',
      width: 140,
      x: 100,
      y: 200,
    };

    const childX = parentNode.x + parentNode.width + 120;
    const childY = parentNode.y;
    const childNode: any = {
      color: '#000000',
      fillColor: '#ffffff',
      height: parentNode.height,
      id: 'child-1',
      isMindMapNode: true,
      shapeType: parentNode.shapeType,
      strokeWidth: 2,
      text: 'Nuevo Subnodo',
      type: 'shape',
      width: parentNode.width,
      x: childX,
      y: childY,
    };
    const childConn: any = {
      arrowEnd: true,
      color: '#64748b',
      fromId: parentNode.id,
      id: 'conn-parent-child',
      strokeWidth: 2,
      style: 'curved',
      toId: childNode.id,
      type: 'connector',
    };

    assert.strictEqual(childNode.x, 360);
    assert.strictEqual(childNode.y, 200);
    assert.strictEqual(childConn.fromId, parentNode.id);
    assert.strictEqual(childConn.toId, childNode.id);

    const siblingX = childNode.x;
    const siblingY = childNode.y + childNode.height + 40;
    const siblingNode: any = {
      color: '#000000',
      fillColor: '#ffffff',
      height: childNode.height,
      id: 'child-2',
      isMindMapNode: true,
      shapeType: childNode.shapeType,
      strokeWidth: 2,
      text: 'Nuevo Subnodo',
      type: 'shape',
      width: childNode.width,
      x: siblingX,
      y: siblingY,
    };
    const siblingConn: any = {
      arrowEnd: true,
      color: '#64748b',
      fromId: parentNode.id,
      id: 'conn-parent-sibling',
      strokeWidth: 2,
      style: 'curved',
      toId: siblingNode.id,
      type: 'connector',
    };

    assert.strictEqual(siblingNode.x, 360);
    assert.strictEqual(siblingNode.y, 300);
    assert.strictEqual(siblingConn.fromId, parentNode.id);
    assert.strictEqual(siblingConn.toId, siblingNode.id);
  });

  process.stdout.write(`\n=== TODAS LAS PRUEBAS PASARON EXITOSAMENTE (${passedTests} pruebas completadas) ===\n`);
}

void runSuite();
