// Character ramps, indexed palettes and gradient maps used by styles.

/** Character sets ordered DENSE -> SPARSE (bright pixels map to dense glyphs). */
export const CHARSETS: { label: string; ramp: string }[] = [
  { label: 'Standard', ramp: '@#S08Xx+=-;:.' },
  { label: 'Classic ASCII', ramp: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'.' },
  { label: 'Ink', ramp: '█▓▒░@%#*+=-:.' },
  { label: 'Minimal', ramp: '#+-.' },
  { label: 'Forensic', ramp: '▉▊▋▌▍▎▏:.' },
  { label: 'Blocks', ramp: '█▓▒░' },
  { label: 'Bars', ramp: '█▇▆▅▄▃▂▁' },
  { label: 'Quadrants', ramp: '█▛▜▙▟▀▄▌▐▞▚▖▗▘▝' },
  { label: 'Braille', ramp: '⣿⣷⣯⣟⡿⢿⣻⣽⣾⣶⣦⣤⣄⣀⡀⠄⠂⠁' },
  { label: 'Numeric', ramp: '8096532147' },
  { label: 'Binary', ramp: '10' },
  { label: 'Hacker', ramp: '#$%&@0x{}[]<>/\\|=+-:.' },
  { label: 'Alpha', ramp: 'MWNQBHKRDEAXSPZGUOCVYLJFTIwmqbdpkhgaexzsnuocvyrjftli' },
  { label: 'Dots', ramp: '●◉◎○◌•∙·.' },
  { label: 'Geometric', ramp: '■◆▲●◼▪◇△○□▫·' },
  { label: 'Math', ramp: '∑∏∫∂√∞≈≠±×÷=+-·' },
  { label: 'Katakana', ramp: 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ' },
  { label: 'Kanji', ramp: '龍鬱霧薔瀧錦藝驚麗響雲華風花月光水火空' },
  { label: 'Runic', ramp: 'ᛟᛞᛝᛜᛛᛚᛙᛘᛗᛖᛕᛔ᛬᛫' },
  { label: 'Arrows', ramp: '⬛⬆➜↗→↘↓↙←↖·' },
  { label: 'Emoji', ramp: '🔥💀👁🌀✦◆●○·' },
];

export const CHARSET_OPTIONS = CHARSETS.map((c, i) => ({ label: c.label, value: i }));
export const CHARSET_RAMPS = CHARSETS.map((c) => c.ramp);

/** Indexed palettes (max 16 colors). */
export const PALETTES: { label: string; colors: string[] }[] = [
  { label: 'Mono 1-bit', colors: ['#000000', '#ffffff'] },
  { label: 'Grey 2-bit (4 levels)', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
  { label: 'Grey 3-bit (8 levels)', colors: ['#000000', '#242424', '#494949', '#6d6d6d', '#929292', '#b6b6b6', '#dbdbdb', '#ffffff'] },
  { label: '3-bit RGB (8)', colors: ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'] },
  { label: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { label: 'CGA Palette 0', colors: ['#000000', '#00aa00', '#aa0000', '#aa5500'] },
  { label: 'CGA Palette 1', colors: ['#000000', '#00aaaa', '#aa00aa', '#aaaaaa'] },
  { label: 'Pico-8 (16)', colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
  { label: 'NES-ish (16)', colors: ['#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8', '#0000fc', '#b8b8f8', '#6888fc', '#0058f8', '#f8b8f8', '#d800cc', '#f83800', '#fca044', '#00b800'] },
  { label: 'C64-ish (16)', colors: ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77', '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'] },
  { label: 'Amber Monitor', colors: ['#100800', '#5c3300', '#c27a00', '#ffb000'] },
  { label: 'Green Terminal', colors: ['#001100', '#003b00', '#008f11', '#00ff41'] },
  { label: 'Blueprint Cyan', colors: ['#0a2a4a', '#145a8c', '#5fb4e6', '#e6f7ff'] },
  { label: 'Sunset', colors: ['#1a0b2e', '#7a1e5a', '#e8445a', '#ffb347', '#fff1c1'] },
  { label: 'Pastel', colors: ['#2b2d42', '#f4acb7', '#ffcad4', '#9d8189', '#d8e2dc', '#ffe5d9'] },
  { label: 'Newsprint', colors: ['#1b1b1b', '#f2ead8'] },
  { label: 'Custom', colors: [] },
  { label: 'Original colours (preserve)', colors: [] },
];

export const PALETTE_CUSTOM = PALETTES.findIndex((p) => p.label === 'Custom');
export const PALETTE_ORIGINAL = PALETTES.findIndex((p) => p.label.startsWith('Original'));
export const PALETTE_OPTIONS = PALETTES.map((p, i) => ({ label: p.label, value: i }));

/** Gradient maps: luminance -> color ramp (2..8 stops, evenly spaced). */
export const GRADIENTS: { label: string; stops: string[] }[] = [
  { label: 'Noir', stops: ['#000000', '#ffffff'] },
  { label: 'Sepia', stops: ['#1a0f07', '#704214', '#c8a27a', '#f5ead6'] },
  { label: 'Cyberpunk', stops: ['#0b0221', '#3b0a75', '#ff2a6d', '#05d9e8', '#d1f7ff'] },
  { label: 'Vapor', stops: ['#1a1033', '#6a2c91', '#f15bb5', '#fee440', '#00f5d4'] },
  { label: 'Sunset Mountain', stops: ['#120024', '#5b0e5c', '#d62d4f', '#ff8c42', '#ffe8a3'] },
  { label: 'Ukiyo Blue', stops: ['#0b1d3a', '#1f4e8c', '#7fb2d9', '#f3ead3'] },
  { label: 'Toxic', stops: ['#020a02', '#0d3b0d', '#5ce600', '#e6ff8a'] },
  { label: 'Copper Ember', stops: ['#120604', '#5a1e0c', '#c4581d', '#ffb26b', '#fff0d9'] },
  { label: 'Molten Gold', stops: ['#1a0d00', '#6b3c00', '#d4920a', '#ffd966', '#fffbe6'] },
  { label: 'Liquid Chrome', stops: ['#050608', '#3a3f4a', '#c9d1dc', '#5b6370', '#f4f7fb'] },
  { label: 'Rose quartz', stops: ['#2b1420', '#8c4a6b', '#e8a5c2', '#fff0f6'] },
  { label: 'Sea glass', stops: ['#06201f', '#1f6f68', '#7fd1c1', '#e8fff9'] },
  { label: 'Ice Blue', stops: ['#020814', '#0b3d6b', '#58b7ff', '#e6f6ff'] },
  { label: 'Crimson', stops: ['#0a0000', '#5c0010', '#d1001f', '#ff9aa2'] },
  { label: 'Violet', stops: ['#0b0016', '#3d0a73', '#9d4edd', '#e0c3fc'] },
  { label: 'Obsidian', stops: ['#000000', '#1b1d2a', '#4a4e69', '#c9ada7'] },
  { label: 'Sakura', stops: ['#1e0b14', '#a8325e', '#f7a8c4', '#fff5f9'] },
  { label: 'Amber CRT', stops: ['#0d0600', '#663300', '#ffb000', '#ffe7a6'] },
  { label: 'Green Phosphor', stops: ['#000a00', '#004d12', '#00ff41', '#d6ffd9'] },
  { label: 'Rainbow', stops: ['#4b0082', '#0000ff', '#00ff00', '#ffff00', '#ff7f00', '#ff0000'] },
];

export const GRADIENT_OPTIONS = GRADIENTS.map((g, i) => ({ label: g.label, value: i }));

/** Thermal camera ramps. */
export const THERMAL: { label: string; stops: string[] }[] = [
  { label: 'FLIR', stops: ['#000010', '#2b0a6b', '#a3127a', '#f04c2a', '#ffb000', '#ffff9e'] },
  { label: 'White Hot', stops: ['#000000', '#ffffff'] },
  { label: 'Predator', stops: ['#00007a', '#0050ff', '#00e0ff', '#00ff40', '#ffff00', '#ff2000'] },
  { label: 'Military IR', stops: ['#001400', '#0f4d1a', '#59c26b', '#e6ffe6'] },
  { label: 'Lava', stops: ['#000000', '#560000', '#d40000', '#ff7b00', '#fff3a6'] },
  { label: 'Arctic', stops: ['#000814', '#003566', '#4ea8de', '#caf0f8', '#ffffff'] },
  { label: 'Night Watch', stops: ['#000000', '#0b2e1f', '#3fbf7f', '#d8ffe8'] },
];

export const THERMAL_OPTIONS = THERMAL.map((g, i) => ({ label: g.label, value: i }));

export const PHOTO_FILTERS = [
  'None', 'B&W', 'Sepia', 'Warm', 'Cool', 'Vintage', 'Fade', 'Cyber', 'Noir', 'Chrome', 'Matte', 'Teal & Orange',
];
