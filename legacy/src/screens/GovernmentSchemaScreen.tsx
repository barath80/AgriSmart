import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type NewsArticle = { title: string; published_at: string; url: string };
type GovernmentScheme = {
  name: string;
  description: string;
  eligibility: string;
  benefits: string;
  applyUrl: string;
  category: string;
};

import AsyncStorage from '@react-native-async-storage/async-storage';

// Government Schemes Data
const GOVERNMENT_SCHEMES: GovernmentScheme[] = [
  {
    name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    description: 'Direct income support scheme providing ₹6,000 per year in three equal installments to all landholding farmer families.',
    eligibility: 'All landholding farmer families who own cultivable land. Small and marginal farmer families.',
    benefits: '₹6,000 per year (₹2,000 per installment), Direct benefit transfer to bank accounts, Financial stability for farming families',
    applyUrl: 'https://pmkisan.gov.in/',
    category: 'Income Support'
  },
  {
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    description: 'Crop insurance scheme to provide financial support to farmers in case of crop loss due to natural calamities, pests, and diseases.',
    eligibility: 'All farmers growing notified crops in notified areas, Both loanee and non-loanee farmers are eligible',
    benefits: 'Premium as low as 1.5-2% for Kharif crops, 5% for Rabi crops, Comprehensive coverage against natural disasters',
    applyUrl: 'https://pmfby.gov.in/',
    category: 'Insurance'
  },
  {
    name: 'Kisan Credit Card (KCC)',
    description: 'Credit facility for farmers to meet their short-term credit requirements for cultivation and other needs.',
    eligibility: 'All farmers including individual farmers, tenant farmers, oral lessees, sharecroppers, Self-help groups (SHGs) or Joint Liability Groups (JLGs)',
    benefits: 'Interest subvention of 2% per annum, Interest subvention of additional 3% for prompt repayment, Credit limit up to ₹3 lakh',
    applyUrl: 'https://www.kisancard.co.in/',
    category: 'Credit'
  },
  {
    name: 'Pradhan Mantri Krishi Sinchai Yojana (PMKSY)',
    description: 'Scheme to ensure access to water for every farm and improve water use efficiency.',
    eligibility: 'Individual farmers, Groups of farmers, Farmer Producer Organizations (FPOs), State agencies',
    benefits: 'Financial assistance for micro-irrigation, Water conservation structures, Drip and sprinkler irrigation support',
    applyUrl: 'https://pmksy.gov.in/',
    category: 'Irrigation'
  },
  {
    name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
    description: 'Promote organic farming in the country through adoption of organic village by cluster approach.',
    eligibility: 'Individual farmers, Groups of farmers, Farmer groups willing to adopt organic farming practices',
    benefits: 'Financial assistance of ₹50,000 per hectare for 3 years, Assistance for certification, Marketing support',
    applyUrl: 'https://www.pgsindia-ncof.gov.in/',
    category: 'Organic Farming'
  },
  {
    name: 'Soil Health Card Scheme',
    description: 'Provides soil health cards to farmers every 2 years to help them understand the nutrient status of their soil.',
    eligibility: 'All farmers owning agricultural land, State governments and soil testing laboratories',
    benefits: 'Free soil testing, Nutrient recommendations, Balanced use of fertilizers, Improved soil health',
    applyUrl: 'https://soilhealth.dac.gov.in/',
    category: 'Soil Health'
  },
  {
    name: 'National Mission for Sustainable Agriculture (NMSA)',
    description: 'Promotes location-specific improved agronomic practices through soil health management, water use efficiency, and climate change adaptation.',
    eligibility: 'All farmers, State governments, Agricultural research institutions',
    benefits: 'Support for climate-resilient agriculture, Water use efficiency programs, Sustainable farming practices',
    applyUrl: 'https://nmsa.dac.gov.in/',
    category: 'Sustainable Agriculture'
  },
  {
    name: 'Pradhan Mantri Kisan Maan Dhan Yojana',
    description: 'Pension scheme for small and marginal farmers to provide them with a monthly pension of ₹3,000 after attaining the age of 60 years.',
    eligibility: 'Small and marginal farmers aged 18-40 years, Landholding up to 2 hectares',
    benefits: '₹3,000 per month pension after 60 years, Contribution from both farmer and government, Life insurance cover',
    applyUrl: 'https://maandhan.in/',
    category: 'Pension'
  },
  {
    name: 'Sub-Mission on Agricultural Mechanization (SMAM)',
    description: 'Promotes agricultural mechanization among small and marginal farmers through custom hiring centers.',
    eligibility: 'Individual farmers, Custom Hiring Centers (CHCs), Farmers\' groups, FPOs',
    benefits: 'Subsidy for purchase of agricultural machinery, Establishment of CHCs, Training programs',
    applyUrl: 'https://farmech.gov.in/',
    category: 'Mechanization'
  },
  {
    name: 'Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan (PM-KUSUM)',
    description: 'Aims to add solar capacity and provide financial and water security to farmers through solar irrigation.',
    eligibility: 'Individual farmers, Groups of farmers, State governments, Solar power developers',
    benefits: 'Subsidy for solar pumps, Additional income through sale of surplus power, Reduced electricity costs',
    applyUrl: 'https://pmkusum.mnre.gov.in/',
    category: 'Solar Energy'
  }
];

// Supplied at build time through app config `extra` (never commit real keys).
const NEWS_API_KEY: string = Constants.expoConfig?.extra?.NEWS_API_KEY ?? '';

export default function GovernmentSchemaScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [saved, setSaved] = useState<NewsArticle[]>([]);
  const [activeTab, setActiveTab] = useState<'schemes' | 'news' | 'saved'>('schemes');

  // Verify schemes data is loaded
  React.useEffect(() => {
    console.log('Government Schemes loaded:', GOVERNMENT_SCHEMES.length, 'schemes');
  }, []);

  const SAVED_KEY = '@saved_news_v1';
  const loadSaved = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      if (!raw) return setSaved([]);
      const list: NewsArticle[] = JSON.parse(raw);
      setSaved(list || []);
    } catch (e) {
      console.warn('Failed load saved', e);
    }
  };

  const isSaved = (a: NewsArticle) => saved.some((s) => s.url === a.url);

  const toggleSave = async (a: NewsArticle) => {
    try {
      let next: NewsArticle[];
      if (isSaved(a)) {
        next = saved.filter((s) => s.url !== a.url);
      } else {
        next = [a, ...saved];
      }
      setSaved(next);
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed save', e);
      Alert.alert('Error', 'Failed to update saved news');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
  try {
  const apiKey = NEWS_API_KEY;
        const endpoint = 'https://api.worldnewsapi.com/search-news';
        const params = new URLSearchParams({
          text: 'farmer OR agriculture OR farming',
          'source-country': 'in',
          language: 'en',
          categories: 'environment,business,science',
          sort: 'publish-time',
          number: '20',
          'api-key': apiKey,
        });

        const url = `${endpoint}?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`HTTP ${resp.status} - ${txt}`);
        }
        const data = await resp.json();

        // The API may return different shapes; normalize to an array safely.
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.articles)) list = data.articles;
        else if (Array.isArray(data.results)) list = data.results;
        else if (Array.isArray(data.data)) list = data.data;
        else if (data && typeof data === 'object') {
          // Sometimes APIs return an object with numeric keys — try to coerce to array safely
          try {
            list = Object.values(data).filter((v) => v && (Array.isArray(v) || typeof v === 'object')).flat().filter(Boolean);
          } catch (e) {
            list = [];
          }
        }
        const parsed: NewsArticle[] = [];
        if (Array.isArray(list)) {
          for (const it of list) {
          const title = it.title || it.headline || it.description || '';
          const published_at = it.publishedAt || it.published_at || it.pubDate || it.date || '';
          const url = it.url || it.link || it.articleUrl || '';
          if (!title || !url) continue;
          parsed.push({ title, published_at, url });
          // Log clearly
          console.log('[News] Title:', title);
          console.log('[News] Published:', published_at);
          console.log('[News] URL:', url);
          }
        }

  setArticles(parsed);
  // reconcile saved list
  loadSaved();
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Failed fetching news', err);
        setError(err.message || 'Failed to fetch news');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    return () => controller.abort();
  }, []);

 

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={32} color="#E6F7FF" />
        <Text style={styles.title}>Government Schema</Text>
        <Text style={styles.subtitle}>Farmer & agriculture news 🇮🇳</Text>
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 8 }}>
        <View style={styles.tabRow}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'schemes' && styles.tabActive]} 
            onPress={() => setActiveTab('schemes')}
          >
            <Ionicons 
              name="document-text-outline" 
              size={16} 
              color={activeTab === 'schemes' ? '#021427' : '#9FD3FF'} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'schemes' && styles.tabTextActive]}>
              Govt. Schemes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'news' && styles.tabActive]} 
            onPress={() => setActiveTab('news')}
          >
            <Ionicons 
              name="newspaper-outline" 
              size={16} 
              color={activeTab === 'news' ? '#021427' : '#9FD3FF'} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'news' && styles.tabTextActive]}>News</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'saved' && styles.tabActive]} 
            onPress={() => setActiveTab('saved')}
          >
            <Ionicons 
              name="bookmark-outline" 
              size={16} 
              color={activeTab === 'saved' ? '#021427' : '#9FD3FF'} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Saved</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={true}
      >
        <View style={{ padding: 16 }}>
          {activeTab === 'schemes' && (
            <View style={{ width: '100%' }}>
              <Text style={styles.sectionHeader}>Available Government Schemes</Text>
              <Text style={styles.sectionSubheader}>
                Explore various government schemes designed to support farmers and improve agricultural practices
              </Text>
              {GOVERNMENT_SCHEMES && GOVERNMENT_SCHEMES.length > 0 ? (
                GOVERNMENT_SCHEMES.map((scheme, index) => (
                <View key={index} style={styles.schemeCard}>
                  <View style={styles.schemeHeader}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{scheme.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.schemeName}>{scheme.name}</Text>
                  <Text style={styles.schemeDescription}>{scheme.description}</Text>
                  
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                      <Text style={styles.detailLabel}>Eligibility:</Text>
                    </View>
                    <Text style={styles.detailText}>{scheme.eligibility}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Ionicons name="gift" size={18} color="#3b82f6" />
                      <Text style={styles.detailLabel}>Benefits:</Text>
                    </View>
                    <Text style={styles.detailText}>{scheme.benefits}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.applyButton} 
                    onPress={() => {
                      if (scheme.applyUrl) {
                        Linking.openURL(scheme.applyUrl).catch(() => {
                          Alert.alert('Error', 'Unable to open the application link');
                        });
                      }
                    }}
                  >
                    <Ionicons name="open-outline" size={18} color="#E6F7FF" />
                    <Text style={styles.applyButtonText}>{t('government.applyNow')}</Text>
                  </TouchableOpacity>
                </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color="#9FD3FF" />
                  <Text style={styles.emptyStateText}>No schemes available at the moment</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'news' && (
            <>
              {loading && <ActivityIndicator size="large" color="#E6F7FF" />}
              {error ? <Text style={{ color: '#fecaca', marginTop: 12 }}>Error: {error}</Text> : null}

              {/* saved teaser removed — saved posts show only under Saved Posts tab */}

              {loading ? null : articles.length === 0 ? (
                <Text style={{ color: '#9FD3FF', marginTop: 12 }}>No news found.</Text>
              ) : (
                articles.map((a, i) => (
                  <View key={`${i}-${a.title}`} style={styles.newsCard}>
                    <View style={[styles.newsRow, { alignItems: 'center', justifyContent: 'space-between' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
                        <Text style={styles.newsEmoji}>🌾</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.newsTitle}>{a.title}</Text>
                          <Text style={styles.newsDate}>{a.published_at}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.pinButton} onPress={() => toggleSave(a)}>
                        <Ionicons name={isSaved(a) ? 'bookmark' : 'bookmark-outline'} size={20} color="#E6F7FF" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.newsButton} onPress={() => { if (a.url) Linking.openURL(a.url); }}>
                      <Text style={styles.newsButtonText}>Read article 📰</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'saved' && (
            <>
              {saved.length === 0 ? (
                <Text style={{ color: '#9FD3FF' }}>No saved posts yet. Pin articles from the News tab.</Text>
              ) : (
                saved.map((s, idx) => (
                  <View key={`saved-full-${idx}`} style={styles.newsCard}>
                    <View style={[styles.newsRow, { alignItems: 'center' }]}>
                      <Text style={styles.newsEmoji}>📌</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.newsTitle}>{s.title}</Text>
                        <Text style={styles.newsDate}>{s.published_at}</Text>
                      </View>
                      <TouchableOpacity style={styles.pinButton} onPress={() => toggleSave(s)}>
                        <Ionicons name="bookmark" size={20} color="#E6F7FF" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[styles.newsButton, { backgroundColor: '#047857' }]} onPress={() => { if (s.url) Linking.openURL(s.url); }}>
                      <Text style={styles.newsButtonText}>Read article 📰</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  },
  tabRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  paddingVertical: 12,
  backgroundColor: 'transparent',
  marginHorizontal: -20,
  marginTop: 12,
  marginBottom: 6,
  },
  tabButton: {
  flexDirection: 'row',
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 24,
  backgroundColor: '#071837',
  marginHorizontal: 4,
  minWidth: 100,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 3,
  flex: 1,
  },
  tabActive: {
  backgroundColor: '#0ea5a4',
  transform: [{ translateY: -2 }],
  shadowOpacity: 0.24,
  elevation: 6,
  },
  tabText: {
  color: '#9FD3FF',
  fontWeight: '700',
  fontSize: 13,
  },
  tabTextActive: {
  color: '#021427',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 8,
  },
  newsCard: {
    backgroundColor: '#071837',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#11324a',
    marginBottom: 12,
  },
  newsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  newsEmoji: { fontSize: 22, marginRight: 8 },
  newsTitle: { color: '#E6F7FF', fontWeight: '700' },
  newsDate: { color: '#9FD3FF', fontSize: 12, marginTop: 4 },
  newsButton: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#1e40af', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  newsButtonText: { color: '#E6F7FF', fontWeight: '600' },
  pinButton: { marginLeft: 8, padding: 6 },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubheader: {
    fontSize: 14,
    color: '#9FD3FF',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: '#9FD3FF',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  schemeCard: {
    backgroundColor: '#071837',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#11324a',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  schemeHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#0ea5a4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#021427',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schemeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 10,
    lineHeight: 24,
  },
  schemeDescription: {
    fontSize: 14,
    color: '#9FD3FF',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailSection: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E6F7FF',
    marginLeft: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#9FD3FF',
    lineHeight: 18,
    paddingLeft: 24,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  applyButtonText: {
    color: '#E6F7FF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});

