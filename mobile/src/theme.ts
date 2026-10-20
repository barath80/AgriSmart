/**
 * Design tokens. Built for farmers outdoors: high contrast, large type, big touch targets
 * (minimum 56 dp), and colour never used as the only signal.
 */
export const colors = {
  background: '#F7F6F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2E6',
  primary: '#1B5E20',
  primaryPressed: '#144A18',
  primaryText: '#FFFFFF',
  accent: '#F9A825',
  accentText: '#2B1D00',
  text: '#1A1C18',
  textMuted: '#4A5246',
  border: '#D4D9CC',
  danger: '#B3261E',
  dangerSurface: '#FCE8E6',
  warning: '#8A5300',
  warningSurface: '#FFF3D6',
  info: '#0B57D0',
  infoSurface: '#E5EEFC',
  success: '#1E6B34',
  successSurface: '#E3F2E6',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 22, round: 999 } as const;

export const type = {
  caption: { fontSize: 15, lineHeight: 21 },
  body: { fontSize: 18, lineHeight: 27 },
  bodyStrong: { fontSize: 18, lineHeight: 27, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
  display: { fontSize: 34, lineHeight: 42, fontWeight: '800' as const },
} as const;

export const touch = { min: 56, large: 72 } as const;

export const shadow = {
  shadowColor: '#1A1C18',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
