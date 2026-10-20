import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { fileForUpload } from './upload';
import type {
  AssistantReply,
  CalendarEvent,
  CropCycle,
  CropInfo,
  CropRecommendation,
  CurrentPrices,
  Diagnosis,
  Farm,
  FarmerProfile,
  Inbox,
  SupportMessage,
  SupportThread,
  Language,
  Location,
  NotificationPreferences,
  PriceHistory,
  ProfitResult,
  Scheme,
  SchemeEligibility,
  SoilRecord,
  VoiceCatalog,
  VoicePreferences,
  VoiceSession,
  WeatherAlert,
  WeatherReport,
  YieldEstimate,
} from './types';

// Speech recognition, the answer and its speech together can take 10-20 s (longer on a
// rate-limited free tier); plant photos go through a model. Ordinary requests keep 30 s.
const SLOW_REQUEST_MS = 90_000;

export const keys = {
  profile: ['profile'] as const,
  farms: ['farms'] as const,
  soil: (farmId: string) => ['soil', farmId] as const,
  cycles: ['cycles'] as const,
  catalog: ['catalog'] as const,
  weather: ['weather'] as const,
  calendar: ['calendar'] as const,
  schemes: ['schemes'] as const,
  prices: (commodity: string) => ['prices', commodity] as const,
  history: (commodity: string) => ['history', commodity] as const,
  inbox: ['inbox'] as const,
  voices: ['voices'] as const,
  support: ['support'] as const,
};

// --- Profile & farm ---------------------------------------------------------------------

export const useProfile = (enabled = true) =>
  useQuery({ queryKey: keys.profile, queryFn: () => api<FarmerProfile>('/farmer/profile'), enabled });

export interface ProfileUpdate {
  name?: string;
  preferred_language?: Language;
  birth_year?: number;
  location?: Partial<Location> & { state: string; district: string };
  notification_preferences?: NotificationPreferences;
  voice_preferences?: VoicePreferences;
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => api<FarmerProfile>('/farmer/profile', { method: 'PUT', body: { ...update } }),
    onSuccess: (profile, update) => {
      client.setQueryData(keys.profile, profile);
      if (update.preferred_language) {
        // Server content (schemes, advice, weather text) is written in the farmer's language:
        // refetch everything so nothing stays in the previous language.
        void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== keys.profile[0] });
      } else {
        void client.invalidateQueries({ queryKey: keys.weather });
      }
    },
  });
}

export const useFarms = () => useQuery({ queryKey: keys.farms, queryFn: () => api<Farm[]>('/farms') });

export function useSaveFarm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...farm }: Omit<Farm, 'id'> & { id?: string }) =>
      id ? api<Farm>(`/farms/${id}`, { method: 'PUT', body: farm }) : api<Farm>('/farms', { method: 'POST', body: farm }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.farms }),
  });
}

export const useSoilRecords = (farmId: string | undefined) =>
  useQuery({
    queryKey: keys.soil(farmId ?? ''),
    queryFn: () => api<SoilRecord[]>(`/farms/${farmId}/soil`),
    enabled: Boolean(farmId),
  });

export function useAddSoilRecord(farmId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (record: Omit<SoilRecord, 'id' | 'farm_id' | 'source'>) =>
      api<SoilRecord>(`/farms/${farmId}/soil`, { method: 'POST', body: { ...record } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.soil(farmId) }),
  });
}

export const useCycles = () => useQuery({ queryKey: keys.cycles, queryFn: () => api<CropCycle[]>('/farms/cycles') });

export function useStartCycle(farmId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (cycle: Pick<CropCycle, 'crop_slug' | 'season' | 'sowing_date' | 'area_acres'>) =>
      api<CropCycle>(`/farms/${farmId}/cycles`, { method: 'POST', body: { ...cycle } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.cycles });
      void client.invalidateQueries({ queryKey: keys.calendar });
    },
  });
}

export const useCropCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => api<CropInfo[]>('/crop/catalog'), staleTime: 60 * 60 * 1000 });

// --- Information services ----------------------------------------------------------------

export const useWeather = (enabled = true) =>
  useQuery({ queryKey: keys.weather, queryFn: () => api<WeatherReport>('/weather'), enabled, staleTime: 10 * 60 * 1000 });

export const useCalendar = () =>
  useQuery({
    queryKey: keys.calendar,
    queryFn: () => api<{ events: CalendarEvent[]; weather_alerts: WeatherAlert[] }>('/calendar'),
  });

export function useToggleEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<void>(`/calendar/events/${id}`, { method: 'PATCH', body: { done } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.calendar }),
  });
}

export const useSchemes = () =>
  useQuery({ queryKey: keys.schemes, queryFn: () => api<SchemeEligibility[]>('/schemes/eligible') });

export const useAllSchemes = () => useQuery({ queryKey: ['all-schemes'], queryFn: () => api<Scheme[]>('/schemes') });

export const usePrices = (commodity: string | null) =>
  useQuery({
    queryKey: keys.prices(commodity ?? ''),
    queryFn: () => api<CurrentPrices>('/market/prices', { query: { commodity } }),
    enabled: Boolean(commodity),
  });

export const usePriceHistory = (commodity: string | null) =>
  useQuery({
    queryKey: keys.history(commodity ?? ''),
    queryFn: () => api<PriceHistory>('/market/history', { query: { commodity, days: 90 } }),
    enabled: Boolean(commodity),
  });

// --- Predictions & calculators -----------------------------------------------------------

export const useCropRecommendation = () =>
  useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<CropRecommendation>('/crop/recommend', { method: 'POST', body: input }),
  });

export const useYieldEstimate = () =>
  useMutation({
    mutationFn: (input: { crop: string; area_acres: number }) =>
      api<YieldEstimate>('/yield/predict', { method: 'POST', body: input }),
  });

export const useProfit = () =>
  useMutation({
    mutationFn: (input: Record<string, unknown>) => api<ProfitResult>('/profit/calculate', { method: 'POST', body: input }),
  });

export interface PhotoInput {
  uri: string;
  mimeType: string;
  kind: 'disease' | 'pest';
  requestId: string;
}

export const useDiagnosis = () =>
  useMutation({
    mutationFn: async ({ uri, mimeType, kind, requestId }: PhotoInput) => {
      const form = new FormData();
      const extension = mimeType.split('/')[1] ?? 'jpg';
      form.append('image', await fileForUpload(uri, `photo.${extension}`, mimeType));
      // The same request id on retry makes the server replay instead of re-running the model.
      return api<Diagnosis>(`/${kind}/predict`, {
        method: 'POST',
        body: form,
        headers: { 'Idempotency-Key': requestId },
        timeoutMs: SLOW_REQUEST_MS,
      });
    },
  });

// --- Assistant & voice -------------------------------------------------------------------


export const askAssistant = (text: string, sessionId: string | null, language: Language) =>
  api<AssistantReply>('/assistant/query', {
    method: 'POST',
    body: { text, session_id: sessionId, language, speak: true },
    timeoutMs: SLOW_REQUEST_MS,
  });

export const startVoiceSession = (language: Language) =>
  api<VoiceSession>('/voice/session', { method: 'POST', body: { language } });

export async function sendUtterance(voiceSessionId: string, recordingUri: string, chatSessionId: string | null) {
  const form = new FormData();
  form.append('audio', await fileForUpload(recordingUri, 'question.m4a', 'audio/mp4'));
  if (chatSessionId) form.append('chat_session_id', chatSessionId);
  return api<AssistantReply>(`/voice/session/${voiceSessionId}/utterance`, {
    method: 'POST',
    body: form,
    timeoutMs: SLOW_REQUEST_MS,
  });
}

export const registerPushToken = (pushToken: string) =>
  api<void>('/farmer/push-token', { method: 'PUT', body: { push_token: pushToken } });

// --- Alerts & voices ---------------------------------------------------------------------

export const useInbox = () =>
  useQuery({ queryKey: keys.inbox, queryFn: () => api<Inbox>('/notifications'), refetchInterval: 5 * 60 * 1000 });

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api<void>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.inbox }),
  });
}

// --- Help desk ---------------------------------------------------------------------------

/** The farmer's conversation with the AgriSmart team; polled so admin replies appear on their own. */
export const useSupport = () =>
  useQuery({ queryKey: keys.support, queryFn: () => api<SupportThread>('/support'), refetchInterval: 15_000 });

export const useSupportUnread = () =>
  useQuery({
    queryKey: [...keys.support, 'unread'] as const,
    queryFn: () => api<{ unread: number }>('/support/unread'),
    refetchInterval: 60_000,
  });

export function useSendSupport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<SupportMessage>('/support', { method: 'POST', body: { body } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.support }),
  });
}

export function useMarkSupportRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/support/read', { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.support }),
  });
}

export const useVoices = () =>
  useQuery({ queryKey: keys.voices, queryFn: () => api<VoiceCatalog>('/voice/voices'), staleTime: 60 * 60 * 1000 });

/** Server speech in the farmer's chosen voice; null when the server has no TTS. */
export async function serverSpeech(
  text: string,
  language: Language,
  voicePreferences?: VoicePreferences,
): Promise<string | null> {
  try {
    const result = await api<{ audio_base64: string }>('/voice/tts', {
      method: 'POST',
      body: { text, language, voice_preferences: voicePreferences },
      timeoutMs: SLOW_REQUEST_MS,
    });
    return result.audio_base64;
  } catch {
    return null;
  }
}

