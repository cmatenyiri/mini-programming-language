import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { Box, Button, ListSubheader, Menu, MenuItem, Typography } from '@mui/material';
import { Fragment, type ReactNode, useState } from 'react';
import { EXAMPLES, type Example, type ExampleCategory } from '../examples/examples';
import { colors } from '../theme/tokens';

const CATEGORY_ICONS: Record<ExampleCategory, ReactNode> = {
  'Start here': <RocketLaunchRoundedIcon sx={{ fontSize: 15, color: colors.amber }} />,
  Language: <CodeRoundedIcon sx={{ fontSize: 15, color: colors.violet }} />,
  'Data & types': <DataObjectRoundedIcon sx={{ fontSize: 15, color: colors.cyan }} />,
  Showcase: <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: colors.pink }} />,
};

const CATEGORIES: ExampleCategory[] = ['Start here', 'Language', 'Data & types', 'Showcase'];

interface Props {
  currentId?: string;
  onSelect: (example: Example) => void;
  compact?: boolean;
}

export function ExamplesMenu({ currentId, onSelect, compact }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreRoundedIcon />}
        data-testid="examples-button"
        sx={{ color: colors.textSoft, fontWeight: 600 }}
      >
        {compact ? 'Examples' : 'Examples'}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 340, maxHeight: '75vh' } } }}
      >
        {CATEGORIES.map((category) => (
          <Fragment key={category}>
            <ListSubheader
              sx={{
                background: 'transparent',
                lineHeight: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontFamily: '"JetBrains Mono Variable", monospace',
                fontSize: 10.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: colors.textFaint,
                position: 'static',
                mt: 0.5,
              }}
            >
              {CATEGORY_ICONS[category]}
              {category}
            </ListSubheader>
            {EXAMPLES.filter((e) => e.category === category).map((example) => (
              <MenuItem
                key={example.id}
                selected={example.id === currentId}
                onClick={() => {
                  setAnchor(null);
                  onSelect(example);
                }}
                data-testid={`example-${example.id}`}
                sx={{ alignItems: 'flex-start', py: 0.75 }}
              >
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                    {example.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: colors.textMuted }}>
                    {example.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Fragment>
        ))}
      </Menu>
    </>
  );
}
