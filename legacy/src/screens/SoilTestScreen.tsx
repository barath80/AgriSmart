import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';

export default function SoilTestScreen() {
  const { t } = useTranslation();
  const handleOpenLink = () => {
    const url = 'http://10.1.25.150';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert(t('common.error'), t('common.error'));
        }
      })
      .catch((error) => {
        console.error('Error opening link:', error);
        Alert.alert(t('common.error'), t('common.error'));
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="flask" size={32} color="#E6F7FF" />
          <Text style={styles.title}>{t('soilTest.title')}</Text>
          <Text style={styles.subtitle}>{t('soilTest.subtitle')}</Text>
        </View>

        <Card style={styles.descriptionCard}>
          <View style={styles.descriptionHeader}>
            <Ionicons name="information-circle" size={24} color="#eab308" />
            <Text style={styles.descriptionTitle}>{t('soilTest.importance')}</Text>
          </View>
          
          <Text style={styles.descriptionText}>
            {t('soilTest.importanceText')}
          </Text>

          <Text style={styles.descriptionText}>
            <Text style={styles.boldText}>{t('soilTest.benefits')}</Text>
          </Text>

          <Text style={styles.descriptionText}>
            {t('soilTest.importanceText')}
          </Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.benefitText}>
                <Text style={styles.boldText}>{t('soilTest.benefit1')}</Text>
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.benefitText}>
                <Text style={styles.boldText}>{t('soilTest.benefit2')}</Text>
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.benefitText}>
                <Text style={styles.boldText}>{t('soilTest.benefit3')}</Text>
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.benefitText}>
                <Text style={styles.boldText}>{t('soilTest.benefit4')}</Text>
              </Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>
            <Text style={styles.boldText}>What Soil Tests Measure:</Text>
          </Text>

          <View style={styles.testMeasuresList}>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>Macro Nutrients:</Text> Nitrogen (N), Phosphorus (P), Potassium (K)
              </Text>
            </View>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>pH Level:</Text> Acidity or alkalinity of the soil (optimal range: 6.0-7.5)
              </Text>
            </View>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>Organic Matter:</Text> Percentage of decomposed plant and animal material
              </Text>
            </View>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>Micro Nutrients:</Text> Iron, Zinc, Manganese, Copper, Boron, etc.
              </Text>
            </View>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>Soil Texture:</Text> Proportion of sand, silt, and clay particles
              </Text>
            </View>
            <View style={styles.measureItem}>
              <View style={styles.measureBullet} />
              <Text style={styles.measureText}>
                <Text style={styles.boldText}>Electrical Conductivity:</Text> Measure of soil salinity
              </Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>
            <Text style={styles.boldText}>How to Get Your Soil Tested:</Text>
          </Text>

          <Text style={styles.descriptionText}>
            1. Collect soil samples from different areas of your field{'\n'}
            2. Mix the samples and send to a certified soil testing laboratory{'\n'}
            3. Receive detailed analysis report with recommendations{'\n'}
            4. Implement suggested amendments and monitor results
          </Text>

          <Text style={styles.descriptionText}>
            Regular soil testing (once every 2-3 years) helps maintain soil health and ensures
            sustainable agricultural practices for long-term productivity.
          </Text>
        </Card>

        <Card style={styles.procedureCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="clipboard-outline" size={24} color="#eab308" />
            <Text style={styles.sectionTitle}>{t('soilTest.howToTest')}</Text>
          </View>
          
          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>{t('soilTest.step1')}</Text>{'\n'}
            {t('soilTest.step1Text')}
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>{t('soilTest.step2')}</Text>{'\n'}
            {t('soilTest.step2Text')}
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>{t('soilTest.step3')}</Text>{'\n'}
            {t('soilTest.step3Text')}
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>{t('soilTest.step4')}</Text>{'\n'}
            {t('soilTest.step4Text')}
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>{t('soilTest.step5')}</Text>{'\n'}
            {t('soilTest.step5Text')}
          </Text>
        </Card>

        <Card style={styles.importanceCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up-outline" size={24} color="#10b981" />
            <Text style={styles.sectionTitle}>Benefits of Regular Soil Testing</Text>
          </View>

          <View style={styles.benefitsGrid}>
            <View style={styles.benefitBox}>
              <Ionicons name="cash-outline" size={24} color="#10b981" />
              <Text style={styles.benefitBoxTitle}>Cost Savings</Text>
              <Text style={styles.benefitBoxText}>
                Apply only the fertilizers your soil needs, reducing unnecessary expenses
              </Text>
            </View>

            <View style={styles.benefitBox}>
              <Ionicons name="stats-chart-outline" size={24} color="#10b981" />
              <Text style={styles.benefitBoxTitle}>Higher Yields</Text>
              <Text style={styles.benefitBoxText}>
                Optimize nutrient levels to maximize crop production and quality
              </Text>
            </View>

            <View style={styles.benefitBox}>
              <Ionicons name="leaf-outline" size={24} color="#10b981" />
              <Text style={styles.benefitBoxTitle}>Soil Health</Text>
              <Text style={styles.benefitBoxText}>
                Maintain long-term soil fertility and prevent nutrient depletion
              </Text>
            </View>

            <View style={styles.benefitBox}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#10b981" />
              <Text style={styles.benefitBoxTitle}>Environmental</Text>
              <Text style={styles.benefitBoxText}>
                Prevent over-fertilization and protect groundwater from contamination
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.interpretationCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Understanding Your Test Results</Text>
          </View>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>pH Level:</Text>{'\n'}
            • 6.0-7.5: Optimal for most crops{'\n'}
            • Below 6.0: Acidic soil (may need lime){'\n'}
            • Above 7.5: Alkaline soil (may need sulfur)
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>Nutrient Levels:</Text>{'\n'}
            • High: No additional fertilizer needed{'\n'}
            • Medium: Moderate application recommended{'\n'}
            • Low: Significant fertilizer application required
          </Text>

          <Text style={styles.sectionText}>
            <Text style={styles.boldText}>Organic Matter:</Text>{'\n'}
            • Ideal: 2-5% for most agricultural soils{'\n'}
            • Low: Add compost or organic manure{'\n'}
            • High: Excellent for water retention and nutrient availability
          </Text>

          <Text style={styles.sectionText}>
            Always consult with agricultural experts or extension officers to interpret your
            soil test results and get personalized recommendations for your specific crops
            and farming conditions.
          </Text>
        </Card>

        <Card style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <Ionicons name="link" size={28} color="#3b82f6" />
            <Text style={styles.linkTitle}>{t('soilTest.openPortal')}</Text>
          </View>
          
          <Text style={styles.linkDescription}>
            {t('soilTest.portalInfo')}
          </Text>

          <View style={styles.portalFeatures}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.featureText}>{t('soilTest.benefit1')}</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.featureText}>{t('soilTest.benefit2')}</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.featureText}>{t('soilTest.benefit3')}</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.featureText}>{t('soilTest.benefit4')}</Text>
            </View>
          </View>

          <View style={styles.urlHighlightContainer}>
            <View style={styles.urlBadge}>
              <Ionicons name="globe" size={20} color="#3b82f6" />
              <Text style={styles.urlLabel}>{t('soilTest.portalUrl')}</Text>
            </View>
            <TouchableOpacity
              style={styles.urlDisplayContainer}
              onPress={handleOpenLink}
              activeOpacity={0.8}
            >
              <Text style={styles.urlDisplayText}>http://10.1.25.150</Text>
              <Ionicons name="open-outline" size={18} color="#5AC8FA" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleOpenLink}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward-circle" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.linkButtonText}>{t('soilTest.openPortal')}</Text>
          </TouchableOpacity>

          <View style={styles.urlInfoContainer}>
            <Ionicons name="information-circle" size={16} color="#eab308" />
            <Text style={styles.urlInfoText}>
              {t('soilTest.portalInfo')}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#eab308',
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
    color: '#ffffff',
  },
  descriptionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  descriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#9FD3FF',
    lineHeight: 22,
    marginBottom: 12,
  },
  boldText: {
    fontWeight: '700',
    color: '#E6F7FF',
  },
  benefitsList: {
    marginVertical: 12,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#E6F7FF',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  testMeasuresList: {
    marginVertical: 12,
    marginBottom: 16,
  },
  measureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  measureBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#eab308',
    marginTop: 7,
    marginRight: 12,
  },
  measureText: {
    fontSize: 14,
    color: '#E6F7FF',
    flex: 1,
    lineHeight: 20,
  },
  linkCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  linkDescription: {
    fontSize: 14,
    color: '#9FD3FF',
    lineHeight: 22,
    marginBottom: 20,
  },
  urlDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2433',
    padding: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3b82f6',
    justifyContent: 'space-between',
  },
  urlDisplayText: {
    fontSize: 16,
    color: '#5AC8FA',
    fontWeight: '700',
    flex: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  urlInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#11324a',
  },
  urlInfoText: {
    fontSize: 12,
    color: '#9aa9b8',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  procedureCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#9FD3FF',
    lineHeight: 22,
    marginBottom: 14,
  },
  importanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  benefitsGrid: {
    marginTop: 12,
  },
  benefitBox: {
    backgroundColor: '#0b2433',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#11324a',
    marginBottom: 12,
    alignItems: 'center',
  },
  benefitBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 12,
    marginBottom: 8,
  },
  benefitBoxText: {
    fontSize: 13,
    color: '#9FD3FF',
    textAlign: 'center',
    lineHeight: 20,
  },
  interpretationCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  portalFeatures: {
    marginVertical: 16,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#E6F7FF',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  urlHighlightContainer: {
    marginBottom: 20,
  },
  urlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  urlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E6F7FF',
    marginLeft: 8,
  },
});

