import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useMarkSupportRead, useSendSupport, useSupport } from '@/api/hooks';
import type { SupportMessage } from '@/api/types';
import { AppText, ErrorState, Loading, Notice, Screen, useErrorText } from '@/components/ui';
import { shortDate } from '@/format';
import { colors, radius, spacing, touch, type } from '@/theme';

/** A private conversation with the AgriSmart team. Replies from the admin appear here. */
export default function Support() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const thread = useSupport();
  const send = useSendSupport();
  const markRead = useMarkSupportRead();
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<SupportMessage>>(null);
  const unread = thread.data?.unread ?? 0;

  // Opening the screen is what "reads" the team's replies.
  useEffect(() => {
    if (unread > 0 && !markRead.isPending) markRead.mutate();
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  if (thread.isPending) return <Screen title={t('support.title')}><Loading /></Screen>;
  if (thread.error) {
    const code = thread.error instanceof ApiError ? thread.error.code : 'generic';
    return <Screen title={t('support.title')}><ErrorState code={code} onRetry={() => thread.refetch()} /></Screen>;
  }

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate(body, { onError: () => setDraft(body) });
  };

  return (
    <Screen title={t('support.title')} scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={thread.data.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<AppText muted>{t('support.intro')}</AppText>}
          renderItem={({ item }) => {
            const mine = item.sender === 'farmer';
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.team]}>
                <AppText variant="caption" style={{ color: mine ? colors.primaryText : colors.textMuted }}>
                  {mine ? t('support.you') : t('support.team')} · {shortDate(item.created_at)}
                </AppText>
                <AppText style={{ color: mine ? colors.primaryText : colors.text }}>{item.body}</AppText>
              </View>
            );
          }}
        />
        {send.error ? <Notice tone="danger">{errorText(send.error instanceof ApiError ? send.error.code : 'generic')}</Notice> : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('support.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            accessibilityLabel={t('support.placeholder')}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || send.isPending}
            style={[styles.round, (!draft.trim() || send.isPending) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={t('support.send')}
          >
            <MaterialCommunityIcons name="send" size={28} color={colors.primaryText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '88%', padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  team: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
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
