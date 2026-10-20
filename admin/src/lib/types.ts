/** Mirrors backend/app/admin/schemas.py and related response models. */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface FarmerRow {
  id: string;
  name: string;
  phone: string;
  preferred_language: string;
  primary_channel: string;
  state: string | null;
  district: string | null;
  farms: number;
  total_acres: number;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
}

export interface FarmRow {
  id: string;
  farmer_name: string;
  name: string;
  area_acres: number;
  soil_type: string | null;
  irrigation: string;
  state: string | null;
  district: string | null;
  active_crops: string[];
}

export interface VoiceSessionRow {
  id: string;
  farmer_name: string | null;
  channel: string;
  language: string;
  provider: string;
  started_at: string;
  duration_seconds: number | null;
  turns: number;
  end_reason: string | null;
}

export interface CountByKey {
  key: string;
  count: number;
}

// A type alias (not an interface) so it satisfies the charts' Record<string, …> constraint.
export type DailyPoint = {
  date: string;
  assistant_requests: number;
  diagnoses: number;
  recommendations: number;
};

export interface Analytics {
  total_farmers: number;
  new_farmers_7d: number;
  active_users_7d: number;
  assistant_requests_24h: number;
  assistant_requests_7d: number;
  voice_sessions_7d: number;
  disease_predictions_7d: number;
  crop_recommendations_7d: number;
  yield_predictions_7d: number;
  failed_assistant_answers_7d: number;
  avg_assistant_latency_ms: number | null;
  diagnosis_acceptance_rate: number | null;
  intents: CountByKey[];
  handled_by: CountByKey[];
  languages: CountByKey[];
  channels: CountByKey[];
  states: CountByKey[];
  notification_deliveries: CountByKey[];
  daily: DailyPoint[];
}

export interface SystemHealth {
  status: string;
  environment: string;
  database_latency_ms: number;
  providers: Record<string, string>;
  voice_capabilities: Record<string, boolean>;
  models_active: Record<string, string | null>;
  models_loaded_here: Record<string, string | null>;
  pending_notifications: number;
  metrics: {
    uptime_seconds: number;
    counters: Record<string, number>;
    latency: Record<string, { count: number; avg_ms: number }>;
  };
}

export interface ModelRow {
  name: string;
  version: string;
  registered: boolean;
  is_active: boolean;
  framework: string | null;
  dataset_version: string | null;
  feature_version: string | null;
  metrics: Record<string, unknown>;
  trained_at: string | null;
  loaded_in_this_instance: boolean;
}

export interface CropInfo {
  slug: string;
  names: Record<string, string>;
  aliases: string[];
  category: string;
  seasons: string[];
  duration_days_min: number;
  duration_days_max: number;
  water_requirement: string;
  suitable_soils: string[];
  fertilizer_guidance: string;
  yield_min_q_per_acre: number;
  yield_max_q_per_acre: number;
  market_commodity: string | null;
}

export interface KnowledgeEntry {
  slug: string;
  names: Record<string, string>;
  verified_by: string | null;
  verified_at: string | null;
  crop_slug?: string;
  is_healthy?: boolean;
  is_beneficial?: boolean;
  [field: string]: unknown;
}

export interface SchemeRule {
  rule_type: string;
  value: unknown;
}

export interface Scheme {
  id: string;
  code: string;
  name: string;
  state: string | null;
  district: string | null;
  summary: string;
  benefits: string;
  eligibility_text: string;
  application_process: string;
  official_url: string;
  source: string;
  last_verified_on: string;
  is_active: boolean;
  rules: SchemeRule[];
}

export interface NotificationRow {
  id: string;
  category: string;
  title: Record<string, string>;
  target: { states?: string[]; districts?: string[]; crops?: string[]; languages?: string[] };
  recipients: number;
  created_at: string;
  sent: number;
  failed: number;
  pending: number;
}

export interface PriceRow {
  commodity: string;
  variety: string;
  market: string;
  district: string;
  state: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  source: string;
  fetched_at: string;
}

export interface WeatherCacheRow {
  key: string;
  fetched_at: string;
  expires_at: string;
  fresh: boolean;
  current: { temperature_c: number; humidity_pct: number; condition: string } | null;
  rainfall_last_90_days_mm: number | null;
}

/** Shape returned by every form server action (used with useActionState). */
export interface ActionState {
  ok: boolean;
  message: string;
}

// --- Support desk and per-farmer activity ---------------------------------------------------

export interface SupportThreadRow {
  farmer_id: string;
  name: string;
  phone: string;
  language: string;
  last_message: string;
  last_sender: "farmer" | "admin";
  last_at: string;
  messages: number;
  awaiting_reply: boolean;
}

export interface SupportThreadPage {
  items: SupportThreadRow[];
  awaiting: number;
}

export interface SupportMessage {
  id: string;
  sender: "farmer" | "admin";
  body: string;
  created_at: string;
  read: boolean;
}

export interface FarmerBrief {
  id: string;
  name: string;
  phone: string;
  language: string;
  state: string | null;
  district: string | null;
}

export interface SupportThreadDetail {
  farmer: FarmerBrief;
  messages: SupportMessage[];
}

export interface FarmerActivity {
  farmer: FarmerBrief;
  joined_at: string;
  last_login_at: string | null;
  is_active: boolean;
  farms: number;
  questions: number;
  diagnoses: number;
  voice_sessions: number;
  top_intents: { intent: string; count: number }[];
  queries: { at: string; question: string; answer: string | null; intent: string | null; handled_by: string | null; channel: string }[];
  diagnosis_log: { at: string; kind: string; label: string; confidence: number; accepted: boolean }[];
  calls: { at: string; channel: string; seconds: number | null; turns: number }[];
}
