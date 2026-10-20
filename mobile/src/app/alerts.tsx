import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ApiError } from '@/api/client';
import { serverSpeech, useInbox, useMarkRead } from '@/api/hooks';
import type { InboxItem } from '@/api/types';
import { useSession } from '@/auth/session';
import { AppText, Button, Card, ErrorState, type IconName, Loading, Notice, Row, Screen } from '@/components/ui';
import { shortDate } from '@/format';
import { colors, spacing, touch } from '@/theme';
import { speak, stopSpeaking } from '@/voice/speech';

const ICONS: Record<string, IconName> = {
  weather: 'weather-pouring',
  scheme: 'bank',
  calendar: 'calendar-check',
  market: 'currency-inr',
  disease: 'leaf-circle',
  emergency: 'alert-octagon',
};

/** Every alert the farmer received, in their language — and read aloud on request. */
export default function Alerts() {
  const { t } = useTranslation();
  const inbox = useInbox();
  const markRead = useMarkRead();

  useEffect(() => () => void stopSpeaking(), []);

  if (inbox.isPending) return <Screen title={t('alerts.title')}><Loading /></Screen>;
  if (inbox.error) {
    const code = inbox.error instanceof ApiError ? inbox.error.code : 'generic';
    return <Screen title={t('alerts.title')}><ErrorState code={code} onRetry={() => inbox.refetch()} /></Screen>;
  }
  const { items, unread } = inbox.data;

  return (
    <Screen title={t('alerts.title')}>
      {items.length === 0 ? <Notice>{t('alerts.empty')}</Notice> : null}
      {unread > 0 ? (
        <Button label={t('alerts.markAllRead')} icon="check-all" variant="secondary"
                onPress={() => markRead.mutate(undefined)} loading={markRead.isPending} />
      ) : null}
      {items.map((item) => (
        <AlertCard key={item.id} item={item} onRead={() => !item.read && markRead.mutate([item.id])} />
      ))}
    </Screen>
  );
}

function AlertCard({ item, onRead }: { item: InboxItem; onRead: () => void }) {
  const { t } = useTranslation();
  const { language } = useSession();
  const [speaking, setSpeaking] = useState(false);
  const urgent = item.category === 'emergency' || item.category === 'weather';

  async function listen() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    onRead();
    const text = `${item.title}. ${item.body}`;
    // The farmer's chosen AgriSmart voice when available; the phone's voice otherwise.
    await speak(text, language, await serverSpeech(text, language), () => setSpeaking(false));
  }

  return (
    <Card style={!item.read ? { borderLeftWidth: 6, borderLeftColor: urgent ? colors.danger : colors.primary } : undefined}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Row style={{ flex: 1, alignItems: 'flex-start' }}>
          <MaterialCommunityIcons name={ICONS[item.category] ?? 'bell'} size={30} color={urgent ? colors.danger : colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="caption" muted>
              {t(`alerts.category.${item.category}`, { defaultValue: item.category })} · {shortDate(item.created_at)}
              {!item.read ? ` · ${t('alerts.new')}` : ''}
            </AppText>
            <AppText variant="title">{item.title}</AppText>
            <AppText>{item.body}</AppText>
          </View>
        </Row>
        <Pressable
          onPress={listen}
          accessibilityRole="button"
          accessibilityLabel={speaking ? t('common.stop') : t('common.listen')}
          style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name={speaking ? 'stop-circle' : 'volume-high'} size={34} color={colors.primary} />
        </Pressable>
      </Row>
    </Card>
  );
}
