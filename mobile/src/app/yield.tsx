import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useCropCatalog, useCycles, useYieldEstimate } from '@/api/hooks';
import type { Language } from '@/api/types';
import { AppText, Button, Card, Choice, Field, Notice, Screen, useErrorText } from '@/components/ui';
import { decimal, parseNumber, rupees } from '@/format';
import { colors } from '@/theme';

// Crops the yield model was trained on (see ml/agrismart_ml/catalog.py YIELD_CROPS).
const YIELD_CROPS = ['rice', 'wheat', 'maize', 'bajra', 'jowar', 'ragi', 'chickpea', 'pigeon_pea', 'green_gram',
  'black_gram', 'lentil', 'moth_bean', 'groundnut', 'soybean', 'mustard', 'sugarcane', 'onion', 'potato', 'banana'];

/** Expected yield with a likely range — never a single promised number. */
export default function Yield() {
  const { t, i18n } = useTranslation();
  const errorText = useErrorText();
  const catalog = useCropCatalog();
  const cycles = useCycles();
  const estimate = useYieldEstimate();
  const active = cycles.data?.find((c) => c.status === 'active');
  // The farmer's active crop is the default; anything they pick or type overrides it.
  const [pickedCrop, setCrop] = useState<string | null>(null);
  const [typedArea, setArea] = useState<string | null>(null);
  const crop = pickedCrop ?? active?.crop_slug ?? null;
  const area = typedArea ?? (active ? String(active.area_acres) : '');

  const options = useMemo(
    () =>
      (catalog.data ?? [])
        .filter((c) => YIELD_CROPS.includes(c.slug))
        .map((c) => ({ value: c.slug, label: c.names[i18n.language as Language] ?? c.names.en ?? c.slug })),
    [catalog.data, i18n.language],
  );
  const acres = parseNumber(area);
  const result = estimate.data;
  const error = estimate.error instanceof ApiError ? estimate.error.code : estimate.error ? 'generic' : null;

  return (
    <Screen title={t('yield.title')}>
      <AppText variant="bodyStrong">{t('yield.crop')}</AppText>
      <Choice options={options} value={crop} onChange={setCrop} />
      <Field label={t('yield.area')} value={area} onChangeText={setArea} keyboardType="decimal-pad" />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button
        label={t('yield.estimate')}
        icon="scale-balance"
        onPress={() => crop && estimate.mutate({ crop, area_acres: acres })}
        disabled={!crop || !(acres > 0)}
        loading={estimate.isPending}
      />
      {result ? (
        <Card style={{ borderWidth: 2, borderColor: colors.primary }}>
          <AppText variant="title">{result.crop_name}</AppText>
          <AppText variant="headline" style={{ color: colors.primary }}>
            {t('yield.expected', { value: decimal(result.expected_q_per_acre) })}
          </AppText>
          <AppText>{t('yield.range', { low: decimal(result.low_q_per_acre), high: decimal(result.high_q_per_acre) })}</AppText>
          <AppText variant="bodyStrong">{t('yield.total', { value: rupees(result.expected_total_quintals) })}</AppText>
          {Object.keys(result.assumptions).length ? <Notice>{t('yield.assumed')}</Notice> : null}
          <AppText muted>{t('yield.note')}</AppText>
        </Card>
      ) : null}
    </Screen>
  );
}
