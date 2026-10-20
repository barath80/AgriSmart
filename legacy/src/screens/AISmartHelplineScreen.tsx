import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import { helplineData, HelplineInfo } from '../services/helplineData';

export default function AISmartHelplineScreen() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHelplines = useMemo(() => {
    if (!searchQuery.trim()) {
      return helplineData;
    }
    const query = searchQuery.toLowerCase();
    return helplineData.filter(
      (item) =>
        item.state.toLowerCase().includes(query) ||
        item.numbers.some((num) => num.includes(query)) ||
        item.department.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleCall = (phoneNumber: string) => {
    // Clean phone number for dialing (remove dashes and spaces)
    const cleanNumber = phoneNumber.replace(/[\s-]/g, '');
    const telUrl = `tel:${cleanNumber}`;

    Linking.canOpenURL(telUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(telUrl);
        } else {
          Alert.alert(
            t('helpline.call'),
            `${t('helpline.phone')}: ${phoneNumber}\n\n${t('helpline.dialNumber')}`,
            [{ text: t('common.done') }]
          );
        }
      })
      .catch((error) => {
        console.error('Error opening phone dialer:', error);
        Alert.alert(
          t('helpline.call'),
          `${t('helpline.phone')}: ${phoneNumber}\n\n${t('helpline.dialNumber')}`,
          [{ text: t('common.done') }]
        );
      });
  };

  const renderHelplineCard = (helpline: HelplineInfo, index: number) => {
    return (
      <Card key={index} style={styles.helplineCard}>
        <View style={styles.cardHeader}>
          <View style={styles.stateInfo}>
            <Ionicons name="location" size={20} color="#3b82f6" />
            <Text style={styles.stateName}>{helpline.state}</Text>
          </View>
          <View style={styles.departmentBadge}>
            <Text style={styles.departmentText}>{helpline.department}</Text>
          </View>
        </View>

        <View style={styles.numbersContainer}>
          {helpline.numbers.map((number, numIndex) => (
            <View key={numIndex} style={styles.numberRow}>
              <View style={styles.numberContent}>
                <Ionicons name="call-outline" size={18} color="#10b981" />
                <Text style={styles.phoneNumber}>{number}</Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(number)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.callButtonText}>{t('helpline.call')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {helpline.website && (
          <View style={styles.websiteContainer}>
            <Ionicons name="globe-outline" size={16} color="#5AC8FA" />
            <Text style={styles.websiteText}>{helpline.website}</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="call" size={24} color="#E6F7FF" />
        <Text style={styles.title}>{t('helpline.title')}</Text>
        <Text style={styles.subtitle}>
          {t('helpline.subtitle')}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9aa9b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('helpline.search')}
            placeholderTextColor="#9aa9b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#9aa9b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
            <Text style={styles.infoTitle}>{t('helpline.title')}</Text>
          </View>
          <Text style={styles.infoText}>
            {t('helpline.subtitle')}
          </Text>
        </View>

        {filteredHelplines.length === 0 ? (
          <Card style={styles.noResultsCard}>
            <Ionicons name="search-outline" size={48} color="#9aa9b8" />
            <Text style={styles.noResultsText}>{t('common.noData')}</Text>
            <Text style={styles.noResultsSubtext}>
              {t('common.search')}
            </Text>
          </Card>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredHelplines.length} {t('helpline.state')} {t('common.loading')}
              </Text>
            </View>
            {filteredHelplines.map((helpline, index) => renderHelplineCard(helpline, index))}
          </>
        )}

        <Card style={styles.nationalHelplineCard}>
          <View style={styles.nationalHeader}>
            <Ionicons name="call" size={24} color="#ef4444" />
            <Text style={styles.nationalTitle}>{t('helpline.call')}</Text>
          </View>
          
          <View style={styles.nationalContent}>
            <Text style={styles.nationalSubtitle}>{t('helpline.title')}</Text>
            <Text style={styles.nationalDepartment}>
              {t('helpline.subtitle')}
            </Text>
            
            <View style={styles.nationalNumbers}>
              <View style={styles.nationalNumberRow}>
                <Ionicons name="call-outline" size={20} color="#10b981" />
                <Text style={styles.nationalNumberText}>Toll Free No. 1800-11-4000 OR 1915</Text>
              </View>
            </View>
            
            <View style={styles.nationalCallButtons}>
              <TouchableOpacity
                style={styles.nationalCallButton}
                onPress={() => handleCall('1800-11-4000')}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.nationalCallButtonText}>{t('helpline.call')} 1800-11-4000</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.nationalCallButton, { marginLeft: 12 }]}
                onPress={() => handleCall('1915')}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.nationalCallButtonText}>{t('helpline.call')} 1915</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.appInfo}>
              <Ionicons name="phone-portrait-outline" size={16} color="#5AC8FA" />
              <Text style={styles.appInfoText}>
                {t('helpline.subtitle')}
              </Text>
            </View>
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
  header: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#9FD3FF',
    textAlign: 'center',
    lineHeight: 18,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071837',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#11324a',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#E6F7FF',
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#9FD3FF',
    lineHeight: 20,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
    color: '#9aa9b8',
    fontWeight: '600',
  },
  helplineCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
    flex: 1,
  },
  departmentBadge: {
    backgroundColor: '#11324a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  departmentText: {
    fontSize: 12,
    color: '#5AC8FA',
    fontWeight: '600',
  },
  numbersContainer: {
    // gap handled by marginBottom in numberRow
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b2433',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#11324a',
    marginBottom: 12,
  },
  numberContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginLeft: 10,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 70,
    justifyContent: 'center',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  websiteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#11324a',
  },
  websiteText: {
    fontSize: 14,
    color: '#5AC8FA',
    marginLeft: 8,
    fontWeight: '500',
  },
  nationalHelplineCard: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 20,
    backgroundColor: '#071837',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  nationalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  nationalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginLeft: 8,
  },
  nationalContent: {
    // Content spacing handled by marginBottom in children
  },
  nationalSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 4,
  },
  nationalDepartment: {
    fontSize: 14,
    color: '#9FD3FF',
    marginBottom: 16,
    lineHeight: 20,
  },
  nationalNumbers: {
    marginBottom: 16,
  },
  nationalNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2433',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  nationalNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginLeft: 10,
    flex: 1,
  },
  nationalCallButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  nationalCallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  nationalCallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#11324a',
  },
  appInfoText: {
    fontSize: 14,
    color: '#5AC8FA',
    marginLeft: 8,
    fontWeight: '500',
  },
  noResultsCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#9aa9b8',
    textAlign: 'center',
  },
});
