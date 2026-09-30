import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { FeeOut } from '../../core/api/types';
import { BENEFIT_ICON, FEE_TYPE_LABEL, money, pct } from '../../core/format';
import { CardVisual } from '../../shared/card-visual';
import { CompareStore } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer, ErrorState } from '../../shared/states';
import { Donut } from '../../viz/donut';

type FeeFilter = 'todas' | 'obligatoria' | 'por_evento' | 'penalizacion';

const FEE_COLORS: Record<string, string> = { obligatoria: '#8b5cf6', por_evento: '#22d3ee', penalizacion: '#f472b6' };

@Component({
  selector: 'app-card-detail',
  imports: [RouterLink, CardVisual, Icon, ErrorState, Disclaimer, Donut],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/tarjetas" class="btn-ghost btn-sm -ml-2"><app-icon name="back" [size]="14" /> Catálogo</a>

    @if (card.error()) {
      <app-error-state class="mt-6 block" title="No encontramos esta tarjeta" message="Puede que el enlace sea incorrecto." (retry)="card.reload()" />
    } @else if (card.isLoading() && !card.value()) {
      <div class="mt-6 grid gap-8 lg:grid-cols-[420px_1fr]">
        <div class="skeleton aspect-[1.586]"></div>
        <div class="space-y-4"><div class="skeleton h-10 w-2/3"></div><div class="skeleton h-24"></div><div class="skeleton h-40"></div></div>
      </div>
    } @else if (card.value(); as c) {
      <!-- Encabezado -->
      <section class="mt-4 grid items-center gap-8 lg:grid-cols-[420px_1fr]">
        <div class="relative mx-auto w-full max-w-md animate-fade-up">
          <div class="absolute inset-6 rounded-full blur-3xl" [style.background]="c.profile.color + '55'"></div>
          <div class="relative text-[18px] transition duration-700 hover:[transform:perspective(900px)_rotateY(-10deg)_rotateX(6deg)]">
            <app-card-visual [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" />
          </div>
        </div>
        <div class="animate-fade-up [animation-delay:80ms]">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge" [style.background]="c.profile.color + '26'" [style.color]="c.profile.color">Perfil {{ c.profile.label }}</span>
            <span class="badge bg-white/8 text-slate-300">{{ c.card_class }}</span>
            <span class="badge bg-white/8 text-slate-300">ID {{ c.id }}</span>
          </div>
          <h1 class="mt-3 text-3xl font-bold sm:text-4xl">{{ c.name }}</h1>
          <p class="mt-1 text-lg text-slate-400">{{ c.institution }}</p>
          <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="kpi">
              <dt class="kpi-label">Anualidad</dt>
              <dd class="kpi-value" [class.text-emerald-300]="!c.annual_fee">{{ c.annual_fee ? money(c.annual_fee) : '$0' }}</dd>
            </div>
            <div class="kpi">
              <dt class="kpi-label">CAT</dt>
              <dd class="kpi-value">{{ pct(c.cat) }}</dd>
            </div>
            <div class="kpi">
              <dt class="kpi-label">Tasa</dt>
              <dd class="kpi-value">{{ pct(c.interest_rate) }}</dd>
            </div>
            <div class="kpi">
              <dt class="kpi-label">Línea desde</dt>
              <dd class="kpi-value">{{ money(c.credit_line_min) }}</dd>
            </div>
          </dl>
          <div class="mt-6 flex flex-wrap gap-3">
            <button type="button" class="btn-secondary" (click)="compare.toggle(c.id)" [disabled]="!compare.has(c.id) && compare.full()">
              <app-icon [name]="compare.has(c.id) ? 'check' : 'compare'" [size]="16" /> {{ compare.has(c.id) ? 'En comparación' : 'Agregar a comparar' }}
            </button>
            <button type="button" class="btn-primary" (click)="ask('¿Qué comisiones cobra ' + c.name + '?')">
              <app-icon name="chat" [size]="16" /> Preguntar al asistente
            </button>
          </div>
        </div>
      </section>

      <div class="mt-10 grid gap-6 lg:grid-cols-3">
        <!-- Requisitos -->
        <section class="surface p-5">
          <h2 class="flex items-center gap-2 text-lg font-semibold"><app-icon name="user" class="text-accent-400" /> Requisitos</h2>
          <ul class="mt-4 divide-y divide-white/5 text-sm">
            <li class="flex justify-between gap-3 py-2.5"><span class="text-slate-400">Edad</span><span class="font-medium text-white">{{ ageRange() }}</span></li>
            <li class="flex justify-between gap-3 py-2.5"><span class="text-slate-400">Ingreso mensual mínimo</span><span class="font-medium text-white">{{ money(c.requirements.monthly_income_min) }}</span></li>
            <li class="flex justify-between gap-3 py-2.5"><span class="text-slate-400">Score mínimo</span><span class="font-medium" [class]="c.requirements.score_min ? 'text-white' : 'text-slate-500'">{{ c.requirements.score_min ?? 'No publicado' }}</span></li>
            <li class="flex justify-between gap-3 py-2.5"><span class="text-slate-400">Antigüedad laboral</span><span class="font-medium" [class]="c.requirements.work_seniority_min ? 'text-white' : 'text-slate-500'">{{ c.requirements.work_seniority_min ?? 'No publicada' }}</span></li>
            <li class="flex justify-between gap-3 py-2.5"><span class="text-slate-400">Antigüedad residencial</span><span class="font-medium" [class]="c.requirements.residence_seniority_min ? 'text-white' : 'text-slate-500'">{{ c.requirements.residence_seniority_min ?? 'No publicada' }}</span></li>
          </ul>
          <p class="mt-3 text-xs text-slate-500">"No publicado" significa que la fuente no reporta el dato; no lo inventamos.</p>
        </section>

        <!-- Beneficios -->
        <section class="surface p-5 lg:col-span-2">
          <h2 class="flex items-center gap-2 text-lg font-semibold"><app-icon name="gift" class="text-hot-400" /> Beneficios ({{ c.benefits.length }})</h2>
          @if (c.benefits.length) {
            <ul class="mt-4 grid gap-3 sm:grid-cols-2">
              @for (b of c.benefits; track $index) {
                <li class="rounded-xl border border-white/6 bg-white/3 p-3.5">
                  <p class="flex items-center gap-2 text-sm font-semibold text-white">
                    <span class="grid h-7 w-7 place-items-center rounded-lg bg-accent-400/15 text-accent-400"><app-icon [name]="icon(b.benefit_type)" [size]="14" /></span>
                    {{ b.benefit_type }}
                  </p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-400">{{ b.text }}</p>
                </li>
              }
            </ul>
          } @else {
            <p class="mt-4 text-sm text-slate-500">La fuente no reporta beneficios para esta tarjeta.</p>
          }
        </section>
      </div>

      <!-- Comisiones -->
      <section class="surface mt-6 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="flex items-center gap-2 text-lg font-semibold"><app-icon name="wallet" class="text-brand-400" /> Desglose de comisiones</h2>
          <div class="flex flex-wrap gap-2" role="tablist">
            @for (f of feeFilters; track f.key) {
              <button type="button" role="tab" class="chip" [class.chip-active]="feeFilter() === f.key" [attr.aria-selected]="feeFilter() === f.key" (click)="feeFilter.set(f.key)">
                {{ f.label }} <span class="text-slate-500">{{ feeCount(f.key) }}</span>
              </button>
            }
          </div>
        </div>
        <div class="mt-5 grid gap-6 lg:grid-cols-[280px_1fr]">
          <app-donut [slices]="feeSlices()" ariaLabel="Comisiones por tipo" />
          <div class="overflow-x-auto">
            <table class="table-base">
              <thead>
                <tr><th>Concepto</th><th>Tipo</th><th class="text-right">Monto</th></tr>
              </thead>
              <tbody>
                @for (f of visibleFees(); track $index) {
                  <tr>
                    <td class="font-medium text-white">{{ f.concept }}</td>
                    <td>
                      <span class="badge" [style.background]="feeColor(f.fee_type) + '22'" [style.color]="feeColor(f.fee_type)">{{ feeLabel(f.fee_type) }}</span>
                    </td>
                    <td class="text-right font-semibold whitespace-nowrap text-white tabular-nums">{{ feeAmount(f) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="py-6 text-center text-slate-500">Sin comisiones de este tipo.</td></tr>
                }
              </tbody>
            </table>
            <p class="mt-3 text-xs text-slate-500">Montos sin IVA según la fuente. Los porcentajes se aplican sobre el monto de la transacción.</p>
          </div>
        </div>
      </section>

      <app-disclaimer class="mt-8 block" [text]="c.disclaimer" />
    }
  `,
})
export class CardDetailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly compare = inject(CompareStore);
  protected readonly money = money;
  protected readonly pct = pct;

  readonly id = input.required<string>();
  protected readonly card = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.card(params) });
  protected readonly feeFilter = signal<FeeFilter>('todas');
  protected readonly feeFilters: { key: FeeFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'obligatoria', label: 'Obligatorias' },
    { key: 'por_evento', label: 'Por evento' },
    { key: 'penalizacion', label: 'Penalizaciones' },
  ];

  protected readonly visibleFees = computed(() => {
    const fees = this.card.value()?.fees ?? [];
    const f = this.feeFilter();
    return f === 'todas' ? fees : fees.filter((x) => x.fee_type === f);
  });

  protected readonly feeSlices = computed(() => {
    const c = this.card.value()?.fee_counts;
    if (!c) return [];
    return [
      { label: 'Obligatorias', value: c.obligatoria ?? 0, color: FEE_COLORS['obligatoria'] },
      { label: 'Por evento', value: c.por_evento ?? 0, color: FEE_COLORS['por_evento'] },
      { label: 'Penalizaciones', value: c.penalizacion ?? 0, color: FEE_COLORS['penalizacion'] },
    ];
  });

  protected readonly ageRange = computed(() => {
    const r = this.card.value()?.requirements;
    if (!r) return '';
    if (r.age_min && r.age_max) return `${r.age_min} a ${r.age_max} años`;
    if (r.age_min) return `Desde ${r.age_min} años`;
    return 'No publicada';
  });

  feeCount(key: FeeFilter): number {
    const fees = this.card.value()?.fees ?? [];
    return key === 'todas' ? fees.length : fees.filter((f) => f.fee_type === key).length;
  }

  feeAmount(f: FeeOut): string {
    if (f.amount === null || f.amount === undefined) return 'N/D';
    if (f.denomination === 'PCT') return `${f.amount}%`;
    if (f.denomination === 'USD') return `US$${f.amount}`;
    return money(f.amount);
  }

  feeLabel(t: string): string {
    return FEE_TYPE_LABEL[t] ?? t;
  }

  feeColor(t: string): string {
    return FEE_COLORS[t] ?? '#94a3b8';
  }

  icon(b: string): string {
    return BENEFIT_ICON[b] ?? 'star';
  }

  ask(q: string): void {
    this.router.navigate(['/asistente'], { queryParams: { q } });
  }
}
