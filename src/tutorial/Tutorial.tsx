import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { tutorialHiddenOnStartup } from '../storage';
import { colors, fonts, gradients } from '../theme/tokens';
import { CHAPTERS, STEPS } from './steps';

interface Props {
  open: boolean;
  onClose: (hideOnStartup: boolean) => void;
  onTry: (code: string, name?: string) => void;
}

export function Tutorial({ open, onClose, onTry }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hideOnStartup, setHideOnStartup] = useState(tutorialHiddenOnStartup);
  const fullScreen = useMediaQuery('(max-width: 860px)');
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
      setDirection(clamped >= index ? 1 : -1);
      setIndex(clamped);
    },
    [index],
  );

  const close = useCallback(() => onClose(hideOnStartup), [onClose, hideOnStartup]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, go]);

  const Illustration = step.Illustration;

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      maxWidth={false}
      slotProps={{
        paper: {
          'data-testid': 'tutorial',
          sx: {
            width: fullScreen ? '100%' : 'min(1120px, calc(100vw - 48px))',
            height: fullScreen ? '100%' : 'min(700px, calc(100vh - 48px))',
            m: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: fullScreen ? 0 : 4.5,
          },
        } as object,
      }}
    >
      {/* Top bar: chapters + skip */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Box sx={{ flex: 1, display: 'flex', gap: 1, minWidth: 0 }}>
          {CHAPTERS.map((chapter) => {
            const steps = STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.chapter === chapter);
            const activeChapter = step.chapter === chapter;
            return (
              <Box key={chapter} sx={{ flex: Math.max(steps.length, 1.8), minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: activeChapter ? colors.amber : colors.textFaint,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    mb: 0.75,
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  {chapter}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {steps.map(({ s, i }) => (
                    <Tooltip key={s.id} title={s.title}>
                      <ButtonBase
                        onClick={() => go(i)}
                        aria-label={`Go to: ${s.title}`}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 4,
                          background: i <= index ? gradients.lumen : colors.surface4,
                          boxShadow: i === index ? `0 0 10px ${colors.orange}` : 'none',
                          transition: 'all 250ms',
                          '&::after': { content: '""', position: 'absolute', inset: '-8px 0' },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
        <Button
          variant="text"
          size="small"
          onClick={close}
          endIcon={<CloseRoundedIcon sx={{ fontSize: '16px !important' }} />}
          data-testid="tutorial-skip"
          sx={{ flexShrink: 0, color: colors.textMuted }}
        >
          Skip tutorial
        </Button>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: { md: '0 0 42%' },
            minWidth: 0,
            overflowY: 'auto',
            px: { xs: 2.5, md: 4 },
            py: { xs: 2.5, md: 4 },
            order: { xs: 2, md: 1 },
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <Typography
                sx={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: colors.amber,
                  mb: 1.25,
                }}
              >
                {step.chapter} · {index + 1}/{STEPS.length}
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontSize: { xs: 26, md: 32 }, mb: 1.5, lineHeight: 1.12 }}
                data-testid="tutorial-title"
              >
                {step.title}
              </Typography>
              <Typography sx={{ fontSize: 15.5, color: colors.textSoft, lineHeight: 1.6, mb: 2.5 }}>
                {step.lead}
              </Typography>
              <Box
                sx={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: colors.text,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {step.body}
              </Box>
              {step.snippet && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={() => onTry(step.snippet!, `${step.id}.lum`)}
                  sx={{ mt: 2.5 }}
                  data-testid="tutorial-try"
                >
                  Try it in the editor
                </Button>
              )}
            </motion.div>
          </AnimatePresence>
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: { xs: 300, md: 0 },
            '& > div > div > *': { zoom: { xs: 0.68, sm: 0.85, md: 1 } },
            position: 'relative',
            order: { xs: 1, md: 2 },
            borderLeft: { md: `1px solid ${colors.border}` },
            borderBottom: { xs: `1px solid ${colors.border}`, md: 'none' },
            background: `radial-gradient(600px 400px at 70% 20%, rgba(255,181,71,0.08), transparent 60%),
              radial-gradient(500px 400px at 20% 90%, rgba(182,109,255,0.10), transparent 60%),
              ${colors.ink}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(148,160,255,0.12) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
              pointerEvents: 'none',
            },
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Illustration />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderTop: `1px solid ${colors.border}`,
          background: 'rgba(6,7,12,0.4)',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hideOnStartup}
              onChange={(e) => setHideOnStartup(e.target.checked)}
            />
          }
          label="Don’t show on startup"
          sx={{
            mr: 'auto',
            '& .MuiFormControlLabel-label': { fontSize: 12.5, color: colors.textMuted },
          }}
        />
        <Typography
          sx={{ fontSize: 11.5, color: colors.textFaint, display: { xs: 'none', md: 'block' } }}
        >
          Use <kbd>←</kbd> <kbd>→</kbd> to navigate
        </Typography>
        <IconButton
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          data-testid="tutorial-back"
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        {isLast ? (
          <Button
            variant="contained"
            onClick={close}
            startIcon={<RocketLaunchRoundedIcon />}
            data-testid="tutorial-finish"
          >
            Start coding
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => go(index + 1)}
            endIcon={<ArrowForwardRoundedIcon />}
            data-testid="tutorial-next"
          >
            {index === 0 ? 'Take the tour' : 'Next'}
          </Button>
        )}
      </Box>
    </Dialog>
  );
}
