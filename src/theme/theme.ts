import { alpha, createTheme } from '@mui/material/styles';
import { colors, fonts, gradients } from './tokens';

const glow = (color: string, strength = 0.35) =>
  `0 0 0 1px ${alpha(color, 0.28)}, 0 8px 28px -6px ${alpha(color, strength)}`;

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.amber,
      light: colors.amberSoft,
      dark: '#E8932A',
      contrastText: '#1B1206',
    },
    secondary: {
      main: colors.violet,
      light: colors.violetSoft,
      dark: '#7F55E0',
      contrastText: '#0E0820',
    },
    info: { main: colors.cyan },
    success: { main: colors.green },
    warning: { main: colors.yellow },
    error: { main: colors.red },
    background: { default: colors.bg, paper: colors.surface },
    text: { primary: colors.text, secondary: colors.textMuted, disabled: colors.textFaint },
    divider: colors.border,
    action: {
      hover: 'rgba(160, 170, 255, 0.07)',
      selected: 'rgba(255, 181, 71, 0.10)',
      focus: 'rgba(255, 181, 71, 0.14)',
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    h1: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.03em' },
    h2: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: fonts.display, fontWeight: 650, letterSpacing: '-0.02em' },
    h5: { fontFamily: fonts.display, fontWeight: 650, letterSpacing: '-0.015em' },
    h6: { fontFamily: fonts.display, fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, letterSpacing: '0.01em' },
    overline: {
      fontFamily: fonts.mono,
      fontWeight: 600,
      letterSpacing: '0.14em',
      fontSize: '0.68rem',
    },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.005em' },
    caption: { color: colors.textMuted },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'dark' },
        'html, body, #root': { height: '100%' },
        body: {
          backgroundColor: colors.bg,
          backgroundImage: `radial-gradient(1200px 600px at -10% -20%, ${alpha(colors.amber, 0.07)}, transparent 60%),
            radial-gradient(900px 600px at 110% 120%, ${alpha(colors.violet, 0.08)}, transparent 60%)`,
          backgroundAttachment: 'fixed',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          overflow: 'hidden',
        },
        '::selection': { background: alpha(colors.amber, 0.28) },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: 'rgba(148, 160, 255, 0.14)',
          borderRadius: 10,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
        '*::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(148, 160, 255, 0.26)',
          backgroundClip: 'padding-box',
        },
        '*::-webkit-scrollbar-corner': { background: 'transparent' },
        kbd: {
          fontFamily: fonts.mono,
          fontSize: '0.72em',
          padding: '1px 5px',
          borderRadius: 5,
          border: `1px solid ${colors.borderStrong}`,
          borderBottomWidth: 2,
          background: colors.surface3,
          color: colors.textSoft,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 14,
          transition: 'all 160ms ease',
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                background: gradients.lumen,
                color: '#170C02',
                boxShadow: glow(colors.orange, 0.45),
                '&:hover': {
                  background: gradients.lumen,
                  filter: 'brightness(1.08) saturate(1.05)',
                  boxShadow: glow(colors.orange, 0.65),
                },
                '&.Mui-disabled': {
                  background: colors.surface3,
                  color: colors.textFaint,
                  boxShadow: 'none',
                },
              },
            },
            {
              props: { variant: 'contained', color: 'error' },
              style: {
                background: alpha(colors.red, 0.16),
                color: colors.red,
                boxShadow: `inset 0 0 0 1px ${alpha(colors.red, 0.45)}`,
                '&:hover': {
                  background: alpha(colors.red, 0.26),
                  boxShadow: `inset 0 0 0 1px ${alpha(colors.red, 0.7)}`,
                },
              },
            },
            {
              props: { variant: 'outlined' },
              style: {
                borderColor: colors.borderStrong,
                color: colors.textSoft,
                background: alpha(colors.surface3, 0.5),
                '&:hover': {
                  borderColor: alpha(colors.amber, 0.5),
                  background: alpha(colors.amber, 0.06),
                  color: colors.text,
                },
              },
            },
            {
              props: { variant: 'text' },
              style: { color: colors.textSoft, '&:hover': { color: colors.text } },
            },
          ],
        },
        sizeSmall: { paddingInline: 10, fontSize: '0.8rem' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          color: colors.textMuted,
          transition: 'all 140ms ease',
          '&:hover': { color: colors.text, background: 'rgba(160, 170, 255, 0.08)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: colors.border },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 350 },
      styleOverrides: {
        tooltip: {
          background: alpha(colors.surface4, 0.96),
          backdropFilter: 'blur(8px)',
          border: `1px solid ${colors.borderStrong}`,
          color: colors.text,
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.7)',
        },
        arrow: { color: alpha(colors.surface4, 0.96) },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 42 },
        indicator: {
          height: 2,
          borderRadius: 2,
          background: gradients.lumen,
          boxShadow: `0 0 12px ${alpha(colors.orange, 0.8)}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          minWidth: 0,
          paddingInline: 14,
          fontSize: '0.8rem',
          fontWeight: 600,
          color: colors.textMuted,
          '&.Mui-selected': { color: colors.text },
          '&:hover': { color: colors.textSoft },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 600 },
        sizeSmall: { height: 22, fontSize: '0.7rem' },
        outlined: { borderColor: colors.borderStrong },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: `linear-gradient(180deg, ${colors.surface2} 0%, ${colors.surface} 100%)`,
          border: `1px solid ${colors.borderStrong}`,
          boxShadow: `0 40px 120px -20px rgba(0,0,0,0.85), 0 0 0 1px ${alpha(colors.violet, 0.08)}`,
          borderRadius: 18,
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(4, 5, 10, 0.72)', backdropFilter: 'blur(6px)' },
        invisible: { backgroundColor: 'transparent', backdropFilter: 'none' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: alpha(colors.surface2, 0.97),
          backdropFilter: 'blur(14px)',
          border: `1px solid ${colors.borderStrong}`,
          boxShadow: '0 24px 60px -16px rgba(0,0,0,0.8)',
          borderRadius: 12,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.84rem',
          minHeight: 36,
          '&:hover': { background: 'rgba(160, 170, 255, 0.08)' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: `linear-gradient(180deg, ${colors.surface2} 0%, ${colors.surface} 100%)`,
          borderLeft: `1px solid ${colors.borderStrong}`,
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          background: colors.surface4,
          color: colors.text,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 12,
          fontWeight: 500,
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: colors.border } } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: colors.surface3, borderRadius: 4 },
        bar: { background: gradients.lumen, borderRadius: 4 },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked + .MuiSwitch-track': { opacity: 0.6 } },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '0.85rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          background: alpha(colors.surface3, 0.6),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(colors.amber, 0.4) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.amber,
            borderWidth: 1,
          },
        },
      },
    },
  },
});
