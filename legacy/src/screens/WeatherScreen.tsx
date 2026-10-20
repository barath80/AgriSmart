import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setLoading, setWeather, setForecast, setCity, setError } from '../store/slices/weatherSlice';
import { getWeatherData, getWeatherIcon } from '../services/weatherService';
import { getCityForState } from '../config/stateToCityMapping';
import indianDistricts from '../config/indianDistricts';

export default function WeatherScreen() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  // Get selected state from Redux (for initialization)
  const reduxState = useAppSelector((state) => (state as any).location?.stateName);
  
  // Local state for manual input
  const [selectedState, setSelectedState] = useState<string>(reduxState || '');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  
  // Get weather data from Redux
  const weatherState = useAppSelector((state) => (state as any).weather);
  const weather = weatherState?.current;
  const forecast = weatherState?.forecast || [];
  const loading = weatherState?.loading || false;
  const error = weatherState?.error;
  const city = weatherState?.city;

  // Initialize districts when component mounts or reduxState changes
  useEffect(() => {
    if (reduxState && !selectedState) {
      setSelectedState(reduxState);
    }
    if (selectedState && indianDistricts[selectedState]) {
      setAvailableDistricts(indianDistricts[selectedState]);
    }
  }, [reduxState]);

  // Update districts when state changes
  useEffect(() => {
    if (selectedState && indianDistricts[selectedState]) {
      setAvailableDistricts(indianDistricts[selectedState]);
      setSelectedDistrict(''); // Reset district when state changes
    } else {
      setAvailableDistricts([]);
      setSelectedDistrict('');
    }
  }, [selectedState]);

  // Function to fetch weather based on user input
  const loadWeatherData = async (forceRefresh: boolean = false) => {
    let locationQuery = '';
    
    // Priority: District > State > Default
    // Note: Service will normalize (remove ", India" if present)
    if (selectedDistrict && selectedState) {
      locationQuery = `${selectedDistrict}, ${selectedState}`;
    } else if (selectedState) {
      locationQuery = getCityForState(selectedState);
    } else {
      locationQuery = 'Delhi'; // Default fallback
    }
    
    dispatch(setCity(locationQuery));
    dispatch(setLoading(true));
    dispatch(setError(null));
    
    try {
      // Use getWeatherData to fetch both current and forecast
      // Service will normalize the location query
      const { current, forecast: forecastData } = await getWeatherData(locationQuery, forceRefresh);
      
      dispatch(setWeather(current));
      dispatch(setForecast(forecastData));
      dispatch(setError(null));
    } catch (error: any) {
      // Error handling is done in the service, but we still catch here for safety
      console.warn('[WeatherScreen] Weather fetch error:', error?.message || error);
      dispatch(setError('Unable to fetch weather data. Please try again.'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Refresh control handler
  const onRefresh = async () => {
    await loadWeatherData(true);
  };

  const getIcon = (condition: string, iconCode?: string) => {
    if (iconCode) {
      return getWeatherIcon(iconCode, condition) as any;
    }
    const icons: any = {
      sunny: 'sunny',
      cloudy: 'cloud',
      rainy: 'rainy',
      windy: 'cloudy',
      clear: 'sunny',
      rain: 'rainy',
      clouds: 'cloud',
    };
    return icons[condition.toLowerCase()] || 'sunny';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('weather.title')}</Text>
          <Text style={styles.subtitle}>{t('weather.current')}</Text>
        </View>

      {/* State and District Selection Card */}
      <Card>
        <Text style={styles.cardTitle}>Select Location</Text>
        
        {/* State Selection */}
        <TouchableOpacity 
          style={styles.inputField} 
          onPress={() => setStateModalVisible(true)}
        >
          <Ionicons name="location" size={20} color="#60a5fa" style={{ marginRight: 8 }} />
          <Text style={{ color: selectedState ? '#e6f7ff' : '#9aa9b8', flex: 1 }}>
            {selectedState || 'Select State'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#9aa9b8" />
        </TouchableOpacity>

        {/* State Modal */}
        <Modal
          visible={stateModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select State</Text>
                <TouchableOpacity onPress={() => setStateModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {Object.keys(indianDistricts).map((state) => (
                  <TouchableOpacity
                    key={state}
                    style={[
                      styles.modalItem,
                      selectedState === state && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedState(state);
                      setStateModalVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.modalItemText,
                      selectedState === state && styles.modalItemTextSelected
                    ]}>{state}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* District Selection */}
        {selectedState && (
          <>
            <TouchableOpacity 
              style={[styles.inputField, { marginTop: 12 }]} 
              onPress={() => setDistrictModalVisible(true)}
              disabled={availableDistricts.length === 0}
            >
              <Ionicons name="map" size={20} color="#60a5fa" style={{ marginRight: 8 }} />
              <Text style={{ 
                color: selectedDistrict ? '#e6f7ff' : '#9aa9b8', 
                flex: 1,
                opacity: availableDistricts.length === 0 ? 0.5 : 1
              }}>
                {selectedDistrict || 'Select District (Optional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9aa9b8" />
            </TouchableOpacity>

            {/* District Modal */}
            <Modal
              visible={districtModalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setDistrictModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      Select District ({selectedState})
                    </Text>
                    <TouchableOpacity onPress={() => setDistrictModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    <TouchableOpacity
                      style={[
                        styles.modalItem,
                        selectedDistrict === '' && styles.modalItemSelected
                      ]}
                      onPress={() => {
                        setSelectedDistrict('');
                        setDistrictModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.modalItemText,
                        selectedDistrict === '' && styles.modalItemTextSelected
                      ]}>No District (Use State Capital)</Text>
                    </TouchableOpacity>
                    {availableDistricts.map((district) => (
                      <TouchableOpacity
                        key={district}
                        style={[
                          styles.modalItem,
                          selectedDistrict === district && styles.modalItemSelected
                        ]}
                        onPress={() => {
                          setSelectedDistrict(district);
                          setDistrictModalVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.modalItemText,
                          selectedDistrict === district && styles.modalItemTextSelected
                        ]}>{district}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </>
        )}

        {/* Fetch Weather Button */}
        <TouchableOpacity 
          style={[
            styles.fetchButton, 
            (!selectedState || loading) && styles.fetchButtonDisabled
          ]} 
          onPress={loadWeatherData}
          disabled={!selectedState || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Get Weather
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Card>

      <Card>
        {loading && !weather ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading weather data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorSubtext}>Please try again later</Text>
          </View>
        ) : weather ? (
          <>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={20} color="#3b82f6" />
              <Text style={styles.locationText}>
                {selectedDistrict ? `${selectedDistrict}, ${selectedState}` : selectedState || city || 'Location'}
              </Text>
            </View>
            <View style={styles.currentWeather}>
              <Ionicons 
                name={getIcon(weather.description, weather.icon)} 
                size={80} 
                color="#f59e0b" 
              />
              <View style={styles.tempSection}>
                <Text style={styles.temp}>{weather.temperature}°C</Text>
                <Text style={styles.condition}>{weather.description}</Text>
                <Text style={styles.feelsLike}>Feels like {weather.feelsLike}°C</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="water" size={24} color="#3b82f6" />
                <Text style={styles.statLabel}>{t('weather.humidity')}</Text>
                <Text style={styles.statValue}>{weather.humidity}%</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="speedometer" size={24} color="#8b5cf6" />
                <Text style={styles.statLabel}>Wind Speed</Text>
                <Text style={styles.statValue}>{weather.windSpeed} km/h</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="water" size={24} color="#06b6d4" />
                <Text style={styles.statLabel}>Soil Moisture</Text>
                <Text style={styles.statValue}>{weather.soilMoisture?.toFixed(0) || '--'}%</Text>
              </View>
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('weather.forecast')}</Text>
        
        {loading && forecast.length === 0 ? (
          <View style={styles.forecastLoading}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.forecastLoadingText}>Loading forecast...</Text>
          </View>
        ) : forecast.length > 0 ? (
          forecast.map((day, index) => (
            <View key={index} style={styles.forecastItem}>
              <Text style={styles.dayText}>{day.date}</Text>
              <Ionicons name={getIcon(day.description, day.icon) as any} size={32} color="#f59e0b" />
              <View style={styles.forecastTempContainer}>
                <Text style={styles.tempText}>{day.temperature}°C</Text>
                {day.minTemp !== day.maxTemp && (
                  <Text style={styles.tempRange}>
                    {day.minTemp}° / {day.maxTemp}°
                  </Text>
                )}
              </View>
              <Text style={styles.conditionText}>{day.description}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noForecastText}>No forecast data available</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Farming Tips</Text>
        
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          <Text style={styles.tipText}>
            Weather is ideal for planting. Ensure adequate irrigation.
          </Text>
        </View>
        
        <View style={styles.tipItem}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.tipText}>
            Day 4 forecast shows rain. Plan irrigation accordingly.
          </Text>
        </View>
        
        <View style={styles.tipItem}>
          <Ionicons name="leaf" size={24} color="#10b981" />
          <Text style={styles.tipText}>
            Current conditions are perfect for crop spraying activities.
          </Text>
        </View>
      </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#dbeafe',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 16,
  },
  currentWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  tempSection: {
    alignItems: 'center',
  },
  temp: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e6f7ff',
  },
  condition: {
    fontSize: 18,
    color: '#9aa9b8',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#11324a',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9aa9b8',
    marginTop: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginTop: 4,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  dayText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#e6f7ff',
  },
  tempText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e6f7ff',
    width: 50,
    textAlign: 'right',
  },
  conditionText: {
    fontSize: 14,
    color: '#9aa9b8',
    width: 80,
    textAlign: 'right',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#e6f7ff',
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9aa9b8',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9aa9b8',
    textAlign: 'center',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#e6f7ff',
  },
  feelsLike: {
    fontSize: 14,
    color: '#9aa9b8',
    marginTop: 4,
  },
  forecastLoading: {
    padding: 20,
    alignItems: 'center',
  },
  forecastLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9aa9b8',
  },
  forecastTempContainer: {
    alignItems: 'flex-end',
  },
  tempRange: {
    fontSize: 12,
    color: '#9aa9b8',
    marginTop: 2,
  },
  noForecastText: {
    padding: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#9aa9b8',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 16,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0b2433',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  fetchButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemSelected: {
    backgroundColor: '#eff6ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#374151',
  },
  modalItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
