import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import Loader from '../components/Loader';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setInputData, setRecommendation, setLoading } from '../store/slices/cropSlice';
import { getDynamicCropRecommendations } from '../services/cropDatabase';

export default function CropScreen() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { inputData, recommendation, loading } = useAppSelector((state) => state.crop);
  const [formData, setFormData] = useState(inputData);

  const handleGetRecommendation = () => {
    // Validate inputs
    if (!formData.n || !formData.p || !formData.k || !formData.temperature || 
        !formData.humidity || !formData.ph || !formData.rainfall) {
      Alert.alert(t('common.missingInfo'), t('common.pleaseFillAll'));
      return;
    }

    dispatch(setLoading(true));
    dispatch(setInputData(formData));
    
    // Use dynamic crop recommendation algorithm with comprehensive database (no API calls)
    try {
      const recommendations = getDynamicCropRecommendations(formData, 5);
      
      if (recommendations && recommendations.length > 0) {
        // Use the top recommendation
        const topRecommendation = recommendations[0];
        dispatch(setRecommendation({
          cropName: topRecommendation.crop,
          cropNameTamil: '',
          confidence: topRecommendation.confidence,
          description: topRecommendation.description,
          descriptionTamil: '',
        }));
      } else {
        // Fallback if no recommendations found
        Alert.alert(
          t('common.error'),
          t('common.pleaseFillAll')
        );
      }
    } catch (error) {
      // Silent error handling - no console errors
      Alert.alert(
        t('common.error'),
        t('common.pleaseFillAll')
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
  <Text style={styles.title}>{t('crop.title')}</Text>
  <Text style={styles.subtitle}>{t('crop.subtitle')}</Text>
      </View>

      <Card>
        <Input
          label={t('crop.nValue')}
          value={formData.n}
          onChangeText={(text) => setFormData({ ...formData, n: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterNitrogen')}
        />
        <Input
          label={t('crop.pValue')}
          value={formData.p}
          onChangeText={(text) => setFormData({ ...formData, p: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterPhosphorus')}
        />
        <Input
          label={t('crop.kValue')}
          value={formData.k}
          onChangeText={(text) => setFormData({ ...formData, k: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterPotassium')}
        />
        <Input
          label={t('crop.temperature')}
          value={formData.temperature}
          onChangeText={(text) => setFormData({ ...formData, temperature: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterTemperature')}
        />
        <Input
          label={t('crop.humidity')}
          value={formData.humidity}
          onChangeText={(text) => setFormData({ ...formData, humidity: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterHumidity')}
        />
        <Input
          label={t('crop.ph')}
          value={formData.ph}
          onChangeText={(text) => setFormData({ ...formData, ph: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterPh')}
        />
        <Input
          label={t('crop.rainfall')}
          value={formData.rainfall}
          onChangeText={(text) => setFormData({ ...formData, rainfall: text })}
          keyboardType="numeric"
          placeholder={t('crop.enterRainfall')}
        />
        <Button
          title={t('crop.getRecommendation')}
          onPress={handleGetRecommendation}
          style={{ marginTop: 8 }}
        />
      </Card>

      {recommendation && (
        <Card>
          <Text style={styles.resultTitle}>{t('crop.recommended')}</Text>
          <Text style={styles.cropName}>{recommendation.cropName}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {t('crop.confidence')}: {recommendation.confidence}%
            </Text>
          </View>
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionTitle}>{t('crop.description')}</Text>
            <Text style={styles.description}>{recommendation.description}</Text>
          </View>
        </Card>
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
  header: {
    backgroundColor: '#22c55e',
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e6f7ff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 12,
  },
  cropName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 16,
  },
  confidenceBadge: {
    backgroundColor: '#071837',
    borderWidth: 1,
    borderColor: '#11324a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  confidenceText: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  descriptionBox: {
    backgroundColor: '#071837',
    padding: 16,
    borderRadius: 8,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 20,
  },
});

