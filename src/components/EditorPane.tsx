import { Box, Typography } from '@mui/material';
import { type Ref } from 'react';
import { type CursorInfo, LumenEditor, type LumenEditorHandle } from '../editor/LumenEditor';
import type { Diagnostic } from '../lumen/diagnostics';
import type { Analysis } from '../lumen/index';
import { colors, fonts } from '../theme/tokens';
import { MOD_KEY } from '../platform';

interface Props {
  editorRef: Ref<LumenEditorHandle>;
  fileName: string;
  initialValue: string;
  diagnostics: Diagnostic[];
  getAnalysis: () => Analysis | null;
  onChange: (value: string) => void;
  onCursor: (cursor: CursorInfo) => void;
  onRun: () => void;
  onSave: () => void;
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <defs>
        <linearGradient id="file-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD36E" />
          <stop offset="1" stopColor="#B66DFF" />
        </linearGradient>
      </defs>
      <path
        d="M3 1.5h6.5L13 5v9.5H3z"
        fill="none"
        stroke="url(#file-g)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6 6.5v5h4"
        fill="none"
        stroke="url(#file-g)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditorPane({ editorRef, fileName, ...editorProps }: Props) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Box
        sx={{
          height: 42,
          display: 'flex',
          alignItems: 'stretch',
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <Box
          data-testid="file-tab"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            borderRight: `1px solid ${colors.border}`,
            background: 'linear-gradient(180deg, rgba(255,181,71,0.06), transparent)',
            boxShadow: `inset 0 2px 0 ${colors.amber}`,
          }}
        >
          <FileIcon />
          <Typography sx={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.text }}>
            {fileName}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            alignSelf: 'center',
            px: 2,
            fontSize: 11.5,
            color: colors.textFaint,
            display: { xs: 'none', xl: 'block' },
            whiteSpace: 'nowrap',
          }}
        >
          Hover for types · <kbd>Ctrl</kbd> <kbd>Space</kbd> completions · <kbd>{MOD_KEY}</kbd>{' '}
          <kbd>/</kbd> comment
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LumenEditor ref={editorRef} {...editorProps} />
      </Box>
    </Box>
  );
}
