import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface Point {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  color: string;
  group: number;
}

const W = 640;
const H = 340;
const PAD = { l: 48, r: 16, t: 16, b: 40 };

@Component({
  selector: 'app-scatter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="h-auto w-full" role="img" [attr.aria-label]="ariaLabel()">
        @for (t of yTicks(); track t.v) {
          <line [attr.x1]="PAD.l" [attr.x2]="W - PAD.r" [attr.y1]="t.y" [attr.y2]="t.y" stroke="rgb(255 255 255 / .06)" />
          <text [attr.x]="PAD.l - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="central" class="fill-slate-500 text-[10px]">{{ t.v }}%</text>
        }
        @for (t of xTicks(); track t.v) {
          <text [attr.x]="t.x" [attr.y]="H - PAD.b + 16" text-anchor="middle" class="fill-slate-500 text-[10px]">{{ t.label }}</text>
        }
        <text [attr.x]="(W + PAD.l) / 2" [attr.y]="H - 4" text-anchor="middle" class="fill-slate-400 text-[11px]">{{ xLabel() }}</text>
        <text [attr.x]="12" [attr.y]="H / 2" text-anchor="middle" class="fill-slate-400 text-[11px]" [attr.transform]="'rotate(-90 12 ' + H / 2 + ')'">{{ yLabel() }}</text>
        @for (p of placed(); track p.id) {
          <circle
            [attr.cx]="p.cx"
            [attr.cy]="p.cy"
            [attr.r]="hover()?.id === p.id ? 9 : 6"
            [attr.fill]="p.color"
            [attr.fill-opacity]="dim(p) ? 0.12 : 0.85"
            stroke="rgb(5 7 15)"
            stroke-width="1.5"
            class="cursor-pointer transition-all duration-200"
            (mouseenter)="hover.set(p)"
            (mouseleave)="hover.set(null)"
            (focus)="hover.set(p)"
            (blur)="hover.set(null)"
            tabindex="0"
          />
        }
      </svg>
      @if (hover(); as h) {
        <div
          class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          [style.left.%]="(h.cx / W) * 100"
          [style.top.%]="(h.cy / H) * 100 - 3"
        >
          <p class="font-semibold text-white">{{ h.label }}</p>
          <p class="text-slate-400">{{ h.sub }}</p>
        </div>
      }
    </div>
  `,
})
export class Scatter {
  readonly points = input.required<Point[]>();
  readonly highlight = input<number | null>(null);
  readonly xLabel = input('Anualidad (MXN)');
  readonly yLabel = input('Tasa de interés');
  readonly ariaLabel = input('Gráfica de dispersión');
  protected readonly hover = signal<(Point & { cx: number; cy: number }) | null>(null);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;

  private readonly bounds = computed(() => {
    const xs = this.points().map((p) => p.x);
    const ys = this.points().map((p) => p.y);
    const xMax = Math.max(1000, ...xs);
    return { xMax: Math.ceil(xMax / 1000) * 1000, yMin: 0, yMax: Math.ceil(Math.max(10, ...ys) / 10) * 10 };
  });

  protected readonly placed = computed(() => {
    const b = this.bounds();
    return this.points().map((p) => ({
      ...p,
      cx: PAD.l + (p.x / b.xMax) * (W - PAD.l - PAD.r),
      cy: H - PAD.b - ((p.y - b.yMin) / (b.yMax - b.yMin)) * (H - PAD.t - PAD.b),
    }));
  });

  protected readonly yTicks = computed(() => {
    const b = this.bounds();
    const out = [];
    for (let v = 0; v <= b.yMax; v += 20) out.push({ v, y: H - PAD.b - (v / b.yMax) * (H - PAD.t - PAD.b) });
    return out;
  });

  protected readonly xTicks = computed(() => {
    const b = this.bounds();
    const step = b.xMax > 4000 ? 1000 : 500;
    const out = [];
    for (let v = 0; v <= b.xMax; v += step)
      out.push({ v, x: PAD.l + (v / b.xMax) * (W - PAD.l - PAD.r), label: v === 0 ? '$0' : `$${v / 1000}k` });
    return out;
  });

  protected dim(p: Point): boolean {
    const h = this.highlight();
    return h !== null && p.group !== h;
  }
}
