import Constants from 'expo-constants';
import React, { useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import Input from '../components/Input';
import Button from '../components/Button';
import indianDistricts from '../config/indianDistricts';
import { CROPS } from '../services/fertilizerData';

// Supplied at build time through app config `extra` (never commit real keys).
const MARKET_API_KEY: string = Constants.expoConfig?.extra?.MARKET_API_KEY ?? '';
const MARKET_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

export default function MarketScreen() {
	const { t } = useTranslation();
	// Debug: report masked presence of keys at runtime
	React.useEffect(() => {
		try {
			const mask = (s?: string) => (s ? `${s.slice(0, 4)}...${s.slice(-4)}` : '(empty)');
			console.debug('MarketScreen: MARKET_API_KEY', mask(MARKET_API_KEY));
			console.debug('MarketScreen: MARKET_RESOURCE_ID', mask(MARKET_RESOURCE_ID));
		} catch (e) {
			console.debug('MarketScreen: error reading keys', e);
		}
	}, []);
	const [stateExpanded, setStateExpanded] = useState(false);
	const [stateQuery, setStateQuery] = useState('');
	const [selectedState, setSelectedState] = useState<string | null>(null);

	const [districtExpanded, setDistrictExpanded] = useState(false);
	const [districtQuery, setDistrictQuery] = useState('');
	const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

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

	const [loading, setLoading] = useState(false);
	const [marketResults, setMarketResults] = useState<Array<{ crop: string; price: string }>>([]);
	// Map of normalized crop name -> raw price string from market API
	const [cropRates, setCropRates] = useState<Record<string, string>>({});

	const fetchMarketPrices = async () => {
		if (!selectedState || !selectedDistrict) return;
		setLoading(true);

		setMarketResults([]);

		try {
			// Instead of calling external API, generate random market rates between 15 and 40 for each crop.
			const map: Record<string, string> = {};
			const results: Array<{ crop: string; price: string }> = [];
			CROPS.forEach((c) => {
				const key = c.toLowerCase();
				let min = 15;
				let max = 40;
				if (key === 'rice') {
					min = 40; max = 50; // always 40-50 for rice
				} else if (key === 'wheat') {
					min = 35; max = 45; // always 35-45 for wheat
				}
				// random integer between min and max (inclusive)
				const val = Math.floor(Math.random() * (max - min + 1)) + min;
				map[key] = String(val);
				results.push({ crop: c, price: String(val) });
			});
			setCropRates(map);
			setMarketResults(results);
		} finally {
			setLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<View style={styles.header}>
				<Text style={styles.title}>{t('market.title')}</Text>
				<Text style={styles.subtitle}>{t('market.subtitle')}</Text>
			</View>

			<View style={styles.content}>
				<Text style={styles.inputLabel}>{t('market.state')}</Text>
				{!stateExpanded ? (
					<TouchableOpacity
						style={[styles.selectBox, styles.card]}
						activeOpacity={0.8}
						onPress={() => setStateExpanded((prev) => { const next = !prev; if (next) setDistrictExpanded(false); return next; })}
					>
						<Text style={styles.selectText}>{selectedState || t('market.selectState')}</Text>
					</TouchableOpacity>
				) : (
					<View style={{ marginTop: 8 }}>
						<View style={{ marginTop: 12 }}>
							<Input
								label={t('market.searchState')}
								placeholder={t('market.typeToSearchStates')}
								value={stateQuery}
								onChangeText={setStateQuery}
							/>
						</View>

						<FlatList
							data={filteredStates}
							keyExtractor={(item) => item}
							renderItem={({ item }) => (
								<TouchableOpacity
									style={[styles.stateRow, styles.card]}
									onPress={() => onSelectState(item)}
								>
									<Text style={styles.stateText}>{item}</Text>
								</TouchableOpacity>
							)}
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={{ paddingBottom: 40 }}
							style={{ maxHeight: 320 }}
						/>
					</View>
				)}

				<Text style={[styles.inputLabel, { marginTop: 16 }]}>{t('market.district')}</Text>
				{!selectedState ? (
					<Text style={styles.helper}>{t('market.selectStateFirst')}</Text>
				) : !districtExpanded ? (
					<TouchableOpacity
						style={[styles.selectBox, styles.card]}
						activeOpacity={0.8}
						onPress={() => setDistrictExpanded((prev) => { const next = !prev; if (next) setStateExpanded(false); return next; })}
					>
						<Text style={styles.selectText}>{selectedDistrict || t('market.selectDistrict')}</Text>
					</TouchableOpacity>
				) : (
					<View>
						<View style={{ marginTop: 12 }}>
							<Input
								label={t('market.searchDistrict')}
								placeholder={t('market.typeToSearchDistricts')}
								value={districtQuery}
								onChangeText={setDistrictQuery}
							/>
						</View>

						<FlatList
							data={filteredDistricts}
							keyExtractor={(item) => item}
							renderItem={({ item }) => (
								<TouchableOpacity
									style={[styles.stateRow, styles.card]}
									onPress={() => {
										setSelectedDistrict(item);
										setDistrictExpanded(false);
										setDistrictQuery('');
									}}
								>
									<Text style={styles.stateText}>{item}</Text>
								</TouchableOpacity>
							)}
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={{ paddingBottom: 40 }}
							style={{ maxHeight: 320 }}
						/>
					</View>
				)}

				{/* Fetch button placed under district selector */}
				<View style={styles.fetchRow}>
					<Button
						title={loading ? t('market.fetching') : t('market.fetchPrices')}
						onPress={fetchMarketPrices}
						disabled={loading || !selectedState || !selectedDistrict}
						style={{ flex: 0.5 }}
					/>
					<View style={{ flex: 0.5 }} />
				</View>

				{/* Results list shown below the button */}
				{/* Show our canonical crop list with dynamic rates populated after fetch */}
				<FlatList
					data={CROPS}
					keyExtractor={(item) => item}
					renderItem={({ item }) => {
						const cropKey = item.toLowerCase();

						// helper: find best match in cropRates (exact then include)
						const findRateForCrop = (name: string) => {
							const key = name.toLowerCase();
							if (cropRates[key]) return cropRates[key];
							const found = Object.keys(cropRates).find((k) => k.includes(key) || key.includes(k));
							return found ? cropRates[found] : undefined;
						};

						const rawPrice = findRateForCrop(item);
						// show raw numeric price (e.g., 45.0) — do not divide by 100
						let priceText = '-';
						if (rawPrice) {
							const raw = String(rawPrice).replace(/[^0-9.\-]/g, '');
							const num = parseFloat(raw);
							priceText = Number.isFinite(num) ? `₹${num.toFixed(1)}` : String(rawPrice);
						}

						return (
							<View style={styles.resultRow}>
								<Text style={styles.cropName}>{item}</Text>
								<Text style={styles.cropPrice}>{priceText}</Text>
							</View>
						);
					}}
					style={{ marginTop: 12 }}
					contentContainerStyle={{ paddingBottom: 40 }}
				/>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#071837' },
	header: {
		backgroundColor: '#22c55e',
		padding: 20,
		paddingTop: 36,
		marginTop: 12,
		borderBottomLeftRadius: 20,
		borderBottomRightRadius: 20,
		alignItems: 'center',
	},
	title: { fontSize: 24, fontWeight: 'bold', color: '#e6f7ff', marginBottom: 4 },
	subtitle: { fontSize: 14, color: '#ffffff', fontWeight: '500' },
	content: { padding: 16, flex: 1, paddingTop: 24 },
	inputLabel: { color: '#e6f7ff', fontWeight: '600', marginBottom: 8 },
	helper: { color: '#9aa9b8', fontSize: 13 },
	selectBox: {
		borderWidth: 1,
		borderColor: '#11324a',
		borderRadius: 8,
		padding: 12,
		backgroundColor: '#071837',
	},
	selectText: { color: '#e6f7ff', fontSize: 16 },
	stateRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#11324a' },
	stateText: { color: '#e6f7ff', fontSize: 16 },
	card: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 3,
		backgroundColor: '#081a2b',
		borderRadius: 10,
	},
	expandedPanel: {
		zIndex: 40,
		elevation: 8,
		backgroundColor: 'transparent',
	},
	fetchRow: { flexDirection: 'row', marginTop: 18, alignItems: 'center' },
	resultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#11324a', flexDirection: 'row', justifyContent: 'space-between' },
	cropName: { color: '#e6f7ff', fontWeight: '600', flex: 0.7 },
	cropPrice: { color: '#9aa9b8', flex: 0.3, textAlign: 'right' },
});

