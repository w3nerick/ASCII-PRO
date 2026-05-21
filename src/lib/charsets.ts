// Character ramps ordered from DARKEST to LIGHTEST.
// The converter maps pixel luminance -> index in the ramp.

export type CharsetKey =
  | 'standard'
  | 'detailed'
  | 'blocks'
  | 'shades'
  | 'binary'
  | 'minimal'
  | 'matrix'
  | 'cyberpunk'
  | 'glitch'
  | 'braille'
  | 'braille_full'
  | 'lines'
  | 'diagonal'
  | 'cross'
  | 'diamond'
  | 'dots'
  | 'ascii_magic'   // matches ascii-magic.com default
  | 'dense'
  | 'custom';

export const CHARSETS: Record<Exclude<CharsetKey, 'custom'>, { label: string; ramp: string }> = {
  standard:    { label: 'Standard',    ramp: '@%#*+=-:. ' },
  detailed:    { label: 'Detailed',    ramp: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ' },
  blocks:      { label: 'Blocks',      ramp: '█▓▒░ ' },
  shades:      { label: 'Shades',      ramp: '█▉▊▋▌▍▎▏ ' },
  binary:      { label: 'Binary',      ramp: '10 ' },
  minimal:     { label: 'Minimal',     ramp: '@#*+=-:. ' },
  matrix:      { label: 'Matrix',      ramp: 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345789Z:.\"=*+-<>¦｜çﾘ ' },
  cyberpunk:   { label: 'Cyberpunk',   ramp: '█▇▆▅▄▃▂▁ ' },
  glitch:      { label: 'Glitch',      ramp: '▓▒░@#%&*+=-:. ' },
  braille:     { label: 'Braille',     ramp: '⣿⣷⣶⣦⣤⣄⣀⠀' },
  braille_full:{ label: 'Braille+',    ramp: '⣿⣻⣽⣾⣷⣯⣟⡿⢿⣫⣗⣖⣴⣬⣤⣠⣀⠤⠐⠀' },
  lines:       { label: 'Lines',       ramp: '┃╏┆│| ' },
  diagonal:    { label: 'Diagonal',    ramp: '╲╱/⁄ ' },
  cross:       { label: 'Cross',       ramp: '╋┼+× ' },
  diamond:     { label: 'Diamond',     ramp: '⬥◆◈◇⋄ ' },
  dots:        { label: 'Dots',        ramp: '●•·⋅ ' },
  ascii_magic: { label: 'ASCII Magic', ramp: '@#S08Xx+=-;:,. ' },
  dense:       { label: 'Dense',       ramp: '█▓▒Ñ@#W$9876543210?!abc;:+=-,._ ' },
};

// Order shown in the UI (custom appended at the end).
export const CHARSET_KEYS: CharsetKey[] = [
  'standard',
  'detailed',
  'ascii_magic',
  'dense',
  'blocks',
  'shades',
  'braille',
  'braille_full',
  'dots',
  'lines',
  'diagonal',
  'cross',
  'diamond',
  'matrix',
  'cyberpunk',
  'glitch',
  'binary',
  'minimal',
  'custom',
];

export function charsetLabel(key: CharsetKey): string {
  if (key === 'custom') return 'Custom';
  return CHARSETS[key].label;
}
