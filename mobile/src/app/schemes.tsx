import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable } from 'react-native';

import { ApiError } from '@/api/client';
import { useSchemes } from '@/api/hooks';
import type { SchemeEligibility } from '@/api/types';
import { AppText, Button, Card, ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { shortDate } from '@/format';
import { colors } from '@/theme';

/** Schemes the farmer may qualify for, decided by deterministic rules — not by an AI guess. */
export default function Schemes() {
  const { t } = useTranslation();
  const schemes = useSchemes();

  if (schemes.isPending) return <Screen title={t('schemes.title')}><Loading /></Screen>;
  if (schemes.error) {
    const code = schemes.error instanceof ApiError ? schemes.error.code : 'generic';
    return <Screen title={t('schemes.title')}><ErrorState code={code} onRetry={() => schemes.refetch()} /></Screen>;
  }

  return (
    <Screen title={t('schemes.title')}>
      {schemes.data.length === 0 ? <Notice>{t('schemes.empty')}</Notice> : null}
      {schemes.data.some((s) => !s.scheme.translated) ? <Notice>{t('schemes.notTranslated')}</Notice> : null}
      {schemes.data.map((item) => (
        <SchemeCard key={item.scheme.id} item={item} />
      ))}
    </Screen>
  );
}

function SchemeCard({ item }: { item: SchemeEligibility }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { scheme, status, missing_facts } = item;
  const eligible = status === 'eligible';

  return (
    <Card>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <AppText variant="title" style={{ flex: 1 }}>{scheme.name}</AppText>
        </Row>
        <AppText variant="bodyStrong" style={{ color: eligible ? colors.success : colors.warning }}>
          {eligible ? `✓ ${t('schemes.eligible')}` : t('schemes.maybe')}
        </AppText>
        <AppText>{scheme.summary}</AppText>
      </Pressable>
      {missing_facts.length ? (
        <Notice tone="warning">
          {t('schemes.missing', { facts: missing_facts.map((f) => t(`schemes.fact.${f}`, { defaultValue: f })).join(', ') })}
        </Notice>
      ) : null}
      {open ? (
        <>
          <AppText variant="bodyStrong">{t('schemes.benefits')}</AppText>
          <AppText>{scheme.benefits}</AppText>
          <AppText variant="bodyStrong">{t('schemes.whoCanApply')}</AppText>
          <AppText>{scheme.eligibility_text}</AppText>
          <AppText variant="bodyStrong">{t('schemes.howToApply')}</AppText>
          <AppText>{scheme.application_process}</AppText>
          <AppText variant="caption" muted>{t('schemes.verifiedOn', { date: shortDate(scheme.last_verified_on) })}</AppText>
        </>
      ) : null}
      <Button label={t('schemes.officialSite')} icon="open-in-new" variant="secondary"
              onPress={() => Linking.openURL(scheme.official_url)} />
    </Card>
  );
}
