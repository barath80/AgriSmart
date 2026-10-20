import { useTranslation } from 'react-i18next';

import type { WeatherAlert } from '@/api/types';
import { shortDate } from '@/format';

import { Notice } from './ui';

/** Deterministic weather advice from the backend rules, worded by the app's locale files. */
export function AlertList({ alerts }: { alerts: WeatherAlert[] }) {
  const { t } = useTranslation();
  return (
    <>
      {alerts.map((alert) => (
        <Notice
          key={`${alert.code}-${alert.on}`}
          tone={alert.severity === 'info' ? 'info' : alert.severity === 'severe' ? 'danger' : 'warning'}
        >
          {`${shortDate(alert.on)}: ${t(`alert.${alert.code}`, alert.params)}`}
        </Notice>
      ))}
    </>
  );
}
