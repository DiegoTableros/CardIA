import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import type {
  AdminOverview,
  AdminUsers,
  AuditEventPage,
  BIResponse,
  CardDetail,
  CardFacets,
  CardListResponse,
  CardQueryParams,
  ChatPlanResponse,
  ChatRunResponse,
  ChatRunSummary,
  ChatTopicsResponse,
  CompareResponse,
  RecommendResponse,
  TokenResponse,
  UserOut,
  UserProfileIn,
} from './types';

const API = '/api/v1';

function toParams(obj: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '' && v !== false) p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private allCards$?: Observable<CardListResponse>;
  private facets$?: Observable<CardFacets>;

  login(email: string, password: string) {
    return this.http.post<TokenResponse>(`${API}/auth/login`, { email, password });
  }
  me() {
    return this.http.get<UserOut>(`${API}/auth/me`);
  }
  logout() {
    return this.http.post<void>(`${API}/auth/logout`, {});
  }

  /** Catalogo completo (69 tarjetas, datos estaticos): se cachea en memoria. */
  allCards(): Observable<CardListResponse> {
    this.allCards$ ??= this.http
      .get<CardListResponse>(`${API}/cards`, { params: toParams({ limit: 100 }) })
      .pipe(shareReplay(1));
    return this.allCards$;
  }
  cards(query: CardQueryParams) {
    return this.http.get<CardListResponse>(`${API}/cards`, { params: toParams(query) });
  }
  facets(): Observable<CardFacets> {
    this.facets$ ??= this.http.get<CardFacets>(`${API}/cards/facets`).pipe(shareReplay(1));
    return this.facets$;
  }
  card(id: string) {
    return this.http.get<CardDetail>(`${API}/cards/${id}`);
  }
  compare(cardIds: string[]) {
    return this.http.post<CompareResponse>(`${API}/compare`, { card_ids: cardIds });
  }
  recommend(profile: UserProfileIn) {
    return this.http.post<RecommendResponse>(`${API}/recommend`, profile);
  }

  chatPlan(message: string, sessionId: string) {
    return this.http.post<ChatPlanResponse>(`${API}/chat/plan`, { message, session_id: sessionId });
  }
  chatExecute(runId: string) {
    return this.http.post<ChatRunResponse>(`${API}/chat/runs/${runId}/execute`, {});
  }
  chatAsk(message: string, sessionId: string) {
    return this.http.post<ChatRunResponse>(`${API}/chat/ask`, { message, session_id: sessionId });
  }
  chatTopics() {
    return this.http.get<ChatTopicsResponse>(`${API}/chat/topics`);
  }
  chatRuns(sessionId: string) {
    return this.http.get<ChatRunResponse[]>(`${API}/chat/runs`, { params: toParams({ session_id: sessionId }) });
  }

  bi() {
    return this.http.get<BIResponse>(`${API}/bi`);
  }

  adminOverview() {
    return this.http.get<AdminOverview>(`${API}/admin/overview`);
  }
  adminEvents(action?: string, limit = 50, offset = 0) {
    return this.http.get<AuditEventPage>(`${API}/admin/events`, { params: toParams({ action, limit, offset }) });
  }
  adminChatRuns() {
    return this.http.get<ChatRunSummary[]>(`${API}/admin/chat-runs`);
  }
  adminUsers() {
    return this.http.get<AdminUsers>(`${API}/admin/users`);
  }

  resetCache(): void {
    this.allCards$ = undefined;
    this.facets$ = undefined;
  }
}
