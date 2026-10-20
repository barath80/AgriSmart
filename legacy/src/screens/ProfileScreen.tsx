import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Card from "../components/Card";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { auth } from "../config/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import LanguageSelector from "../components/LanguageSelector";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userState, setUserState] = useState("");
  const [userCity, setUserCity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Load from AsyncStorage first
      const storedName = await AsyncStorage.getItem('farmerName');
      const storedEmail = await AsyncStorage.getItem('email');
      const storedPhone = await AsyncStorage.getItem('phoneNumber');
      const storedState = await AsyncStorage.getItem('farmerState');
      const storedCity = await AsyncStorage.getItem('farmerCity');
      const storedUserId = await AsyncStorage.getItem('userId');

      if (storedName) setUserName(storedName);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedPhone) setUserPhone(storedPhone);
      if (storedState) setUserState(storedState);
      if (storedCity) setUserCity(storedCity);

      // If we have userId but missing data, fetch from Supabase
      if (storedUserId && (!storedName || !storedState || !storedCity)) {
        const { data: farmerData, error } = await supabase
          .from("Farmer's info")
          .select('"Name", "State", "City"')
          .eq('"ID"', parseInt(storedUserId))
          .maybeSingle();

        if (farmerData) {
          setUserName(farmerData['Name'] || '');
          setUserState(farmerData['State'] || '');
          setUserCity(farmerData['City'] || '');
          
          // Update AsyncStorage
          if (farmerData['Name']) await AsyncStorage.setItem('farmerName', farmerData['Name']);
          if (farmerData['State']) await AsyncStorage.setItem('farmerState', farmerData['State']);
          if (farmerData['City']) await AsyncStorage.setItem('farmerCity', farmerData['City']);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    if (userName) {
      const names = userName.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return userName.substring(0, 2).toUpperCase();
    }
    return 'FM';
  };

  const displayEmail = userEmail || userPhone || 'farmer@email.com';

  const handleHelpSupport = () => {
    navigation.navigate('HelpSupport');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logout'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Get auth type before clearing
              const storedAuthType = await AsyncStorage.getItem('authType');

              // Clear all AsyncStorage data
              await AsyncStorage.multiRemove([
                'userId',
                'authType',
                'phoneNumber',
                'email',
                'farmerName',
                'farmerState',
                'farmerCity',
              ]);

              // Sign out from Firebase if Gmail login
              if (storedAuthType === 'gmail' && auth.currentUser) {
                try {
                  await firebaseSignOut(auth);
                } catch (firebaseError) {
                  console.error('Firebase sign out error:', firebaseError);
                  // Continue with logout even if Firebase sign out fails
                }
              }

              // The AppNavigator will automatically detect the cleared AsyncStorage
              // and switch back to AuthNavigator (login screen) within 2 seconds
              console.log('Logout successful. App will return to login screen.');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('common.error'), t('common.error'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.userName}>{userName || t('profile.name')}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
          {(userState || userCity) && (
            <Text style={styles.userLocation}>
              {userCity && userState ? `${userCity}, ${userState}` : userState || userCity}
            </Text>
          )}
        </View>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

        <View style={styles.settingItem}>
          <Ionicons name="language" size={24} color="#22c55e" />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('profile.language')}</Text>
            <LanguageSelector />
          </View>
        </View>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications" size={24} color="#3b82f6" />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('profile.notifications')}</Text>
            <Switch
              trackColor={{ false: "#d1d5db", true: "#22c55e" }}
              thumbColor="#ffffff"
              value={true}
            />
          </View>
        </TouchableOpacity>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('common.select')}</Text>

        {[
          { icon: "help-circle", label: t('profile.helpSupport'), color: "#8b5cf6", onPress: handleHelpSupport },
          { icon: "information-circle", label: t('profile.about'), color: "#6b7280", onPress: handleAbout },
          {
            icon: "shield-checkmark",
            label: t('profile.privacyPolicy'),
            color: "#10b981",
            onPress: handlePrivacyPolicy,
          },
          { icon: "log-out", label: t('profile.logout'), color: "#ef4444", onPress: handleLogout },
        ].map((item, index) => (
          <TouchableOpacity key={index} style={styles.linkItem} onPress={item.onPress}>
            <Ionicons name={item.icon as any} size={24} color={item.color} />
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
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
    backgroundColor: '#071837',
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0b6b3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e6f7ff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#9aa9b8',
    marginBottom: 4,
  },
  userLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  settingContent: {
    flex: 1,
    marginLeft: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#e6f7ff',
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  langBtnActive: {
    backgroundColor: '#11324a',
    borderColor: '#38bdf8',
  },
  langBtnText: {
    fontSize: 14,
    color: '#9aa9b8',
    fontWeight: '500',
  },
  langBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#11324a',
  },
  linkLabel: {
    flex: 1,
    fontSize: 16,
    color: '#e6f7ff',
    marginLeft: 16,
  },
});
