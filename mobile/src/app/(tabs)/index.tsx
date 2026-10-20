import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useInbox, useProfile, useSupportUnread, useWeather } from '@/api/hooks';
import { MicButton } from '@/components/MicButton';
import { AppText, Card, type IconName, Notice, Row, Screen, Tile, useErrorText } from '@/components/ui';
import { colors, radius, spacing, touch } from '@/theme';
import { useConversation } from '@/voice/conversation';

const FEATURES: { key: string; icon: IconName; href: Href; color: string }[] = [
  { key: 'weather', icon: 'weather-partly-rainy', href: '/weather', color: '#0B57D0' },
  { key: 'market', icon: 'currency-inr', href: '/market', color: '#8A5300' },
  { key: 'cropAdvice', icon: 'sprout', href: '/crop-advice', color: colors.primary },
  { key: 'plantDoctor', icon: 'leaf-circle', href: { pathname: '/diagnose', params: { kind: 'disease' } }, color: '#B3261E' },
  { key: 'pestCheck', icon: 'bug', href: { pathname: '/diagnose', params: { kind: 'pest' } }, color: '#6A3D9A' },
  { key: 'schemes', icon: 'bank', href: '/schemes', color: '#00696B' },
  { key: 'calendar', icon: 'calendar-check', href: '/calendar', color: '#2E7D32' },
  { key: 'yield', icon: 'scale-balance', href: '/yield', color: '#5D4037' },
  { key: 'profit', icon: 'calculator-variant', href: '/profit', color: '#37474F' },
  { key: 'support', icon: 'face-agent', href: '/support', color: '#00695C' },
];

/** Voice first: one huge microphone, the last answer, and shortcuts underneath. */
export default function Home() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const profile = useProfile();
  const weather = useWeather(Boolean(profile.data?.location?.latitude));
  const inbox = useInbox();
  const unread = inbox.data?.unread ?? 0;
  const supportUnread = useSupportUnread().data?.unread ?? 0;
  const { phase, messages, errorCode, voiceAvailable, pressMic, handsFree, setHandsFree } = useConversation();
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastQuestion = lastAnswer?.reply?.transcript;
  const firstName = profile.data?.name.split(' ')[0];
  const current = weather.data?.current;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="headline">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
        </AppText>
        <Row>
          {current ? (
            <Pressable onPress={() => router.push('/weather')} accessibilityRole="button" style={styles.weatherChip}>
              <MaterialCommunityIcons name="thermometer" size={22} color={colors.info} />
              <AppText variant="bodyStrong">{Math.round(current.temperature_c)}°C</AppText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/alerts')}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.alerts')}${unread ? `: ${unread}` : ''}`}
            style={styles.bell}
          >
            <MaterialCommunityIcons name={unread ? 'bell-ring' : 'bell-outline'} size={28} color={colors.primary} />
            {unread ? (
              <View style={styles.badge}>
                <AppText variant="caption" style={{ color: colors.primaryText, fontWeight: '700' }}>{unread > 9 ? '9+' : unread}</AppText>
              </View>
            ) : null}
          </Pressable>
        </Row>
      </Row>

      {supportUnread > 0 ? (
        <Pressable onPress={() => router.push('/support')} accessibilityRole="button" style={styles.typeBar}>
          <MaterialCommunityIcons name="face-agent" size={26} color={colors.primary} />
          <AppText variant="bodyStrong" style={{ color: colors.primary, flex: 1 }}>{t('support.newReply')}</AppText>
          <MaterialCommunityIcons name="chevron-right" size={26} color={colors.primary} />
        </Pressable>
      ) : null}

      <MicButton phase={phase} onPress={pressMic} />

      {voiceAvailable !== false ? (
        <Row style={styles.handsFree}>
          <MaterialCommunityIcons name="account-voice" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{t('home.handsFree')}</AppText>
            <AppText variant="caption" muted>{t('home.handsFreeHint')}</AppText>
          </View>
          <Switch
            value={handsFree}
            onValueChange={setHandsFree}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('home.handsFree')}
          />
        </Row>
      ) : null}

      {errorCode ? (
        <Notice tone={errorCode === 'asr_unavailable' ? 'info' : 'danger'}>
          {errorCode === 'asr_unavailable' ? t('home.voiceUnavailable') : errorText(errorCode)}
        </Notice>
      ) : null}

      <Pressable onPress={() => router.push('/assistant')} accessibilityRole="button" style={styles.typeBar}>
        <MaterialCommunityIcons name="keyboard-outline" size={26} color={colors.primary} />
        <AppText variant="bodyStrong" style={{ color: colors.primary, flex: 1 }}>{t('home.typeInstead')}</AppText>
        <MaterialCommunityIcons name="chevron-right" size={26} color={colors.primary} />
      </Pressable>

      {lastAnswer ? (
        <Card>
          {lastQuestion ? <AppText muted>{t('home.youSaid', { text: lastQuestion })}</AppText> : null}
          <AppText variant="title" accessibilityLiveRegion="polite">{lastAnswer.text}</AppText>
        </Card>
      ) : null}

      {voiceAvailable === false && !errorCode ? <Notice>{t('home.voiceUnavailable')}</Notice> : null}

      <AppText variant="title" style={{ marginTop: spacing.sm }}>{t('home.quickHelp')}</AppText>
      <View style={styles.grid}>
        {FEATURES.map((feature) => (
          <Tile
            key={feature.key}
            label={t(`features.${feature.key}`)}
            icon={feature.icon}
            color={feature.color}
            onPress={() => router.push(feature.href)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.round,
    backgroundColor: colors.infoSurface,
  },
  bell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: radius.round,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handsFree: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  typeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
});
