import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { Phase } from '@/voice/conversation';

import { AppText } from './ui';

const SIZE = 168;

/** The one control a farmer needs: tap to talk, tap to stop. State is shown by
 *  icon, colour, motion and words, so it works for every ability and literacy level. */
export function MicButton({ phase, onPress }: { phase: Phase; onPress: () => void }) {
  const { t } = useTranslation();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const label = {
    idle: t('home.tapToSpeak'),
    listening: t('home.listening'),
    thinking: t('home.thinking'),
    speaking: t('home.speaking'),
  }[phase];
  const background = phase === 'listening' ? colors.danger : phase === 'idle' ? colors.primary : colors.accent;
  const icon = phase === 'listening' ? 'stop' : phase === 'speaking' ? 'volume-high' : 'microphone';

  return (
    <View style={styles.wrapper}>
      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              backgroundColor: background,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
            },
          ]}
        />
        <Pressable
          onPress={onPress}
          disabled={phase === 'thinking'}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy: phase === 'thinking' }}
          style={({ pressed }) => [styles.button, { backgroundColor: background, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          {phase === 'thinking' ? (
            <ActivityIndicator size="large" color={colors.accentText} />
          ) : (
            <MaterialCommunityIcons
              name={icon}
              size={84}
              color={phase === 'idle' || phase === 'listening' ? colors.primaryText : colors.accentText}
            />
          )}
        </Pressable>
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  stage: { width: SIZE * 1.5, height: SIZE * 1.5, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: radius.round },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
