import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginSelectionScreen from '../screens/auth/LoginSelectionScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import GmailLoginScreen from '../screens/auth/GmailLoginScreen';
import FarmerInfoScreen from '../screens/auth/FarmerInfoScreen';
import AuthHomeScreen from '../screens/auth/AuthHomeScreen';

export type AuthStackParamList = {
  LoginSelection: undefined;
  PhoneLogin: undefined;
  GmailLogin: undefined;
  FarmerInfo: { userId: number; authType: 'phone' | 'gmail' };
  AuthHome: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, next, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
      initialRouteName="LoginSelection"
    >
      <Stack.Screen name="LoginSelection" component={LoginSelectionScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="GmailLogin" component={GmailLoginScreen} />
      <Stack.Screen name="FarmerInfo" component={FarmerInfoScreen} />
      <Stack.Screen name="AuthHome" component={AuthHomeScreen} />
    </Stack.Navigator>
  );
}

