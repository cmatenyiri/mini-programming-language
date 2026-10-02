import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { type ReactNode, useState } from 'react';
import type { Example } from '../examples/examples';
import { colors, fonts, gradients } from '../theme/tokens';
import { MOD_KEY } from '../platform';
import { ExamplesMenu } from './ExamplesMenu';
import { Logo } from './Logo';

interface Props {
  running: boolean;
  currentExampleId?: string;
  onRun: () => void;
  onStop: () => void;
  onExample: (example: Example) => void;
  onShare: () => void;
  onOpenFile: () => void;
  onDownload: () => void;
  onDocs: () => void;
  onTutorial: () => void;
}

function HeaderAction({
  title,
  icon,
  onClick,
  testId,
}: {
  title: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        data-testid={testId}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export function AppHeader(props: Props) {
  const { running, onRun, onStop } = props;
  const compact = useMediaQuery('(max-width: 760px)');
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const actions = [
    {
      title: 'Tutorial',
      icon: <AutoStoriesRoundedIcon fontSize="small" />,
      onClick: props.onTutorial,
      testId: 'tutorial-button',
    },
    {
      title: 'Language reference',
      icon: <MenuBookRoundedIcon fontSize="small" />,
      onClick: props.onDocs,
      testId: 'docs-button',
    },
    {
      title: 'Open a .lum file',
      icon: <FolderOpenRoundedIcon fontSize="small" />,
      onClick: props.onOpenFile,
      testId: 'open-button',
    },
    {
      title: 'Download as .lum',
      icon: <FileDownloadRoundedIcon fontSize="small" />,
      onClick: props.onDownload,
      testId: 'download-button',
    },
    {
      title: 'Copy share link',
      icon: <IosShareRoundedIcon fontSize="small" />,
      onClick: props.onShare,
      testId: 'share-button',
    },
  ];

  return (
    <Box
      component="header"
      sx={{
        height: 56,
        px: { xs: 1.5, sm: 2 },
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderBottom: `1px solid ${colors.border}`,
        background: 'linear-gradient(180deg, rgba(14,16,25,0.9), rgba(10,11,18,0.75))',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Logo size={30} animated />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.03em',
              background: gradients.lumen,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Lumen
          </Typography>
          {!compact && (
            <Typography
              sx={{
                fontFamily: fonts.mono,
                fontSize: 10.5,
                color: colors.textFaint,
                border: `1px solid ${colors.border}`,
                borderRadius: 1,
                px: 0.75,
                py: 0.1,
              }}
            >
              v1.0 · playground
            </Typography>
          )}
        </Box>
      </Box>

      <Divider
        orientation="vertical"
        flexItem
        sx={{ my: 1.5, display: { xs: 'none', sm: 'block' } }}
      />
      <ExamplesMenu currentId={props.currentExampleId} onSelect={props.onExample} />

      <Box sx={{ flex: 1 }} />

      {compact ? (
        <>
          <IconButton
            size="small"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            aria-label="More actions"
          >
            <MoreVertRoundedIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={() => setMoreAnchor(null)}
          >
            {actions.map((a) => (
              <MenuItem
                key={a.title}
                onClick={() => {
                  setMoreAnchor(null);
                  a.onClick();
                }}
              >
                <ListItemIcon>{a.icon}</ListItemIcon>
                <ListItemText>{a.title}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {actions.map((a) => (
            <HeaderAction key={a.title} {...a} />
          ))}
        </Box>
      )}

      {running ? (
        <Button
          variant="contained"
          color="error"
          onClick={onStop}
          startIcon={<StopRoundedIcon />}
          data-testid="stop-button"
          sx={{ minWidth: 104 }}
        >
          Stop
        </Button>
      ) : (
        <Tooltip
          title={
            <span>
              Run program <kbd>{MOD_KEY}</kbd> <kbd>Enter</kbd>
            </span>
          }
        >
          <Button
            variant="contained"
            onClick={onRun}
            startIcon={<PlayArrowRoundedIcon />}
            data-testid="run-button"
            sx={{ minWidth: 104 }}
          >
            Run
          </Button>
        </Tooltip>
      )}
    </Box>
  );
}
