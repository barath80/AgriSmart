import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useCropCatalog, useCycles, useFarms, useSoilRecords } from '@/api/hooks';
import type { CropCycle, Farm, Language } from '@/api/types';
import { AppText, Button, Card, ErrorState, Loading, Row, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme';

function FarmCard({ farm, cycles }: { farm: Farm; cycles: CropCycle[] }) {
  const { t, i18n } = useTranslation();
  const soil = useSoilRecords(farm.id);
  const catalog = useCropCatalog();
  const latest = soil.data?.[0];
  const cropName = (slug: string) =>
    catalog.data?.find((c) => c.slug === slug)?.names[i18n.language as Language] ?? slug;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title">{farm.name || t('farm.title')}</AppText>
        <AppText variant="bodyStrong" style={{ color: colors.primary }}>{t('common.acres', { value: farm.area_acres })}</AppText>
      </Row>
      <AppText muted>
        {t(`irrigation.${farm.irrigation}`)}
        {farm.soil_type ? ` · ${t(`soil.${farm.soil_type}`)}` : ''}
      </AppText>

      <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>{t('farm.soilTest')}</AppText>
      {latest ? (
        <AppText>
          N {latest.nitrogen} · P {latest.phosphorus} · K {latest.potassium} · pH {latest.ph}  ({latest.tested_on})
        </AppText>
      ) : (
        <AppText muted>{t('farm.noSoil')}</AppText>
      )}
      <Button label={t('farm.addSoil')} icon="flask-outline" variant="secondary"
              onPress={() => router.push({ pathname: '/soil', params: { farmId: farm.id } })} />

      <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>{t('farm.crops')}</AppText>
      {cycles.length ? (
        cycles.map((cycle) => (
          <AppText key={cycle.id}>
            {cropName(cycle.crop_slug)} · {t(`season.${cycle.season}`)} · {cycle.sowing_date}
          </AppText>
        ))
      ) : (
        <AppText muted>{t('farm.noCrops')}</AppText>
      )}
      <Button label={t('farm.addCrop')} icon="plus" variant="secondary"
              onPress={() => router.push({ pathname: '/add-crop', params: { farmId: farm.id } })} />
    </Card>
  );
}

export default function FarmTab() {
  const { t } = useTranslation();
  const farms = useFarms();
  const cycles = useCycles();

  if (farms.isPending) return <Loading />;
  if (farms.error) return <ErrorState code={(farms.error as { code?: string }).code ?? 'generic'} onRetry={() => farms.refetch()} />;

  return (
    <Screen title={t('farm.title')} back={false}>
      {farms.data.map((farm) => (
        <FarmCard key={farm.id} farm={farm} cycles={(cycles.data ?? []).filter((c) => c.farm_id === farm.id && c.status !== 'harvested')} />
      ))}
      <Button label={t('farm.addFarm')} icon="plus" onPress={() => router.push('/add-farm')} />
    </Screen>
  );
}
