import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch } from 'react-native';

import { ApiError, api } from '@/api/client';
import { useProfile, useUpdateProfile } from '@/api/hooks';
import type { NotificationPreferences } from '@/api/types';
import { useSession } from '@/auth/session';
import { AppText, Button, Card, Field, Loading, Notice, Row, Screen, useErrorText } from '@/components/ui';
import { VoiceSettings } from '@/components/VoiceSettings';
import { LANGUAGES } from '@/i18n';
import { colors, radius, spacing, touch } from '@/theme';

/** Set a first password (accounts made with a code) or change the current one. */
function PasswordCard() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('/auth/password', { method: 'PUT', body: { current_password: current || null, new_password: next } });
      setCurrent('');
      setNext('');
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'generic');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <AppText variant="title">{t('profile.passwordTitle')}</AppText>
      <Field
        label={t('profile.currentPassword')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        maxLength={128}
        value={current}
        onChangeText={setCurrent}
      />
      <Field
        label={t('login.newPassword')}
        hint={t('login.passwordHint')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={128}
        value={next}
        onChangeText={setNext}
      />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      {saved ? <Notice tone="success">{t('profile.passwordSaved')}</Notice> : null}
      <Button label={t('profile.savePassword')} icon="content-save" variant="secondary" onPress={save} loading={busy} disabled={next.length < 8} />
    </Card>
  );
}

const PREFERENCES: (keyof NotificationPreferences)[] = ['weather', 'market', 'schemes', 'calendar', 'disease'];

export default function ProfileTab() {
  const { t } = useTranslation();
  const { language, chooseLanguage, signOut } = useSession();
  const profile = useProfile();
  const update = useUpdateProfile();

  if (!profile.data) return <Loading />;
  const { name, phone, location, notification_preferences: prefs } = profile.data;

  async function switchLanguage(code: (typeof LANGUAGES)[number]['code']) {
    await chooseLanguage(code); // the whole UI switches immediately
    update.mutate({ preferred_language: code }); // AI answers and alerts follow too
  }

  return (
    <Screen title={t('profile.title')} back={false}>
      <Card>
        <AppText variant="title">{name}</AppText>
        <AppText muted>{phone}</AppText>
        {location ? <AppText>{[location.village, location.district, location.state].filter(Boolean).join(', ')}</AppText> : null}
      </Card>

      <AppText variant="title">{t('profile.language')}</AppText>
      <Row style={{ flexWrap: 'wrap' }}>
        {LANGUAGES.map((option) => {
          const selected = option.code === language;
          return (
            <Pressable
              key={option.code}
              onPress={() => switchLanguage(option.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.language, selected && styles.languageSelected]}
            >
              <AppText variant="bodyStrong" style={{ color: selected ? colors.primaryText : colors.text }}>
                {option.nativeName}
              </AppText>
            </Pressable>
          );
        })}
      </Row>

      <AppText variant="title">{t('voice.title')}</AppText>
      <VoiceSettings preferences={profile.data.voice_preferences} />

      <AppText variant="title">{t('profile.notifications')}</AppText>
      <Card>
        {PREFERENCES.map((key) => (
          <Row key={key} style={{ justifyContent: 'space-between', minHeight: touch.min }}>
            <AppText style={{ flex: 1 }}>{t(`profile.notify.${key}`)}</AppText>
            <Switch
              value={prefs[key]}
              onValueChange={(value) => update.mutate({ notification_preferences: { ...prefs, [key]: value } })}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t(`profile.notify.${key}`)}
            />
          </Row>
        ))}
      </Card>

      <PasswordCard />

      <Card tone="muted">
        <AppText>{t('profile.about')}</AppText>
        <AppText variant="bodyStrong">{t('profile.helpline')}</AppText>
      </Card>
      <Button label={t('profile.signOut')} icon="logout" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  language: {
    minHeight: touch.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  languageSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
