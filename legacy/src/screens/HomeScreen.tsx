import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setStateName } from '../store/slices/locationSlice';
import { setLoading, setWeather, setForecast, setCity, setError } from '../store/slices/weatherSlice';
import { getWeatherData, getWeatherIcon } from '../services/weatherService';
import { getCityForState } from '../config/stateToCityMapping';
import { ActivityIndicator } from 'react-native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import indianDistricts from '../config/indianDistricts';
import LanguageSelector from "../components/LanguageSelector";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const dispatch = useAppDispatch();
  const [stateModalVisible, setStateModalVisible] = useState(false);
  
  // Get selected state from Redux store
  const selectedStateFromStore = useAppSelector((state) => (state as any).location?.stateName);
  const [selectedState, setSelectedState] = useState<string>(selectedStateFromStore || 'Tamil Nadu');
  
  // Get weather data from Redux store
  const weather = useAppSelector((state) => (state as any).weather?.current);
  const forecast = useAppSelector((state) => (state as any).weather?.forecast) || [];
  const weatherLoading = useAppSelector((state) => (state as any).weather?.loading);
  const [refreshing, setRefreshing] = useState(false);
  
  // Sync local state with Redux store
  useEffect(() => {
    if (selectedStateFromStore) {
      setSelectedState(selectedStateFromStore);
    }
  }, [selectedStateFromStore]);
  
  // Fetch weather when state changes
  const loadWeather = async (forceRefresh: boolean = false) => {
    if (!selectedState) return;
    
    // Get consistent city name (no ", India" suffix)
    const cityName = getCityForState(selectedState);
    dispatch(setCity(cityName));
    dispatch(setLoading(true));
    setRefreshing(forceRefresh);
    
    try {
      // Pass city name directly (normalization happens in service)
      const { current, forecast: forecastData } = await getWeatherData(cityName, forceRefresh);
      dispatch(setWeather(current));
      dispatch(setForecast(forecastData));
      dispatch(setError(null));
    } catch (error: any) {
      console.error('[HomeScreen] Failed to fetch weather:', error);
      dispatch(setError(error.message || 'Failed to fetch weather'));
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWeather(false);
  }, [selectedState, dispatch]);

  const services: Array<{
    id: string;
    icon: string;
    label: string;
    description: string;
    color: string;
    gradient: readonly [string, string];
    screen: string;
  }> = [
    {
      id: "crop",
      icon: "leaf",
      label: t('crop.title'),
      description: t('crop.subtitle'),
      color: "#22c55e",
  gradient: ["#22c55e", "#16a34a"] as const,
      screen: "Crop",
    },
    {
      id: "disease",
      icon: "bug",
      label: t('disease.title'),
      description: t('disease.subtitle'),
      color: "#ef4444",
  gradient: ["#ef4444", "#dc2626"] as const,
      screen: "DiseaseDetection",
    },
    {
      id: "pest",
      icon: "bug-outline",
      label: t('pest.title'),
      description: t('pest.subtitle'),
      color: "#8b5cf6",
  gradient: ["#8b5cf6", "#7c3aed"] as const,
      screen: "PestDetection",
    },
    {
      id: "market",
      icon: "trending-up",
      label: t('market.title'),
      description: t('market.subtitle'),
      color: "#3b82f6",
  gradient: ["#3b82f6", "#2563eb"] as const,
      screen: "Market",
    },
    {
      id: "profit",
      icon: "calculator",
      label: t('profit.title'),
      description: t('profit.subtitle'),
      color: "#f59e0b",
  gradient: ["#f59e0b", "#d97706"] as const,
      screen: "ProfitLoss",
    },
    {
      id: "chat",
      icon: "sparkles",
      label: t('voice.title'),
      description: t('voice.subtitle'),
      color: "#ec4899",
  gradient: ["#ec4899", "#db2777"] as const,
      screen: "ChatAssistant",
    },
    {
      id: "weather",
      icon: "partly-sunny",
      label: t('weather.title'),
      description: t('weather.forecast'),
      color: "#06b6d4",
  gradient: ["#06b6d4", "#0891b2"] as const,
      screen: "Weather",
    },
    {
      id: "community",
      icon: "people",
      label: t('tabs.community'),
      description: t('community.subtitle'),
      color: "#14b8a6",
  gradient: ["#14b8a6", "#0d9488"] as const,
      screen: "Community",
    },
    {
      id: "calendar",
      icon: "calendar",
      label: t('calendar.title'),
      description: t('calendar.subtitle'),
      color: "#f97316",
      gradient: ["#f97316", "#ea580c"] as const,
      screen: "Calendar",
    },
    {
      id: "learn",
      icon: "school",
      label: t('learn.title'),
      description: t('learn.subtitle'),
      color: "#6366f1",
      gradient: ["#6366f1", "#4f46e5"] as const,
      screen: "LearnFarmerCourse",
    },
    {
      id: "soil-test",
      icon: "flask",
      label: t('soilTest.title'),
      description: t('soilTest.subtitle'),
      color: "#eab308",
      gradient: ["#eab308", "#ca8a04"] as const,
      screen: "SoilTest",
    },
    {
      id: "fertilizer",
      icon: "repeat",
      label: t('fertilizer.title'),
      description: t('fertilizer.subtitle'),
      color: "#10b981",
      gradient: ["#10b981", "#059669"] as const,
      screen: "Fertilizer",
    },
    {
      id: "government",
      icon: "document-text",
      label: t('government.title'),
      description: t('government.subtitle'),
      color: "#3b82f6",
      gradient: ["#3b82f6", "#2563eb"] as const,
      screen: "GovernmentSchema",
    },
    {
      id: "helpline",
      icon: "call",
      label: t('helpline.title'),
      description: t('helpline.subtitle'),
      color: "#ef4444",
      gradient: ["#ef4444", "#dc2626"] as const,
      screen: "AISmartHelpline",
    },
    {
      id: "yield",
      icon: "stats-chart",
      label: t('yield.title'),
      description: t('yield.subtitle'),
      color: "#84cc16",
      gradient: ["#84cc16", "#65a30d"] as const,
      screen: "YieldPrediction",
    },
    {
      id: "smartmapping",
      icon: "map",
      label: t('smartMapping.title'),
      description: t('smartMapping.subtitle'),
      color: "#06b6d4",
      gradient: ["#06b6d4", "#0891b2"] as const,
      screen: "SmartMapping",
    },
  ];

  const navigateToScreen = (screenName: string) => {
    setSidebarVisible(false);
    (navigation as any).navigate(screenName);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Sidebar Menu */}
      <Modal
        visible={sidebarVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarHeaderContent}>
                <Text style={styles.sidebarTitle}>AgriSmart</Text>
                <Text style={styles.sidebarSubtitle}>All Features</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSidebarVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.menuItem}
                  onPress={() => navigateToScreen(service.screen)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.menuIconContainer,
                      { backgroundColor: service.color + "20" },
                    ]}
                  >
                    <Ionicons
                      name={service.icon as any}
                      size={24}
                      color={service.color}
                    />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuLabel}>{service.label}</Text>
                    <Text style={styles.menuDescription}>{service.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9FD3FF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <LinearGradient
          colors={["#000000", "#071840"] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
            <View style={styles.headerContent}>
              <View style={styles.welcomeSection}>
                <View style={styles.headerTop}>
                  {/* Top-left small icon */}
                  {/* Replace three-dash menu with header image */}
                  <Image
                    source={require("../../assets/images/header.png")}
                    style={styles.headerImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.greeting}>🍃 {t('home.title')}</Text>
                </View>
                <Text style={styles.welcomeText}>
                  {t('home.subtitle')}
                </Text>
              </View>

              {/* Language selector and menu button */}
              <View style={styles.headerRight}>
                <LanguageSelector />
                <TouchableOpacity
                  style={styles.moreInfoButton}
                  onPress={() => setSidebarVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#ffffff" />
                  <Text style={styles.moreInfoText}>{t('home.moreInfo')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          
          {/* Location Display */}
          {weather && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#9FD3FF" />
              <Text style={styles.locationText}>
                {getCityForState(selectedState) || 'Location'}
              </Text>
            </View>
          )}

          {/* Weather / Field Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Ionicons name="thermometer" size={20} color="#fbbf24" />
              {weatherLoading ? (
                <ActivityIndicator size="small" color="#fbbf24" style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.metricValue}>{weather?.temperature || '--'}°C</Text>
                  <Text style={styles.metricLabel}>Temp</Text>
                </>
              )}
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="water" size={20} color="#60a5fa" />
              {weatherLoading ? (
                <ActivityIndicator size="small" color="#60a5fa" style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.metricValue}>{weather?.humidity || '--'}%</Text>
                  <Text style={styles.metricLabel}>Humidity</Text>
                </>
              )}
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="speedometer" size={20} color="#60a5fa" />
              {weatherLoading ? (
                <ActivityIndicator size="small" color="#60a5fa" style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.metricValue}>{weather?.windSpeed || '--'} km/h</Text>
                  <Text style={styles.metricLabel}>Wind</Text>
                </>
              )}
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="leaf" size={20} color="#06b6d4" />
              {weatherLoading ? (
                <ActivityIndicator size="small" color="#06b6d4" style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.metricValue}>{weather?.soilMoisture?.toFixed(0) || '--'}%</Text>
                  <Text style={styles.metricLabel}>Moisture</Text>
                </>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Weather Forecast Card (moved above Explore Features so it's visible first) */}
        <View style={styles.section}>
          <Card style={styles.weatherCard}>
            <View style={styles.weatherCardHeader}>
              <View style={styles.weatherTitleContainer}>
                <Ionicons name="partly-sunny" size={24} color="#f59e0b" />
                <Text style={styles.weatherCardTitle}>{t('weather.forecast')}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigateToScreen("Weather")}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {weatherLoading && forecast.length === 0 ? (
              <View style={styles.forecastLoading}>
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text style={styles.forecastLoadingText}>Loading forecast...</Text>
              </View>
            ) : forecast.length > 0 ? (
              <View style={styles.forecastRow}>
                {forecast.slice(0, 4).map((day: any, index: number) => (
                  <View key={index} style={styles.forecastItem}>
                    <Text style={styles.forecastDay}>{day.date}</Text>
                    <Ionicons 
                      name={getWeatherIcon(day.icon, day.description) as any} 
                      size={32} 
                      color="#f59e0b" 
                    />
                    <View style={styles.forecastTempContainer}>
                      <Text style={styles.forecastTemp}>{day.temperature}°C</Text>
                      {day.minTemp !== undefined && day.maxTemp !== undefined && (
                        <Text style={styles.forecastTempRange}>
                          {day.minTemp}° / {day.maxTemp}°
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.forecastLoading}>
                <Text style={styles.forecastLoadingText}>No forecast data available</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Services Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.exploreFeatures')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('home.tapToGetStarted')}
          </Text>

          <View style={styles.servicesGrid}>
            {services.map((service, index) => (
              <TouchableOpacity
                key={service.id}
                activeOpacity={0.7}
                style={styles.serviceCard}
                onPress={() => navigateToScreen(service.screen)}
              >
                <LinearGradient
                  colors={service.gradient as readonly [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.serviceCardContent}
                >
                  <View style={styles.serviceIconContainer}>
                    <Ionicons
                      name={service.icon as any}
                      size={32}
                      color="#ffffff"
                    />
                  </View>
                  <Text style={styles.serviceLabel} numberOfLines={2}>{service.label}</Text>
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {service.description}
                  </Text>
                  <View style={styles.arrowContainer}>
                    <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
  paddingTop: 12,
  paddingBottom: 16,
  paddingHorizontal: 8,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: 'transparent',
  },
  headerContent: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 10,
  },
  welcomeSection: {
  flex: 1,
  alignItems: 'flex-start',
  },
  headerTop: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: 'flex-start',
  gap: 12,
  marginBottom: 4,
  },
  headerImage: {
    width: 40,
    height: 40,
  marginRight: 6,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 20,
    fontWeight: "600",
  color: "#E6F7FF",
  alignSelf: 'flex-start',
  marginLeft: -50,
  },
  welcomeText: {
    fontSize: 14,
    color: "#9FD3FF",
    lineHeight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  avatarContainer: {
    marginLeft: 16,
  },
  topRightMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  moreInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  moreInfoText: {
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  avatarIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#071837",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(30,64,175,0.12)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9FD3FF',
    marginLeft: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E6F7FF',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9FD3FF',
    marginTop: 2,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  statLabel: {
    fontSize: 12,
    color: "#dcfce7",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#E6F7FF",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#9FD3FF",
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  serviceCard: {
    width: (width - 44) / 2,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  serviceCardContent: {
    padding: 20,
    height: 180,
    justifyContent: "space-between",
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  serviceLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E6F7FF",
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: "rgba(159,211,255,0.9)",
    lineHeight: 18,
    flexShrink: 1,
  },
  arrowContainer: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  weatherCard: {
    backgroundColor: "#000000",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#11324a",
  },
  weatherCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  weatherTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weatherCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E6F7FF",
  },
  weatherHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refreshButton: {
    padding: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#60a5fa",
  },
  forecastLoading: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  forecastLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#9aa9b8",
  },
  forecastRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  forecastItem: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  forecastDay: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9FD3FF",
  },
  forecastTempContainer: {
    alignItems: "center",
  },
  forecastTemp: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E6F7FF",
  },
  forecastTempRange: {
    fontSize: 11,
    color: "#9aa9b8",
    marginTop: 2,
  },
  marketCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  marketCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  marketTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  marketCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  priceList: {
    gap: 12,
  },
  priceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  priceItemInfo: {
    flex: 1,
  },
  cropName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  cropTamil: {
    fontSize: 12,
    color: "#64748b",
  },
  priceRight: {
    alignItems: "flex-end",
  },
  cropPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 2,
  },
  priceTrend: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22c55e",
  },
  trendDown: {
    color: "#ef4444",
  },
  bottomSpacer: {
    height: 100,
  },
  // Sidebar Styles
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sidebar: {
    width: width * 0.85,
    backgroundColor: "#000000",
    borderLeftWidth: 1,
    borderLeftColor: "#11324a",
  },
  sidebarHeader: {
    backgroundColor: "#22c55e",
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sidebarHeaderContent: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  sidebarSubtitle: {
    fontSize: 14,
    color: "#9FD3FF",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  menuContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  stateText: {
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 13,
  },
  stateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  stateModalContainer: {
    backgroundColor: '#ffffff',
    maxHeight: '60%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
  },
  stateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  stateItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stateItemText: {
    fontSize: 16,
    color: '#0f172a',
  },
  stateClose: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  stateCloseText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#11324a",
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E6F7FF",
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 12,
    color: "#9FD3FF",
  },
});
