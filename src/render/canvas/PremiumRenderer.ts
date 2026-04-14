import { Ball, Cue, GamePhase, Table, Vector2 } from '@/engine/types';
import { LayerManager } from './LayerManager';

// ARQUITETO: Feature flag para Canvas Layering Fase 2
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const USE_LAYER_MANAGER = true; // ATIVADO - Fase 2
void USE_LAYER_MANAGER; // Suprimir warning de variável não utilizada

interface RenderConfig {
  width: number;
  height: number;
}

interface TableGeometry {
  outerLeft: number;
  outerTop: number;
  outerRight: number;
  outerBottom: number;
  playLeft: number;
  playTop: number;
  playRight: number;
  playBottom: number;
  centerX: number;
  cornerCut: number;
  sidePocketHalf: number;
  sidePocketDepth: number;
  railDepth: number;
}

type BallPalette = {
  base: string;
  dark: string;
  highlight: string;
  numberColor: string;
};

const BALL_PALETTES: Record<Ball['color'], BallPalette> = {
  white: {
    base: '#ffffff',
    dark: '#d1d5db',
    highlight: '#ffffff',
    numberColor: '#111111',
  },
  red: {
    base: '#dc2626',
    dark: '#991b1b',
    highlight: '#fca5a5',
    numberColor: '#ffffff',
  },
  yellow: {
    base: '#fbbf24',
    dark: '#b45309',
    highlight: '#fde68a',
    numberColor: '#111111',
  },
  green: {
    base: '#16a34a',
    dark: '#166534',
    highlight: '#86efac',
    numberColor: '#ffffff',
  },
  brown: {
    base: '#92400e',
    dark: '#78350f',
    highlight: '#d6c4a5',
    numberColor: '#ffffff',
  },
  blue: {
    base: '#2563eb',
    dark: '#1e40af',
    highlight: '#93c5fd',
    numberColor: '#ffffff',
  },
  pink: {
    base: '#ec4899',
    dark: '#be185d',
    highlight: '#fbcfe8',
    numberColor: '#111111',
  },
  black: {
    base: '#262626',
    dark: '#171717',
    highlight: '#525252',
    numberColor: '#ffffff',
  },
  orange: {
    base: '#f97316',
    dark: '#c2410c',
    highlight: '#fdba74',
    numberColor: '#111111',
  },
  purple: {
    base: '#9333ea',
    dark: '#6b21a8',
    highlight: '#d8b4fe',
    numberColor: '#ffffff',
  },
  maroon: {
    base: '#7f1d1d',
    dark: '#450a0a',
    highlight: '#dc2626',
    numberColor: '#ffffff',
  },
  cyan: {
    base: '#06b6d4',
    dark: '#0891b2',
    highlight: '#a5f3fc',
    numberColor: '#111111',
  },
};

export class PremiumRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private dpr: number;
  private canvas: HTMLCanvasElement;

  // ARQUITETO: Integração LayerManager - Fase 2
  private layerManager?: LayerManager;
  private tableCtx?: CanvasRenderingContext2D;
  private ballsCtx?: CanvasRenderingContext2D;
  private uiCtx?: CanvasRenderingContext2D;
  private tableRendered = false;
  private container?: HTMLElement;

  constructor(canvas: HTMLCanvasElement, config: RenderConfig) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.config = config;
    this.dpr = window.devicePixelRatio || 1;

    this.applyCanvasSize();

    // ARQUITETO: Inicialização condicional do LayerManager
    if (USE_LAYER_MANAGER && canvas.parentElement) {
      this.container = canvas.parentElement;
      this.layerManager = new LayerManager(this.container, config.width, config.height);

      // Layer 0: Mesa estática
      this.tableCtx = this.layerManager.createLayer({
        name: 'table',
        zIndex: 0,
        isStatic: true
      });

      // Layer 1: Bolas dinâmicas
      this.ballsCtx = this.layerManager.createLayer({
        name: 'balls',
        zIndex: 1,
        isStatic: false
      });

      // Layer 2: UI/Taco
      this.uiCtx = this.layerManager.createLayer({
        name: 'ui',
        zIndex: 2,
        isStatic: false
      });

      // Esconder canvas original quando usando layers
      canvas.style.display = 'none';
    }

    // Suprimir warnings de variáveis não utilizadas (serão usadas nos próximos commits)
    void this.tableCtx;
    void this.ballsCtx;
    void this.uiCtx;
    void this.tableRendered;
    void this.container;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
  }

  renderTable(table: Table): void {
    const { ctx } = this;
    const width = table.width;
    const height = table.height;
    const geometry = this.getTableGeometry(table);

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 58;
    ctx.shadowOffsetY = 22;
    ctx.fillStyle = '#301f12';
    this.roundRect(
      geometry.outerLeft,
      geometry.outerTop,
      geometry.outerRight - geometry.outerLeft,
      geometry.outerBottom - geometry.outerTop,
      28
    );
    ctx.fill();
    ctx.restore();

    this.renderPremiumPockets(table.pockets);
    this.renderInnerCushions(geometry);

    const feltGradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      24,
      width / 2,
      height / 2,
      Math.max(width, height) / 1.35
    );
    feltGradient.addColorStop(0, '#1a5f2a');
    feltGradient.addColorStop(0.55, '#0d3d1a');
    feltGradient.addColorStop(1, '#04140b');

    ctx.fillStyle = feltGradient;
    this.tracePlayfieldPath(geometry);
    ctx.fill();

    ctx.save();
    this.tracePlayfieldPath(geometry);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.028)';
    ctx.lineWidth = 1;
    for (let x = geometry.playLeft + 18; x < geometry.playRight; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, geometry.playTop + 18);
      ctx.lineTo(x, geometry.playBottom - 18);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(width * 0.25, geometry.playTop + 12);
    ctx.lineTo(width * 0.25, geometry.playBottom - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(width * 0.25, height / 2, 60, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    this.tracePlayfieldPath(geometry);
    ctx.stroke();
    ctx.restore();
  }

  renderBall(ball: Ball): void {
    if (ball.inPocket) {
      return;
    }

    const { ctx } = this;
    const { x, y } = ball.position;
    const { radius } = ball;
    const palette = BALL_PALETTES[ball.color];

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 4.5, radius * 0.92, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fill();
    ctx.restore();

    const gradient = ctx.createRadialGradient(
      x - radius * 0.42,
      y - radius * 0.42,
      radius * 0.1,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, palette.highlight);
    gradient.addColorStop(0.32, palette.base);
    gradient.addColorStop(1, palette.dark);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      x - radius * 0.35,
      y - radius * 0.35,
      radius * 0.25,
      radius * 0.15,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fill();
    ctx.restore();

    if (ball.color === 'white') {
      return;
    }

    ctx.save();
    ctx.fillStyle = palette.numberColor;
    ctx.font = `700 ${Math.max(10, radius)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = 2;
    ctx.fillText(String(ball.number), x, y);
    ctx.restore();
  }

  renderCue(cue: Cue, phase: GamePhase, whiteBallPos: Vector2): void {
    if (phase !== 'aiming' && phase !== 'charging') {
      return;
    }

    const { ctx } = this;
    const angleRad = (cue.angle * Math.PI) / 180;

    const aimStart = {
      x: whiteBallPos.x + Math.cos(angleRad) * 20,
      y: whiteBallPos.y + Math.sin(angleRad) * 20,
    };
    const aimEnd = {
      x: whiteBallPos.x + Math.cos(angleRad) * 320,
      y: whiteBallPos.y + Math.sin(angleRad) * 320,
    };

    const aimGradient = ctx.createLinearGradient(aimStart.x, aimStart.y, aimEnd.x, aimEnd.y);
    aimGradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    aimGradient.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    aimGradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.moveTo(aimStart.x, aimStart.y);
    ctx.lineTo(aimEnd.x, aimEnd.y);
    ctx.strokeStyle = aimGradient;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const cueLength = 184;
    const recoil = phase === 'charging' ? cue.power * 0.8 : 0;
    const cueDistance = 26 + recoil;

    const startX = whiteBallPos.x - Math.cos(angleRad) * cueDistance;
    const startY = whiteBallPos.y - Math.sin(angleRad) * cueDistance;
    const endX = startX - Math.cos(angleRad) * cueLength;
    const endY = startY - Math.sin(angleRad) * cueLength;

    ctx.beginPath();
    ctx.moveTo(startX + 3, startY + 3);
    ctx.lineTo(endX + 3, endY + 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    const cueGradient = ctx.createLinearGradient(startX, startY, endX, endY);
    cueGradient.addColorStop(0, '#d4a574');
    cueGradient.addColorStop(0.42, '#8b5a2b');
    cueGradient.addColorStop(1, '#3d2817');

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = cueGradient;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    const ringX = startX - Math.cos(angleRad) * 30;
    const ringY = startY - Math.sin(angleRad) * 30;
    ctx.beginPath();
    ctx.arc(ringX, ringY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    if (phase !== 'charging') {
      return;
    }

    const barWidth = 110;
    const barHeight = 8;
    const barX = whiteBallPos.x - barWidth / 2;
    const barY = whiteBallPos.y - 64;

    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    const powerGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    powerGradient.addColorStop(0, '#22c55e');
    powerGradient.addColorStop(0.6, '#eab308');
    powerGradient.addColorStop(1, '#dc2626');

    ctx.fillStyle = powerGradient;
    ctx.fillRect(barX, barY, (cue.power / 100) * barWidth, barHeight);
  }

  resize(width: number, height: number): void {
    this.config = { width, height };
    this.dpr = window.devicePixelRatio || 1;
    this.applyCanvasSize();

    // ARQUITETO: Recriar layers se necessário (switch implícito)
    if (USE_LAYER_MANAGER && this.container && this.layerManager) {
      this.container.innerHTML = '';
      this.layerManager = new LayerManager(this.container, width, height);

      this.tableCtx = this.layerManager.createLayer({
        name: 'table',
        zIndex: 0,
        isStatic: true
      });

      this.ballsCtx = this.layerManager.createLayer({
        name: 'balls',
        zIndex: 1,
        isStatic: false
      });

      this.uiCtx = this.layerManager.createLayer({
        name: 'ui',
        zIndex: 2,
        isStatic: false
      });

      this.tableRendered = false;
    }
  }

  // ARQUITETO: Renderização com layers - Fase 2
  renderWithLayers(table: Table, balls: Ball[], cue: Cue, phase: GamePhase, whiteBallPos: Vector2): void {
    if (!this.layerManager || !this.tableCtx || !this.ballsCtx || !this.uiCtx) return;

    // Layer 0: Mesa (apenas 1x)
    if (!this.tableRendered) {
      this.renderTableToContext(table, this.tableCtx);
      this.tableRendered = true;
    }

    // Layer 1: Bolas (limpar e redesenhar)
    this.layerManager.clearLayer('balls');
    balls.forEach(ball => {
      this.renderBallToContext(ball, this.ballsCtx!);
    });

    // Layer 2: UI/Taco (limpar e redesenhar)
    this.layerManager.clearLayer('ui');
    this.renderCueToContext(cue, phase, whiteBallPos, this.uiCtx!);
  }

  // ARQUITETO: Verificar se está usando layers
  isUsingLayers(): boolean {
    return USE_LAYER_MANAGER && !!this.layerManager;
  }

  private applyCanvasSize(): void {
    this.canvas.width = this.config.width * this.dpr;
    this.canvas.height = this.config.height * this.dpr;
    this.canvas.style.width = `${this.config.width}px`;
    this.canvas.style.height = `${this.config.height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  // ARQUITETO: Métodos de renderização para contexto específico (LayerManager)
  private renderTableToContext(table: Table, targetCtx: CanvasRenderingContext2D): void {
    const originalCtx = this.ctx;
    this.ctx = targetCtx;
    this.renderTable(table);
    this.ctx = originalCtx;
  }

  private renderBallToContext(ball: Ball, targetCtx: CanvasRenderingContext2D): void {
    const originalCtx = this.ctx;
    this.ctx = targetCtx;
    this.renderBall(ball);
    this.ctx = originalCtx;
  }

  private renderCueToContext(cue: Cue, phase: GamePhase, whiteBallPos: Vector2, targetCtx: CanvasRenderingContext2D): void {
    const originalCtx = this.ctx;
    this.ctx = targetCtx;
    this.renderCue(cue, phase, whiteBallPos);
    this.ctx = originalCtx;
  }

  private renderPremiumPockets(pockets: Table['pockets']): void {
    const { ctx } = this;

    pockets.forEach(pocket => {
      const x = pocket.position.x;
      const y = pocket.position.y;
      const radius = pocket.radius;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#2f2f2f';
      ctx.lineWidth = 5;
      ctx.stroke();

      const innerGradient = ctx.createRadialGradient(
        x - radius * 0.3,
        y - radius * 0.3,
        0,
        x,
        y,
        radius + 2
      );
      innerGradient.addColorStop(0, '#303030');
      innerGradient.addColorStop(1, '#000000');

      ctx.beginPath();
      ctx.arc(x, y, Math.max(radius + 2, 1), 0, Math.PI * 2);
      ctx.fillStyle = innerGradient;
      ctx.fill();
      ctx.restore();
    });
  }

  private renderInnerCushions(geometry: TableGeometry): void {
    const { ctx } = this;
    const color = '#6f2f2a';
    const edgeColor = '#9f4b43';
    const shadowColor = 'rgba(0,0,0,0.24)';

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    this.fillPolygon([
      { x: geometry.playLeft + geometry.cornerCut - 8, y: geometry.outerTop + 8 },
      { x: geometry.centerX - geometry.sidePocketHalf - 8, y: geometry.outerTop + 8 },
      { x: geometry.centerX - geometry.sidePocketHalf + 16, y: geometry.playTop - 4 },
      { x: geometry.playLeft + geometry.cornerCut + 14, y: geometry.playTop - 4 },
    ]);
    this.fillPolygon([
      { x: geometry.centerX + geometry.sidePocketHalf + 8, y: geometry.outerTop + 8 },
      { x: geometry.playRight - geometry.cornerCut + 8, y: geometry.outerTop + 8 },
      { x: geometry.playRight - geometry.cornerCut - 14, y: geometry.playTop - 4 },
      { x: geometry.centerX + geometry.sidePocketHalf - 16, y: geometry.playTop - 4 },
    ]);
    this.fillPolygon([
      { x: geometry.playLeft + geometry.cornerCut - 8, y: geometry.outerBottom - 8 },
      { x: geometry.centerX - geometry.sidePocketHalf - 8, y: geometry.outerBottom - 8 },
      { x: geometry.centerX - geometry.sidePocketHalf + 16, y: geometry.playBottom + 4 },
      { x: geometry.playLeft + geometry.cornerCut + 14, y: geometry.playBottom + 4 },
    ]);
    this.fillPolygon([
      { x: geometry.centerX + geometry.sidePocketHalf + 8, y: geometry.outerBottom - 8 },
      { x: geometry.playRight - geometry.cornerCut + 8, y: geometry.outerBottom - 8 },
      { x: geometry.playRight - geometry.cornerCut - 14, y: geometry.playBottom + 4 },
      { x: geometry.centerX + geometry.sidePocketHalf - 16, y: geometry.playBottom + 4 },
    ]);
    this.fillPolygon([
      { x: geometry.outerLeft + 8, y: geometry.playTop + geometry.cornerCut - 8 },
      { x: geometry.playLeft - 4, y: geometry.playTop + geometry.cornerCut + 14 },
      { x: geometry.playLeft - 4, y: geometry.playBottom - geometry.cornerCut - 14 },
      { x: geometry.outerLeft + 8, y: geometry.playBottom - geometry.cornerCut + 8 },
    ]);
    this.fillPolygon([
      { x: geometry.outerRight - 8, y: geometry.playTop + geometry.cornerCut - 8 },
      { x: geometry.playRight + 4, y: geometry.playTop + geometry.cornerCut + 14 },
      { x: geometry.playRight + 4, y: geometry.playBottom - geometry.cornerCut - 14 },
      { x: geometry.outerRight - 8, y: geometry.playBottom - geometry.cornerCut + 8 },
    ]);
    ctx.restore();
  }

  private getTableGeometry(table: Table): TableGeometry {
    const width = table.width;
    const height = table.height;
    const topLeftPocket = table.pockets.find(pocket => pocket.id === 'tl');
    const topCenterPocket = table.pockets.find(pocket => pocket.id === 'tc');
    const topRightPocket = table.pockets.find(pocket => pocket.id === 'tr');
    const bottomLeftPocket = table.pockets.find(pocket => pocket.id === 'bl');
    const bottomCenterPocket = table.pockets.find(pocket => pocket.id === 'bc');

    if (!topLeftPocket || !topCenterPocket || !topRightPocket || !bottomLeftPocket || !bottomCenterPocket) {
      throw new Error('Expected pocket positions to be available for rendering.');
    }

    return {
      outerLeft: 20,
      outerTop: 20,
      outerRight: width - 20,
      outerBottom: height - 20,
      playLeft: topLeftPocket.position.x + 1,
      playTop: topLeftPocket.position.y + 1,
      playRight: topRightPocket.position.x - 1,
      playBottom: bottomLeftPocket.position.y - 1,
      centerX: topCenterPocket.position.x,
      cornerCut: topLeftPocket.radius + 12,
      sidePocketHalf: topCenterPocket.radius + 28,
      sidePocketDepth: topLeftPocket.position.y - topCenterPocket.position.y + 18,
      railDepth: 26,
    };
  }

  private tracePlayfieldPath(geometry: TableGeometry): void {
    const { ctx } = this;
    const left = geometry.playLeft;
    const top = geometry.playTop;
    const right = geometry.playRight;
    const bottom = geometry.playBottom;
    const centerX = geometry.centerX;
    const cornerCut = geometry.cornerCut;
    const sidePocketHalf = geometry.sidePocketHalf;
    const sidePocketDepth = geometry.sidePocketDepth;

    ctx.beginPath();
    ctx.moveTo(left + cornerCut, top);
    ctx.lineTo(centerX - sidePocketHalf, top);
    ctx.lineTo(centerX - sidePocketHalf + 18, top + sidePocketDepth);
    ctx.lineTo(centerX + sidePocketHalf - 18, top + sidePocketDepth);
    ctx.lineTo(centerX + sidePocketHalf, top);
    ctx.lineTo(right - cornerCut, top);
    ctx.lineTo(right, top + cornerCut);
    ctx.lineTo(right, bottom - cornerCut);
    ctx.lineTo(right - cornerCut, bottom);
    ctx.lineTo(centerX + sidePocketHalf, bottom);
    ctx.lineTo(centerX + sidePocketHalf - 18, bottom - sidePocketDepth);
    ctx.lineTo(centerX - sidePocketHalf + 18, bottom - sidePocketDepth);
    ctx.lineTo(centerX - sidePocketHalf, bottom);
    ctx.lineTo(left + cornerCut, bottom);
    ctx.lineTo(left, bottom - cornerCut);
    ctx.lineTo(left, top + cornerCut);
    ctx.closePath();
  }

  private fillPolygon(points: Vector2[]): void {
    const { ctx } = this;
    if (points.length < 3) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const { ctx } = this;
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }
}
