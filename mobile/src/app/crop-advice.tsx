import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useCropRecommendation, useFarms } from '@/api/hooks';
import type { CropOption } from '@/api/types';
import { AppText, Button, Card, Notice, Row, Screen, useErrorText } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** Model prediction + transparent agronomic adjustments, each explained in plain words. */
export default function CropAdvice() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const farms = useFarms();
  const recommend = useCropRecommendation();
  const error = recommend.error instanceof ApiError ? recommend.error.code : recommend.error ? 'generic' : null;
  const result = recommend.data;
  const farmId = farms.data?.[0]?.id;

  return (
    <Screen title={t('cropAdvice.title')}>
      <AppText muted>{t('cropAdvice.intro')}</AppText>
      <Button label={t('cropAdvice.run')} icon="sprout" onPress={() => recommend.mutate({})} loading={recommend.isPending} />

      {error === 'soil_data_required' ? (
        <>
          <Notice tone="warning">{t('cropAdvice.needSoil')}</Notice>
          {farmId ? (
            <Button label={t('cropAdvice.addSoil')} icon="flask-outline" variant="secondary"
                    onPress={() => router.push({ pathname: '/soil', params: { farmId } })} />
          ) : null}
        </>
      ) : error ? (
        <Notice tone="danger">{errorText(error)}</Notice>
      ) : null}

      {result ? (
        <>
          {result.warnings.length ? <Notice tone="warning">{t('cropAdvice.rangeWarning')}</Notice> : null}
          <AppText variant="title">{t('cropAdvice.best')}</AppText>
          <Option option={result.recommended} best={result.recommended.score} highlight />
          {result.alternatives.length ? <AppText variant="title">{t('cropAdvice.others')}</AppText> : null}
          {result.alternatives.map((option) => (
            <Option key={option.crop} option={option} best={result.recommended.score} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

/** The score is relative across every crop, so a number like "26 %" would read as a poor fit
 * even for the clear winner. Farmers see plain words instead, relative to the best option. */
function fitLevel(option: CropOption, best: number): 'good' | 'possible' {
  const relative = best > 0 ? option.score / best : 0;
  return relative >= 0.35 ? 'good' : 'possible';
}

function Option({ option, best, highlight = false }: { option: CropOption; best: number; highlight?: boolean }) {
  const { t } = useTranslation();
  return (
    <Card style={highlight ? { borderWidth: 2, borderColor: colors.primary } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant={highlight ? 'headline' : 'title'} style={{ flex: 1 }}>{option.name}</AppText>
        {highlight ? null : (
          // The "best match" heading above already labels the winner.
          <AppText variant="bodyStrong" style={{ color: colors.primary }}>
            {t(`cropAdvice.fit.${fitLevel(option, best)}`)}
          </AppText>
        )}
      </Row>
      <View style={{ gap: spacing.xs }}>
        {option.duration_days ? (
          <AppText>{t('cropAdvice.duration', { min: option.duration_days[0], max: option.duration_days[1] })}</AppText>
        ) : null}
        {option.water_requirement ? (
          <AppText>{t('cropAdvice.water', { level: t(`cropAdvice.waterLevel.${option.water_requirement}`) })}</AppText>
        ) : null}
        {option.expected_yield_q_per_acre ? (
          <AppText>
            {t('cropAdvice.expectedYield', { min: option.expected_yield_q_per_acre[0], max: option.expected_yield_q_per_acre[1] })}
          </AppText>
        ) : null}
      </View>
      {option.reasons.map((reason) => (
        <Notice key={reason} tone="warning">{t(`cropAdvice.reason.${reason}`)}</Notice>
      ))}
    </Card>
  );
}
