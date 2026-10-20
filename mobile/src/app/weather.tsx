import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useWeather } from '@/api/hooks';
import { AlertList } from '@/components/AlertList';
import { AppText, Card, ErrorState, type IconName, Loading, Notice, Row, Screen } from '@/components/ui';
import { shortDate } from '@/format';
import { colors, spacing } from '@/theme';

const ICONS: Record<string, IconName> = {
  clear: 'weather-sunny',
  cloudy: 'weather-cloudy',
  fog: 'weather-fog',
  drizzle: 'weather-partly-rainy',
  rain: 'weather-pouring',
  snow: 'weather-snowy',
  thunderstorm: 'weather-lightning-rainy',
};

export default function Weather() {
  const { t } = useTranslation();
  const weather = useWeather();

  if (weather.isPending) {
    return (
      <Screen title={t('weather.title')}>
        <Loading />
      </Screen>
    );
  }
  if (weather.error) {
    const code = weather.error instanceof ApiError ? weather.error.code : 'generic';
    return (
      <Screen title={t('weather.title')}>
        <ErrorState code={code} onRetry={() => weather.refetch()} />
      </Screen>
    );
  }
  const { current, daily, alerts } = weather.data;

  return (
    <Screen title={t('weather.title')}>
      <Card>
        <AppText muted>{t('weather.now')}</AppText>
        <Row gap={spacing.md}>
          <MaterialCommunityIcons name={ICONS[current.condition] ?? 'weather-cloudy'} size={72} color={colors.info} />
          <View>
            <AppText variant="display">{Math.round(current.temperature_c)}°C</AppText>
            <AppText variant="title">{t(`weather.condition.${current.condition}`)}</AppText>
          </View>
        </Row>
        <AppText>
          {t('weather.humidity', { value: Math.round(current.humidity_pct) })} ·{' '}
          {t('weather.wind', { value: Math.round(current.wind_kmh) })}
        </AppText>
      </Card>

      <AppText variant="title">{t('weather.advice')}</AppText>
      {alerts.length ? <AlertList alerts={alerts} /> : <Notice tone="success">{t('weather.noAlerts')}</Notice>}

      <AppText variant="title">{t('weather.next7')}</AppText>
      {daily.map((day, index) => (
        <Card key={day.date}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <MaterialCommunityIcons name={ICONS[day.condition] ?? 'weather-cloudy'} size={36} color={colors.info} />
              <View>
                <AppText variant="bodyStrong">
                  {index === 0 ? t('weather.today') : index === 1 ? t('weather.tomorrow') : shortDate(day.date)}
                </AppText>
                <AppText muted>{t(`weather.condition.${day.condition}`)}</AppText>
              </View>
            </Row>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="bodyStrong">
                {Math.round(day.temp_max_c)}° / {Math.round(day.temp_min_c)}°
              </AppText>
              <AppText style={{ color: colors.info }}>
                {t('weather.rainChance', { value: Math.round(day.rain_probability_pct) })} ·{' '}
                {t('weather.rainMm', { value: Math.round(day.rain_mm) })}
              </AppText>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
