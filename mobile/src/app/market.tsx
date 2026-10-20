import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useCropCatalog, useCycles, usePriceHistory, usePrices } from '@/api/hooks';
import type { Language } from '@/api/types';
import { AppText, Button, Card, Choice, ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { rupees, shortDate } from '@/format';
import { colors, radius } from '@/theme';

/** The most traded mandi commodities, so the common choices are always on screen. */
const POPULAR = ['rice', 'wheat', 'onion', 'tomato', 'potato', 'cotton', 'maize', 'soybean', 'groundnut', 'chickpea',
  'mustard', 'pigeon_pea', 'banana', 'coconut'];
const popularity = (slug: string) => (POPULAR.includes(slug) ? POPULAR.indexOf(slug) : POPULAR.length);

/** Observed mandi prices only — clearly labelled, never presented as a forecast. */
export default function Market() {
  const { t, i18n } = useTranslation();
  const catalog = useCropCatalog();
  const cycles = useCycles();
  const crops = useMemo(() => (catalog.data ?? []).filter((c) => c.market_commodity), [catalog.data]);
  const growing = cycles.data?.[0]?.crop_slug;
  const [selected, setSelected] = useState<string | null>(null);
  // The farmer's own crop first, then the most traded ones, so the usual choice is one tap away.
  const ordered = useMemo(
    () =>
      [...crops].sort(
        (a, b) => Number(b.slug === growing) - Number(a.slug === growing) || popularity(a.slug) - popularity(b.slug),
      ),
    [crops, growing],
  );
  const [showAll, setShowAll] = useState(false);
  const slug = selected ?? ordered[0]?.slug ?? null;
  const commodity = crops.find((c) => c.slug === slug)?.market_commodity ?? null;
  const prices = usePrices(commodity);
  const history = usePriceHistory(commodity);

  const name = (s: string) => {
    const crop = crops.find((c) => c.slug === s);
    return crop?.names[i18n.language as Language] ?? crop?.names.en ?? s;
  };

  const errorCode = prices.error instanceof ApiError ? prices.error.code : prices.error ? 'generic' : null;

  return (
    <Screen title={t('market.title')}>
      <AppText variant="bodyStrong">{t('market.chooseCrop')}</AppText>
      <Choice
        options={(showAll ? ordered : ordered.slice(0, 12)).map((c) => ({ value: c.slug, label: name(c.slug) }))}
        value={slug}
        onChange={setSelected}
      />
      {!showAll && ordered.length > 12 ? (
        <Button label={t('market.moreCrops')} variant="ghost" icon="chevron-down" onPress={() => setShowAll(true)} />
      ) : null}
      <Notice>{t('market.notForecast')}</Notice>

      {prices.isLoading ? <Loading /> : null}
      {errorCode ? <ErrorState code={errorCode} onRetry={() => prices.refetch()} /> : null}
      {prices.data?.stale ? <Notice tone="warning">{t('market.stale')}</Notice> : null}
      {prices.data && prices.data.prices.length === 0 ? <Notice>{t('market.noData')}</Notice> : null}

      {prices.data?.prices.length ? (
        <>
          <AppText variant="title">{t('market.markets')}</AppText>
          {prices.data.prices.slice(0, 10).map((price) => (
            <Card key={`${price.market}-${price.variety}-${price.arrival_date}`}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{price.market}</AppText>
                  <AppText muted>
                    {price.district}
                    {price.variety ? ` · ${price.variety}` : ''}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="title" style={{ color: colors.primary }}>
                    {t('common.perQuintal', { value: rupees(price.modal_price) })}
                  </AppText>
                  <AppText muted>{t('market.range', { min: rupees(price.min_price), max: rupees(price.max_price) })}</AppText>
                </View>
              </Row>
              <AppText variant="caption" muted>
                {t('market.observedOn', { date: shortDate(price.arrival_date) })}
              </AppText>
            </Card>
          ))}
        </>
      ) : null}

      {history.data && history.data.points.length > 1 ? <Trend points={history.data.points} /> : null}
    </Screen>
  );
}

/** A dependency-free bar chart of stored price history (historical, not a forecast). */
function Trend({ points }: { points: { date: string; avg_modal_price: number }[] }) {
  const { t } = useTranslation();
  const values = points.map((p) => p.avg_modal_price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <Card>
      <AppText variant="title">{t('market.trend')}</AppText>
      <View style={styles.chart} accessible accessibilityLabel={`${t('market.trend')}: ₹${rupees(min)} – ₹${rupees(max)}`}>
        {points.map((p) => (
          <View
            key={p.date}
            style={[styles.bar, { height: `${20 + (80 * (p.avg_modal_price - min)) / Math.max(max - min, 1)}%` }]}
          />
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" muted>{shortDate(first.date)}</AppText>
        <AppText variant="caption" muted>
          {shortDate(last.date)} · ₹{rupees(last.avg_modal_price)}
        </AppText>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, backgroundColor: colors.primary, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, opacity: 0.85 },
});
