import { Ball, Cue, GamePhase, Table } from '@/engine/types';

interface Viewport {
  width: number;
  height: number;
  device: 'mobile' | 'tablet' | 'desktop';
}

export class AdaptiveRenderer {
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;

  private readonly TABLE_W = 1200;
  private readonly TABLE_H = 600;

  constructor(canvas: HTMLCanvasElement, viewport: Viewport) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    this.viewport = viewport;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.calculateDimensions();
    this.setupCanvas(canvas);
  }

  private calculateDimensions() {
    const isMobile = this.viewport.device === 'mobile';

    // Margens mínimas para não cortar a mesa
    const marginX = isMobile ? 4 : 16;
    const marginY = isMobile ? 4 : 16;

    // Área disponível
    const availableW = Math.max(this.viewport.width - marginX * 2, 100);
    const availableH = Math.max(this.viewport.height - marginY * 2, 100);

    // Escala mantendo aspect ratio 2:1 da mesa
    const scaleX = availableW / this.TABLE_W;
    const scaleY = availableH / this.TABLE_H;
    this.scale = Math.min(scaleX, scaleY);

    // Garantir escala mínima visível
    this.scale = Math.max(this.scale, 0.12);

    // Centralizar a mesa
    const renderWidth = this.TABLE_W * this.scale;
    const renderHeight = this.TABLE_H * this.scale;
    this.offsetX = (this.viewport.width - renderWidth) / 2;
    this.offsetY = (this.viewport.height - renderHeight) / 2;
  }

  private setupCanvas(canvas: HTMLCanvasElement) {
    // Canvas size em pixels físicos (DPR)
    canvas.width = Math.floor(this.viewport.width * this.dpr);
    canvas.height = Math.floor(this.viewport.height * this.dpr);

    // CSS size
    canvas.style.width = `${this.viewport.width}px`;
    canvas.style.height = `${this.viewport.height}px`;

    // Reset transform e aplicar DPR
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  private toScreen(x: number, y: number) {
    return {
      x: this.offsetX + x * this.scale,
      y: this.offsetY + y * this.scale,
    };
  }

  toTable(screenX: number, screenY: number) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale,
    };
  }

  getScale() {
    return this.scale;
  }

  getOffset() {
    return { x: this.offsetX, y: this.offsetY };
  }

  getViewport() {
    return { ...this.viewport };
  }

  clear() {
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
  }

  renderTable(table: Table) {
    const { ctx } = this;
    const w = this.TABLE_W * this.scale;
    const h = this.TABLE_H * this.scale;
    const x = this.offsetX;
    const y = this.offsetY;

    // Borda da mesa (madeira)
    const borderWidth = 20 * this.scale;
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(x - borderWidth, y - borderWidth, w + borderWidth * 2, h + borderWidth * 2);

    // Feltro verde com gradiente
    const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h));
    grad.addColorStop(0, '#1e5c2f');
    grad.addColorStop(0.7, '#0d3d1a');
    grad.addColorStop(1, '#0a2a15');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Caçapas
    for (const pocket of table.pockets) {
      const pos = this.toScreen(pocket.position.x, pocket.position.y);
      const r = pocket.radius * this.scale;

      // Buraco preto
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Borda da caçapa
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 2 * this.scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2 * this.scale;
      ctx.stroke();
    }
  }

  renderBall(ball: Ball) {
    if (ball.inPocket) return;

    const { ctx } = this;
    const pos = this.toScreen(ball.position.x, ball.position.y);
    const r = ball.radius * this.scale;

    // Sombra da bola
    ctx.beginPath();
    ctx.ellipse(pos.x + r * 0.3, pos.y + r * 0.3, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Gradiente da bola
    const ballGrad = ctx.createRadialGradient(
      pos.x - r * 0.35,
      pos.y - r * 0.35,
      r * 0.1,
      pos.x,
      pos.y,
      r
    );

    const colors: Record<string, [string, string, string]> = {
      white: ['#fff', '#f3f4f6', '#9ca3af'],
      red: ['#fca5a5', '#dc2626', '#991b1b'],
      yellow: ['#fde68a', '#fbbf24', '#b45309'],
      green: ['#86efac', '#16a34a', '#166534'],
      brown: ['#d6c4a5', '#92400e', '#78350f'],
      blue: ['#93c5fd', '#2563eb', '#1e40af'],
      pink: ['#fbcfe8', '#ec4899', '#be185d'],
      black: ['#525252', '#262626', '#171717'],
      orange: ['#fdba74', '#f97316', '#c2410c'],
      purple: ['#d8b4fe', '#9333ea', '#6b21a8'],
      maroon: ['#fca5a5', '#7f1d1d', '#450a0a'],
      cyan: ['#a5f3fc', '#06b6d4', '#0891b2'],
    };

    const [light, base, dark] = colors[ball.color] || colors.white;
    ballGrad.addColorStop(0, light);
    ballGrad.addColorStop(0.4, base);
    ballGrad.addColorStop(1, dark);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Brilho
    ctx.beginPath();
    ctx.ellipse(pos.x - r * 0.35, pos.y - r * 0.35, r * 0.25, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Número da bola
    if (ball.color !== 'white') {
      ctx.fillStyle = ball.color === 'black' ? '#fff' : '#000';
      ctx.font = `bold ${Math.max(8, Math.floor(r * 1.1))}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ball.number), pos.x, pos.y);
    }
  }

  renderCue(cue: Cue, phase: GamePhase, whiteBall: { x: number; y: number }) {
    // Sempre mostrar o taco, não apenas em aiming/charging
    const { ctx } = this;
    const ballPos = this.toScreen(whiteBall.x, whiteBall.y);

    // Converter ângulo para radianos (invertido porque o taco aponta para trás)
    const angleRad = ((cue.angle + 180) * Math.PI) / 180;

    // Linha de mira (tracejada) - só em aiming/charging
    if (phase === 'aiming' || phase === 'charging') {
      const aimLength = Math.min(200, this.TABLE_W * 0.3);
      const aimEndX = ballPos.x + Math.cos(angleRad) * aimLength;
      const aimEndY = ballPos.y + Math.sin(angleRad) * aimLength;

      ctx.beginPath();
      ctx.moveTo(ballPos.x, ballPos.y);
      ctx.lineTo(aimEndX, aimEndY);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2 * this.scale;
      ctx.setLineDash([6 * this.scale, 6 * this.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Taco - posicionado atrás da bola branca
    const isMobile = this.viewport.device === 'mobile';
    const recoil = (phase === 'charging' ? cue.power * 0.3 : 0) * this.scale;
    const cueDist = (isMobile ? 30 : 40) * this.scale + recoil;
    const cueLen = (isMobile ? 120 : 160) * this.scale;

    // Posição do taco (atrás da bola, na direção oposta ao ângulo)
    const startX = ballPos.x - Math.cos(angleRad) * cueDist;
    const startY = ballPos.y - Math.sin(angleRad) * cueDist;
    const endX = startX - Math.cos(angleRad) * cueLen;
    const endY = startY - Math.sin(angleRad) * cueLen;

    // Taco principal - cor sólida visível
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = Math.max(4, 6 * this.scale);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Ponta do taco - mais escura
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX - Math.cos(angleRad) * 20 * this.scale, startY - Math.sin(angleRad) * 20 * this.scale);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = Math.max(4, 6 * this.scale);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Anel dourado na ponta
    const ringX = startX - Math.cos(angleRad) * (8 * this.scale);
    const ringY = startY - Math.sin(angleRad) * (8 * this.scale);
    ctx.beginPath();
    ctx.arc(ringX, ringY, Math.max(3, 3 * this.scale), 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }

  updateViewport(viewport: Viewport, canvas: HTMLCanvasElement) {
    this.viewport = viewport;
    this.calculateDimensions();
    this.setupCanvas(canvas);
  }
}
