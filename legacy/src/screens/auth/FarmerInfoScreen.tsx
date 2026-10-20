import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguageSelector from '../../components/LanguageSelector';

type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

type FarmerInfoScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'FarmerInfo'
>;

type FarmerInfoScreenRouteProp = RouteProp<AuthStackParamList, 'FarmerInfo'>;

interface Props {
  navigation: FarmerInfoScreenNavigationProp;
  route: FarmerInfoScreenRouteProp;
}

export default function FarmerInfoScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { userId, authType } = route.params;
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseEnterName'));
      return;
    }

    if (!state.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseSelectState'));
      return;
    }

    if (!city.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseSelectCity'));
      return;
    }

    setLoading(true);

    try {
      console.log('Saving farmer info for userId:', userId);
      console.log('Data to insert:', {
        "ID": userId,
        "Name": name.trim(),
        "State": state.trim(),
        "City": city.trim(),
      });

      // Insert farmer info into Farmer's info table
      // Table name: "Farmer's info" (with capital F)
      const { data, error } = await supabase
        .from("Farmer's info")
        .insert({
          "ID": userId,
          "Name": name.trim(),
          "State": state.trim(),
          "City": city.trim(),
        })
        .select()
        .single();

      console.log('Supabase response - data:', data, 'error:', error);

      if (error) {
        console.error('Error inserting farmer info:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Full error:', JSON.stringify(error, null, 2));
        
        // Provide more helpful error message
        let errorMessage = 'Failed to save information. Please try again.';
        if (error?.message) {
          errorMessage = `Error: ${error.message}`;
        } else if (error?.code) {
          if (error.code === '23505') {
            errorMessage = 'This user already has farmer information. Please try logging in again.';
          } else if (error.code === '23503') {
            errorMessage = 'Invalid user ID. Please try logging in again.';
          } else if (error.code === '42P01') {
            errorMessage = 'The farmer\'s info table does not exist. Please create it in Supabase.';
          } else {
            errorMessage = `Database error (${error.code}). Please check your Supabase configuration.`;
          }
        } else if (error?.details) {
          errorMessage = `Error: ${error.details}`;
        }
        
        Alert.alert('Save Error', errorMessage);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('No data returned from insert');
        Alert.alert('Error', 'No data returned from save operation. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Farmer info saved successfully:', data);

      // Store farmer info in AsyncStorage
      await AsyncStorage.setItem('farmerName', name.trim());
      await AsyncStorage.setItem('farmerState', state.trim());
      await AsyncStorage.setItem('farmerCity', city.trim());

      // Navigate to AuthHome (which will switch to main app)
      navigation.replace('AuthHome');
    } catch (error: any) {
      console.error('Error saving farmer info:', error);
      console.error('Error type:', typeof error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'Failed to save information. Please try again.';
      if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#071840', '#0a2642'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      >
        {/* Decorative Circles */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />

        {/* Header Section */}
        <View style={styles.header}>
          {/* Language Selector */}
          <View style={styles.languageSelectorContainer}>
            <LanguageSelector />
          </View>
          
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={32} color="#22c55e" />
            </View>
            <Text style={styles.title}>{t('auth.completeProfile')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.personalizeExperience')}
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressStepContainer}>
              <View style={[styles.progressStep, styles.progressStepActive]}>
                <Ionicons name="checkmark" size={18} color="#ffffff" />
              </View>
              <Text style={styles.progressLabel}>{t('auth.phone')}</Text>
            </View>
            <View style={styles.progressConnector} />
            <View style={styles.progressStepContainer}>
              <View style={[styles.progressStep, styles.progressStepActive]}>
                <Ionicons name="checkmark" size={18} color="#ffffff" />
              </View>
              <Text style={styles.progressLabel}>{t('auth.passwordStep')}</Text>
            </View>
            <View style={styles.progressConnector} />
            <View style={styles.progressStepContainer}>
              <View style={[styles.progressStep, styles.progressStepActive]}>
                <Ionicons name="person" size={18} color="#ffffff" />
              </View>
              <Text style={styles.progressLabel}>{t('auth.profileStep')}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                <Ionicons name="person-outline" size={16} color="#22c55e" />{' '}
                {t('auth.fullName')} *
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#9aa9b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.enterFullName')}
                  placeholderTextColor="#6b7280"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  selectionColor="#22c55e"
                />
              </View>
            </View>

            {/* State Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                <Ionicons name="location" size={16} color="#22c55e" /> {t('auth.state')} *
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#9aa9b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.enterState')}
                  placeholderTextColor="#6b7280"
                  value={state}
                  onChangeText={setState}
                  autoCapitalize="words"
                  selectionColor="#22c55e"
                />
              </View>
            </View>

            {/* City Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                <Ionicons name="location-outline" size={16} color="#22c55e" />{' '}
                {t('auth.city')} *
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="map-outline"
                  size={20}
                  color="#9aa9b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.enterCity')}
                  placeholderTextColor="#6b7280"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                  selectionColor="#22c55e"
                />
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || !name || !state || !city) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !name || !state || !city}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#22c55e', '#16a34a', '#15803d'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>{t('auth.completeRegistration')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={styles.loadingText}>{t('auth.savingInfo')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundGradient: {
    flex: 1,
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    top: -40,
    right: -40,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    bottom: 100,
    left: -20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.1)',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 1,
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: 20,
    right: 24,
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#9FD3FF',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  progressStepContainer: {
    alignItems: 'center',
    flex: 1,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressStepActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#9FD3FF',
    fontWeight: '500',
    textAlign: 'center',
  },
  progressConnector: {
    width: 20,
    height: 2,
    backgroundColor: '#22c55e',
    marginTop: 15,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 10,
  },
  formContainer: {
    // Spacing handled by inputSection marginBottom
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071837',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#11324a',
    paddingHorizontal: 16,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#E6F7FF',
    paddingVertical: 0,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  loaderContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#9FD3FF',
    fontWeight: '500',
    marginTop: 12,
  },
});

