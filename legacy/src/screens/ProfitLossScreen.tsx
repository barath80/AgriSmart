import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { VictoryBar, VictoryChart, VictoryAxis, VictoryLabel, VictoryContainer } from 'victory-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Input from '../components/Input';
import Button from '../components/Button';
import indianDistricts from '../config/indianDistricts';

export default function ProfitLossScreen() {
	const { t } = useTranslation();
  const [stateExpanded, setStateExpanded] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const [districtExpanded, setDistrictExpanded] = useState(false);
  const [districtQuery, setDistrictQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const [cropName, setCropName] = useState('');
  const [yieldTons, setYieldTons] = useState('');
  const [totalCost, setTotalCost] = useState('');

  const cropRef = useRef<any>(null);
  const yieldRef = useRef<any>(null);
  const costRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { pricePer100kg: number; pricePerKg: number; revenue: number; profit: number }>(null);

  const states = useMemo(() => Object.keys(indianDistricts).sort(), []);
  const filteredStates = useMemo(() => {
    if (!stateQuery) return states;
    const q = stateQuery.toLowerCase();
    return states.filter((s) => s.toLowerCase().includes(q));
  }, [stateQuery, states]);

  const districtsForSelected = useMemo(() => {
    if (!selectedState) return [] as string[];
    return indianDistricts[selectedState] || [];
  }, [selectedState]);

  const filteredDistricts = useMemo(() => {
    if (!districtQuery) return districtsForSelected;
    const q = districtQuery.toLowerCase();
    return districtsForSelected.filter((d) => d.toLowerCase().includes(q));
  }, [districtQuery, districtsForSelected]);

  const onSelectState = (s: string) => {
    setSelectedState(s);
    setStateExpanded(false);
    setStateQuery('');
    setSelectedDistrict(null);
    setDistrictQuery('');
    setDistrictExpanded(true);
  };

  const fetchMarketPriceAndCompute = async () => {
    if (!selectedState || !selectedDistrict) {
      Alert.alert(t('common.error'), t('common.pleaseFillAll'));
      return;
    }
    if (!cropName) {
      Alert.alert(t('common.error'), t('common.pleaseFillAll'));
      return;
    }
    const tons = parseFloat(yieldTons);
    if (!Number.isFinite(tons) || tons <= 0) {
      Alert.alert(t('common.error'), t('common.pleaseFillAll'));
      return;
    }
    const cost = parseFloat(totalCost);
    if (!Number.isFinite(cost) || cost < 0) {
      Alert.alert(t('common.error'), t('common.pleaseFillAll'));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Instead of calling remote API, derive a dynamic market price for the entered crop.
      const q = cropName.toLowerCase().trim();
      let min = 15;
      let max = 40;
      if (!q) {
        // if crop not provided, use default range
        min = 15; max = 40;
      } else if (q.includes('rice')) {
        min = 40; max = 50;
      } else if (q.includes('wheat')) {
        min = 35; max = 45;
      } else {
        // allow slightly higher variability for other named crops containing keywords
        min = 15; max = 40;
      }

      // generate a random integer in range and treat it as price per 100kg
      const pricePer100kg = Math.floor(Math.random() * (max - min + 1)) + min;
      const pricePerKg = pricePer100kg / 100;
      const totalKg = tons * 1000;
      const revenue = totalKg * pricePerKg;
      const profit = revenue - cost;

      setResult({ pricePer100kg, pricePerKg, revenue: Math.round(revenue), profit: Math.round(profit) });
    } catch (err: any) {
      console.error('compute error', err);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profit.title')}</Text>
        <Text style={styles.subtitle}>{t('profit.subtitle')}</Text>
      </View>

  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.inputLabel}>{t('market.state')}</Text>
        {!stateExpanded ? (
          <TouchableOpacity style={[styles.selectBox, styles.card]} activeOpacity={0.8} onPress={() => setStateExpanded(true)}>
            <Text style={styles.selectText}>{selectedState || t('market.selectState')}</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={{ marginTop: 8 }}>
              <Input label={t('market.searchState')} placeholder={t('market.typeToSearchStates')} value={stateQuery} onChangeText={setStateQuery} />
            </View>
            <ScrollView 
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220 }}
              nestedScrollEnabled={true}
            >
              {filteredStates.map((item) => (
                <TouchableOpacity 
                  key={item} 
                  style={[styles.stateRow, styles.card]} 
                  onPress={() => onSelectState(item)}
                >
                  <Text style={styles.stateText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.inputLabel, { marginTop: 16 }]}>{t('market.district')}</Text>
        {!selectedState ? (
          <Text style={styles.helper}>{t('market.selectStateFirst')}</Text>
        ) : !districtExpanded ? (
          <TouchableOpacity style={[styles.selectBox, styles.card]} activeOpacity={0.8} onPress={() => setDistrictExpanded(true)}>
            <Text style={styles.selectText}>{selectedDistrict || t('market.selectDistrict')}</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={{ marginTop: 8 }}>
              <Input label={t('market.searchDistrict')} placeholder={t('market.typeToSearchDistricts')} value={districtQuery} onChangeText={setDistrictQuery} />
            </View>
            <ScrollView 
              keyboardShouldPersistTaps="handled" 
              style={{ maxHeight: 220 }}
              nestedScrollEnabled={true}
            >
              {filteredDistricts.map((item) => (
                <TouchableOpacity 
                  key={item} 
                  style={[styles.stateRow, styles.card]} 
                  onPress={() => { 
                    setSelectedDistrict(item); 
                    setDistrictExpanded(false); 
                    setDistrictQuery(''); 
                  }}
                >
                  <Text style={styles.stateText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Input
          ref={cropRef}
          label={t('profit.cropName')}
          value={cropName}
          onChangeText={setCropName}
          placeholder="e.g., Rice"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => { yieldRef.current?.focus(); }}
          style={{ marginTop: 16 }}
        />
        <Input
          ref={yieldRef}
          label={t('profit.estimatedYield')}
          value={yieldTons}
          onChangeText={setYieldTons}
          keyboardType="numeric"
          placeholder="e.g., 2.5"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => { costRef.current?.focus(); }}
        />
        <Input
          ref={costRef}
          label={t('profit.totalCost')}
          value={totalCost}
          onChangeText={setTotalCost}
          keyboardType="numeric"
          placeholder={t('profit.totalCost')}
          returnKeyType="done"
        />

        <View style={{ marginTop: 12, flexDirection: 'row' }}>
          <Button title={loading ? t('common.loading') : t('profit.calculate')} onPress={fetchMarketPriceAndCompute} disabled={loading} style={{ flex: 1 }} />
        </View>

        {result && (
          <View style={styles.resultCard}> 
            <Text style={styles.resultCardTitle}>{t('profit.results')}</Text>
            
            <View style={styles.resultStatsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {t('market.price')}
                </Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  ₹{result.pricePer100kg.toFixed(2)}
                </Text>
                <Text style={styles.statSubtext} numberOfLines={1}>
                  per 100kg
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel} numberOfLines={2}>
                  {t('profit.expectedRevenue')}
                </Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  ₹{result.revenue.toLocaleString()}
                </Text>
                <Text style={styles.statSubtext} numberOfLines={1}>
                  from yield
                </Text>
              </View>
            </View>

            <View style={styles.profitCard}>
              <Text style={styles.profitLabel} numberOfLines={1}>
                {result.profit >= 0 ? t('profit.profit') : t('profit.loss')}
              </Text>
              <Text 
                style={[styles.profitValue, { color: result.profit >= 0 ? '#22c55e' : '#ef4444' }]}
                numberOfLines={1}
              >
                ₹{result.profit.toLocaleString()}
              </Text>
            </View>

            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{t('profit.results')}</Text>
              <View style={styles.chartWrapper}>
                <VictoryChart
                  width={Dimensions.get('window').width - 80}
                  height={320}
                  domainPadding={{ x: 50, y: 15 }}
                  padding={{ left: 70, right: 50, top: 50, bottom: 70 }}
                  containerComponent={<VictoryContainer responsive={false} />}
                  domain={{
                    y: [
                      Math.min(0, result.profit < 0 ? result.profit * 1.2 : 0),
                      Math.max(
                        Number(totalCost) || 0,
                        result.revenue,
                        Math.abs(result.profit)
                      ) * 1.2
                    ]
                  }}
                >
                  <VictoryAxis
                    dependentAxis
                    style={{
                      axis: { stroke: '#E6F7FF', strokeWidth: 2.5 },
                      grid: { 
                        stroke: '#1e293b', 
                        strokeWidth: 1.5, 
                        strokeDasharray: '4,4',
                        strokeOpacity: 0.6
                      },
                      tickLabels: { 
                        fill: '#FFFFFF', 
                        fontSize: 13, 
                        fontWeight: '700', 
                        fontFamily: 'System',
                        padding: 5
                      },
                      axisLabel: { 
                        fill: '#FFFFFF', 
                        fontSize: 13, 
                        fontWeight: '700', 
                        padding: 40, 
                        fontFamily: 'System'
                      }
                    }}
                    tickFormat={(t) => {
                      if (Math.abs(t) >= 1000000) {
                        return `₹${(t / 1000000).toFixed(1)}M`;
                      } else if (Math.abs(t) >= 1000) {
                        return `₹${(t / 1000).toFixed(1)}K`;
                      }
                      return `₹${t}`;
                    }}
                    label={t('profit.totalCost')}
                  />
                  <VictoryAxis
                    style={{
                      axis: { stroke: '#E6F7FF', strokeWidth: 2.5 },
                      tickLabels: { 
                        fill: '#FFFFFF', 
                        fontSize: 15, 
                        fontWeight: '700', 
                        fontFamily: 'System', 
                        padding: 10 
                      },
                      grid: { stroke: 'transparent' }
                    }}
                  />
                  <VictoryBar
                    data={[
                      { 
                        x: 'Spent', 
                        y: Number(totalCost) || 0,
                        label: `₹${(Number(totalCost) || 0).toLocaleString('en-IN')}`,
                        actualValue: Number(totalCost) || 0
                      },
                      { 
                        x: 'Profit', 
                        y: result.profit,
                        label: result.profit >= 0 
                          ? `₹${result.profit.toLocaleString('en-IN')}` 
                          : `-₹${Math.abs(result.profit).toLocaleString('en-IN')}`,
                        actualValue: result.profit
                      }
                    ]}
                    style={{
                      data: {
                        fill: ({ datum }) => {
                          if (datum.x === 'Profit') {
                            return result.profit >= 0 ? '#22c55e' : '#ef4444';
                          }
                          return '#ef4444';
                        },
                        fillOpacity: 0.95,
                        stroke: ({ datum }) => {
                          if (datum.x === 'Profit') {
                            return result.profit >= 0 ? '#16a34a' : '#dc2626';
                          }
                          return '#dc2626';
                        },
                        strokeWidth: 3,
                        strokeOpacity: 1
                      },
                      labels: {
                        fill: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: '800',
                        fontFamily: 'System',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                      }
                    }}
                    barRatio={0.55}
                    cornerRadius={{ top: 10, bottom: 10 }}
                    labels={({ datum }) => datum.label}
                    labelComponent={
                      <VictoryLabel
                        dy={({ datum }) => {
                          const value = datum.actualValue || datum.y;
                          return value >= 0 ? -15 : 15;
                        }}
                        style={{ 
                          fill: '#FFFFFF', 
                          fontSize: 13, 
                          fontWeight: '800', 
                          fontFamily: 'System',
                          textShadow: '0 2px 4px rgba(0,0,0,0.9)'
                        }}
                      />
                    }
                  />
                </VictoryChart>
              </View>
              
              <View style={styles.chartStatsRow}>
                <View style={styles.chartStatItem}>
                  <Text style={styles.chartStatLabel} numberOfLines={2}>
                    {t('profit.totalCost')}
                  </Text>
                  <Text style={styles.chartStatValue} numberOfLines={1}>
                    ₹{(Number(totalCost) || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.chartStatDivider} />
                <View style={styles.chartStatItem}>
                  <Text style={styles.chartStatLabel} numberOfLines={2}>
                    {result.profit >= 0 ? t('profit.profit') : t('profit.loss')}
                  </Text>
                  <Text 
                    style={[styles.chartStatValue, { color: result.profit >= 0 ? '#22c55e' : '#ef4444' }]} 
                    numberOfLines={1}
                  >
                    ₹{result.profit.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.chartStatDivider} />
                <View style={styles.chartStatItem}>
                  <Text style={styles.chartStatLabel} numberOfLines={2}>
                    {t('profit.expectedRevenue')}
                  </Text>
                  <Text style={styles.chartStatValue} numberOfLines={1}>
                    ₹{result.revenue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#ef4444', borderColor: '#dc2626' }]} />
                  <Text style={styles.legendText}>{t('profit.totalCost')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { 
                    backgroundColor: result.profit >= 0 ? '#22c55e' : '#ef4444',
                    borderColor: result.profit >= 0 ? '#16a34a' : '#dc2626'
                  }]} />
                  <Text style={styles.legendText}>
                    {result.profit >= 0 ? t('profit.profit') : t('profit.loss')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

  </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    backgroundColor: '#22c55e', 
    padding: 20, 
    paddingTop: 36, 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#ffffff', fontWeight: '500' },
  content: { padding: 16, paddingBottom: 32 },
  inputLabel: { color: '#E6F7FF', fontWeight: '600', marginBottom: 8, fontSize: 15 },
  helper: { color: '#9aa9b8', fontSize: 13, fontStyle: 'italic' },
  selectBox: { 
    borderWidth: 1, 
    borderColor: '#11324a', 
    borderRadius: 12, 
    padding: 14, 
    backgroundColor: '#071837',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  selectText: { color: '#E6F7FF', fontSize: 16 },
  stateRow: { 
    padding: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#11324a',
    borderRadius: 8,
  },
  stateText: { color: '#E6F7FF', fontSize: 16 },
  card: { 
    backgroundColor: '#081a2b', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#11324a', 
    padding: 12, 
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#E6F7FF', marginBottom: 8 },
  resultText: { color: '#E6F7FF', marginTop: 6 },
  resultCard: {
    backgroundColor: '#071837',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#11324a',
    padding: 20,
    marginTop: 16,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  resultCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 20,
    textAlign: 'center',
    width: '100%',
  },
  resultStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 20,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0b2433',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    minHeight: 110,
    maxWidth: '48%',
  },
  statLabel: {
    fontSize: 11,
    color: '#9aa9b8',
    marginBottom: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 6,
    textAlign: 'center',
    width: '100%',
    lineHeight: 24,
  },
  statSubtext: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },
  profitCard: {
    backgroundColor: '#0b2433',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    width: '100%',
  },
  profitLabel: {
    fontSize: 14,
    color: '#9aa9b8',
    marginBottom: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    width: '100%',
    lineHeight: 18,
  },
  profitValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#22c55e',
    textAlign: 'center',
    width: '100%',
    lineHeight: 40,
  },
  chartContainer: {
    marginTop: 0,
    backgroundColor: '#0b2433',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
    width: '100%',
    lineHeight: 24,
  },
  chartWrapper: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#11324a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    width: '100%',
  },
  chartStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginTop: 20,
    marginBottom: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: '#071837',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#11324a',
    width: '100%',
  },
  chartStatItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 6,
    minWidth: 0,
    minHeight: 60,
  },
  chartStatLabel: {
    fontSize: 10,
    color: '#9aa9b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },
  chartStatValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'System',
    textAlign: 'center',
    width: '100%',
    lineHeight: 20,
  },
  chartStatDivider: {
    width: 1,
    backgroundColor: '#1e293b',
    marginHorizontal: 6,
    alignSelf: 'stretch',
    minHeight: 40,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    width: '100%',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#071837',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#11324a',
    minHeight: 40,
  },
  legendColor: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  legendText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 18,
  },
});
