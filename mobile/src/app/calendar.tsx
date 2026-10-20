import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useCalendar, useCropCatalog, useFarms, useToggleEvent } from '@/api/hooks';
import type { CalendarEvent, Language } from '@/api/types';
import { AlertList } from '@/components/AlertList';
import { AppText, Button, Card, ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { shortDate, todayIso } from '@/format';
import { colors, spacing, touch } from '@/theme';

/** Crop-cycle tasks from agronomic rules, combined with this week's weather alerts. */
export default function Calendar() {
  const { t, i18n } = useTranslation();
  const calendar = useCalendar();
  const catalog = useCropCatalog();
  const farms = useFarms();
  const toggle = useToggleEvent();

  if (calendar.isPending) return <Screen title={t('calendar.title')}><Loading /></Screen>;
  if (calendar.error) {
    const code = calendar.error instanceof ApiError ? calendar.error.code : 'generic';
    return <Screen title={t('calendar.title')}><ErrorState code={code} onRetry={() => calendar.refetch()} /></Screen>;
  }

  const cropName = (slug: string) =>
    catalog.data?.find((c) => c.slug === slug)?.names[i18n.language as Language] ?? slug;
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of calendar.data.events) {
    byDate.set(event.scheduled_on, [...(byDate.get(event.scheduled_on) ?? []), event]);
  }
  const farmId = farms.data?.[0]?.id;
  const today = todayIso();

  return (
    <Screen title={t('calendar.title')}>
      <AlertList alerts={calendar.data.weather_alerts.filter((a) => a.severity !== 'info')} />
      {calendar.data.events.length === 0 ? (
        <>
          <Notice>{t('calendar.empty')}</Notice>
          {farmId ? (
            <Button label={t('calendar.addCrop')} icon="plus"
                    onPress={() => router.push({ pathname: '/add-crop', params: { farmId } })} />
          ) : null}
        </>
      ) : null}
      {[...byDate.entries()].map(([day, events]) => (
        <View key={day} style={{ gap: spacing.sm }}>
          <AppText variant="title" style={day === today ? { color: colors.primary } : undefined}>
            {shortDate(day)}
          </AppText>
          {events.map((event) => (
            <Card key={event.id} tone={event.done ? 'muted' : 'surface'}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" style={event.done ? { textDecorationLine: 'line-through' } : undefined}>
                    {t(`task.${event.detail_key}`, { defaultValue: event.detail_key })}
                  </AppText>
                  <AppText muted>
                    {cropName(event.crop_slug)}
                    {event.window_days ? ` · ${t('calendar.within', { days: event.window_days })}` : ''}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => toggle.mutate({ id: event.id, done: !event.done })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: event.done }}
                  accessibilityLabel={t('calendar.markDone')}
                  style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons
                    name={event.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={36}
                    color={event.done ? colors.success : colors.textMuted}
                  />
                </Pressable>
              </Row>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
