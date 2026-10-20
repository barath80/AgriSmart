import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useProfile, useSaveFarm, useUpdateProfile } from '@/api/hooks';
import type { FarmerProfile, Irrigation } from '@/api/types';
import { AppText, Button, Card, Choice, Field, Loading, Notice, Screen, useErrorText } from '@/components/ui';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';

const IRRIGATION: Irrigation[] = ['rainfed', 'canal', 'borewell', 'drip', 'sprinkler'];

/** Only what advice really needs: name, place, farm size, water. Everything else is optional. */
export default function Onboarding() {
  const profile = useProfile();
  // The form starts from whatever the profile already holds (e.g. a re-onboarding).
  return profile.data ? <OnboardingForm profile={profile.data} /> : <Loading />;
}

function OnboardingForm({ profile }: { profile: FarmerProfile }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const updateProfile = useUpdateProfile();
  const saveFarm = useSaveFarm();
  const { locate, locating, denied } = useDeviceLocation();

  const [name, setName] = useState(profile.name);
  const [state, setState] = useState(profile.location?.state ?? '');
  const [district, setDistrict] = useState(profile.location?.district ?? '');
  const [village, setVillage] = useState(profile.location?.village ?? '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [acres, setAcres] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation>('rainfed');
  const [birthYear, setBirthYear] = useState(profile.birth_year ? String(profile.birth_year) : '');
  const [error, setError] = useState<string | null>(null);

  async function useGps() {
    const place = await locate();
    if (!place) return;
    setState(place.state);
    setDistrict(place.district);
    setVillage(place.village);
    setCoords({ latitude: place.latitude, longitude: place.longitude });
  }

  const area = Number(acres.replace(',', '.'));
  const valid = name.trim().length > 0 && state.trim().length > 1 && district.trim().length > 1 && area > 0;

  async function finish() {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        name: name.trim(),
        birth_year: birthYear ? Number(birthYear) : undefined,
        location: { state, district, village, ...(coords ?? {}) },
      });
      await saveFarm.mutateAsync({ name: '', area_acres: area, soil_type: null, irrigation });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'generic');
    }
  }

  return (
    <Screen title={t('onboarding.title')} back={false}>
      <AppText muted>{t('onboarding.subtitle')}</AppText>
      <Field label={t('onboarding.name')} value={name} onChangeText={setName} autoComplete="name" />

      <Card>
        <Button label={locating ? t('onboarding.locating') : t('onboarding.useGps')} icon="crosshairs-gps"
                variant="secondary" onPress={useGps} loading={locating} />
        {denied ? <Notice tone="warning">{t('onboarding.locationDenied')}</Notice> : null}
        <Field label={t('onboarding.state')} value={state} onChangeText={setState} />
        <Field label={t('onboarding.district')} value={district} onChangeText={setDistrict} />
        <Field label={`${t('onboarding.village')} ${t('common.optional')}`} value={village} onChangeText={setVillage} />
      </Card>

      <Field label={t('onboarding.farmSize')} value={acres} onChangeText={setAcres} keyboardType="decimal-pad" />
      <AppText variant="bodyStrong">{t('onboarding.waterSource')}</AppText>
      <Choice
        options={IRRIGATION.map((value) => ({ value, label: t(`irrigation.${value}`) }))}
        value={irrigation}
        onChange={setIrrigation}
      />
      <Field
        label={`${t('onboarding.birthYear')} ${t('common.optional')}`}
        value={birthYear}
        onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
      />
      {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
      <Button
        label={t('onboarding.finish')}
        icon="arrow-right"
        onPress={finish}
        disabled={!valid}
        loading={updateProfile.isPending || saveFarm.isPending}
      />
    </Screen>
  );
}
