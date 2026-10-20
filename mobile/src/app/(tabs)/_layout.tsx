import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useProfile } from '@/api/hooks';
import { ErrorState, Loading } from '@/components/ui';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { colors, type } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const profile = useProfile();
  usePushRegistration(Boolean(profile.data?.profile_complete));

  if (profile.isPending) return <Loading />;
  if (profile.error) return <ErrorState code={(profile.error as { code?: string }).code ?? 'generic'} onRetry={() => profile.refetch()} />;
  if (!profile.data.profile_complete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { ...type.caption, fontWeight: '600' },
        tabBarStyle: { height: 72, paddingTop: 6, paddingBottom: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="microphone" size={30} color={color} /> }}
      />
      <Tabs.Screen
        name="farm"
        options={{ title: t('tabs.farm'), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="sprout" size={30} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account" size={30} color={color} /> }}
      />
    </Tabs>
  );
}
