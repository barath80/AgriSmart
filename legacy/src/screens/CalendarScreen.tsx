import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { crops, CropCalendar, Stage } from '../config/cropCalendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string>(crops[0]?.key || '');
  const selected = useMemo(() => crops.find((c: CropCalendar) => c.key === selectedKey) || crops[0], [selectedKey]);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [cropDropdownVisible, setCropDropdownVisible] = useState(false);

  const toggleStage = useCallback((stageKey: string) => {
    setExpandedStages((s) => ({ ...s, [stageKey]: !s[stageKey] }));
  }, []);

  const emojiForStage = (stageName: string, index: number) => {
    const map = ['🚜','🌱','💧','🌾','🛠','⚠️','🌿','🍂','📦'];
    return map[index % map.length] || '🔹';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="calendar-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{t('calendar.title')}</Text>
          <Text style={styles.subtitle}>{t('calendar.subtitle')}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Ionicons name="leaf-outline" size={20} color="#22c55e" style={{ marginRight: 8 }} />
            <Text style={styles.sectionLabel}>{t('crop.title')}</Text>
          </View>
          
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>{t('common.select')}</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setCropDropdownVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownButtonContent}>
                <Ionicons name="leaf" size={22} color="#22c55e" style={{ marginRight: 12 }} />
                <Text style={styles.dropdownButtonText}>
                  {selected?.name || t('common.select')}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={22} color="#E6F7FF" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={cropDropdownVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCropDropdownVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={styles.modalOverlayTouchable}
                activeOpacity={1}
                onPress={() => setCropDropdownVisible(false)}
              />
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons name="leaf-outline" size={24} color="#22c55e" style={{ marginRight: 12 }} />
                    <Text style={styles.modalTitle}>{t('common.select')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCropDropdownVisible(false)}>
                    <Ionicons name="close" size={24} color="#E6F7FF" />
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={true}
                >
                  {crops.map((crop: CropCalendar) => (
                    <TouchableOpacity
                      key={crop.key}
                      style={[
                        styles.modalItem,
                        selectedKey === crop.key && styles.modalItemSelected
                      ]}
                      onPress={() => {
                        setSelectedKey(crop.key);
                        setCropDropdownVisible(false);
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Ionicons 
                          name={selectedKey === crop.key ? "checkmark-circle" : "ellipse-outline"} 
                          size={20} 
                          color={selectedKey === crop.key ? "#22c55e" : "#9aa9b8"} 
                          style={{ marginRight: 12 }}
                        />
                        <Text style={[
                          styles.modalItemText,
                          selectedKey === crop.key && styles.modalItemTextSelected
                        ]}>
                          {crop.name}
                        </Text>
                      </View>
                      {selectedKey === crop.key && (
                        <View style={styles.selectedIndicator} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={styles.calendarCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIconContainer}>
                  <Ionicons name="time-outline" size={20} color="#22c55e" />
                </View>
                <View style={styles.cardHeaderTextContainer}>
                  <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">{selected?.name} {t('calendar.title')}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">{t('calendar.events')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.stagesContainer}>
              {(selected?.stages || []).map((item: Stage, index: number) => {
                const key = `${item.stage}-${index}`;
                const opened = !!expandedStages[key];
                return (
                  <View key={key} style={[styles.stageCard, opened && styles.stageCardExpanded]}>
                    <TouchableOpacity 
                      style={[styles.stageTouchable, opened && styles.stageTouchableExpanded]} 
                      onPress={() => toggleStage(key)} 
                      activeOpacity={0.8}
                    >
                      <View style={styles.stageHeader}>
                        <View style={styles.stageHeaderLeft}>
                          <View style={[styles.stageEmojiContainer, opened && styles.stageEmojiContainerExpanded]}>
                            <Text style={[styles.stageEmoji, opened && styles.stageEmojiExpanded]}>{emojiForStage(item.stage, index)}</Text>
                          </View>
                          <View style={styles.stageTitleContainer}>
                            <Text style={[styles.stageTitle, opened && styles.stageTitleExpanded]}>{item.stage}</Text>
                            <View style={[styles.stageIndexBadge, opened && styles.stageIndexBadgeExpanded]}>
                              <Text style={[styles.stageIndexText, opened && styles.stageIndexTextExpanded]}>{t('calendar.events')} {index + 1}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.chevronContainer, opened && styles.chevronContainerExpanded]}>
                          <Ionicons 
                            name={opened ? 'chevron-up' : 'chevron-down'} 
                            size={opened ? 24 : 18} 
                            color={opened ? '#22c55e' : '#9aa9b8'} 
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {opened && (
                      <View style={styles.stageBody}>
                        <View style={styles.stageInfoRow}>
                          <Ionicons name="time" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                          <Text style={styles.stagePeriod}>
                            <Text style={styles.stageInfoLabel}>{t('weather.current')}: </Text>
                            {item.timePeriod}
                          </Text>
                        </View>
                        <View style={[styles.stageInfoRow, { marginTop: 12 }]}>
                          <Ionicons name="thermometer-outline" size={16} color="#f97316" style={{ marginRight: 8 }} />
                          <Text style={styles.stageCondition}>
                            <Text style={styles.stageInfoLabel}>{t('crop.idealConditions')}: </Text>
                            {item.condition}
                          </Text>
                        </View>
                        <View style={styles.activitiesContainer}>
                          <View style={styles.activitiesHeader}>
                            <Ionicons name="list-outline" size={18} color="#3b82f6" style={{ marginRight: 8 }} />
                            <Text style={styles.activitiesTitle}>{t('calendar.events')}</Text>
                          </View>
                          {item.activities?.map((a: string, idx: number) => (
                            <View key={idx} style={styles.activityRow}>
                              <View style={styles.activityBullet}>
                                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                              </View>
                              <Text style={styles.activityText}>{a}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    paddingTop: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#f97316',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    width: '100%',
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    width: '100%',
  },
  sectionLabel: {
    color: '#E6F7FF',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  dropdownContainer: {
    marginBottom: 16,
    width: '100%',
  },
  dropdownLabel: {
    color: '#9aa9b8',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  dropdownButton: {
    backgroundColor: '#071837',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22c55e',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 60,
    width: '100%',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownButtonText: {
    color: '#E6F7FF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#071837',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#E6F7FF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#081a2b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalItemText: {
    color: '#E6F7FF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalItemTextSelected: {
    color: '#22c55e',
    fontWeight: '700',
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  calendarCard: {
    backgroundColor: '#071837',
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },
  cardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    width: '100%',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cardHeaderTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    flexShrink: 0,
  },
  cardTitle: {
    color: '#E6F7FF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  cardSubtitle: {
    color: '#9aa9b8',
    fontSize: 12,
    fontWeight: '500',
  },
  stagesContainer: {
    width: '100%',
  },
  stageCard: {
    backgroundColor: '#0b2433',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  stageCardExpanded: {
    borderColor: '#22c55e',
    borderWidth: 2,
    backgroundColor: '#0f2e42',
    shadowColor: '#22c55e',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  stageTouchable: {
    padding: 10,
    paddingVertical: 12,
    width: '100%',
  },
  stageTouchableExpanded: {
    padding: 16,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stageEmojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  stageEmojiContainerExpanded: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    borderWidth: 2,
  },
  stageEmoji: {
    fontSize: 18,
  },
  stageEmojiExpanded: {
    fontSize: 24,
  },
  stageTitleContainer: {
    flex: 1,
  },
  stageTitle: {
    color: '#E6F7FF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
    marginBottom: 3,
    lineHeight: 18,
  },
  stageTitleExpanded: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
    lineHeight: 22,
  },
  stageIndexBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    marginTop: 2,
  },
  stageIndexBadgeExpanded: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 0,
  },
  stageIndexText: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stageIndexTextExpanded: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chevronContainer: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(154, 169, 184, 0.1)',
  },
  chevronContainerExpanded: {
    padding: 8,
    borderRadius: 20,
  },
  stageBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    marginHorizontal: 0,
    marginBottom: 16,
    width: '100%',
  },
  stageInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stagePeriod: {
    color: '#E6F7FF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  stageCondition: {
    color: '#E6F7FF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  stageInfoLabel: {
    color: '#9aa9b8',
    fontWeight: '600',
  },
  activitiesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  activitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activitiesTitle: {
    color: '#E6F7FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 4,
  },
  activityBullet: {
    marginRight: 12,
    marginTop: 2,
  },
  activityText: {
    color: '#E6F7FF',
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
});

