import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import HomeScreen from '../screens/HomeScreen';
import CropScreen from '../screens/CropScreen';
import MarketScreen from '../screens/MarketScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DiseaseDetectionScreen from '../screens/DiseaseDetectionScreen';
import PestDetectionScreen from '../screens/PestDetectionScreen';
import ProfitLossScreen from '../screens/ProfitLossScreen';
import ChatAssistantWebScreen from '../screens/ChatAssistantWebScreen';
import WeatherScreen from '../screens/WeatherScreen';
import VoiceAssistantScreen from '../screens/VoiceAssistantScreen';
import VoiceAssistantWebScreen from '../screens/VoiceAssistantWebScreen';
import CalendarScreen from '../screens/CalendarScreen';
import LearnFarmerCourseScreen from '../screens/LearnFarmerCourseScreen';
import AIFarmingScreen from '../screens/AIFarmingScreen';
import SoilTestScreen from '../screens/SoilTestScreen';
import FertilizerScreen from '../screens/FertilizerScreen';
import GovernmentSchemaScreen from '../screens/GovernmentSchemaScreen';
import AISmartHelplineScreen from '../screens/AISmartHelplineScreen';
import YieldPredictionScreen from '../screens/YieldPredictionScreen';
import SmartMappingScreen from '../screens/SmartMappingScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import AboutScreen from '../screens/AboutScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import AuthNavigator from './AuthNavigator';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38BDF8', // bright blue
        tabBarInactiveTintColor: '#94A3B8', // muted blue/gray
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 0,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
          elevation: 10,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Crop"
        component={CropScreen}
        options={{
          tabBarLabel: t('tabs.crop'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{
          tabBarLabel: t('tabs.market'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarLabel: t('tabs.community'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator that handles authentication
const RootStack = createStackNavigator();

export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status - switch to main app after login + farmer info
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const farmerName = await AsyncStorage.getItem('farmerName');
        // User is authenticated if they have both userId and farmerName
        // This allows switching to main app after successful login + farmer info entry
        setIsAuthenticated(!!(userId && farmerName));
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      }
    };

    // Check immediately and then every 2 seconds
    // This allows the app to switch to main app after user completes login + farmer info
    checkAuth();
    const interval = setInterval(checkAuth, 2000);
    return () => clearInterval(interval);
  }, []);

  // Show main app only after user has logged in AND entered farmer info
  // Otherwise, always show login screen (no auto-login)
  if (isAuthenticated) {
    return <MainAppStack />;
  }

  // Always start with login screen - user must authenticate every time
  return <AuthNavigator />;
}

// Main App Stack (existing app screens)
function MainAppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MainTabs">
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="DiseaseDetection" component={DiseaseDetectionScreen} />
      <Stack.Screen name="PestDetection" component={PestDetectionScreen} />
      <Stack.Screen name="ProfitLoss" component={ProfitLossScreen} />
      <Stack.Screen name="ChatAssistant" component={ChatAssistantWebScreen} />
      <Stack.Screen name="Weather" component={WeatherScreen} />
      <Stack.Screen name="VoiceAssistant" component={VoiceAssistantScreen} />
      <Stack.Screen name="VoiceAssistantWeb" component={VoiceAssistantWebScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="LearnFarmerCourse" component={LearnFarmerCourseScreen} />
      <Stack.Screen name="AIFarming" component={AIFarmingScreen} />
      <Stack.Screen name="SoilTest" component={SoilTestScreen} />
      <Stack.Screen name="Fertilizer" component={FertilizerScreen} />
      <Stack.Screen name="GovernmentSchema" component={GovernmentSchemaScreen} />
      <Stack.Screen name="AISmartHelpline" component={AISmartHelplineScreen} />
      <Stack.Screen name="YieldPrediction" component={YieldPredictionScreen} />
  <Stack.Screen name="SmartMapping" component={SmartMappingScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
