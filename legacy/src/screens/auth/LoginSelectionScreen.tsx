import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../../components/LanguageSelector';

const { width } = Dimensions.get('window');

type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

type LoginSelectionScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'LoginSelection'
>;

type LoginSelectionScreenRouteProp = RouteProp<
  AuthStackParamList,
  'LoginSelection'
>;

interface Props {
  navigation: LoginSelectionScreenNavigationProp;
  route: LoginSelectionScreenRouteProp;
}

export default function LoginSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  
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
        <View style={styles.decorativeCircle3} />

        {/* Header Section */}
        <View style={styles.header}>
          {/* Language Selector */}
          <View style={styles.languageSelectorContainer}>
            <LanguageSelector />
          </View>
          
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#22c55e', '#16a34a', '#15803d'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name="leaf" size={56} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>{t('auth.appName')}</Text>
          <Text style={styles.subtitle}>{t('auth.tagline')}</Text>
          <View style={styles.divider} />
          <Text style={styles.welcomeText}>
            {t('auth.welcome')}{' '}
            <Text style={styles.highlightText}>{t('auth.agriculture')}</Text>
          </Text>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Phone Login Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('PhoneLogin')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#22c55e', '#16a34a', '#15803d'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonIconContainer}>
                <Ionicons name="call" size={28} color="#ffffff" />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>{t('auth.continueWithPhone')}</Text>
                <Text style={styles.buttonSubtext}>{t('auth.quickSecureLogin')}</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            {t('auth.termsAndPrivacy')}
          </Text>
        </View>
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(34, 197, 94, 0.03)',
    top: -50,
    right: -50,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.05)',
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 197, 94, 0.02)',
    top: 100,
    left: -30,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.04)',
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(34, 197, 94, 0.02)',
    bottom: 150,
    right: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.03)',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 8,
    letterSpacing: 1,
    textShadowColor: 'rgba(34, 197, 94, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9FD3FF',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  divider: {
    width: 60,
    height: 4,
    backgroundColor: '#22c55e',
    borderRadius: 2,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#B8D4E8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  highlightText: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 30,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 80,
  },
  buttonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '400',
  },
  footerText: {
    fontSize: 12,
    color: '#9aa9b8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
    marginTop: 10,
  },
});

