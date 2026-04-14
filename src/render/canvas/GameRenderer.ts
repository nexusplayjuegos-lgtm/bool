import { Ball, Cue, GamePhase, Table, Vector2 } from '@/engine/types';
import { darkenHexColor } from '@/render/effects/color';

interface RenderConfig {
  width: number;
  height: number;
  tableColor: string;
  cushionColor: string;
  feltTexture?: boolean;
}

const BALL_COLORS: Record<Ball['color'], string> = {
  white: '#ffffff',
  red: '#dc2626',
  yellow: '#fbbf24',
  green: '#16a34a',
  brown: '#92400e',
  blue: '#2563eb',
  pink: '#ec4899',
  black: '#171717',
  orange: '#f97316',
  purple: '#9333ea',
  maroon: '#7f1d1d',
  cyan: '#06b6d4',
};

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: RenderConfig) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    this.ctx = ctx;
    this.config = config;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = config.width * dpr;
    canvas.height = config.height * dpr;
    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;
    ctx.scale(dpr, dpr);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
  }

  renderTable(table: Table): void {
    const { ctx, config } = this;

    const gradient = ctx.createRadialGradient(
      table.width / 2,
      table.height / 2,
      40,
      table.width / 2,
      table.height / 2,
      table.width
    );
    gradient.addColorStop(0, config.tableColor);
    gradient.addColorStop(1, '#0d3d1a');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, table.width, table.height);

    if (config.feltTexture) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let y = 0; y < table.height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(table.width, y);
        ctx.stroke();
      }
    }

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;

    ctx.fillStyle = config.cushionColor;
    ctx.fillRect(0, -20, table.width, 20);
    ctx.fillRect(0, table.height, table.width, 20);
    ctx.fillRect(-20, 0, 20, table.height);
    ctx.fillRect(table.width, 0, 20, table.height);

    ctx.shadowColor = 'transparent';

    table.pockets.forEach(pocket => {
      ctx.beginPath();
      ctx.arc(pocket.position.x, pocket.position.y, pocket.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();

      ctx.strokeStyle = '#3b2d1f';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  renderBall(ball: Ball): void {
    if (ball.inPocket) {
      return;
    }

    const { ctx } = this;
    const { x, y } = ball.position;
    const { radius, color } = ball;

    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, radius * 0.8, radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 0, x, y, radius);
    const baseColor = BALL_COLORS[color];
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.22, baseColor);
    gradient.addColorStop(1, darkenHexColor(baseColor, 35));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x - radius * 0.28, y - radius * 0.28, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    if (color !== 'white') {
      ctx.fillStyle = color === 'yellow' ? '#111111' : '#ffffff';
      ctx.font = `700 ${Math.max(10, radius * 0.95)}px var(--font-geist-sans), sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ball.number), x, y);
    }
  }

  renderCue(cue: Cue, phase: GamePhase, whiteBallPos: Vector2): void {
    if (phase !== 'aiming' && phase !== 'charging') {
      return;
    }

    const { ctx } = this;
    const angleRad = (cue.angle * Math.PI) / 180;
    const cueLength = 200;
    const cueDistance = 30 + (cue.power / 100) * 50;

    const startX = whiteBallPos.x - Math.cos(angleRad) * cueDistance;
    const startY = whiteBallPos.y - Math.sin(angleRad) * cueDistance;
    const endX = startX - Math.cos(angleRad) * cueLength;
    const endY = startY - Math.sin(angleRad) * cueLength;

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(whiteBallPos.x, whiteBallPos.y);
    ctx.lineTo(
      whiteBallPos.x + Math.cos(angleRad) * 540,
      whiteBallPos.y + Math.sin(angleRad) * 540
    );
    ctx.stroke();
    ctx.setLineDash([]);

    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, '#d4a574');
    gradient.addColorStop(0.3, '#8b5a2b');
    gradient.addColorStop(1, '#3d2817');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    if (phase === 'charging') {
      const width = 120;
      const height = 12;
      const x = whiteBallPos.x - width / 2;
      const y = whiteBallPos.y - 58;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x, y, width, height);

      const powerGradient = ctx.createLinearGradient(x, y, x + width, y);
      powerGradient.addColorStop(0, '#22c55e');
      powerGradient.addColorStop(0.55, '#eab308');
      powerGradient.addColorStop(1, '#dc2626');

      ctx.fillStyle = powerGradient;
      ctx.fillRect(x, y, (cue.power / 100) * width, height);
    }
  }
}
