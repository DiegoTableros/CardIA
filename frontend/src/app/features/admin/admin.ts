import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api/api.service';
import { Icon } from '../../shared/icon';
import { ErrorState } from '../../shared/states';
import { BarList } from '../../viz/bar-list';

type Tab = 'eventos' | 'chat' | 'usuarios';

const ACTION_STYLE: Record<string, string> = {
  login: 'bg-emerald-400/15 text-emerald-300',
  logout: 'bg-slate-400/15 text-slate-300',
  login_failed: 'bg-rose-400/15 text-rose-300',
  recommend: 'bg-brand-400/15 text-brand-300',
  chat: 'bg-accent-400/15 text-accent-400',
  compare: 'bg-hot-400/15 text-hot-400',
};

@Component({
  selector: 'app-admin',
  imports: [DatePipe, JsonPipe, Icon, ErrorState, BarList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="section-eyebrow">Administración</p>
        <h1 class="section-title sm:text-4xl">Panel y trazabilidad</h1>
        <p class="mt-2 text-slate-400">Actividad de la plataforma: sesiones, recomendaciones y planes del asistente.</p>
      </div>
      <button type="button" class="btn-secondary btn-sm" (click)="reload()"><app-icon name="refresh" [size]="14" /> Actualizar</button>
    </header>

    @if (overview.error()) {
      <app-error-state class="mt-8 block" (retry)="overview.reload()" />
    } @else if (overview.value(); as o) {
      <dl class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div class="kpi"><dt class="kpi-label">Usuarios</dt><dd class="kpi-value">{{ o.users }}</dd></div>
        <div class="kpi"><dt class="kpi-label">Tarjetas</dt><dd class="kpi-value">{{ o.cards }}</dd></div>
        <div class="kpi"><dt class="kpi-label">Comisiones</dt><dd class="kpi-value">{{ o.fees }}</dd></div>
        <div class="kpi"><dt class="kpi-label">Eventos</dt><dd class="kpi-value">{{ o.events }}</dd></div>
        <div class="kpi"><dt class="kpi-label">Runs de chat</dt><dd class="kpi-value">{{ o.chat_runs }}</dd></div>
        <div class="kpi"><dt class="kpi-label">Recomendaciones</dt><dd class="kpi-value">{{ o.recommendations }}</dd></div>
      </dl>
      <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section class="surface p-5">
          <h2 class="text-lg font-semibold">Eventos por acción</h2>
          <div class="mt-4"><app-bar-list [items]="actionBars()" /></div>
        </section>
        <section class="surface space-y-3 p-5 text-sm">
          <h2 class="text-lg font-semibold">Estado del servicio</h2>
          <p class="flex justify-between gap-2"><span class="text-slate-400">LLM</span><span [class]="o.llm_enabled ? 'text-emerald-300' : 'text-amber-300'">{{ o.llm_enabled ? 'Activo' : 'Modo reglas' }}</span></p>
          <p class="flex justify-between gap-2"><span class="text-slate-400">Base de datos</span><code class="text-xs text-slate-300">{{ o.database }}</code></p>
          <p class="flex justify-between gap-2"><span class="text-slate-400">Datos generados</span><span class="text-slate-300">{{ o.data_generated_at | date: 'medium' }}</span></p>
          <p class="flex justify-between gap-2"><span class="text-slate-400">Beneficios</span><span class="text-slate-300">{{ o.benefits }}</span></p>
        </section>
      </div>
    }

    <section class="surface mt-6 overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 border-b border-white/6 p-3" role="tablist">
        @for (t of tabs; track t.key) {
          <button type="button" role="tab" class="chip" [class.chip-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)">
            <app-icon [name]="t.icon" [size]="13" /> {{ t.label }}
          </button>
        }
        @if (tab() === 'eventos') {
          <label for="act" class="sr-only">Filtrar acción</label>
          <select id="act" class="input ml-auto !w-48 !py-1.5" [value]="action()" (change)="action.set($any($event.target).value)">
            <option value="">Todas las acciones</option>
            @for (a of actions; track a) {
              <option [value]="a">{{ a }}</option>
            }
          </select>
        }
      </div>

      <div class="overflow-x-auto">
        @switch (tab()) {
          @case ('eventos') {
            <table class="table-base">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th class="text-right">ms</th></tr></thead>
              <tbody>
                @for (e of events.value()?.items ?? []; track e.id) {
                  <tr class="cursor-pointer" (click)="expanded.set(expanded() === e.id ? null : e.id)">
                    <td class="whitespace-nowrap text-xs">{{ e.created_at | date: 'short' }}</td>
                    <td class="text-xs">{{ e.user_email ?? '—' }}</td>
                    <td><span class="badge" [class]="actionStyle(e.action)">{{ e.action }}</span></td>
                    <td class="max-w-md">
                      <span class="text-slate-200">{{ e.detail }}</span>
                      @if (expanded() === e.id && e.payload) {
                        <pre class="mt-2 max-h-60 overflow-auto rounded-lg bg-ink-950 p-3 text-[11px] text-slate-400">{{ e.payload | json }}</pre>
                      }
                    </td>
                    <td class="text-right text-xs tabular-nums">{{ e.duration_ms }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="py-10 text-center text-slate-500">{{ events.isLoading() ? 'Cargando…' : 'Sin eventos todavía.' }}</td></tr>
                }
              </tbody>
            </table>
            <p class="px-4 py-3 text-xs text-slate-500">Mostrando {{ events.value()?.items?.length ?? 0 }} de {{ events.value()?.total ?? 0 }} · clic en una fila para ver el payload</p>
          }
          @case ('chat') {
            <table class="table-base">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Pregunta</th><th>Pasos</th><th>Estado</th><th class="text-right">ms</th></tr></thead>
              <tbody>
                @for (r of runs.value() ?? []; track r.id) {
                  <tr>
                    <td class="whitespace-nowrap text-xs">{{ r.created_at | date: 'short' }}</td>
                    <td class="text-xs">{{ r.user_email }}</td>
                    <td class="max-w-md text-slate-200">{{ r.question }}</td>
                    <td class="tabular-nums">{{ r.steps }}</td>
                    <td><span class="badge" [class]="r.status === 'ok' ? 'bg-emerald-400/15 text-emerald-300' : r.status === 'planned' ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300'">{{ r.status }}</span></td>
                    <td class="text-right text-xs tabular-nums">{{ r.duration_ms }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="py-10 text-center text-slate-500">Sin conversaciones todavía.</td></tr>
                }
              </tbody>
            </table>
          }
          @case ('usuarios') {
            <table class="table-base">
              <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Último acceso</th></tr></thead>
              <tbody>
                @for (u of users.value()?.items ?? []; track u.id) {
                  <tr>
                    <td class="font-medium text-white">{{ u.full_name }}</td>
                    <td class="text-xs">{{ u.email }}</td>
                    <td><span class="badge" [class]="u.role === 'admin' ? 'bg-brand-400/15 text-brand-300' : 'bg-white/8 text-slate-300'">{{ u.role }}</span></td>
                    <td class="text-xs">{{ u.last_login_at ? (u.last_login_at | date: 'short') : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      </div>
    </section>
  `,
})
export class AdminPage {
  private readonly api = inject(ApiService);
  protected readonly tab = signal<Tab>('eventos');
  protected readonly action = signal('');
  protected readonly expanded = signal<number | null>(null);
  protected readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'eventos', label: 'Eventos', icon: 'clock' },
    { key: 'chat', label: 'Runs del asistente', icon: 'chat' },
    { key: 'usuarios', label: 'Usuarios', icon: 'user' },
  ];
  protected readonly actions = ['login', 'logout', 'login_failed', 'recommend', 'chat', 'compare'];

  protected readonly overview = rxResource({ stream: () => this.api.adminOverview() });
  protected readonly events = rxResource({ params: () => this.action(), stream: ({ params }) => this.api.adminEvents(params || undefined) });
  protected readonly runs = rxResource({ stream: () => this.api.adminChatRuns() });
  protected readonly users = rxResource({ stream: () => this.api.adminUsers() });

  actionBars() {
    return (this.overview.value()?.by_action ?? []).map((a) => ({ label: a.action, value: a.count }));
  }

  actionStyle(a: string): string {
    return ACTION_STYLE[a] ?? 'bg-white/8 text-slate-300';
  }

  reload(): void {
    this.overview.reload();
    this.events.reload();
    this.runs.reload();
    this.users.reload();
  }
}
