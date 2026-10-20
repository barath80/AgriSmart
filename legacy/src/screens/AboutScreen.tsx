import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

export default function AboutScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.title}>{t('about.title')}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="leaf" size={64} color="#22c55e" />
          <Text style={styles.appName}>{t('about.appName')}</Text>
          <Text style={styles.version}>{t('about.version')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.aboutUs')}</Text>
          <Text style={styles.sectionText}>
            {t('about.aboutText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.features')}</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature1')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature2')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature3')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature4')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature5')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.featureText}>{t('about.feature6')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.mission')}</Text>
          <Text style={styles.sectionText}>
            {t('about.missionText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.contactUs')}</Text>
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={20} color="#22c55e" />
            <Text style={styles.contactText}>{t('about.email')}</Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="call" size={20} color="#22c55e" />
            <Text style={styles.contactText}>{t('about.phone')}</Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="globe" size={20} color="#22c55e" />
            <Text style={styles.contactText}>{t('about.website')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.developedBy')}</Text>
          <Text style={styles.sectionText}>
            {t('about.developedByText')}
          </Text>
        </View>
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E6F7FF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 32,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 16,
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#9aa9b8',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 22,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#071837',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  featureText: {
    fontSize: 14,
    color: '#E6F7FF',
    marginLeft: 12,
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#071837',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  contactText: {
    fontSize: 14,
    color: '#E6F7FF',
    marginLeft: 12,
  },
});

