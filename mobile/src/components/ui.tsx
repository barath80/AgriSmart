import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, touch, type } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// --- Text --------------------------------------------------------------------------------

type Variant = keyof typeof type;

export function AppText({ variant = 'body', muted, style, ...props }: TextProps & { variant?: Variant; muted?: boolean }) {
  return <Text {...props} style={[type[variant], { color: muted ? colors.textMuted : colors.text }, style]} />;
}

// --- Layout ------------------------------------------------------------------------------

interface ScreenProps {
  title?: string;
  back?: boolean;
  scroll?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function Screen({ title, back = true, scroll = true, children, footer }: ScreenProps) {
  const { t } = useTranslation();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {title ? (
        <View style={styles.header}>
          {back && router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.backButton}
              hitSlop={12}
            >
              <MaterialCommunityIcons name="arrow-left" size={30} color={colors.text} />
            </Pressable>
          ) : null}
          <AppText variant="headline" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </AppText>
        </View>
      ) : null}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: ViewStyle; tone?: 'surface' | 'muted' }) {
  return (
    <View style={[styles.card, tone === 'muted' && { backgroundColor: colors.surfaceMuted, ...noShadow }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, gap = spacing.sm, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// --- Actions -----------------------------------------------------------------------------

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, icon, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={26} color={palette.fg} /> : null}
          <Text style={[type.bodyStrong, { color: palette.fg, textAlign: 'center' }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Tile({ label, icon, onPress, color = colors.primary }: { label: string; icon: IconName; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${color}1A` }]}>
        <MaterialCommunityIcons name={icon} size={34} color={color} />
      </View>
      <AppText variant="bodyStrong" style={{ textAlign: 'center' }} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            {selected ? <MaterialCommunityIcons name="check" size={20} color={colors.primaryText} /> : null}
            <Text style={[type.body, { color: selected ? colors.primaryText : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Forms -------------------------------------------------------------------------------

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.style]}
      />
      {hint ? <AppText variant="caption" muted>{hint}</AppText> : null}
    </View>
  );
}

// --- Feedback ----------------------------------------------------------------------------

const tones = {
  info: { bg: colors.infoSurface, fg: colors.info, icon: 'information-outline' as IconName },
  warning: { bg: colors.warningSurface, fg: colors.warning, icon: 'alert-outline' as IconName },
  danger: { bg: colors.dangerSurface, fg: colors.danger, icon: 'alert-circle-outline' as IconName },
  success: { bg: colors.successSurface, fg: colors.success, icon: 'check-circle-outline' as IconName },
};

export function Notice({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const palette = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityRole="alert">
      <MaterialCommunityIcons name={palette.icon} size={24} color={palette.fg} />
      <AppText style={{ flex: 1, color: palette.fg }}>{children}</AppText>
    </View>
  );
}

/** Translates an API error code; unknown codes fall back to a generic message. */
export function useErrorText() {
  const { t } = useTranslation();
  return (code: string | null | undefined) => {
    if (!code) return null;
    if (code === 'mic_permission') return t('home.micPermission');
    return t(`errors.${code}`, { defaultValue: t('errors.generic') });
  };
}

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText muted>{label ?? t('common.loading')}</AppText>
    </View>
  );
}

export function ErrorState({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  return (
    <View style={[styles.centered, { gap: spacing.md }]}>
      <Notice tone="danger">{errorText(code)}</Notice>
      {onRetry ? <Button label={t('common.retry')} icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const noShadow = { shadowOpacity: 0, elevation: 0 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...shadow },
  button: {
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 124,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadow,
  },
  tileIcon: { width: 60, height: 60, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: touch.min - 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    minHeight: touch.min,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...type.body,
  },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
});
