/** Design tokens shared by the MUI theme, the code editor and the illustrations. */
export const colors = {
  ink: '#06070C',
  bg: '#08090F',
  surface: '#0D0F18',
  surface2: '#121521',
  surface3: '#181C2B',
  surface4: '#1F2436',
  border: 'rgba(148, 160, 255, 0.10)',
  borderStrong: 'rgba(148, 160, 255, 0.18)',
  text: '#E9EBF7',
  textSoft: '#B4B9D6',
  textMuted: '#8A90AE',
  textFaint: '#5B6180',

  amber: '#FFB547',
  amberSoft: '#FFD08A',
  orange: '#FF8A5B',
  violet: '#A77BFF',
  violetSoft: '#C9B2FF',
  cyan: '#4CD6FF',
  green: '#4BE3A1',
  red: '#FF5C7A',
  yellow: '#FFD45C',
  pink: '#FF7AB8',
} as const;

export const gradients = {
  lumen: 'linear-gradient(135deg, #FFD36E 0%, #FF8A5B 48%, #B66DFF 100%)',
  lumenSoft:
    'linear-gradient(135deg, rgba(255,211,110,0.16) 0%, rgba(255,138,91,0.12) 48%, rgba(182,109,255,0.16) 100%)',
  cool: 'linear-gradient(135deg, #4CD6FF 0%, #A77BFF 100%)',
  panel: 'linear-gradient(180deg, rgba(20,23,36,0.92) 0%, rgba(13,15,24,0.92) 100%)',
} as const;

/** Syntax colors, used by the editor, token inspector and code samples. */
export const syntax = {
  keyword: '#C792FF',
  type: '#4CD6FF',
  function: '#FFC66D',
  string: '#A5E887',
  number: '#FF9F6B',
  operator: '#89DDFF',
  punctuation: '#7D84A6',
  comment: '#5C6386',
  identifier: '#E4E7F5',
  property: '#9FB6FF',
  constant: '#FF7AB8',
  interpolation: '#FF7AB8',
} as const;

export type SyntaxClass = keyof typeof syntax;

export const fonts = {
  display: '"Space Grotesk Variable", "Space Grotesk", "Inter Variable", system-ui, sans-serif',
  body: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;
