import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Box, Button, ButtonBase, Drawer, IconButton, InputBase, Typography } from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { colors, fonts } from '../theme/tokens';
import { DOC_SECTIONS } from './reference';

interface Props {
  open: boolean;
  onClose: () => void;
  onTry: (code: string, name?: string) => void;
}

export function DocsDrawer({ open, onClose, onTry }: Props) {
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_SECTIONS;
    return DOC_SECTIONS.filter((s) =>
      `${s.title} ${s.summary} ${s.keywords}`.toLowerCase().includes(q),
    );
  }, [query]);

  const scrollTo = (id: string) => {
    const el = scrollRef.current?.querySelector(`#doc-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: 600 }, display: 'flex', flexDirection: 'column' } },
      }}
    >
      <Box
        sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${colors.border}` }}
        data-testid="docs"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: colors.amber,
              background: 'linear-gradient(135deg, rgba(255,211,110,0.14), rgba(182,109,255,0.14))',
              border: `1px solid ${colors.borderStrong}`,
            }}
          >
            <MenuBookRoundedIcon fontSize="small" />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              Language reference
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: colors.textMuted }}>
              Everything Lumen can do, with runnable examples
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close reference">
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            border: `1px solid ${colors.borderStrong}`,
            background: 'rgba(24,28,43,0.6)',
            '&:focus-within': { borderColor: colors.amber },
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 18, color: colors.textFaint }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Search — e.g. map, match, closure, ??"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ fontSize: 13.5 }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
          {sections.map((s) => (
            <ButtonBase
              key={s.id}
              onClick={() => scrollTo(s.id)}
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                px: 1.1,
                py: 0.4,
                borderRadius: 1.5,
                color: colors.textSoft,
                border: `1px solid ${colors.border}`,
                '&:hover': { borderColor: `${colors.amber}88`, color: colors.text },
              }}
            >
              {s.title}
            </ButtonBase>
          ))}
        </Box>
      </Box>

      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {sections.length === 0 && (
          <Typography sx={{ color: colors.textMuted, textAlign: 'center', mt: 6 }}>
            Nothing matches “{query}”.
          </Typography>
        )}
        {sections.map((s) => (
          <Box key={s.id} id={`doc-${s.id}`} sx={{ mb: 4, scrollMarginTop: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontSize: 18 }}>
                {s.title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: colors.textFaint, fontFamily: fonts.mono }}>
                {s.summary}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{s.content}</Box>
            {s.example && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => onTry(s.example!, `${s.id}.lum`)}
                sx={{ mt: 1.5 }}
              >
                Open example in editor
              </Button>
            )}
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}
