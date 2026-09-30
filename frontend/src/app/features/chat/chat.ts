import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import type { CardSummary, PlanStep } from '../../core/api/types';
import { money, pct } from '../../core/format';
import { renderMarkdown } from '../../core/markdown';
import { CardVisual } from '../../shared/card-visual';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  html?: string;
  plan?: PlanStep[];
  cards?: CardSummary[];
  suggestions?: string[];
  status?: 'planning' | 'running' | 'done' | 'error';
  mode?: string;
  ms?: number;
}

const SESSION_KEY = 'cardia.chat.session';
const HISTORY_KEY = 'cardia.chat.history';

const AGENT_META: Record<string, { label: string; color: string; icon: string }> = {
  FundamentalsAgent: { label: 'Fundamentals', color: '#a78bfa', icon: 'cards' },
  ComisionesAgent: { label: 'Comisiones', color: '#f472b6', icon: 'wallet' },
  EducativeAgent: { label: 'Educativo', color: '#22d3ee', icon: 'book' },
  PerfilAgent: { label: 'Perfil', color: '#f59e0b', icon: 'brain' },
};

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, Icon, Logo, CardVisual],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
      <!-- Conversacion -->
      <section class="glass flex h-[calc(100dvh-10rem)] min-h-[520px] flex-col overflow-hidden">
        <header class="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3 sm:px-5">
          <div class="flex items-center gap-3">
            <app-logo [size]="34" [showText]="false" />
            <div>
              <h1 class="text-base font-semibold">Asistente CardIA</h1>
              <p class="flex items-center gap-1.5 text-xs text-slate-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> 4 agentes · datos de la base de tarjetas
              </p>
            </div>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="newChat()" [disabled]="busy()"><app-icon name="plus" [size]="14" /> Nueva</button>
        </header>

        <div #scroller class="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
          @if (messages().length === 0) {
            <div class="mx-auto max-w-xl py-6 text-center animate-fade-up">
              <div class="mx-auto mb-4 w-fit"><app-logo [size]="56" [showText]="false" /></div>
              <h2 class="text-2xl font-bold">¿En qué te ayudo hoy?</h2>
              <p class="mt-2 text-sm text-slate-400">
                Pregúntame cómo funciona una tarjeta, qué cobra un banco o qué tarjetas tienen cierto beneficio. Antes de responder te muestro el plan de
                consultas que voy a hacer.
              </p>
              <div class="mt-6 grid gap-2 text-left sm:grid-cols-2">
                @for (s of starters; track s.q) {
                  <button type="button" class="surface flex items-start gap-3 p-3 text-sm text-slate-300 transition hover:border-brand-400/40 hover:text-white" (click)="send(s.q)">
                    <app-icon [name]="s.icon" [size]="18" class="mt-0.5 text-brand-400" /> {{ s.q }}
                  </button>
                }
              </div>
            </div>
          }

          @for (m of messages(); track m.id) {
            @if (m.role === 'user') {
              <div class="flex justify-end animate-fade-up">
                <p class="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-hot-500 px-4 py-2.5 text-[15px] text-white shadow-lg">{{ m.text }}</p>
              </div>
            } @else {
              <div class="flex gap-3 animate-fade-up">
                <app-logo [size]="30" [showText]="false" class="mt-1 hidden sm:inline-flex" />
                <div class="min-w-0 flex-1 space-y-3">
                  <!-- PLAN -->
                  @if (m.plan?.length) {
                    <div class="rounded-2xl border border-white/8 bg-ink-950/50 p-3.5">
                      <p class="mb-2.5 flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        <span class="flex items-center gap-1.5"><app-icon name="layers" [size]="13" /> Plan de ejecución · {{ m.plan!.length }} pasos</span>
                        @if (m.ms !== undefined) {
                          <span class="font-normal normal-case text-slate-500">{{ m.ms }} ms · modo {{ m.mode }}</span>
                        }
                      </p>
                      <ol class="space-y-1.5">
                        @for (s of m.plan; track s.id) {
                          <li class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm" [class.bg-white/3]="s.status === 'running'">
                            <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" [class]="stepClass(s.status)">
                              @switch (s.status) {
                                @case ('ok') { <app-icon name="check" [size]="11" [stroke]="3" /> }
                                @case ('error') { <app-icon name="x" [size]="11" [stroke]="3" /> }
                                @case ('running') { <span class="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> }
                                @default { <span class="text-[10px] font-bold">{{ $index + 1 }}</span> }
                              }
                            </span>
                            <span class="min-w-0 flex-1">
                              <span class="flex flex-wrap items-center gap-1.5">
                                <span class="badge !normal-case" [style.background]="agent(s.agent).color + '22'" [style.color]="agent(s.agent).color">
                                  <app-icon [name]="agent(s.agent).icon" [size]="11" /> {{ agent(s.agent).label }}
                                </span>
                                <code class="text-xs text-slate-300">{{ s.tool }}</code>
                                @if (s.depends_on?.length) {
                                  <span class="text-[11px] text-slate-500">← {{ s.depends_on!.join(', ') }}</span>
                                }
                              </span>
                              <span class="mt-0.5 block text-xs text-slate-400">{{ s.summary || s.rationale }}</span>
                            </span>
                          </li>
                        }
                      </ol>
                    </div>
                  }

                  @if (m.status === 'planning') {
                    <div class="flex items-center gap-2 text-sm text-slate-400">
                      <span class="flex gap-1"><span class="h-2 w-2 animate-pulse-soft rounded-full bg-brand-400"></span><span class="h-2 w-2 animate-pulse-soft rounded-full bg-hot-400 [animation-delay:.2s]"></span><span class="h-2 w-2 animate-pulse-soft rounded-full bg-accent-400 [animation-delay:.4s]"></span></span>
                      Planeando consultas…
                    </div>
                  }

                  @if (m.html) {
                    <div class="surface prose-cardia px-4 py-3.5 sm:px-5" [innerHTML]="m.html"></div>
                  }

                  @if (m.cards?.length) {
                    <div class="flex gap-3 overflow-x-auto pb-1">
                      @for (c of m.cards; track c.id) {
                        <a [routerLink]="['/tarjetas', c.id]" class="surface w-52 shrink-0 p-2.5 transition hover:border-white/20">
                          <div class="text-[11px]"><app-card-visual [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" /></div>
                          <p class="mt-2 truncate text-sm font-semibold text-white">{{ c.name }}</p>
                          <p class="text-xs text-slate-400">{{ c.annual_fee ? money(c.annual_fee) : 'Sin anualidad' }} · {{ pct(c.interest_rate) }}</p>
                        </a>
                      }
                    </div>
                  }

                  @if (m.status === 'done') {
                    <p class="text-[11px] leading-relaxed text-slate-500">Herramienta educativa: datos de Banxico y CONDUSEF; no es asesoría financiera.</p>
                  }

                  @if (m.suggestions?.length && $last) {
                    <div class="flex flex-wrap gap-2">
                      @for (s of m.suggestions; track s) {
                        <button type="button" class="chip" (click)="send(s)">{{ s }}</button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <form class="border-t border-white/6 p-3 sm:p-4" (ngSubmit)="send(draft)">
          <div class="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink-950/70 p-1.5 transition focus-within:border-brand-400/60 focus-within:ring-4 focus-within:ring-brand-500/15">
            <label for="msg" class="sr-only">Escribe tu pregunta</label>
            <textarea
              id="msg"
              name="msg"
              rows="1"
              class="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-white placeholder:text-slate-500 focus:outline-none"
              placeholder="Pregunta sobre tarjetas, comisiones o conceptos…"
              [(ngModel)]="draft"
              (keydown.enter)="onEnter($event)"
              maxlength="1000"
              [disabled]="busy()"
            ></textarea>
            <button type="submit" class="btn-primary h-10 w-10 !p-0" [disabled]="busy() || !draft.trim()" aria-label="Enviar">
              <app-icon name="send" [size]="16" />
            </button>
          </div>
          <p class="mt-2 px-1 text-[11px] text-slate-500">No compartas datos personales (RFC, CURP, números de tarjeta). CardIA no los necesita.</p>
        </form>
      </section>

      <!-- Lateral -->
      <aside class="hidden space-y-4 lg:block">
        <div class="surface p-4">
          <h2 class="text-sm font-semibold">Equipo de agentes</h2>
          <ul class="mt-3 space-y-3">
            @for (a of agents; track a.key) {
              <li class="flex gap-3">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg" [style.background]="a.color + '22'" [style.color]="a.color"><app-icon [name]="a.icon" [size]="16" /></span>
                <span>
                  <span class="block text-sm font-medium text-white">{{ a.label }}</span>
                  <span class="block text-xs text-slate-400">{{ a.desc }}</span>
                </span>
              </li>
            }
          </ul>
        </div>
        <div class="surface p-4">
          <h2 class="text-sm font-semibold">Temas para aprender</h2>
          <div class="mt-3 flex flex-wrap gap-1.5">
            @for (t of topics; track t) {
              <button type="button" class="chip" (click)="send('¿Qué es ' + t + '?')" [disabled]="busy()">{{ t }}</button>
            }
          </div>
        </div>
        <div class="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs leading-relaxed text-amber-100/80">
          <strong class="text-amber-200">Modo actual: reglas.</strong> Las respuestas se arman solo con datos de las tools. Con una
          <code>OPENAI_API_KEY</code> el planner y el narrador usarán el LLM (fase 4).
        </div>
      </aside>
    </div>
  `,
})
export class ChatPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');
  readonly q = input<string>();

  protected readonly money = money;
  protected readonly pct = pct;
  protected draft = '';
  protected readonly messages = signal<Message[]>(this.readHistory());
  protected readonly busy = signal(false);
  private sessionId = localStorage.getItem(SESSION_KEY) ?? this.newSessionId();

  protected readonly starters = [
    { icon: 'book', q: '¿Cómo funciona una tarjeta de crédito?' },
    { icon: 'wallet', q: '¿Qué es el pago mínimo y cómo se calcula?' },
    { icon: 'gift', q: '¿Qué tarjetas no cobran anualidad? sin anualidad' },
    { icon: 'compare', q: 'Compara Black Unlimited y Santander Free' },
  ];
  protected readonly topics = ['el CAT', 'la fecha de corte', 'el pago mínimo', 'la anualidad', 'el Buró de Crédito', 'la disposición de efectivo', 'los meses sin intereses'];
  protected readonly agents = [
    { key: 'f', label: 'Fundamentals', color: '#a78bfa', icon: 'cards', desc: 'Fichas, búsquedas y comparativas de tarjetas.' },
    { key: 'c', label: 'Comisiones', color: '#f472b6', icon: 'wallet', desc: 'Desglose de cobros y su impacto si la tienes.' },
    { key: 'e', label: 'Educativo', color: '#22d3ee', icon: 'book', desc: 'Conceptos de TDC para inclusión financiera.' },
    { key: 'p', label: 'Perfil', color: '#f59e0b', icon: 'brain', desc: 'Interpreta los perfiles del modelo de clusters.' },
  ];

  protected readonly hasMessages = computed(() => this.messages().length > 0);

  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollDown());
    });
    afterNextRender(() => {
      const q = this.q();
      if (q) {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        this.send(q);
      }
    });
  }

  onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send(this.draft);
    }
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.draft = '';
    this.busy.set(true);
    const aid = crypto.randomUUID();
    this.push({ id: crypto.randomUUID(), role: 'user', text: message });
    this.push({ id: aid, role: 'assistant', text: '', status: 'planning' });

    try {
      // Paso 1 (D8): el plan llega ANTES de ejecutar y se muestra.
      const plan = await firstValueFrom(this.api.chatPlan(message, this.sessionId));
      this.patch(aid, { plan: plan.plan.map((s) => ({ ...s, status: 'pending' })), status: 'running', mode: plan.mode });
      await this.animatePlan(aid, plan.plan.length);
      // Paso 2: ejecucion por niveles.
      const run = await firstValueFrom(this.api.chatExecute(plan.run_id));
      this.patch(aid, {
        plan: run.plan,
        text: run.answer,
        html: renderMarkdown(run.answer),
        cards: run.cards,
        suggestions: run.suggestions,
        status: 'done',
        ms: run.duration_ms,
        mode: run.mode,
      });
    } catch {
      this.patch(aid, {
        status: 'error',
        html: renderMarkdown('> No pude conectar con el asistente. Verifica que el backend esté corriendo e inténtalo de nuevo.'),
      });
    } finally {
      this.busy.set(false);
      this.saveHistory();
    }
  }

  newChat(): void {
    this.messages.set([]);
    this.sessionId = this.newSessionId();
    localStorage.removeItem(HISTORY_KEY);
  }

  agent(name: string) {
    return AGENT_META[name] ?? { label: name, color: '#94a3b8', icon: 'bolt' };
  }

  stepClass(status: string): string {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500 text-white';
      case 'error':
        return 'bg-rose-500 text-white';
      case 'skipped':
        return 'bg-slate-600 text-white';
      case 'running':
        return 'bg-brand-500 text-white';
      default:
        return 'bg-white/10 text-slate-400';
    }
  }

  /** Marca visualmente cada paso como "ejecutando" mientras llega la respuesta. */
  private async animatePlan(id: string, n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      const m = this.messages().find((x) => x.id === id);
      if (!m?.plan) return;
      this.patch(id, { plan: m.plan.map((s, j) => ({ ...s, status: j < i ? 'ok' : j === i ? 'running' : 'pending' })) });
      await new Promise((r) => setTimeout(r, 260));
    }
  }

  private push(m: Message): void {
    this.messages.update((list) => [...list, m]);
  }

  private patch(id: string, p: Partial<Message>): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }

  private scrollDown(): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  private newSessionId(): string {
    const id = crypto.randomUUID().slice(0, 18);
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  private saveHistory(): void {
    const slim = this.messages()
      .slice(-30)
      .map(({ html: _h, ...rest }) => rest);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(slim));
  }

  private readHistory(): Message[] {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Message[];
      return raw.map((m) => (m.role === 'assistant' && m.text ? { ...m, html: renderMarkdown(m.text), status: 'done' } : m));
    } catch {
      return [];
    }
  }
}
