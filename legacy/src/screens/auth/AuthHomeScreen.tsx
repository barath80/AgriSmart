import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { auth } from '../../config/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

type AuthHomeScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'AuthHome'
>;

type AuthHomeScreenRouteProp = RouteProp<AuthStackParamList, 'AuthHome'>;

interface Props {
  navigation: AuthHomeScreenNavigationProp;
  route: AuthHomeScreenRouteProp;
}

export default function AuthHomeScreen({ navigation }: Props) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [authType, setAuthType] = useState<'phone' | 'gmail' | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load user information
   */
  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedAuthType = await AsyncStorage.getItem('authType');
      const storedPhone = await AsyncStorage.getItem('phoneNumber');
      const storedEmail = await AsyncStorage.getItem('email');
      const storedName = await AsyncStorage.getItem('farmerName');

      if (storedAuthType) {
        setAuthType(storedAuthType as 'phone' | 'gmail');
      }

      if (storedName) {
        setUserName(storedName);
      } else if (storedEmail) {
        setUserEmail(storedEmail);
      } else if (storedPhone) {
        setUserEmail(storedPhone);
      }

      // If we have a userId, try to fetch farmer info from Supabase
      if (storedUserId) {
        const { data, error } = await supabase
          .from("Farmer's info")
          .select('"Name"')
          .eq('"ID"', parseInt(storedUserId))
          .single();

        if (data && data['Name']) {
          setUserName(data['Name']);
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage
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
              if (authType === 'gmail' && auth.currentUser) {
                await firebaseSignOut(auth);
              }

              // Clear AsyncStorage will cause AppNavigator to automatically
              // switch back to AuthNavigator (login screen) within 2 seconds
              // No need to navigate manually - the auth check will handle it
              console.log('Logout successful. App will return to login screen.');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const displayName = userName || userEmail || 'User';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#071840'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.welcomeSection}>
            <Ionicons name="leaf" size={32} color="#E6F7FF" />
            <Text style={styles.title}>Welcome!</Text>
            <Text style={styles.welcomeText}>
              Welcome, {displayName}!
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons
            name={authType === 'gmail' ? 'mail' : 'call'}
            size={48}
            color="#22c55e"
          />
          <Text style={styles.infoText}>
            You are logged in via {authType === 'gmail' ? 'Gmail' : 'Phone Number'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Text style={styles.noteText}>
            You are successfully logged in!{'\n'}
            The app will automatically switch to the main application.
          </Text>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Ionicons name="log-out" size={20} color="#ffffff" />
              <Text style={styles.buttonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  welcomeSection: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 18,
    color: '#9FD3FF',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  infoCard: {
    alignItems: 'center',
    backgroundColor: '#071837',
    borderRadius: 16,
    padding: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  infoText: {
    fontSize: 16,
    color: '#9FD3FF',
    textAlign: 'center',
    marginTop: 16,
  },
  logoutButton: {
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
});

