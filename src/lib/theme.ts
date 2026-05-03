import { Platform } from 'react-native';

import type { TaskColor } from './types';

export const palette = {
  paper: '#F4F3EE',
  paper2: '#EAE8E1',
  paper3: '#DDD8C8',
  ink: '#0A0A0A',
  inkMute: '#6b6b66',
  hairline: '#cfccc1',
  red: '#E63946',
  orange: '#F77F00',
  green: '#2A9D5F',
};

export const fonts = Platform.select({
  web: {
    display: '"Archivo Black", Impact, sans-serif',
    ui: 'Inter, Arial, sans-serif',
    body: '"Source Serif 4", Georgia, serif',
    mono: '"JetBrains Mono", "SFMono-Regular", monospace',
  },
  default: {
    display: 'System',
    ui: 'System',
    body: 'Georgia',
    mono: 'Courier',
  },
}) as {
  display: string;
  ui: string;
  body: string;
  mono: string;
};

export const taskPalette: Record<
  TaskColor,
  {
    fill: string;
    strong: string;
    text: string;
  }
> = {
  green: {
    fill: 'rgba(42, 157, 95, 0.18)',
    strong: palette.green,
    text: palette.ink,
  },
  orange: {
    fill: 'rgba(247, 127, 0, 0.18)',
    strong: palette.orange,
    text: palette.ink,
  },
  red: {
    fill: 'rgba(230, 57, 70, 0.18)',
    strong: palette.red,
    text: palette.ink,
  },
};
