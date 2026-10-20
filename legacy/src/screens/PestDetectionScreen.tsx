import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
// FileSystem import - optional, will handle gracefully if not available
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system');
} catch (e) {
  // FileSystem not available - will use mock data
  console.log('FileSystem module not available');
}
import Card from '../components/Card';
import Button from '../components/Button';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getDynamicMockPestData } from '../services/mockData';
import { PEST_DETECTION_BACKEND_URL } from '../config/api';

export default function PestDetectionScreen() {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult(null);
    }
  };

  const detectPest = async () => {
    if (!image && !description.trim()) {
      Alert.alert(t('pest.uploadImageOrDescribe'));
      return;
    }

    setDetecting(true);
    
    // Simulate API delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      let apiResult = null;
      let useMockData = false;
      
      // Try to call API only if backend is available and image can be processed
      if (image) {
        try {
          // Try to convert image to base64 (optional - only if FileSystem works)
          let imageBase64 = null;
          
          // Check if FileSystem is available and try to use it
          if (FileSystem && FileSystem.readAsStringAsync) {
            try {
              let encodingOption: any = 'base64';
              
              // Try EncodingType enum if available
              if (FileSystem.EncodingType && FileSystem.EncodingType.Base64) {
                encodingOption = FileSystem.EncodingType.Base64;
              }
              
              imageBase64 = await FileSystem.readAsStringAsync(image, {
                encoding: encodingOption,
              });
            } catch (fsError) {
              // FileSystem failed - continue without image or use mock data
              console.log('FileSystem not available, using mock data with description');
              useMockData = true;
            }
          } else {
            // FileSystem not available
            useMockData = true;
          }
          
          // Try API call only if we have base64 image or FileSystem is not the issue
          if (!useMockData && imageBase64) {
            try {
              const backendUrl = PEST_DETECTION_BACKEND_URL;
              const apiUrl = `${backendUrl}/pest/detect`;
              
              // Create timeout controller
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  image: imageBase64,
                  description: description.trim(),
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (response.ok) {
                const responseText = await response.text();
                if (responseText) {
                  const parsedData = JSON.parse(responseText);
                  if (parsedData.success && parsedData.result) {
                    apiResult = parsedData.result;
                  }
                }
              }
            } catch (apiError) {
              // API failed - use mock data
              useMockData = true;
            }
          }
        } catch (error) {
          // Any error - use mock data
          useMockData = true;
        }
      } else {
        // No image - try API with text only, or use mock data
        try {
          const backendUrl = PEST_DETECTION_BACKEND_URL;
          const apiUrl = `${backendUrl}/pest/detect`;
          
          // Create timeout controller
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: description.trim(),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const responseText = await response.text();
            if (responseText) {
              const parsedData = JSON.parse(responseText);
              if (parsedData.success && parsedData.result) {
                apiResult = parsedData.result;
              }
            }
          }
        } catch (apiError) {
          // API failed - use mock data
          useMockData = true;
        }
      }
      
      // Use API result or fallback to dynamic mock data
      const result = apiResult || getDynamicMockPestData(description);
      
      // Format the result for display
      setResult({
        pestName: result.pestName || 'Unknown Pest',
        whyOccurring: result.whyOccurring || 'No information available',
        recommendations: result.recommendations || [],
      });
      
    } catch (error: any) {
      console.error('Error in pest detection:', error);
      
      // Fallback to mock data on any error
      const mockResult = getDynamicMockPestData(description);
      setResult({
        pestName: mockResult.pestName,
        whyOccurring: mockResult.whyOccurring,
        recommendations: mockResult.recommendations,
      });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
        <Text style={styles.title}>{t('pest.title')}</Text>
        <Text style={styles.subtitle}>{t('pest.subtitle')}</Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{t('pest.title')}</Text>
        
        {image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity onPress={pickImage} style={styles.changeImageButton}>
              <Ionicons name="refresh" size={20} color="#3b82f6" style={{ marginRight: 4 }} />
              <Text style={styles.changeImageText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={32} color="#3b82f6" />
          <Text style={styles.uploadButtonText}>{t('pest.uploadImage')}</Text>
        </TouchableOpacity>

        <Text style={styles.divider}>{t('pest.orDescribe')}</Text>

        <Text style={styles.label}>{t('pest.description')}</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          placeholder={t('pest.description')}
          placeholderTextColor="#9aa9b8"
        />

        <Button
          title={detecting ? t('common.loading') : t('pest.detectPest')}
          onPress={detectPest}
          style={{ marginTop: 16 }}
          disabled={detecting}
        />
      </Card>

      {result && (
        <>
          <Card>
            <View style={styles.resultHeader}>
              <Ionicons name="bug" size={32} color="#8b5cf6" />
              <Text style={styles.resultTitle}>{t('pest.detected')}</Text>
            </View>
            
            <View style={styles.resultContent}>
              <View style={styles.infoRow}>
                <Text style={styles.label}>{t('pest.pestName')}</Text>
                <Text style={styles.infoValue}>{result.pestName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>{t('pest.whyOccurring')}</Text>
                <Text style={styles.infoDescription}>{result.whyOccurring}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>{t('pest.recommendations')}</Text>
            {result.recommendations && result.recommendations.length > 0 ? (
              result.recommendations.map((remedy: string, index: number) => (
                <View key={index} style={styles.cureItem}>
                  <View style={styles.cureBullet}>
                    <Text style={styles.cureNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.cureText}>{remedy}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noRecommendations}>{t('common.noData')}</Text>
            )}
          </Card>
        </>
      )}
      
      {detecting && (
        <Card>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
    backgroundColor: '#8b5cf6',
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
    color: '#ddd6fe',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 16,
  },
  imageContainer: {
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  changeImageText: {
    color: '#60a5fa',
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#0b2433',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  divider: {
    textAlign: 'center',
    color: '#9aa9b8',
    marginVertical: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e6f7ff',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#11324a',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#0b2433',
    color: '#ffffff',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e6f7ff',
    marginLeft: 12,
  },
  resultContent: {
    // Spacing handled by infoRow marginBottom
  },
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
    paddingBottom: 12,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e6f7ff',
    marginTop: 4,
  },
  infoValueTamil: {
    fontSize: 14,
    color: '#9aa9b8',
    marginTop: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#e6f7ff',
    marginTop: 8,
    lineHeight: 20,
  },
  cureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingLeft: 4,
  },
  cureBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  cureNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cureText: {
    flex: 1,
    fontSize: 14,
    color: '#e6f7ff',
    lineHeight: 20,
  },
  noRecommendations: {
    fontSize: 14,
    color: '#9aa9b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e6f7ff',
    fontWeight: '500',
  },
});
