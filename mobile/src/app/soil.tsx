import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useAddSoilRecord } from '@/api/hooks';
import { Button, Field, Notice, Screen, useErrorText } from '@/components/ui';
import { isIsoDate, parseNumber, todayIso } from '@/format';

/** Copy four numbers from the Soil Health Card — that is all crop advice needs. */
export default function Soil() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const add = useAddSoilRecord(farmId ?? '');
  const [values, setValues] = useState({ nitrogen: '', phosphorus: '', potassium: '', ph: '' });
  const [testedOn, setTestedOn] = useState(todayIso());

  const parsed = {
    nitrogen: parseNumber(values.nitrogen),
    phosphorus: parseNumber(values.phosphorus),
    potassium: parseNumber(values.potassium),
    ph: parseNumber(values.ph),
  };
  const valid =
    Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0) && parsed.ph >= 3 && parsed.ph <= 10 && isIsoDate(testedOn);
  const error = add.error instanceof ApiError ? add.error.code : add.error ? 'generic' : null;

  async function save() {
    await add.mutateAsync({ ...parsed, organic_carbon: null, tested_on: testedOn });
    router.back();
  }

  const field = (key: keyof typeof values) => (
    <Field
      label={t(`farm.${key}`)}
      value={values[key]}
      onChangeText={(value) => setValues((v) => ({ ...v, [key]: value }))}
      keyboardType="decimal-pad"
    />
  );

  return (
    <Screen title={t('farm.addSoil')}>
      <Notice>{t('farm.soilHint')}</Notice>
      {field('nitrogen')}
      {field('phosphorus')}
      {field('potassium')}
      {field('ph')}
      <Field label={t('farm.testedOn')} value={testedOn} onChangeText={setTestedOn} keyboardType="numbers-and-punctuation" />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button label={t('common.save')} icon="content-save" onPress={() => save().catch(() => undefined)} disabled={!valid || !farmId}
              loading={add.isPending} />
    </Screen>
  );
}
