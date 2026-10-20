import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useSaveFarm } from '@/api/hooks';
import type { Irrigation, SoilType } from '@/api/types';
import { AppText, Button, Choice, Field, Notice, Screen, useErrorText } from '@/components/ui';
import { parseNumber } from '@/format';

const IRRIGATION: Irrigation[] = ['rainfed', 'canal', 'borewell', 'drip', 'sprinkler'];
const SOILS: (SoilType | 'unknown')[] = ['black', 'red', 'alluvial', 'clay', 'loamy', 'sandy', 'laterite', 'unknown'];

export default function AddFarm() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const save = useSaveFarm();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation>('rainfed');
  const [soil, setSoil] = useState<SoilType | 'unknown'>('unknown');
  const acres = parseNumber(area);
  const error = save.error instanceof ApiError ? save.error.code : save.error ? 'generic' : null;

  async function submit() {
    await save.mutateAsync({ name: name.trim(), area_acres: acres, irrigation, soil_type: soil === 'unknown' ? null : soil });
    router.back();
  }

  return (
    <Screen title={t('farm.addFarm')}>
      <Field label={`${t('farm.farmName')} ${t('common.optional')}`} value={name} onChangeText={setName} />
      <Field label={t('onboarding.farmSize')} value={area} onChangeText={setArea} keyboardType="decimal-pad" />
      <AppText variant="bodyStrong">{t('onboarding.waterSource')}</AppText>
      <Choice options={IRRIGATION.map((v) => ({ value: v, label: t(`irrigation.${v}`) }))} value={irrigation} onChange={setIrrigation} />
      <AppText variant="bodyStrong">{t('farm.soilType')}</AppText>
      <Choice options={SOILS.map((v) => ({ value: v, label: t(`soil.${v}`) }))} value={soil} onChange={setSoil} />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button label={t('common.save')} icon="content-save" onPress={() => submit().catch(() => undefined)}
              disabled={!(acres > 0)} loading={save.isPending} />
    </Screen>
  );
}
