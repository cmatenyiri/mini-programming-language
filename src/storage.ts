import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const CODE_KEY = 'lumen.playground.code.v1';
const FILE_KEY = 'lumen.playground.file.v1';
const TUTORIAL_KEY = 'lumen.tutorial.hideOnStartup.v1';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — the app still works.
  }
}

export const loadSavedCode = () => read(CODE_KEY);
export const saveCode = (code: string) => write(CODE_KEY, code);
export const loadFileName = () => read(FILE_KEY);
export const saveFileName = (name: string) => write(FILE_KEY, name);

export const tutorialHiddenOnStartup = () => read(TUTORIAL_KEY) === '1';
export const setTutorialHiddenOnStartup = (hidden: boolean) =>
  write(TUTORIAL_KEY, hidden ? '1' : null);

/** Reads code shared through the URL hash (`#code=…`). */
export function loadSharedCode(): string | null {
  const match = /[#&]code=([^&]+)/.exec(window.location.hash);
  if (!match) return null;
  try {
    return decompressFromEncodedURIComponent(match[1]) || null;
  } catch {
    return null;
  }
}

/** Builds a link that embeds the code itself — no server needed. */
export function buildShareUrl(code: string): string {
  const url = new URL(window.location.href);
  url.hash = `code=${compressToEncodedURIComponent(code)}`;
  return url.toString();
}

export function clearShareHash() {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
