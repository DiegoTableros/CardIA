// Alias de tipos GENERADOS desde /openapi.json (make contracts). No escribir tipos de API a mano (D5).
import type { components } from './schema';

type S = components['schemas'];

export type CardSummary = S['CardSummary'];
export type CardDetail = S['CardDetail'];
export type CardFacets = S['CardFacets'];
export type CardListResponse = S['CardListResponse'];
export type ProfileTag = S['ProfileTag'];
export type FeeOut = S['FeeOut'];
export type BenefitOut = S['BenefitOut'];
export type CompareResponse = S['CompareResponse'];
export type CompareMetric = S['CompareMetric'];
export type UserProfileIn = S['UserProfileIn'];
export type RecommendResponse = S['RecommendResponse'];
export type Recommendation = S['Recommendation'];
export type ProfileOut = S['ProfileOut'];
export type ChatPlanResponse = S['ChatPlanResponse'];
export type ChatRunResponse = S['ChatRunResponse'];
export type PlanStep = S['PlanStep'];
export type ChatTopicsResponse = S['ChatTopicsResponse'];
export type BIResponse = S['BIResponse'];
export type LabelCount = S['LabelCount'];
export type AdminOverview = S['AdminOverview'];
export type AuditEventPage = S['AuditEventPage'];
export type ChatRunSummary = S['ChatRunSummary'];
export type AdminUsers = S['AdminUsers'];
export type TokenResponse = S['TokenResponse'];
export type UserOut = S['UserOut'];
export type HealthResponse = S['HealthResponse'];

export type CardQueryParams = {
  q?: string;
  institution?: string;
  card_class?: string;
  benefit_type?: string;
  profile_id?: number;
  no_annual_fee?: boolean;
  max_annual_fee?: number;
  sort?: 'name' | 'annual_fee' | 'cat' | 'interest_rate' | 'credit_line_min' | 'benefits';
  limit?: number;
};
