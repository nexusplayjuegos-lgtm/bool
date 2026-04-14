interface LayerConfig {
  name: string;
  zIndex: number;
  isStatic: boolean;
}

export class LayerManager {
  private container: HTMLElement;
  private layers: Map<string, HTMLCanvasElement> = new Map();
  private contexts: Map<string, CanvasRenderingContext2D> = new Map();
  private width: number;
  private height: number;
  private dpr: number;

  constructor(container: HTMLElement, width: number, height: number) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.setupContainer();
  }

  private setupContainer(): void {
    this.container.style.position = 'relative';
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    this.container.style.overflow = 'hidden';
  }

  createLayer(config: LayerConfig): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = this.width * this.dpr;
    canvas.height = this.height * this.dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = config.zIndex.toString();
    
    const ctx = canvas.getContext('2d', {
      alpha: !config.isStatic,
      desynchronized: true,
    })!;
    
    ctx.scale(this.dpr, this.dpr);
    
    this.layers.set(config.name, canvas);
    this.contexts.set(config.name, ctx);
    this.container.appendChild(canvas);
    
    return ctx;
  }

  getContext(name: string): CanvasRenderingContext2D | undefined {
    return this.contexts.get(name);
  }

  clearLayer(name: string): void {
    const ctx = this.contexts.get(name);
    if (ctx) {
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  clearRect(name: string, x: number, y: number, width: number, height: number): void {
    const ctx = this.contexts.get(name);
    if (ctx) {
      ctx.clearRect(x, y, width, height);
    }
  }
}
