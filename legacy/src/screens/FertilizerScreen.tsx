import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { 
  getFertilizerRecommendation, 
  CROPS, 
  SOIL_TYPES, 
  INDIAN_STATES, 
  SEASONS,
  CropRotationRecommendation 
} from '../services/fertilizerData';

export default function FertilizerScreen() {
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentCrop, setCurrentCrop] = useState('');
  const [soilType, setSoilType] = useState('');
  const [region, setRegion] = useState('');
  const [season, setSeason] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<CropRotationRecommendation | null>(null);
  
  // Modal states for dropdowns
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [soilModalVisible, setSoilModalVisible] = useState(false);
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [seasonModalVisible, setSeasonModalVisible] = useState(false);

  // Clear recommendation when inputs change to show dynamic behavior
  useEffect(() => {
    setRecommendation(null);
  }, [currentCrop, soilType, region, season]);
  
  const renderDropdown = (
    label: string,
    value: string,
    options: string[],
    onSelect: (value: string) => void,
    modalVisible: boolean,
    setModalVisible: (visible: boolean) => void,
    placeholder: string
  ) => {
    return (
      <View style={styles.pickerContainer}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.pickerWrapper}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#E6F7FF" />
        </TouchableOpacity>
        
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalOverlayTouchable}
              activeOpacity={1}
              onPress={() => setModalVisible(false)}
            />
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#E6F7FF" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                <TouchableOpacity
                  style={[styles.modalItem, !value && styles.modalItemSelected]}
                  onPress={() => {
                    onSelect('');
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, !value && styles.modalItemTextSelected]}>
                    {placeholder}
                  </Text>
                </TouchableOpacity>
                {options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.modalItem, value === option && styles.modalItemSelected]}
                    onPress={() => {
                      onSelect(option);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, value === option && styles.modalItemTextSelected]}>
                      {option}
                    </Text>
                    {value === option && (
                      <Ionicons name="checkmark" size={20} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const handleGetRecommendation = async () => {
    if (!currentCrop || !soilType || !region || !season) {
      Alert.alert(t('common.missingInfo'), t('common.pleaseFillAll'));
      return;
    }

    setLoading(true);
    setRecommendation(null); // Clear previous recommendation
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const recommendations = getFertilizerRecommendation(currentCrop, soilType, region, season);
      
      if (recommendations && recommendations.length > 0) {
        setRecommendation(recommendations[0]);
        // Scroll to top to show results
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);
      } else {
        Alert.alert(t('common.error'), t('common.error'));
      }
    } catch (error: any) {
      console.error('Error getting recommendation:', error);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Ionicons name="repeat" size={32} color="#E6F7FF" />
          <Text style={styles.title}>{t('fertilizer.title')}</Text>
          <Text style={styles.subtitle}>{t('fertilizer.subtitle')}</Text>
        </View>

        <Card style={styles.inputCard}>
          <Text style={styles.sectionTitle}>{t('common.select')}</Text>

          {renderDropdown(
            t('fertilizer.currentCrop'),
            currentCrop,
            CROPS,
            setCurrentCrop,
            cropModalVisible,
            setCropModalVisible,
            t('common.select')
          )}

          {renderDropdown(
            t('fertilizer.soilType'),
            soilType,
            SOIL_TYPES,
            setSoilType,
            soilModalVisible,
            setSoilModalVisible,
            t('common.select')
          )}

          {renderDropdown(
            t('fertilizer.region'),
            region,
            INDIAN_STATES,
            setRegion,
            regionModalVisible,
            setRegionModalVisible,
            t('common.select')
          )}

          {renderDropdown(
            t('fertilizer.season'),
            season,
            SEASONS,
            setSeason,
            seasonModalVisible,
            setSeasonModalVisible,
            t('common.select')
          )}

          <Button
            title={loading ? t('common.loading') : t('fertilizer.getRecommendation')}
            onPress={handleGetRecommendation}
            disabled={loading || !currentCrop || !soilType || !region || !season}
            style={styles.button}
          />
        </Card>

        {loading && (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </Card>
        )}

        {recommendation && !loading && (
          <>
            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="leaf" size={24} color="#10b981" />
                <Text style={styles.resultTitle}>{t('fertilizer.recommendedCrop')}</Text>
              </View>
              <Text style={styles.recommendedCrop}>{recommendation.recommendedCrop}</Text>
            </Card>

            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="information-circle" size={24} color="#3b82f6" />
                <Text style={styles.resultTitle}>{t('fertilizer.rotationReason')}</Text>
              </View>
              <Text style={styles.reasonText}>{recommendation.rotationReason}</Text>
            </Card>

            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="flask" size={24} color="#f59e0b" />
                <Text style={styles.resultTitle}>{t('fertilizer.fertilizerRecommendation')}</Text>
              </View>
              <View style={styles.fertilizerBox}>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>Urea (N):</Text>
                  <Text style={styles.fertilizerValue}>
                    {recommendation.fertilizerRecommendation.urea.min} - {recommendation.fertilizerRecommendation.urea.max} {recommendation.fertilizerRecommendation.urea.unit}
                  </Text>
                </View>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>Super Phosphate (P):</Text>
                  <Text style={styles.fertilizerValue}>
                    {recommendation.fertilizerRecommendation.superPhosphate.min} - {recommendation.fertilizerRecommendation.superPhosphate.max} {recommendation.fertilizerRecommendation.superPhosphate.unit}
                  </Text>
                </View>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>MOP (K):</Text>
                  <Text style={styles.fertilizerValue}>
                    {recommendation.fertilizerRecommendation.mop.min} - {recommendation.fertilizerRecommendation.mop.max} {recommendation.fertilizerRecommendation.mop.unit}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="leaf-outline" size={24} color="#10b981" />
                <Text style={styles.resultTitle}>{t('fertilizer.organicAlternative')}</Text>
              </View>
              <View style={styles.organicBox}>
                <View style={styles.organicItem}>
                  <Text style={styles.organicLabel}>Farm Yard Manure (FYM):</Text>
                  <Text style={styles.organicValue}>
                    {recommendation.organicAlternative.fym.min} - {recommendation.organicAlternative.fym.max} {recommendation.organicAlternative.fym.unit}
                  </Text>
                </View>
                <View style={styles.organicDescription}>
                  <Text style={styles.organicText}>{recommendation.organicAlternative.compost}</Text>
                </View>
                <View style={styles.organicDescription}>
                  <Text style={styles.organicText}>{recommendation.organicAlternative.additional}</Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9FD3FF',
    textAlign: 'center',
  },
  inputCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 20,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E6F7FF',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#11324a',
    borderRadius: 8,
    backgroundColor: '#071837',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  pickerText: {
    color: '#E6F7FF',
    fontSize: 16,
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#9aa9b8',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    backgroundColor: '#071837',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#11324a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0b2433',
  },
  modalItemSelected: {
    backgroundColor: '#11324a',
  },
  modalItemText: {
    fontSize: 16,
    color: '#E6F7FF',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
  button: {
    marginTop: 10,
  },
  loadingCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#E6F7FF',
    marginTop: 12,
    fontSize: 16,
  },
  resultCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  recommendedCrop: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 8,
  },
  reasonText: {
    fontSize: 16,
    color: '#9FD3FF',
    lineHeight: 24,
    marginTop: 8,
  },
  fertilizerBox: {
    marginTop: 12,
  },
  fertilizerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  fertilizerLabel: {
    fontSize: 16,
    color: '#E6F7FF',
    flex: 1,
  },
  fertilizerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    flex: 1,
    textAlign: 'right',
  },
  organicBox: {
    marginTop: 12,
  },
  organicItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  organicLabel: {
    fontSize: 16,
    color: '#E6F7FF',
    flex: 1,
  },
  organicValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    flex: 1,
    textAlign: 'right',
  },
  organicDescription: {
    marginTop: 12,
    paddingVertical: 8,
  },
  organicText: {
    fontSize: 14,
    color: '#9FD3FF',
    lineHeight: 20,
  },
});
