import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { auth } from '../../config/firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguageSelector from '../../components/LanguageSelector';

// Complete web browser authentication for Google
WebBrowser.maybeCompleteAuthSession();

type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

type GmailLoginScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'GmailLogin'
>;

type GmailLoginScreenRouteProp = RouteProp<AuthStackParamList, 'GmailLogin'>;

interface Props {
  navigation: GmailLoginScreenNavigationProp;
  route: GmailLoginScreenRouteProp;
}

export default function GmailLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Google Client IDs from Google Cloud Console
  // IMPORTANT: Make sure you've added the redirect URI in Google Cloud Console:
  // - For Expo Go: https://auth.expo.io/@your-username/agrismart
  // - Or the proxy URL that will be logged in console
  const GOOGLE_WEB_CLIENT_ID = '575013924123-1jlh4r9na1f8bi5803gj5vqhk5mmblp1.apps.googleusercontent.com';
  
  // Android Client ID from Google Cloud Console
  // This is required for Android devices (including Expo Go on Android)
  const ANDROID_CLIENT_ID = '575013924123-bqap57hhg7561g8npbhn5v939bq15tae.apps.googleusercontent.com';

  // Create redirect URI for Expo Go (uses proxy)
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
  });

  // Log the redirect URI so you can add it to Google Cloud Console
  useEffect(() => {
    console.log('🔗 Redirect URI for Google OAuth:', redirectUri);
    console.log('📝 Add this URI to Google Cloud Console:');
    console.log('   1. Go to: https://console.cloud.google.com');
    console.log('   2. APIs & Services > Credentials');
    console.log('   3. Edit your Web Client ID');
    console.log('   4. Add this to Authorized redirect URIs:', redirectUri);
    console.log('   5. Also add to your Android Client ID if needed');
  }, [redirectUri]);

  // Use expo-auth-session Google provider (handles OAuth flow correctly)
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    redirectUri: redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  /**
   * Process Gmail authentication result
   */
  const processGmailAuth = useCallback(async (email: string, userId?: string) => {
    try {
      // Check if email exists in Supabase
      // Use maybeSingle() to avoid errors when not found
      const { data, error } = await supabase
        .from('Authentication Info')
        .select('"ID", gmail')
        .eq('gmail', email)
        .maybeSingle();

      // Only throw error if it's not a "not found" error
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
        throw error;
      }

      if (data) {
        // Existing user - check if farmer info exists
        await AsyncStorage.setItem('userId', data['ID'].toString());
        await AsyncStorage.setItem('authType', 'gmail');
        await AsyncStorage.setItem('email', email);

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
          
          // Navigate to main app via AuthHome
          navigation.replace('AuthHome');
        } else {
          // No farmer info - navigate to FarmerInfoScreen
          navigation.replace('FarmerInfo', {
            userId: data['ID'],
            authType: 'gmail',
          });
        }
      } else {
        // New user - insert into Authentication Info
        // Column names: ID (auto), created_at (auto), gmail, Phone Number (null), Password (null)
        const { data: newUser, error: insertError } = await supabase
          .from('Authentication Info')
          .insert({
            gmail: email,
          })
          .select('"ID", created_at, gmail, "Phone Number", "Password"')
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }

        if (newUser && newUser['ID']) {
          // Store user session
          await AsyncStorage.setItem('userId', newUser['ID'].toString());
          await AsyncStorage.setItem('authType', 'gmail');
          await AsyncStorage.setItem('email', email);

          // Navigate to FarmerInfoScreen
          navigation.replace('FarmerInfo', {
            userId: newUser['ID'],
            authType: 'gmail',
          });
        }
      }
    } catch (error: any) {
      console.error('Error processing Gmail auth:', error);
      Alert.alert('Error', 'Failed to process authentication. Please try again.');
      setLoading(false);
    }
  }, [navigation]);

  /**
   * Handle successful authentication
   */
  const handleAuthSuccess = useCallback(async (id_token: string | undefined) => {
    if (!id_token) {
      Alert.alert('Error', 'No id_token received from Google');
      setLoading(false);
      return;
    }

    try {
      console.log('Received id_token, signing in with Firebase...');

      // Create Firebase credential using the id_token
      const credential = GoogleAuthProvider.credential(id_token);

      // Sign in with Firebase
      const firebaseResult = await signInWithCredential(auth, credential);

      console.log('Firebase sign-in successful:', firebaseResult.user.email);

      // Get the email from Firebase user
      const email = firebaseResult.user.email;

      if (!email) {
        throw new Error('No email found in Firebase user');
      }

      // Process the Gmail authentication with Supabase
      await processGmailAuth(email);
    } catch (error: any) {
      console.error('Firebase sign-in error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to sign in with Firebase. Please try again.'
      );
      setLoading(false);
    }
  }, [processGmailAuth]);

  /**
   * Handle authentication errors
   */
  const handleAuthError = useCallback((error: any) => {
    console.error('Auth error:', error);
    Alert.alert(
      'Authentication Error',
      error?.message || 'Failed to authenticate with Google. Please try again.'
    );
    setLoading(false);
  }, []);

  // Handle the auth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleAuthSuccess(response.params.id_token);
    } else if (response?.type === 'error') {
      handleAuthError(response.error);
    } else if (response?.type === 'cancel') {
      setLoading(false);
    }
  }, [response, handleAuthSuccess, handleAuthError]);

  /**
   * Handle Gmail login button press
   */
  const handleGmailLogin = async () => {
    setLoading(true);

    try {
      // Check if request is ready
      if (!request) {
        throw new Error('Auth request not ready. Please wait a moment and try again.');
      }

      // Prompt user to sign in with Google
      await promptAsync();
      // Note: The actual auth handling is done in the useEffect hook above
    } catch (error: any) {
      console.error('Gmail login error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to initiate Google sign-in. Please try again.'
      );
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#071840'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#E6F7FF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.gmailLogin')}</Text>
          <View style={styles.languageSelectorContainer}>
            <LanguageSelector />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.infoContainer}>
          <Ionicons name="mail" size={64} color="#ea4335" />
          <Text style={styles.infoText}>
            {t('auth.signInWithGoogle')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.gmailButton}
          onPress={handleGmailLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ea4335', '#c5221f'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>{t('auth.signInWithGoogleButton')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.noteText}>
          {t('auth.gmailNote')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E6F7FF',
    flex: 1,
  },
  languageSelectorContainer: {
    marginLeft: 'auto',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  infoText: {
    fontSize: 16,
    color: '#9FD3FF',
    textAlign: 'center',
    marginTop: 16,
  },
  gmailButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 12,
    color: '#9aa9b8',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});

