/** Types mirroring the backend's Pydantic schemas (backend/app/<module>/schemas.py). */

export type Language = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'mr' | 'bn' | 'gu' | 'ml' | 'pa' | 'or';
export type Season = 'kharif' | 'rabi' | 'zaid' | 'whole_year';
export type Irrigation = 'rainfed' | 'canal' | 'borewell' | 'drip' | 'sprinkler';
export type SoilType = 'alluvial' | 'black' | 'red' | 'laterite' | 'sandy' | 'clay' | 'loamy';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  role: 'farmer' | 'admin';
  is_new_user: boolean;
}

export interface Location {
  state: string;
  district: string;
  village: string;
  latitude: number | null;
  longitude: number | null;
}

export interface NotificationPreferences {
  weather: boolean;
  market: boolean;
  schemes: boolean;
  calendar: boolean;
  disease: boolean;
}

export type VoiceGender = 'female' | 'male';

export interface VoicePreferences {
  gender: VoiceGender;
  pace: number; // 0.75–1.25
  voice: string | null;
}

export interface VoiceOption {
  id: string;
  label: string;
  gender: VoiceGender;
  description: string;
}

export interface VoiceCatalog {
  provider: string;
  speech_synthesis: boolean;
  voices: VoiceOption[];
}

export interface InboxItem {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: InboxItem[];
}

export interface SupportMessage {
  id: string;
  sender: 'farmer' | 'admin';
  body: string;
  created_at: string;
  read: boolean;
}

export interface SupportThread {
  unread: number;
  messages: SupportMessage[];
}

export interface FarmerProfile {
  id: string;
  name: string;
  phone: string;
  preferred_language: Language;
  primary_channel: 'app' | 'phone';
  birth_year: number | null;
  location: Location | null;
  notification_preferences: NotificationPreferences;
  voice_preferences: VoicePreferences;
  profile_complete: boolean;
}

export interface Farm {
  id: string;
  name: string;
  area_acres: number;
  soil_type: SoilType | null;
  irrigation: Irrigation;
}

export interface SoilRecord {
  id: string;
  farm_id: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  organic_carbon: number | null;
  tested_on: string;
  source: string;
}

export interface CropCycle {
  id: string;
  farm_id: string;
  crop_slug: string;
  season: Season;
  sowing_date: string;
  area_acres: number;
  status: 'planned' | 'active' | 'harvested';
}

export interface CropInfo {
  slug: string;
  names: Partial<Record<Language, string>>;
  category: string;
  seasons: Season[];
  duration_days_min: number;
  duration_days_max: number;
  water_requirement: 'low' | 'medium' | 'high';
  suitable_soils: SoilType[];
  fertilizer_guidance: string;
  yield_min_q_per_acre: number;
  yield_max_q_per_acre: number;
  market_commodity: string | null;
}

export interface WeatherAlert {
  code: string;
  severity: 'info' | 'warning' | 'severe';
  on: string;
  params: Record<string, number | string>;
}

export interface DailyForecast {
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  rain_mm: number;
  rain_probability_pct: number;
  wind_max_kmh: number;
  condition: string;
}

export interface WeatherReport {
  current: {
    temperature_c: number;
    humidity_pct: number;
    precipitation_mm: number;
    wind_kmh: number;
    condition: string;
  };
  daily: DailyForecast[];
  rainfall_last_90_days_mm: number;
  alerts: WeatherAlert[];
  fetched_at: string;
}

export interface MarketPrice {
  kind: 'observed';
  market: string;
  district: string;
  state: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export interface CurrentPrices {
  commodity: string;
  state: string | null;
  prices: MarketPrice[];
  fetched_at: string | null;
  stale: boolean;
}

export interface PriceHistory {
  commodity: string;
  points: { kind: 'historical'; date: string; avg_modal_price: number; min_price: number; max_price: number }[];
}

export interface Scheme {
  id: string;
  code: string;
  name: string;
  summary: string;
  benefits: string;
  eligibility_text: string;
  application_process: string;
  official_url: string;
  last_verified_on: string;
  translated: boolean;
}

export interface SchemeEligibility {
  scheme: Scheme;
  status: 'eligible' | 'maybe' | 'not_eligible';
  missing_facts: string[];
}

export interface CalendarEvent {
  id: string;
  crop_slug: string;
  event_type: string;
  detail_key: string;
  scheduled_on: string;
  window_days: number;
  done: boolean;
}

export interface CropOption {
  crop: string;
  name: string;
  model_probability: number | null; // soil/climate model; null for crops it does not cover
  regional_share: number | null; // share of the region's cropped area this season
  score: number; // combined suitability across all crops, 0–1
  reasons: string[];
  duration_days: [number, number] | null;
  water_requirement: string | null;
  expected_yield_q_per_acre: [number, number] | null;
}

export interface CropRecommendation {
  model_version: string;
  recommended: CropOption;
  alternatives: CropOption[];
  inputs_used: Record<string, number | string | null>;
  warnings: string[];
}

export interface YieldEstimate {
  crop_name: string;
  expected_q_per_acre: number;
  low_q_per_acre: number;
  high_q_per_acre: number;
  expected_total_quintals: number;
  low_total_quintals: number;
  high_total_quintals: number;
  assumptions: Record<string, number | string>;
  warnings: string[];
}

export interface ProfitResult {
  production_quintals: number;
  revenue: number;
  total_cost: number;
  profit: number;
  margin_pct: number | null;
  break_even_price_per_quintal: number | null;
  break_even_yield_q_per_acre: number | null;
  scenarios: { key: string; revenue: number; total_cost: number; profit: number }[];
}

export interface Diagnosis {
  request_id: string;
  kind: 'disease' | 'pest';
  accepted: boolean;
  label: string;
  name: string;
  confidence: number;
  is_healthy: boolean;
  candidates: { label: string; name: string; confidence: number }[];
  sections: { key: string; items: string[] }[];
  summary: string;
  expert_verified: boolean;
  translated: boolean;
}

export interface AssistantAction {
  type: 'capture_image' | 'open_screen';
  target: string;
}

export interface AssistantReply {
  session_id: string | null;
  intent: string;
  handled_by: string;
  language: Language;
  text: string;
  data: Record<string, unknown> | null;
  action: AssistantAction | null;
  audio_base64: string | null;
  audio_mime: string | null;
  transcript: string | null;
}

export interface VoiceSession {
  session_id: string;
  language: Language;
  greeting: string;
  greeting_audio_base64: string | null;
  capabilities: { provider: string; speech_recognition: boolean; speech_synthesis: boolean };
}
