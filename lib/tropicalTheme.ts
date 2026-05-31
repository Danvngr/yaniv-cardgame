export const tropicalColors = {
  woodDark: '#5C4A32',
  woodMid: '#8B7355',
  woodDeep: '#4B3728',
  woodLight: '#D4A574',
  woodBorder: '#6B5344',
  cream: '#F5E6D3',
  creamMuted: 'rgba(245, 230, 211, 0.85)',
  bamboo: '#6B8E4E',
  bambooDark: '#4A6B38',
  wicker: '#E8DCC8',
  wickerDark: '#C4A882',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gold: '#FBBF24',
  goldDark: '#92400E',
  danger: '#DC2626',
};

export const tropicalGradients = {
  /** Dark carved-wood buttons — cool brown, no orange */
  woodButton: ['#6B5344', '#5C4A32', '#3A2D20'] as const,
  /** Slightly lighter plank for secondary actions */
  wickerWood: ['#8B7355', '#6B5344', '#5C4A32'] as const,
  button: ['#6B5344', '#5C4A32', '#3A2D20'] as const,
  panel: ['#8B7355', '#6B5344', '#5C4A32'] as const,
  wicker: ['#F0E4CE', '#E8DCC8', '#C4A882'] as const,
  /** Yaniv title — wood sign, not orange */
  titleYaniv: ['#8B7355', '#6B5344', '#4B3728'] as const,
  titleAssaf: ['#EF4444', '#DC2626', '#991B1B'] as const,
  gold: ['#FBBF24', '#F59E0B', '#D97706'] as const,
};
