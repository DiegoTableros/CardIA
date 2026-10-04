import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { money, pct } from '../../core/format';
import { Icon } from '../../shared/icon';
import { ErrorState } from '../../shared/states';
import { BarList } from '../../viz/bar-list';
import { Donut } from '../../viz/donut';
import { Scatter } from '../../viz/scatter';

const PROFILE_ICON: Record<string, string> = { arranque: 'sprout', cotidiana: 'cart', tasa_baja: 'percent', premium: 'plane' };
const PALETTE = ['#8b5cf6', '#22d3ee', '#f472b6', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];

@Component({
  selector: 'app-bi',
  imports: [RouterLink, Icon, ErrorState, BarList, Donut, Scatter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="section-eyebrow">Perfiles</p>
        <h1 class="section-title sm:text-4xl">Perfiles y mercado de tarjetas</h1>
        <p class="mt-2 max-w-2xl text-slate-400">Resultados del agrupamiento de las tarjetas en perfiles y panorama del mercado con la base consolidada.</p>
      </div>
      @if (bi.value()?.model; as m) {
        <span class="badge px-3 py-1.5" [class]="m.is_stub ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'">
          <app-icon name="brain" [size]="13" /> Modelo {{ m.version }}{{ m.is_stub ? ' · preliminar' : '' }}
        </span>
      }
    </header>

    @if (bi.error()) {
      <app-error-state class="mt-8 block" (retry)="bi.reload()" />
    } @else if (bi.isLoading() && !bi.value()) {
      <div class="mt-8 grid gap-4 sm:grid-cols-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="skeleton h-24"></div>
        }
      </div>
      <div class="skeleton mt-6 h-80"></div>
    } @else if (bi.value(); as d) {
      <!-- KPIs -->
      <dl class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="kpi"><dt class="kpi-label">Tarjetas</dt><dd class="kpi-value">{{ d.kpis.cards }}</dd><p class="mt-1 text-xs text-slate-500">{{ d.kpis.institutions }} instituciones</p></div>
        <div class="kpi"><dt class="kpi-label">CAT promedio</dt><dd class="kpi-value">{{ pct(d.kpis.avg_cat) }}</dd><p class="mt-1 text-xs text-slate-500">sin IVA, publicidad</p></div>
        <div class="kpi"><dt class="kpi-label">Tasa promedio</dt><dd class="kpi-value">{{ pct(d.kpis.avg_interest_rate) }}</dd><p class="mt-1 text-xs text-slate-500">anual de contrato</p></div>
        <div class="kpi"><dt class="kpi-label">Anualidad promedio</dt><dd class="kpi-value">{{ money(d.kpis.avg_annual_fee) }}</dd><p class="mt-1 text-xs text-slate-500">{{ d.kpis.no_annual_fee }} sin anualidad</p></div>
      </dl>

      <!-- Perfiles -->
      <section class="mt-10">
        <h2 class="text-xl font-semibold">Perfiles (clusters)</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (p of d.profiles; track p.profile.id) {
            <button
              type="button"
              class="surface relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5"
              [class.ring-2]="selected() === p.profile.id"
              [style.--tw-ring-color]="p.profile.color"
              (click)="selected.set(selected() === p.profile.id ? null : p.profile.id)"
              [attr.aria-pressed]="selected() === p.profile.id"
            >
              <div class="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full opacity-25 blur-2xl" [style.background]="p.profile.color"></div>
              <div class="flex items-center justify-between">
                <span class="grid h-10 w-10 place-items-center rounded-xl" [style.background]="p.profile.color + '26'" [style.color]="p.profile.color"><app-icon [name]="p.profile.icon || 'layers'" [size]="20" /></span>
                <span class="font-display text-3xl font-bold text-white">{{ p.profile.card_count }}</span>
              </div>
              <h3 class="mt-3 text-lg font-semibold">{{ p.profile.label }}</h3>
              <p class="text-sm text-slate-400">{{ p.profile.tagline }}</p>
              <dl class="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-white/4 p-2"><dt class="text-slate-500">Anualidad</dt><dd class="font-semibold text-white">{{ money(p.avg_annual_fee) }}</dd></div>
                <div class="rounded-lg bg-white/4 p-2"><dt class="text-slate-500">Tasa</dt><dd class="font-semibold text-white">{{ pct(p.avg_interest_rate) }}</dd></div>
                <div class="rounded-lg bg-white/4 p-2"><dt class="text-slate-500">CAT</dt><dd class="font-semibold text-white">{{ pct(p.avg_cat) }}</dd></div>
                <div class="rounded-lg bg-white/4 p-2"><dt class="text-slate-500">Línea</dt><dd class="font-semibold text-white">{{ money(p.avg_credit_line) }}</dd></div>
              </dl>
              <div class="mt-3 flex flex-wrap gap-1">
                @for (b of p.top_benefits; track b.label) {
                  <span class="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{{ b.label }}</span>
                }
              </div>
            </button>
          }
        </div>
      </section>

      <!-- Scatter -->
      <section class="surface mt-6 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">Mapa de tarjetas: anualidad vs. tasa</h2>
            <p class="text-sm text-slate-400">Cada punto es una tarjeta, coloreada por perfil. Haz clic en un perfil para resaltarlo.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (p of d.profiles; track p.profile.id) {
              <button type="button" class="chip" [class.chip-active]="selected() === p.profile.id" (click)="selected.set(selected() === p.profile.id ? null : p.profile.id)">
                <span class="h-2 w-2 rounded-full" [style.background]="p.profile.color"></span> {{ p.profile.label }}
              </button>
            }
          </div>
        </div>
        <div class="mt-4"><app-scatter [points]="points()" [highlight]="selected()" /></div>
      </section>

      <!-- Distribuciones -->
      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <section class="surface p-5">
          <h2 class="text-lg font-semibold">Tarjetas por clase</h2>
          <div class="mt-4"><app-donut [slices]="classSlices()" ariaLabel="Tarjetas por clase" /></div>
        </section>
        <section class="surface p-5">
          <h2 class="text-lg font-semibold">Tipos de beneficio</h2>
          <div class="mt-4"><app-bar-list [items]="bars(d.benefit_types)" /></div>
        </section>
        <section class="surface p-5">
          <h2 class="text-lg font-semibold">Rangos de anualidad</h2>
          <div class="mt-4"><app-bar-list [items]="bars(d.annual_fee_buckets)" /></div>
          <h2 class="mt-6 text-lg font-semibold">Comisiones por tipo</h2>
          <div class="mt-4"><app-bar-list [items]="bars(d.fee_types)" /></div>
        </section>
      </div>

      <section class="surface mt-6 p-5">
        <h2 class="text-lg font-semibold">Tarjetas por institución</h2>
        <div class="mt-4 grid gap-x-10 md:grid-cols-2"><app-bar-list [items]="bars(d.by_institution)" /></div>
      </section>

      @if (d.report; as rep) {
        <section class="surface mt-6 p-5">
          <h2 class="text-lg font-semibold">Cómo se asigna el perfil y se ordenan las tarjetas</h2>
          <ol class="mt-5 grid gap-3 lg:grid-cols-5">
            @for (s of flow; track s.title; let i = $index; let last = $last) {
              <li class="relative flex">
                <div class="flex w-full flex-col rounded-xl border border-white/8 bg-white/3 p-4">
                  <span class="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-hot-500 text-sm font-bold text-white">{{ i + 1 }}</span>
                  <h3 class="mt-3 text-sm font-semibold text-white">{{ s.title }}</h3>
                  <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ s.text }}</p>
                </div>
                @if (!last) {
                  <app-icon name="arrow" [size]="16" class="absolute top-1/2 -right-3.5 z-10 hidden -translate-y-1/2 text-accent-400 lg:block" />
                }
              </li>
            }
          </ol>
          <div class="mt-4 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-100/90">
            <app-icon name="alert" [size]="18" class="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <p class="font-semibold text-amber-200">Advertencias</p>
              <p>
                Son avisos que se muestran junto a una tarjeta; no la descartan. Aparecen cuando la tarjeta contradice algo que el usuario pidió (por ejemplo,
                cobra anualidad y dijo que no la quería), cuando su tasa o CAT es alto y el usuario no paga el total, o cuando no ofrece un beneficio que
                buscaba. Las tarjetas atípicas de su cluster solo se advierten; no se les baja el puntaje.
              </p>
            </div>
          </div>
        </section>

        <section class="mt-6">
          <h2 class="text-lg font-semibold">Documentación de los clusters</h2>
          @for (b of rep.intro; track $index) {
            <p class="mt-3 text-sm text-slate-400">{{ b.text }}</p>
          }
          <div class="mt-4 space-y-3">
            @for (c of rep.clusters; track c.id) {
              <details class="surface p-5" [open]="c.id === 0">
                <summary class="cursor-pointer font-semibold text-white">
                  Cluster {{ c.id }} · {{ profileOf(c.id)?.profile?.label }}
                  <span class="font-normal text-slate-500">({{ profileOf(c.id)?.profile?.analytic_name }})</span>
                  <span class="block text-sm font-normal text-slate-400">{{ c.title }}</span>
                </summary>
                <div class="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  @for (b of c.blocks; track $index) {
                    @if (b.kind === 'li') {
                      <p class="pl-4 text-slate-400">• {{ b.text }}</p>
                    } @else {
                      <p>{{ b.text }}</p>
                    }
                  }
                </div>
              </details>
            }
          </div>

        </section>
      }

      <section class="mt-6 rounded-xl border border-white/8 bg-white/3 p-4 text-sm text-slate-400">
        <p class="font-semibold text-white">Sobre el modelo</p>
        <p class="mt-1">{{ d.model.description }}</p>
        <p class="mt-2 text-xs">Variables: {{ d.model.features.join(', ') }}</p>
        <a routerLink="/encuentra-tu-tarjeta" class="btn-secondary btn-sm mt-3"><app-icon name="sparkles" [size]="14" /> Descubre tu perfil</a>
      </section>
    }
  `,
})
export class BiPage {
  private readonly api = inject(ApiService);
  protected readonly money = money;
  protected readonly pct = pct;
  protected readonly bi = rxResource({ stream: () => this.api.bi() });
  protected readonly selected = signal<number | null>(null);
  protected readonly flow = [
    { title: 'Cuestionario', text: 'El usuario responde sobre su edad, ingreso, historial, uso, forma de pago, preferencias e intereses (puede elegir varios).' },
    { title: 'Elegibilidad', text: 'Se descartan las tarjetas cuyos requisitos publicados no cumple. Si falta algún dato, la tarjeta queda «por confirmar» (puntaje -8%).' },
    { title: 'Utilidad', text: 'Cada tarjeta se mide en 9 dimensiones (0 a 1): anualidad, tasa, comisiones, puntos, viaje, promociones, MSI, transferencia de saldo y requisitos accesibles. Las respuestas definen cuánto pesa cada una.' },
    { title: 'Puntaje y orden', text: 'Puntaje = 75% utilidad de la tarjeta + 25% afinidad de su cluster. Si pidió evitar anualidad, las tarjetas con anualidad se multiplican por 0.75. Se ordena: Top 1, Top 2…' },
    { title: 'Perfil', text: 'El perfil del usuario es el cluster de su tarjeta Top 1.' },
  ];

  private readonly colors = computed(() => new Map((this.bi.value()?.profiles ?? []).map((p) => [p.profile.id, p.profile.color])));

  protected readonly points = computed(() =>
    (this.bi.value()?.scatter ?? []).map((p) => ({
      id: p.id,
      label: p.name,
      sub: `${p.institution} · ${money(p.x)} · ${pct(p.y)}`,
      x: p.x,
      y: p.y,
      color: this.colors().get(p.profile_id) ?? '#94a3b8',
      group: p.profile_id,
    })),
  );

  protected readonly classSlices = computed(() =>
    (this.bi.value()?.by_class ?? []).map((c, i) => ({ label: c.label, value: c.count, color: PALETTE[i % PALETTE.length] })),
  );

  profileOf(id: number) {
    return this.bi.value()?.profiles.find((p) => p.profile.id === id);
  }

  bars(items: { label: string; count: number }[]) {
    return items.map((i) => ({ label: i.label, value: i.count }));
  }

  icon(key: string): string {
    return PROFILE_ICON[key] ?? 'layers';
  }
}
