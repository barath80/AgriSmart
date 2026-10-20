import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { serverSpeech, useUpdateProfile, useVoices } from '@/api/hooks';
import type { VoiceGender, VoicePreferences } from '@/api/types';
import { useSession } from '@/auth/session';
import { colors, radius, spacing, touch } from '@/theme';
import { setSpeechGender, setSpeechPace, speak, stopSpeaking } from '@/voice/speech';

import { AppText, Button, Card, Choice, Notice } from './ui';

const PACES = [
  { value: '0.85', key: 'slow' },
  { value: '1', key: 'normal' },
  { value: '1.15', key: 'fast' },
] as const;

/** Lets a farmer pick how AgriSmart sounds: voice and speed, with an instant preview. */
export function VoiceSettings({ preferences: saved }: { preferences: VoicePreferences }) {
  const { t } = useTranslation();
  const { language } = useSession();
  const catalog = useVoices();
  const update = useUpdateProfile();
  const [previewing, setPreviewing] = useState(false);
  // What the farmer just picked, shown and previewed at once; saving happens in the background.
  const [picked, setPicked] = useState<Partial<VoicePreferences>>({});
  const preferences: VoicePreferences = { ...saved, ...picked };

  const save = (next: Partial<VoicePreferences>) => {
    const merged = { ...preferences, ...next };
    setPicked(merged);
    setSpeechPace(merged.pace);
    setSpeechGender(merged.gender);
    update.mutate({ voice_preferences: merged }, { onError: () => setPicked({}) });
  };

  async function preview() {
    if (previewing) {
      await stopSpeaking();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    const text = t('voice.sampleText');
    // Preview exactly the voice on screen, even if saving it has not finished yet.
    await speak(text, language, await serverSpeech(text, language, preferences), () => setPreviewing(false));
  }

  const voices = (catalog.data?.voices ?? []).filter((v) => v.gender === preferences.gender);
  const paceValue = PACES.reduce((best, p) =>
    Math.abs(Number(p.value) - preferences.pace) < Math.abs(Number(best.value) - preferences.pace) ? p : best,
  ).value;

  return (
    <Card>
      <Choice<VoiceGender>
        options={[
          { value: 'female', label: t('voice.female') },
          { value: 'male', label: t('voice.male') },
        ]}
        value={preferences.gender}
        onChange={(gender) => save({ gender, voice: null })}
      />

      {voices.length ? (
        <>
          <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>{t('voice.choose')}</AppText>
          {voices.map((voice) => {
            const selected = (preferences.voice ?? voices[0]?.id) === voice.id;
            return (
              <Pressable
                key={voice.id}
                onPress={() => save({ voice: voice.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.voice, selected && styles.voiceSelected]}
              >
                <AppText variant="bodyStrong" style={selected ? { color: colors.primary } : undefined}>{voice.label}</AppText>
                <AppText variant="caption" muted>{voice.description}</AppText>
              </Pressable>
            );
          })}
        </>
      ) : null}

      <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>{t('voice.pace')}</AppText>
      <Choice
        options={PACES.map((p) => ({ value: p.value, label: t(`voice.${p.key}`) }))}
        value={paceValue}
        onChange={(value) => save({ pace: Number(value) })}
      />

      {catalog.data && !catalog.data.speech_synthesis ? <Notice>{t('voice.deviceVoice')}</Notice> : null}
      <View style={{ marginTop: spacing.sm }}>
        <Button label={previewing ? t('common.stop') : t('voice.sample')} icon={previewing ? 'stop' : 'play'}
                variant="secondary" onPress={preview} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  voice: {
    minHeight: touch.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  voiceSelected: { borderColor: colors.primary, backgroundColor: colors.successSurface },
});
