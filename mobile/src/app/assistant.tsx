import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/auth/session';
import { AppText, Notice, Screen, useErrorText } from '@/components/ui';
import { colors, radius, spacing, touch, type } from '@/theme';
import { type Message, useConversation } from '@/voice/conversation';
import { speak } from '@/voice/speech';

/** Text conversation (and history of voice turns) with AgriBrain. */
export default function Assistant() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { language } = useSession();
  const { messages, phase, errorCode, ask, pressMic } = useConversation();
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<Message>>(null);

  const send = (text: string) => {
    setDraft('');
    void ask(text);
  };

  const examples = [t('assistant.example1'), t('assistant.example2'), t('assistant.example3')];

  return (
    <Screen title={t('assistant.title')} scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ gap: spacing.md }}>
              <AppText muted>{t('assistant.empty')}</AppText>
              {examples.map((example) => (
                <Pressable key={example} onPress={() => send(example)} style={styles.example} accessibilityRole="button">
                  <AppText style={{ color: colors.primary }}>{example}</AppText>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'farmer' ? styles.farmer : styles.assistant]}>
              <AppText style={{ color: item.role === 'farmer' ? colors.primaryText : colors.text }}>{item.text}</AppText>
              {item.role === 'assistant' ? (
                <Pressable
                  onPress={() => speak(item.text, language, item.reply?.audio_base64 ?? null, () => undefined)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.listen')}
                  style={styles.listen}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="volume-high" size={22} color={colors.primary} />
                  <AppText variant="caption" style={{ color: colors.primary }}>{t('common.listen')}</AppText>
                </Pressable>
              ) : null}
            </View>
          )}
        />
        {phase === 'thinking' ? <AppText muted>{t('home.thinking')}</AppText> : null}
        {errorCode ? <Notice tone="danger">{errorText(errorCode)}</Notice> : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={1000}
            accessibilityLabel={t('assistant.placeholder')}
            onKeyPress={(event) => {
              // Web keyboards: Enter sends, Shift+Enter adds a line — as in any chat app.
              const { key, shiftKey } = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean };
              if (Platform.OS === 'web' && key === 'Enter' && !shiftKey) {
                event.preventDefault();
                if (draft.trim()) send(draft);
              }
            }}
          />
          {draft.trim() ? (
            <Pressable onPress={() => send(draft)} style={styles.round} accessibilityRole="button" accessibilityLabel={t('assistant.send')}>
              <MaterialCommunityIcons name="send" size={28} color={colors.primaryText} />
            </Pressable>
          ) : (
            <Pressable
              onPress={pressMic}
              style={[styles.round, phase === 'listening' && { backgroundColor: colors.danger }]}
              accessibilityRole="button"
              accessibilityLabel={phase === 'listening' ? t('home.listening') : t('home.tapToSpeak')}
            >
              <MaterialCommunityIcons name={phase === 'listening' ? 'stop' : 'microphone'} size={28} color={colors.primaryText} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '88%', padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs },
  farmer: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  assistant: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  listen: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', minHeight: 36 },
  example: { padding: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm },
  input: {
    flex: 1,
    minHeight: touch.min,
    maxHeight: 140,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    color: colors.text,
    ...type.body,
  },
  round: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
