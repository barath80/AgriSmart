import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import type { Language, VoiceGender } from '@/api/types';
import { speechLocale } from '@/i18n';

/**
 * Speaks an answer. Prefers the server's Indian-language voice when the reply carries audio:
 * that voice matches the farmer's chosen voice (female or male) and pace, in every language.
 * Otherwise the phone's own text-to-speech for that language is used, with a voice of the
 * chosen gender when the phone has one.
 */
let player: AudioPlayer | null = null;
let replyFile: File | null = null;
let devicePace = 1;
let deviceGender: VoiceGender = 'female';
let deviceVoices: Speech.Voice[] | null = null;

/** Applied to the phone's own voice; the server voice already carries the pace. */
export function setSpeechPace(pace: number): void {
  devicePace = Math.min(Math.max(pace, 0.75), 1.25);
}

export function setSpeechGender(gender: VoiceGender): void {
  deviceGender = gender;
}

function audioSource(audioBase64: string): string {
  if (Platform.OS === 'web') return `data:audio/wav;base64,${audioBase64}`; // no file system in browsers
  replyFile = new File(Paths.cache, `reply-${Date.now()}.wav`);
  replyFile.create();
  replyFile.write(audioBase64, { encoding: 'base64' });
  return replyFile.uri;
}

const normalizeLocale = (locale: string) => locale.toLowerCase().replace('_', '-');

/**
 * A phone voice for the language whose name says it is of the chosen gender (Android voices
 * look like "hi-in-x-hie#male_1-local"; iOS and browsers often name the speaker). Phones that
 * do not label voices keep their default voice.
 */
async function deviceVoice(language: Language): Promise<string | undefined> {
  try {
    deviceVoices ??= await Speech.getAvailableVoicesAsync();
  } catch {
    deviceVoices = [];
  }
  const locale = normalizeLocale(speechLocale(language));
  const forLanguage = deviceVoices.filter((voice) => normalizeLocale(voice.language) === locale);
  const label = (voice: Speech.Voice) => `${voice.identifier} ${voice.name}`.toLowerCase();
  const isFemale = (voice: Speech.Voice) => /female|woman/.test(label(voice));
  const isMale = (voice: Speech.Voice) => /\bmale|#male|man\b/.test(label(voice)) && !isFemale(voice);
  const match = forLanguage.find(deviceGender === 'male' ? isMale : isFemale);
  return match?.identifier;
}

export async function speak(
  text: string,
  language: Language,
  audioBase64: string | null,
  onDone: () => void,
): Promise<void> {
  await stopSpeaking();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

  if (audioBase64) {
    try {
      player = createAudioPlayer({ uri: audioSource(audioBase64) });
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          void stopSpeaking();
          onDone();
        }
      });
      player.play();
      return;
    } catch {
      await stopSpeaking(); // fall back to device speech below
    }
  }

  Speech.speak(text, {
    language: speechLocale(language),
    voice: await deviceVoice(language),
    rate: 0.95 * devicePace,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export async function stopSpeaking(): Promise<void> {
  Speech.stop();
  if (player) {
    player.remove();
    player = null;
  }
  if (replyFile?.exists) replyFile.delete();
  replyFile = null;
}
