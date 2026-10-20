import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ApiError, api } from '@/api/client';
import type { TokenPair } from '@/api/types';
import { useSession } from '@/auth/session';
import { AppText, Button, Field, Notice, Screen, useErrorText } from '@/components/ui';
import { config, saveServerAddress } from '@/config';
import { colors, spacing } from '@/theme';

type Method = 'phone' | 'email';
/** signIn and create use a password; code and reset use a one-time code (SMS or e-mail). */
type Mode = 'signIn' | 'create' | 'code' | 'reset';
type Offered = Record<Method, boolean> & { password: boolean };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

/**
 * Farmers sign in with a password stored (hashed) on the server, so the same number or e-mail
 * and password work on the phone app and on the web. A one-time code is optional: it is used for
 * "forgot password" and for accounts made before passwords existed. No paid service is needed.
 */
export default function Login() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { signIn, language } = useSession();
  const [mode, setMode] = useState<Mode>('signIn');
  const [method, setMethod] = useState<Method>('phone');
  const [offered, setOffered] = useState<Offered>({ phone: true, email: true, password: true });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(config.apiUrl);

  const digits = phone.replace(/\D/g, '').slice(-10);
  const address = email.trim().toLowerCase();
  const identity = method === 'phone' ? { phone: digits } : { email: address };
  const identityReady = method === 'phone' ? digits.length === 10 : EMAIL_PATTERN.test(address);
  const passwordReady = password.length >= MIN_PASSWORD;
  const canUseCodes = offered.phone || offered.email;

  // Offer only what this server supports (codes need an SMS or e-mail service; passwords do not).
  useEffect(() => {
    api<Offered>('/auth/methods', { auth: false })
      .then((methods) => {
        setOffered({ ...methods, password: methods.password !== false });
        setMethod((current) => (methods[current] ? current : methods.phone ? 'phone' : methods.email ? 'email' : current));
      })
      .catch(() => undefined);
  }, [server]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'generic');
    } finally {
      setBusy(false);
    }
  }

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setCode('');
    setCodeSent(false);
    setDevCode(null);
  };

  const submitSignIn = () =>
    run(async () => {
      await signIn(await api<TokenPair>('/auth/password-login', { method: 'POST', body: { ...identity, password }, auth: false }));
    });

  const submitCreate = () =>
    run(async () => {
      if (password !== confirm) throw new ApiError('password_mismatch', '', 0);
      await signIn(
        await api<TokenPair>('/auth/register', {
          method: 'POST',
          body: { ...identity, password, name: name.trim(), language },
          auth: false,
        }),
      );
    });

  const requestCode = () =>
    run(async () => {
      const result = await api<{ dev_otp: string | null }>('/auth/otp', { method: 'POST', body: identity, auth: false });
      setDevCode(result.dev_otp);
      setCodeSent(true);
    });

  const submitCode = () =>
    run(async () => {
      await signIn(await api<TokenPair>('/auth/login', { method: 'POST', body: { ...identity, otp: code, language }, auth: false }));
    });

  const submitReset = () =>
    run(async () => {
      await signIn(
        await api<TokenPair>('/auth/password-reset', {
          method: 'POST',
          body: { ...identity, otp: code, new_password: password },
          auth: false,
        }),
      );
    });

  const applyServer = () =>
    run(async () => {
      setServer(await saveServerAddress(server));
    });

  const passwordMode = mode === 'signIn' || mode === 'create';
  const title =
    mode === 'create'
      ? t('login.tabCreate')
      : mode === 'signIn'
        ? t('login.tabSignIn')
        : mode === 'reset'
          ? t('login.resetButton')
          : t('login.codeTitle');
  const subtitle =
    mode === 'create'
      ? t('login.createSubtitle')
      : mode === 'signIn'
        ? t('login.signInSubtitle')
        : codeSent
          ? method === 'phone'
            ? t('login.codeSent', { phone: `+91 ${digits}` })
            : t('login.codeSentEmail', { email: address })
          : method === 'phone'
            ? t('login.noPassword')
            : t('login.noPasswordEmail');

  const identityField =
    method === 'phone' ? (
      <Field
        label={t('login.phone')}
        placeholder={t('login.phonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={14}
        value={phone}
        onChangeText={setPhone}
        editable={!codeSent}
        style={{ fontSize: 22, letterSpacing: 1 }}
      />
    ) : (
      <Field
        label={t('login.email')}
        placeholder={t('login.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={120}
        value={email}
        onChangeText={setEmail}
        editable={!codeSent}
      />
    );

  const methodSwitch =
    offered.phone && offered.email ? (
      <Button
        label={method === 'phone' ? t('login.useEmail') : t('login.usePhone')}
        variant="ghost"
        onPress={() => {
          setMethod(method === 'phone' ? 'email' : 'phone');
          setError(null);
        }}
      />
    ) : null;

  return (
    <Screen back={false}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <MaterialCommunityIcons name={passwordMode ? 'shield-lock-outline' : 'message-lock-outline'} size={56} color={colors.primary} />
        <AppText variant="headline" style={{ textAlign: 'center' }}>{title}</AppText>
        <AppText muted style={{ textAlign: 'center' }}>{subtitle}</AppText>
      </View>

      {passwordMode ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label={t('login.tabSignIn')} variant={mode === 'signIn' ? 'primary' : 'secondary'} onPress={() => go('signIn')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('login.tabCreate')} variant={mode === 'create' ? 'primary' : 'secondary'} onPress={() => go('create')} />
          </View>
        </View>
      ) : null}

      {identityField}

      {mode === 'create' ? (
        <>
          <Field label={t('login.yourName')} autoComplete="name" textContentType="name" maxLength={120} value={name} onChangeText={setName} />
          <Field
            label={t('login.password')}
            hint={t('login.passwordHint')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={128}
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label={t('login.confirmPassword')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={128}
            value={confirm}
            onChangeText={setConfirm}
          />
          {confirm.length > 0 && confirm !== password ? <Notice tone="warning">{t('login.passwordMismatch')}</Notice> : null}
          {error ? <Notice tone="danger">{error === 'password_mismatch' ? t('login.passwordMismatch') : errorText(error)}</Notice> : null}
          <Button
            label={t('login.createButton')}
            icon="account-plus"
            onPress={submitCreate}
            loading={busy}
            disabled={!identityReady || !passwordReady || confirm !== password}
          />
        </>
      ) : null}

      {mode === 'signIn' ? (
        <>
          <Field
            label={t('login.password')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            maxLength={128}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={identityReady && password.length > 0 ? submitSignIn : undefined}
          />
          {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
          <Button label={t('login.signInButton')} icon="login" onPress={submitSignIn} loading={busy} disabled={!identityReady || password.length === 0} />
          {canUseCodes ? <Button label={t('login.forgot')} variant="ghost" onPress={() => go('reset')} /> : null}
          {canUseCodes ? <Button label={t('login.useCode')} variant="ghost" onPress={() => go('code')} /> : null}
        </>
      ) : null}

      {mode === 'code' || mode === 'reset' ? (
        <>
          {!codeSent ? (
            <>
              {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
              <Button label={t('login.sendCode')} icon="send" onPress={requestCode} loading={busy} disabled={!identityReady} />
            </>
          ) : (
            <>
              <Field
                label={t('login.codeTitle')}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
                style={{ fontSize: 28, letterSpacing: 10, textAlign: 'center' }}
                autoFocus
              />
              {devCode ? <Notice>{t('login.devCode', { code: devCode })}</Notice> : null}
              {mode === 'reset' ? (
                <Field
                  label={t('login.newPassword')}
                  hint={t('login.passwordHint')}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={128}
                  value={password}
                  onChangeText={setPassword}
                />
              ) : null}
              {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
              <Button
                label={mode === 'reset' ? t('login.resetButton') : t('login.verify')}
                icon="check"
                onPress={mode === 'reset' ? submitReset : submitCode}
                loading={busy}
                disabled={code.length !== 6 || (mode === 'reset' && !passwordReady)}
              />
              <Button label={t('login.resend')} variant="ghost" onPress={requestCode} disabled={busy} />
            </>
          )}
          {methodSwitch}
          <Button label={t('login.usePassword')} variant="ghost" onPress={() => go('signIn')} />
        </>
      ) : null}

      {passwordMode ? methodSwitch : null}

      <Button label={t('login.server')} icon="server-network" variant="ghost" onPress={() => setShowServer((open) => !open)} />
      {showServer ? (
        <View style={{ gap: spacing.sm }}>
          <Field
            label={t('login.server')}
            hint={t('login.serverHint')}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={server}
            onChangeText={setServer}
          />
          <Button label={t('login.saveServer')} icon="content-save" variant="secondary" onPress={applyServer} loading={busy} />
        </View>
      ) : null}
    </Screen>
  );
}
