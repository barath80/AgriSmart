import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useCropCatalog, useFarms, useStartCycle } from '@/api/hooks';
import type { Language, Season } from '@/api/types';
import { AppText, Button, Choice, Field, Notice, Screen, useErrorText } from '@/components/ui';
import { isIsoDate, parseNumber, todayIso } from '@/format';

const SEASONS: Season[] = ['kharif', 'rabi', 'zaid', 'whole_year'];

function currentSeason(): Season {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 10) return 'kharif';
  if (month >= 11 || month <= 3) return 'rabi';
  return 'zaid';
}

/** Adding a crop with its sowing date generates the farm calendar automatically. */
export default function AddCrop() {
  const { t, i18n } = useTranslation();
  const errorText = useErrorText();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const farms = useFarms();
  const catalog = useCropCatalog();
  const start = useStartCycle(farmId ?? '');
  const farm = farms.data?.find((f) => f.id === farmId);
  const [crop, setCrop] = useState<string | null>(null);
  const [season, setSeason] = useState<Season>(currentSeason());
  const [sowingDate, setSowingDate] = useState(todayIso());
  const [area, setArea] = useState('');

  const options = useMemo(
    () =>
      (catalog.data ?? [])
        .filter((c) => c.seasons.includes(season) || c.seasons.includes('whole_year'))
        .map((c) => ({ value: c.slug, label: c.names[i18n.language as Language] ?? c.names.en ?? c.slug })),
    [catalog.data, i18n.language, season],
  );
  const acres = parseNumber(area || String(farm?.area_acres ?? ''));
  const error = start.error instanceof ApiError ? start.error.code : start.error ? 'generic' : null;

  async function submit() {
    if (!crop) return;
    await start.mutateAsync({ crop_slug: crop, season, sowing_date: sowingDate, area_acres: acres });
    router.replace('/calendar');
  }

  return (
    <Screen title={t('farm.addCrop')}>
      <AppText variant="bodyStrong">{t('farm.season')}</AppText>
      <Choice options={SEASONS.map((v) => ({ value: v, label: t(`season.${v}`) }))} value={season} onChange={setSeason} />
      <AppText variant="bodyStrong">{t('farm.crop')}</AppText>
      <Choice options={options} value={crop} onChange={setCrop} />
      <Field label={t('farm.sowingDate')} value={sowingDate} onChangeText={setSowingDate} keyboardType="numbers-and-punctuation" />
      <Field label={t('farm.area')} value={area} placeholder={farm ? String(farm.area_acres) : ''} onChangeText={setArea}
             keyboardType="decimal-pad" />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button label={t('common.save')} icon="calendar-plus" onPress={() => submit().catch(() => undefined)}
              disabled={!crop || !(acres > 0) || !isIsoDate(sowingDate)} loading={start.isPending} />
    </Screen>
  );
}
