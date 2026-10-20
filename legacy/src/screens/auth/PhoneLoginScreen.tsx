import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguageSelector from '../../components/LanguageSelector';

const { width } = Dimensions.get('window');

type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

type PhoneLoginScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'PhoneLogin'
>;

type PhoneLoginScreenRouteProp = RouteProp<AuthStackParamList, 'PhoneLogin'>;

interface Props {
  navigation: PhoneLoginScreenNavigationProp;
  route: PhoneLoginScreenRouteProp;
}

export default function PhoneLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Format phone number with country code
   * Ensures phone number starts with + and country code
   */
  const formatPhoneNumber = (input: string): string => {
    // Remove all non-digit characters except +
    let cleaned = input.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, add it
    if (!cleaned.startsWith('+')) {
      // If it starts with 0, remove it and add +91 (India)
      if (cleaned.startsWith('0')) {
        cleaned = '+91' + cleaned.substring(1);
      } else {
        // Assume Indian number if no country code
        cleaned = '+91' + cleaned;
      }
    }
    
    return cleaned;
  };

  /**
   * Check if phone number exists in Supabase
   */
  const checkPhoneNumber = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseEnterPhoneNumber'));
      return;
    }

    // Format phone number with country code
    const formattedPhone = formatPhoneNumber(phoneNumber.trim());

    // Validate phone number format: + followed by 10-15 digits
    // Example: +911234567890
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    if (!phoneRegex.test(formattedPhone)) {
      Alert.alert(
        t('common.error'), 
        t('auth.pleaseEnterValidPhone')
      );
      return;
    }

    // Update the input field with formatted number
    setPhoneNumber(formattedPhone);

    setLoading(true);

    try {
      console.log('Checking phone number:', formattedPhone);
      
      // Use the already formatted phone number for database query
      // Check if phone number exists in Authentication Info table
      // Use maybeSingle() instead of single() to avoid errors when not found
      const { data, error } = await supabase
        .from('Authentication Info')
        .select('"ID", "Phone Number", "Password"')
        .eq('"Phone Number"', formattedPhone)
        .maybeSingle();

      console.log('Supabase response - data:', data, 'error:', error);

      // Handle different error scenarios
      if (error) {
        // Check for "not found" errors - these are expected for new users
        const isNotFoundError = 
          error.code === 'PGRST116' || 
          error.code === '42P01' || // Table doesn't exist
          error.message?.includes('No rows') ||
          error.message?.includes('not found') ||
          error.message?.includes('does not exist');

        if (isNotFoundError && error.code === 'PGRST116') {
          // This is a "not found" error - expected for new users
          console.log('Phone number not found - new user (PGRST116)');
          setIsNewUser(true);
          setLoading(false);
          return;
        }

        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.error('Table does not exist:', error);
          Alert.alert(
            'Database Error',
            'The Authentication Info table does not exist in Supabase. Please create it first.'
          );
          setLoading(false);
          return;
        }

        // Any other error is a real problem
        console.error('Supabase error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        throw error;
      }

      // No error - check if data exists
      if (data && data['ID']) {
        // Existing user - show password field only
        console.log('Phone number found - existing user');
        setIsNewUser(false);
      } else {
        // New user - show registration fields (data is null, which is expected)
        console.log('Phone number not found - new user (no error, no data)');
        setIsNewUser(true);
      }
    } catch (error: any) {
      console.error('Error checking phone number:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Provide more helpful error message
      let errorMessage = 'Failed to check phone number. Please try again.';
      if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      } else if (error?.code) {
        errorMessage = `Database error (${error.code}). Please check your Supabase connection.`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle new user registration
   */
  const handleRegister = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseFillPasswordFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.mustBe6Characters'));
      return;
    }

    setLoading(true);

    try {
      // Format phone number with country code before storing
      const formattedPhone = formatPhoneNumber(phoneNumber.trim());
      
      console.log('Registering user with phone:', formattedPhone);
      
      // Insert new user into Authentication Info
      // Column names: ID (auto), created_at (auto), gmail (null), Phone Number, Password
      const insertData: any = {
        'Phone Number': formattedPhone,
        'Password': password.trim(),
      };
      
      console.log('Insert data:', JSON.stringify(insertData, null, 2));
      console.log('Table: Authentication Info');
      
      const { data, error } = await supabase
        .from('Authentication Info')
        .insert(insertData)
        .select('"ID", created_at, gmail, "Phone Number", "Password"')
        .single();

      console.log('Registration response - data:', data, 'error:', error);

      if (error) {
        console.error('Registration error details:', JSON.stringify(error, null, 2));
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }

      // Check for ID - column name is "ID" (capitalized)
      const userId = data?.['ID'] || data?.ID;
      
      console.log('Full response data:', JSON.stringify(data, null, 2));
      console.log('Extracted userId:', userId);
      
      if (data && userId) {
        console.log('Registration successful, ID:', userId);
        // Store user session
        await AsyncStorage.setItem('userId', userId.toString());
        await AsyncStorage.setItem('authType', 'phone');
        await AsyncStorage.setItem('phoneNumber', formattedPhone);

        // Navigate to FarmerInfoScreen
        navigation.replace('FarmerInfo', {
          userId: typeof userId === 'number' ? userId : parseInt(userId.toString()),
          authType: 'phone',
        });
      } else {
        console.error('No data or ID returned from insert');
        console.error('Data received:', JSON.stringify(data, null, 2));
        console.error('Data keys:', data ? Object.keys(data) : 'null');
        throw new Error('No ID returned from registration');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error type:', typeof error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      // Provide more helpful error message
      let errorMessage = 'Failed to register. Please try again.';
      if (error?.message) {
        errorMessage = `Registration failed: ${error.message}`;
      } else if (error?.code) {
        errorMessage = `Database error (${error.code}). Please check your Supabase configuration.`;
      } else if (error?.details) {
        errorMessage = `Error: ${error.details}`;
      }
      
      Alert.alert('Registration Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle existing user login
   */
  const handleLogin = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('auth.pleaseEnterPassword'));
      return;
    }

    setLoading(true);

    try {
      // Format phone number with country code
      const formattedPhone = formatPhoneNumber(phoneNumber.trim());
      
      // Verify password for existing user
      const { data, error } = await supabase
        .from('Authentication Info')
        .select('"ID", "Password"')
        .eq('"Phone Number"', formattedPhone)
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        Alert.alert(t('common.error'), 'User not found. Please register first.');
        return;
      }

      // Compare passwords (In production, use proper password hashing!)
      if (data['Password'] === password.trim()) {
        // Store user session
        await AsyncStorage.setItem('userId', data['ID'].toString());
        await AsyncStorage.setItem('authType', 'phone');
        await AsyncStorage.setItem('phoneNumber', formattedPhone);

        // Check if farmer info exists
        const { data: farmerData, error: farmerError } = await supabase
          .from("Farmer's info")
          .select('"ID", "Name", "State", "City"')
          .eq('"ID"', data['ID'])
          .maybeSingle();

        if (farmerData && farmerData['ID']) {
          // Farmer info exists - store it and navigate to main app
          await AsyncStorage.setItem('farmerName', farmerData['Name'] || '');
          await AsyncStorage.setItem('farmerState', farmerData['State'] || '');
          await AsyncStorage.setItem('farmerCity', farmerData['City'] || '');
          
          // Navigate to main app via AuthHome (which will switch to main app)
          navigation.replace('AuthHome');
        } else {
          // No farmer info - navigate to FarmerInfoScreen
          navigation.replace('FarmerInfo', {
            userId: data['ID'],
            authType: 'phone',
          });
        }
      } else {
        Alert.alert(t('common.error'), 'Invalid password');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(t('common.error'), 'Failed to login. Please try again.');
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
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as const}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={24} color="#E6F7FF" />
              </LinearGradient>
            </TouchableOpacity>
            {/* Language Selector */}
            <View style={styles.languageSelectorContainer}>
              <LanguageSelector />
            </View>
          </View>
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="call" size={32} color="#22c55e" />
            </View>
            <Text style={styles.title}>
              {isNewUser === null
                ? t('auth.enterPhoneNumber')
                : isNewUser
                ? t('auth.createAccount')
                : t('auth.welcomeBack')}
            </Text>
            <Text style={styles.subtitle}>
              {isNewUser === null
                ? t('auth.verifyPhoneNumber')
                : isNewUser
                ? t('auth.setupPassword')
                : t('auth.enterPassword')}
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressStep,
                isNewUser !== null && styles.progressStepActive,
              ]}
            />
            <View
              style={[
                styles.progressStep,
                (isNewUser === true || isNewUser === false) && styles.progressStepActive,
              ]}
            />
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* Phone Number Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                <Ionicons name="phone-portrait" size={16} color="#22c55e" />{' '}
                {t('auth.phoneNumber')}
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color="#9aa9b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="+91 12345 67890"
                  placeholderTextColor="#6b7280"
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text)}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  editable={isNewUser === null}
                  selectionColor="#22c55e"
                />
              </View>
              {phoneNumber && !phoneNumber.startsWith('+') && (
                <View style={styles.hintContainer}>
                  <Ionicons name="information-circle" size={14} color="#eab308" />
                  <Text style={styles.hintText}>
                    {t('auth.includeCountryCode')}
                  </Text>
                </View>
              )}
            </View>

            {/* Check Phone Button */}
            {isNewUser === null && (
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={checkPhoneNumber}
                disabled={loading}
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
                      <Text style={styles.buttonText}>{t('auth.continue')}</Text>
                      <Ionicons name="arrow-forward" size={20} color="#ffffff" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* New User Registration Fields */}
            {isNewUser === true && (
              <>
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>
                    <Ionicons name="lock-closed" size={16} color="#22c55e" />{' '}
                    {t('auth.newPassword')}
                  </Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#9aa9b8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.enterSecurePassword')}
                      placeholderTextColor="#6b7280"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      selectionColor="#22c55e"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9aa9b8"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.passwordHint}>
                    {t('auth.mustBe6Characters')}
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>
                    <Ionicons name="lock-closed" size={16} color="#22c55e" />{' '}
                    {t('auth.confirmPassword')}
                  </Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#9aa9b8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.confirmYourPassword')}
                      placeholderTextColor="#6b7280"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      selectionColor="#22c55e"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9aa9b8"
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword && password !== confirmPassword && (
                    <Text style={styles.errorText}>{t('auth.passwordsDoNotMatch')}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
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
                        <Ionicons name="person-add" size={20} color="#ffffff" />
                        <Text style={[styles.buttonText, styles.buttonTextWithIcon]}>{t('auth.createAccount')}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Existing User Login Field */}
            {isNewUser === false && (
              <>
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>
                    <Ionicons name="lock-closed" size={16} color="#22c55e" />{' '}
                    {t('auth.password')}
                  </Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#9aa9b8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.enterYourPassword')}
                      placeholderTextColor="#6b7280"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      selectionColor="#22c55e"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9aa9b8"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
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
                        <Ionicons name="log-in" size={20} color="#ffffff" />
                        <Text style={[styles.buttonText, styles.buttonTextWithIcon]}>{t('auth.login')}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={styles.loadingText}>{t('auth.pleaseWait')}</Text>
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  languageSelectorContainer: {
    zIndex: 10,
  },
  backButtonGradient: {
    padding: 10,
    borderRadius: 12,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 24,
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
    alignItems: 'center',
    marginTop: 10,
  },
  progressStep: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 4,
  },
  progressStepActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 10,
  },
  formContainer: {
    // gap replaced with marginBottom in inputSection
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
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 13,
    color: '#eab308',
    flex: 1,
    marginLeft: 6,
  },
  passwordHint: {
    fontSize: 12,
    color: '#9aa9b8',
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
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
  },
  buttonTextWithIcon: {
    marginLeft: 8,
  },
  buttonIcon: {
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

