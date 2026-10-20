import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useProfit } from '@/api/hooks';
import { AppText, Button, Card, Field, Notice, Row, Screen, useErrorText } from '@/components/ui';
import { parseNumber, rupees } from '@/format';
import { colors } from '@/theme';

const COST_HEADS = ['seeds', 'fertilizer', 'labour', 'irrigation', 'machinery', 'transport', 'other'] as const;

/** Deterministic profit/loss with "what if" scenarios — arithmetic, not prediction. */
export default function Profit() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const profit = useProfit();
  const [area, setArea] = useState('');
  const [yieldPerAcre, setYieldPerAcre] = useState('');
  const [price, setPrice] = useState('');
  const [costs, setCosts] = useState<Record<string, string>>({});

  const numbers = [area, yieldPerAcre, price].map(parseNumber);
  const valid = numbers.every((n) => Number.isFinite(n) && n >= 0) && (numbers[0] ?? 0) > 0;

  const calculate = () =>
    profit.mutate({
      area_acres: numbers[0],
      expected_yield_q_per_acre: numbers[1],
      expected_price_per_quintal: numbers[2],
      costs: Object.fromEntries(COST_HEADS.map((head) => [head, parseNumber(costs[head] ?? '') || 0])),
    });

  const result = profit.data;
  const error = profit.error instanceof ApiError ? profit.error.code : profit.error ? 'generic' : null;
  const money = (value: number) => `₹${rupees(Math.abs(value))}`;

  return (
    <Screen title={t('profit.title')}>
      <AppText muted>{t('profit.intro')}</AppText>
      <Field label={t('profit.area')} value={area} onChangeText={setArea} keyboardType="decimal-pad" />
      <Field label={t('profit.yieldPerAcre')} value={yieldPerAcre} onChangeText={setYieldPerAcre} keyboardType="decimal-pad" />
      <Field label={t('profit.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <AppText variant="title">{t('profit.costs')}</AppText>
      {COST_HEADS.map((head) => (
        <Field
          key={head}
          label={t(`profit.cost.${head}`)}
          value={costs[head] ?? ''}
          onChangeText={(value) => setCosts((c) => ({ ...c, [head]: value }))}
          keyboardType="number-pad"
        />
      ))}
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button label={t('profit.calculate')} icon="calculator" onPress={calculate} disabled={!valid} loading={profit.isPending} />

      {result ? (
        <>
          <Card style={{ borderWidth: 2, borderColor: result.profit >= 0 ? colors.success : colors.danger }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>{t('profit.revenue')}</AppText>
              <AppText variant="bodyStrong">{money(result.revenue)}</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>{t('profit.totalCost')}</AppText>
              <AppText variant="bodyStrong">{money(result.total_cost)}</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="title">{result.profit >= 0 ? t('profit.profit') : t('profit.loss')}</AppText>
              <AppText variant="headline" style={{ color: result.profit >= 0 ? colors.success : colors.danger }}>
                {money(result.profit)}
              </AppText>
            </Row>
            {result.break_even_price_per_quintal ? (
              <AppText muted>{t('profit.breakEven', { value: rupees(result.break_even_price_per_quintal) })}</AppText>
            ) : null}
          </Card>
          <AppText variant="title">{t('profit.whatIf')}</AppText>
          {result.scenarios.map((scenario) => (
            <Card key={scenario.key} tone="muted">
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText style={{ flex: 1 }}>{t(`profit.scenario.${scenario.key}`)}</AppText>
                <AppText variant="bodyStrong" style={{ color: scenario.profit >= 0 ? colors.success : colors.danger }}>
                  {scenario.profit >= 0 ? '' : '−'}
                  {money(scenario.profit)}
                </AppText>
              </Row>
            </Card>
          ))}
          <Notice>{t('profit.estimateNote')}</Notice>
        </>
      ) : null}
    </Screen>
  );
}
