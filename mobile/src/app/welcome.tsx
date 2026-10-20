import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session';
import { AppText, Screen } from '@/components/ui';
import { LANGUAGES } from '@/i18n';
import { colors, radius, shadow, spacing, touch } from '@/theme';

/** First screen. Language names are shown in their own script so anyone can find theirs. */
export default function Welcome() {
  const { t } = useTranslation();
  const { chooseLanguage, language } = useSession();

  return (
    <Screen back={false}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="sprout" size={64} color={colors.primary} />
        <AppText variant="display" style={{ color: colors.primary }}>AgriSmart</AppText>
        <AppText variant="title" style={{ textAlign: 'center' }}>{t('welcome.title')}</AppText>
      </View>
      <View style={styles.grid}>
        {LANGUAGES.map((option) => (
          <Pressable
            key={option.code}
            onPress={() => chooseLanguage(option.code)}
            accessibilityRole="button"
            accessibilityLabel={`${option.nativeName}, ${option.englishName}`}
            style={({ pressed }) => [
              styles.tile,
              option.code === language && styles.tileSuggested,
              pressed && { opacity: 0.8 },
            ]}
          >
            <AppText variant="headline">{option.nativeName}</AppText>
            <AppText muted>{option.englishName}</AppText>
          </Pressable>
        ))}
      </View>
      <AppText muted style={{ textAlign: 'center' }}>{t('welcome.subtitle')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: touch.large + 32,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow,
  },
  tileSuggested: { borderColor: colors.primary },
});
