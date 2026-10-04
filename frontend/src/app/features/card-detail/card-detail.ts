import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { FeeOut } from '../../core/api/types';
import { BENEFIT_ICON, money, pct } from '../../core/format';
import { CardArt } from '../../shared/card-art';
import { CompareStore } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer, ErrorState } from '../../shared/states';

interface FeeColumn {
  key: 'obligatoria' | 'por_evento' | 'penalizacion';
  label: string;
  hint: string;
  color: string;
  icon: string;
}

const FEE_COLUMNS: FeeColumn[] = [
  { key: 'obligatoria', label: 'Obligatorias', hint: 'Se cobran por tener la tarjeta', color: '#a78bfa', icon: 'calendar' },
  { key: 'por_evento', label: 'Por evento', hint: 'Solo si usas el servicio', color: '#22d3ee', icon: 'bolt' },
  { key: 'penalizacion', label: 'Penalizaciones', hint: 'Por pagos tardíos o incumplir', color: '#f472b6', icon: 'alert' },
];

@Component({
  selector: 'app-card-detail',
  imports: [RouterLink, CardArt, Icon, ErrorState, Disclaimer],
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
      <section class="mt-4 grid items-center gap-8 lg:grid-cols-[440px_1fr]">
        <div class="relative mx-auto w-full max-w-md animate-fade-up">
          <div class="absolute inset-6 rounded-full blur-3xl" [style.background]="c.profile.color + '40'"></div>
          <div class="relative transition duration-700 hover:[transform:perspective(900px)_rotateY(-10deg)_rotateX(6deg)]">
            <app-card-art [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" [imageUrl]="c.image_url" [orientation]="c.image_orientation" />
          </div>
        </div>
        <div class="animate-fade-up [animation-delay:80ms]">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge" [style.background]="c.profile.color + '26'" [style.color]="c.profile.color">Perfil {{ c.profile.label }}</span>
            <span class="badge bg-white/8 text-slate-300">{{ c.card_class }}</span>
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
          <p class="mt-3 text-xs text-slate-500">«No publicado» significa que la fuente oficial no reporta el dato.</p>
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

      <!-- Comisiones en tres columnas -->
      <section class="surface mt-6 p-5">
        <h2 class="flex items-center gap-2 text-lg font-semibold"><app-icon name="wallet" class="text-brand-400" /> Desglose de comisiones</h2>
        <div class="mt-5 grid gap-4 md:grid-cols-3">
          @for (col of feeColumns; track col.key) {
            <div class="flex flex-col overflow-hidden rounded-xl border bg-white/3" [style.border-color]="col.color + '55'">
              <div class="flex items-center justify-between gap-2 px-4 py-3" [style.background]="col.color + '1f'">
                <div>
                  <p class="flex items-center gap-2 font-semibold" [style.color]="col.color"><app-icon [name]="col.icon" [size]="15" /> {{ col.label }}</p>
                  <p class="text-[11px] text-slate-400">{{ col.hint }}</p>
                </div>
                <span class="font-display text-2xl font-bold text-white">{{ feesOf(col.key).length }}</span>
              </div>
              <ul class="flex-1 divide-y divide-white/5 text-sm">
                @for (f of feesOf(col.key); track $index) {
                  <li class="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span class="text-slate-300">{{ f.concept }}</span>
                    <span class="font-semibold whitespace-nowrap text-white tabular-nums">{{ feeAmount(f) }}</span>
                  </li>
                } @empty {
                  <li class="px-4 py-6 text-center text-xs text-slate-500">Sin comisiones de este tipo.</li>
                }
              </ul>
            </div>
          }
        </div>
        <p class="mt-4 text-xs text-slate-500">Montos sin IVA según la fuente. Los porcentajes se aplican sobre el monto de la transacción.</p>
      </section>

      <!-- Aplica ahora -->
      @if (c.institution_url) {
        <section class="gradient-border relative mt-6 overflow-hidden rounded-2xl p-5 sm:p-6">
          <div class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-brand-500/25 blur-3xl"></div>
          <div class="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold">Aplica ahora:</h2>
              <p class="mt-1 text-sm text-slate-400">Consulta requisitos y condiciones vigentes directamente en el sitio oficial de {{ c.institution }}.</p>
            </div>
            <a class="btn-primary" [href]="c.institution_url" target="_blank" rel="noopener noreferrer">
              Ir al sitio de {{ c.institution }} <app-icon name="arrow" [size]="16" />
            </a>
          </div>
        </section>
      }

      <app-disclaimer class="mt-8 block" />
    }
  `,
})
export class CardDetailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly compare = inject(CompareStore);
  protected readonly money = money;
  protected readonly pct = pct;
  protected readonly feeColumns = FEE_COLUMNS;

  readonly id = input.required<string>();
  protected readonly card = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.card(params) });

  private readonly grouped = computed(() => {
    const out: Record<string, FeeOut[]> = { obligatoria: [], por_evento: [], penalizacion: [] };
    for (const f of this.card.value()?.fees ?? []) (out[f.fee_type] ??= []).push(f);
    return out;
  });

  protected readonly ageRange = computed(() => {
    const r = this.card.value()?.requirements;
    if (!r) return '';
    if (r.age_min && r.age_max) return `${r.age_min} a ${r.age_max} años`;
    if (r.age_min) return `Desde ${r.age_min} años`;
    return 'No publicada';
  });

  feesOf(key: string): FeeOut[] {
    return this.grouped()[key] ?? [];
  }

  feeAmount(f: FeeOut): string {
    if (f.amount === null || f.amount === undefined) return 'N/D';
    if (f.denomination === 'PCT') return `${f.amount}%`;
    if (f.denomination === 'USD') return `US$${f.amount}`;
    return money(f.amount);
  }

  icon(b: string): string {
    return BENEFIT_ICON[b] ?? 'star';
  }

  ask(q: string): void {
    this.router.navigate(['/asistente'], { queryParams: { q } });
  }
}
