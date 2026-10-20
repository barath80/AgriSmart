import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useDiagnosis } from '@/api/hooks';
import type { Diagnosis } from '@/api/types';
import { useSession } from '@/auth/session';
import { AppText, Button, Card, Loading, Notice, Row, Screen, useErrorText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { speak, stopSpeaking } from '@/voice/speech';

const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Photo → classifier → reviewed knowledge. The answer is read aloud automatically. */
export default function Diagnose() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { language } = useSession();
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const kind = kindParam === 'pest' ? 'pest' : 'disease';
  const diagnosis = useDiagnosis();
  const [photo, setPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => () => void stopSpeaking(), []);

  async function pick(source: 'camera' | 'gallery') {
    setPermissionDenied(false);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        return;
      }
    }
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const picked = { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
    setPhoto(picked);
    // One id per photo: if the upload is retried, the server replays instead of re-running.
    const outcome = await diagnosis.mutateAsync({ ...picked, kind, requestId: newRequestId() }).catch(() => null);
    if (outcome) void speak(outcome.summary, language, null, () => undefined);
  }

  const result = diagnosis.data;
  const errorCode = diagnosis.error instanceof ApiError ? diagnosis.error.code : diagnosis.error ? 'generic' : null;

  return (
    <Screen title={kind === 'pest' ? t('diagnose.pestTitle') : t('diagnose.diseaseTitle')}>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityIgnoresInvertColors /> : (
        <View style={styles.placeholder}>
          <MaterialCommunityIcons name={kind === 'pest' ? 'bug-outline' : 'leaf'} size={96} color={colors.primary} />
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {kind === 'pest' ? t('diagnose.pestIntro') : t('diagnose.diseaseIntro')}
          </AppText>
        </View>
      )}

      {diagnosis.isPending ? <Loading label={t('diagnose.checking')} /> : null}
      {errorCode ? <Notice tone="danger">{errorText(errorCode)}</Notice> : null}
      {permissionDenied ? <Notice tone="warning">{t('diagnose.cameraPermission')}</Notice> : null}
      {result ? <Result result={result} /> : null}

      <Button label={result ? t('diagnose.retake') : t('diagnose.camera')} icon="camera" onPress={() => pick('camera')}
              disabled={diagnosis.isPending} />
      <Button label={t('diagnose.gallery')} icon="image-outline" variant="secondary" onPress={() => pick('gallery')}
              disabled={diagnosis.isPending} />
    </Screen>
  );
}

function Result({ result }: { result: Diagnosis }) {
  const { t } = useTranslation();
  const { language } = useSession();
  const confidence = Math.round(result.confidence * 100);
  const headline = !result.accepted
    ? t('diagnose.uncertain')
    : result.is_healthy
      ? result.kind === 'pest' ? t('diagnose.beneficial') : t('diagnose.healthy')
      : result.name;
  const tone = !result.accepted ? colors.warning : result.is_healthy ? colors.success : colors.danger;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="headline" style={{ color: tone }}>{headline}</AppText>
            {result.accepted && result.is_healthy ? <AppText variant="title">{result.name}</AppText> : null}
            <AppText muted>{t('diagnose.confidence', { value: confidence })}</AppText>
          </View>
          <Button label={t('common.listen')} icon="volume-high" variant="ghost"
                  onPress={() => speak(result.summary, language, null, () => undefined)} />
        </Row>
        <AppText>{result.summary}</AppText>
      </Card>

      {result.accepted && !result.expert_verified && !result.is_healthy ? <Notice tone="warning">{t('diagnose.unverified')}</Notice> : null}
      {!result.translated ? <Notice>{t('diagnose.notTranslated')}</Notice> : null}

      {result.sections.map((section) => (
        <Card key={section.key} tone={section.key === 'safety_warnings' ? 'muted' : 'surface'}>
          <AppText variant="title">{t(`diagnose.section.${section.key}`)}</AppText>
          {section.items.map((item) => (
            <Row key={item} style={{ alignItems: 'flex-start' }}>
              <AppText style={{ color: colors.primary }}>•</AppText>
              <AppText style={{ flex: 1 }}>{item}</AppText>
            </Row>
          ))}
        </Card>
      ))}

      {result.candidates.length > 1 ? (
        <Card tone="muted">
          <AppText variant="bodyStrong">{t('diagnose.otherPossibilities')}</AppText>
          {result.candidates.slice(1).map((candidate) => (
            <AppText key={candidate.label} muted>
              {candidate.name} — {t('diagnose.confidence', { value: Math.round(candidate.confidence * 100) })}
            </AppText>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  placeholder: {
    aspectRatio: 1.3,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
});
