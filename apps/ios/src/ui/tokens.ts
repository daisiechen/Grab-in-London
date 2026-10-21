/** Visual tokens from demo/DESIGN.md (same values as demo/src/prototype.css); single light theme. */
export const colors = {
  forest: '#123f35',
  ink: '#10241f',
  muted: '#6c746f',
  line: '#e4e7e2',
  surface: '#f5f6f1',
  peach: '#ffb49b',
  danger: '#a93b32',
  white: '#ffffff',
  secondaryBorder: '#b8c8bd',
  selectedSurface: '#e8f0ea',
} as const;

export const radius = { sm: 7, md: 11, lg: 19 } as const;
export const spacing = { page: 21, section: 27 } as const;
export const sizes = { button: 45, field: 43, createCircle: 53 } as const;
export const type = { heading: 28, section: 17, body: 14, control: 13, meta: 11, caption: 10 } as const;
