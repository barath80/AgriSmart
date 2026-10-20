import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError } from '@/api/client';
import { askAssistant, sendUtterance, startVoiceSession, useProfile } from '@/api/hooks';
import type { AssistantAction, AssistantReply } from '@/api/types';
import { useSession } from '@/auth/session';
import { config } from '@/config';

import { setSpeechGender, setSpeechPace, speak, stopSpeaking } from './speech';

/**
 * One voice-to-voice conversation shared by the home microphone and the assistant screen:
 *   idle → listening → thinking → speaking → idle  (→ listening again in hands-free mode)
 *
 * Listening ends by itself when the farmer stops talking (silence detection on the
 * microphone level), so the farmer never has to find a "stop" button.
 */
export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface Message {
  id: string;
  role: 'farmer' | 'assistant';
  text: string;
  reply?: AssistantReply;
}

interface Conversation {
  phase: Phase;
  messages: Message[];
  errorCode: string | null;
  voiceAvailable: boolean | null; // null = not checked yet
  handsFree: boolean;
  setHandsFree: (on: boolean) => void;
  pressMic: () => Promise<void>;
  ask: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}

const ConversationContext = createContext<Conversation | null>(null);

const SCREEN_FOR_TARGET: Record<string, Href> = {
  soil: '/soil',
  profit: '/profit',
  farm: '/(tabs)/farm',
  profile: '/(tabs)/profile',
};

// Silence detection (microphone level in dBFS, polled while recording).
const POLL_MS = 150;
const SPEECH_DB = -38; // louder than this = the farmer is talking
const END_SILENCE_MS = 1300; // this much quiet after speech ends the question
const NO_SPEECH_MS = 8000; // nobody spoke: stop listening (and leave hands-free mode)

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

let nextId = 0;
const newId = () => `${Date.now()}-${nextId++}`;

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { language, status } = useSession();
  const router = useRouter();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const profile = useProfile(status === 'signedIn');
  const [phase, setPhase] = useState<Phase>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  const [handsFree, setHandsFreeState] = useState(false);
  const handsFreeRef = useRef(false);
  const voiceSession = useRef<{ id: string; language: string } | null>(null);
  const chatSession = useRef<string | null>(null);
  const monitor = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    setSpeechPace(profile.data?.voice_preferences.pace ?? 1);
    setSpeechGender(profile.data?.voice_preferences.gender ?? 'female');
  }, [profile.data?.voice_preferences.pace, profile.data?.voice_preferences.gender]);

  const stopMonitor = () => {
    if (monitor.current) clearInterval(monitor.current);
    monitor.current = null;
  };

  const runAction = useCallback(
    (action: AssistantAction | null) => {
      if (!action) return false;
      if (action.type === 'capture_image') {
        router.push({ pathname: '/diagnose', params: { kind: action.target } });
      } else if (SCREEN_FOR_TARGET[action.target]) {
        router.push(SCREEN_FOR_TARGET[action.target]!);
      }
      return true;
    },
    [router],
  );

  const deliver = useCallback(
    async (reply: AssistantReply) => {
      chatSession.current = reply.session_id ?? chatSession.current;
      setMessages((list) => [
        ...list,
        ...(reply.transcript ? [{ id: newId(), role: 'farmer' as const, text: reply.transcript }] : []),
        { id: newId(), role: 'assistant', text: reply.text, reply },
      ]);
      setPhase('speaking');
      // The reply may be in another language than the app's (the farmer spoke Tamil while the
      // app is in English); speak it in the language it is written in.
      await speak(reply.text, reply.language ?? language, reply.audio_base64, () => {
        setPhase('idle');
        const navigated = runAction(reply.action);
        // Hands-free: keep the conversation going unless the answer opened another screen.
        if (handsFreeRef.current && !navigated) void listenRef.current();
      });
    },
    [language, runAction],
  );

  const fail = useCallback((error: unknown) => {
    setErrorCode(error instanceof ApiError ? error.code : 'generic');
    setPhase('idle');
  }, []);

  const ensureVoiceSession = useCallback(async (): Promise<boolean> => {
    if (voiceSession.current?.language === language) return voiceAvailable ?? false;
    const session = await startVoiceSession(language);
    voiceSession.current = { id: session.session_id, language };
    const available = session.capabilities.speech_recognition;
    setVoiceAvailable(available);
    return available;
  }, [language, voiceAvailable]);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question) return;
      await stopSpeaking();
      setErrorCode(null);
      setMessages((list) => [...list, { id: newId(), role: 'farmer', text: question }]);
      setPhase('thinking');
      try {
        await deliver(await askAssistant(question, chatSession.current, language));
      } catch (error) {
        fail(error);
      }
    },
    [deliver, fail, language],
  );

  const finishRecording = useCallback(async () => {
    stopMonitor();
    setPhase('thinking');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri || !voiceSession.current) throw new ApiError('generic', 'No recording', 0);
      await deliver(await sendUtterance(voiceSession.current.id, recorder.uri, chatSession.current));
    } catch (error) {
      fail(error);
    }
  }, [deliver, fail, recorder]);

  const cancelListening = useCallback(async () => {
    stopMonitor();
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setPhase('idle');
  }, [recorder]);

  const startListening = useCallback(async () => {
    setErrorCode(null);
    try {
      if (!(await ensureVoiceSession())) {
        setErrorCode('asr_unavailable');
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorCode('mic_permission');
        return;
      }
      await stopSpeaking();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPhase('listening');

      let heardSpeech = false;
      let quietMs = 0;
      let elapsedMs = 0;
      stopMonitor();
      monitor.current = setInterval(() => {
        elapsedMs += POLL_MS;
        const level = recorder.getStatus().metering; // undefined where metering is unsupported (web)
        if (level !== undefined) {
          if (level > SPEECH_DB) {
            heardSpeech = true;
            quietMs = 0;
          } else if (heardSpeech) {
            quietMs += POLL_MS;
          }
        }
        if (heardSpeech && quietMs >= END_SILENCE_MS) {
          void finishRecording();
        } else if (!heardSpeech && level !== undefined && elapsedMs >= NO_SPEECH_MS) {
          handsFreeRef.current = false;
          setHandsFreeState(false);
          void cancelListening();
        } else if (elapsedMs >= config.maxRecordingSeconds * 1000) {
          void finishRecording(); // bounded recordings
        }
      }, POLL_MS);
    } catch (error) {
      fail(error);
    }
  }, [cancelListening, ensureVoiceSession, fail, finishRecording, recorder]);

  useEffect(() => {
    listenRef.current = startListening;
  }, [startListening]);

  useEffect(() => stopMonitor, []);

  const pressMic = useCallback(async () => {
    if (phase === 'listening') return finishRecording();
    if (phase === 'speaking') {
      handsFreeRef.current = false;
      setHandsFreeState(false);
      await stopSpeaking();
      setPhase('idle');
      return;
    }
    if (phase === 'thinking') return;
    return startListening();
  }, [finishRecording, phase, startListening]);

  const setHandsFree = useCallback(
    (on: boolean) => {
      handsFreeRef.current = on;
      setHandsFreeState(on);
      if (on && phase === 'idle') void startListening();
    },
    [phase, startListening],
  );

  const stop = useCallback(async () => {
    handsFreeRef.current = false;
    setHandsFreeState(false);
    if (phase === 'listening') await cancelListening();
    await stopSpeaking();
    setPhase('idle');
  }, [cancelListening, phase]);

  const value = useMemo(
    () => ({ phase, messages, errorCode, voiceAvailable, handsFree, setHandsFree, pressMic, ask, stop }),
    [phase, messages, errorCode, voiceAvailable, handsFree, setHandsFree, pressMic, ask, stop],
  );
  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation(): Conversation {
  const conversation = useContext(ConversationContext);
  if (!conversation) throw new Error('useConversation must be used inside ConversationProvider');
  return conversation;
}
