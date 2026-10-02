const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);

/** The platform's primary shortcut modifier, for display. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
