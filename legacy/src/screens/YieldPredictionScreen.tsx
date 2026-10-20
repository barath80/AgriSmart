import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Input from '../components/Input';
import Button from '../components/Button';
import indianDistricts from '../config/indianDistricts';
import mlServer from '../config/mlServer';
import { VictoryBar, VictoryChart, VictoryTheme } from 'victory-native';

type OtherCropResult = { crop: string; predicted_tonnes: number | null };

const SEASONS = [
  { name: 'kharif', months: [6, 7, 8, 9, 10] },
  { name: 'rabi', months: [10, 11, 12, 1, 2, 3] },
  { name: 'zaid', months: [3, 4, 5, 6] },
  { name: 'autumn', months: [9, 10, 11] },
  { name: 'winter', months: [11, 12, 1, 2] },
];

function inferSeasonFromMonth(month: number) {
  // month: 1-12
  for (const s of SEASONS) {
    if (s.months.includes(month)) return s.name;
  }
  return 'kharif';
}

export default function YieldPredictionScreen() {
  const { t } = useTranslation();
  // start empty - user must fill
  const [crop, setCrop] = useState('');
  const [month, setMonth] = useState<number | null>(null);
  const [state, setState] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [year] = useState<number>(new Date().getFullYear());
  const [rainfall, setRainfall] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [predicted, setPredicted] = useState<number | null>(null);
  const [otherResults, setOtherResults] = useState<OtherCropResult[]>([]);

  const season = useMemo(() => (month != null ? inferSeasonFromMonth(month) : ''), [month]);

  const basicCrops = ['wheat', 'rice', 'maize', 'cotton'];

  const onPredict = async () => {
    const areaNum = parseFloat(area) || 0;
    const rainfallNum = parseFloat(rainfall) || 0;
    if (!crop || areaNum <= 0) {
      Alert.alert(t('common.missingInfo'), t('common.pleaseFillAll'));
      return;
    }

    setLoading(true);
    setPredicted(null);
    setOtherResults([]);

    try {
      // helper: fetch with timeout using AbortController
      const fetchWithTimeout = (url: string, opts: RequestInit = {}, timeout = 4000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
      };

      // try multiple base URLs (mlServer.base first), useful for emulators/devices
      const candidates = [
        mlServer.base,
        'http://10.0.2.2:5001', // Android emulator
        'http://10.0.3.2:5001', // Genymotion
        'http://127.0.0.1:5001',
      ];

      const tryFetchWithFallback = async (path: string, opts: RequestInit = {}) => {
        let lastErr: any = null;
        for (const base of candidates) {
          const url = `${base}${path}`;
          try {
            const resp = await fetchWithTimeout(url, opts, 4000);
            return { resp, base };
          } catch (err) {
            lastErr = err;
          }
        }
        throw lastErr;
      };

      const { resp, base } = await tryFetchWithFallback('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop, season, state, area: areaNum, year, rainfall: rainfallNum }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setPredicted(Number(data.predicted_tonnes || 0));
      } else {
        Alert.alert(t('common.error'), data.error || t('common.error'));
      }

      // fetch other crops for visualization (exclude the main crop)
      const others = basicCrops.filter((c) => c !== crop.toLowerCase());
      try {
        const { resp: resp2 } = await tryFetchWithFallback('/other-crops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crops: others, season, state, area: areaNum, year, rainfall: rainfallNum }),
        });
        const d2 = await resp2.json();
        if (resp2.ok) setOtherResults(d2.results || []);
      } catch (err) {
        // ignore other-crops failure but keep predicted result
        console.warn('other-crops failed', err);
      }
    } catch (e: any) {
      console.error('Network error', e);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
          <Ionicons name="stats-chart" size={32} color="#E6F7FF" />
          <Text style={styles.title}>{t('yield.title')}</Text>
          <Text style={styles.subtitle}>{t('yield.subtitle')}</Text>
            </View>

            <View style={styles.form}>
          <Input label={t('yield.crop')} value={crop} onChangeText={setCrop} placeholder="e.g. wheat" />

          <Input label="Month (1-12)" value={month == null ? '' : String(month)} onChangeText={(v) => setMonth(v === '' ? null : Number(v))} placeholder="1-12" keyboardType="number-pad" />

          <Input label={t('yield.state')} value={state} onChangeText={setState} placeholder={t('yield.state')} />

          <Input label={t('yield.area')} value={area} onChangeText={setArea} placeholder={t('yield.area')} keyboardType="decimal-pad" />

          <Input label={t('yield.year')} value={String(year)} editable={false} />

          <Input label={t('yield.rainfall')} value={rainfall} onChangeText={setRainfall} placeholder={t('yield.rainfall')} keyboardType="decimal-pad" />

          <View style={{ marginTop: 12 }}>
            <Button title={loading ? t('common.loading') : t('yield.predict')} onPress={onPredict} disabled={loading} />
          </View>

          {predicted !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{t('yield.predictedYield')}</Text>
              <Text style={styles.resultValue}>{predicted.toFixed(2)} {t('yield.tonnes')}</Text>
            </View>
          )}

          {otherResults && otherResults.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>{t('yield.otherCrops')}</Text>
              <VictoryChart theme={VictoryTheme.material} domainPadding={20}>
                <VictoryBar
                  data={otherResults.map((r) => ({ x: r.crop, y: r.predicted_tonnes || 0 }))}
                  style={{ data: { fill: '#22c55e' } }}
                />
              </VictoryChart>
            </View>
          )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071837' },
  scrollView: { flex: 1 },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#84cc16',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#E6F7FF', marginTop: 12, marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'white' },
  form: { padding: 16 },
  resultCard: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: '#081a2b' },
  resultLabel: { color: '#9aa9b8' },
  resultValue: { color: '#e6f7ff', fontSize: 20, fontWeight: '700', marginTop: 6 },
  sectionTitle: { color: '#e6f7ff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
});

