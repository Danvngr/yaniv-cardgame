import { Asset } from 'expo-asset';

// All card images
const CARD_IMAGES = {
  // Clubs
  'clubs-A': require('../assets/images/cards/clubs/1 -clubs.png'),
  'clubs-2': require('../assets/images/cards/clubs/2 -clubs.png'),
  'clubs-3': require('../assets/images/cards/clubs/3 -clubs.png'),
  'clubs-4': require('../assets/images/cards/clubs/4 -clubs.png'),
  'clubs-5': require('../assets/images/cards/clubs/5 -clubs.png'),
  'clubs-6': require('../assets/images/cards/clubs/6 -clubs.png'),
  'clubs-7': require('../assets/images/cards/clubs/7-clubs.png'),
  'clubs-8': require('../assets/images/cards/clubs/8 -clubs.png'),
  'clubs-9': require('../assets/images/cards/clubs/9 -clubs.png'),
  'clubs-10': require('../assets/images/cards/clubs/10 -clubs.png'),
  'clubs-J': require('../assets/images/cards/clubs/j -clubs.png'),
  'clubs-Q': require('../assets/images/cards/clubs/q -clubs.png'),
  'clubs-K': require('../assets/images/cards/clubs/k -clubs.png'),
  
  // Diamonds
  'diamonds-A': require('../assets/images/cards/diamonds/1-diamonds-Photoroom.png'),
  'diamonds-2': require('../assets/images/cards/diamonds/2-diamonds-Photoroom.png'),
  'diamonds-3': require('../assets/images/cards/diamonds/3-diamonds-Photoroom.png'),
  'diamonds-4': require('../assets/images/cards/diamonds/4-diamonds-Photoroom.png'),
  'diamonds-5': require('../assets/images/cards/diamonds/5-diamonds-Photoroom.png'),
  'diamonds-6': require('../assets/images/cards/diamonds/6-diamonds-Photoroom.png'),
  'diamonds-7': require('../assets/images/cards/diamonds/7-diamonds-Photoroom.png'),
  'diamonds-8': require('../assets/images/cards/diamonds/8-diamonds-Photoroom.png'),
  'diamonds-9': require('../assets/images/cards/diamonds/9-diamonds-Photoroom.png'),
  'diamonds-10': require('../assets/images/cards/diamonds/10-diamonds-Photoroom.png'),
  'diamonds-J': require('../assets/images/cards/diamonds/J-diamonds-Photoroom.png'),
  'diamonds-Q': require('../assets/images/cards/diamonds/Q-diamonds-Photoroom.png'),
  'diamonds-K': require('../assets/images/cards/diamonds/K-diamonds-Photoroom.png'),
  
  // Hearts
  'hearts-A': require('../assets/images/cards/hearts/1-hearts.png'),
  'hearts-2': require('../assets/images/cards/hearts/2-hearts.png'),
  'hearts-3': require('../assets/images/cards/hearts/3-hearts.png'),
  'hearts-4': require('../assets/images/cards/hearts/4-hearts.png'),
  'hearts-5': require('../assets/images/cards/hearts/5-hearts.png'),
  'hearts-6': require('../assets/images/cards/hearts/6-hearts.png'),
  'hearts-7': require('../assets/images/cards/hearts/7-hearts.png'),
  'hearts-8': require('../assets/images/cards/hearts/8-hearts.png'),
  'hearts-9': require('../assets/images/cards/hearts/9-hearts.png'),
  'hearts-10': require('../assets/images/cards/hearts/10-hearts.png'),
  'hearts-J': require('../assets/images/cards/hearts/J-hearts.png'),
  'hearts-Q': require('../assets/images/cards/hearts/Q-hearts.png'),
  'hearts-K': require('../assets/images/cards/hearts/K-hearts.png'),
  
  // Spades
  'spades-A': require('../assets/images/cards/spades/1-spades-Photoroom.png'),
  'spades-2': require('../assets/images/cards/spades/2-spades-Photoroom.png'),
  'spades-3': require('../assets/images/cards/spades/3-spades-Photoroom.png'),
  'spades-4': require('../assets/images/cards/spades/4-spades-Photoroom.png'),
  'spades-5': require('../assets/images/cards/spades/5-spades-Photoroom.png'),
  'spades-6': require('../assets/images/cards/spades/6-spades-Photoroom.png'),
  'spades-7': require('../assets/images/cards/spades/7-spades-Photoroom.png'),
  'spades-8': require('../assets/images/cards/spades/8-spades-Photoroom.png'),
  'spades-9': require('../assets/images/cards/spades/9-spades-Photoroom.png'),
  'spades-10': require('../assets/images/cards/spades/10-spades-Photoroom.png'),
  'spades-J': require('../assets/images/cards/spades/J-spades-Photoroom.png'),
  'spades-Q': require('../assets/images/cards/spades/Q-spades-Photoroom.png'),
  'spades-K': require('../assets/images/cards/spades/K-spades-Photoroom.png'),
  
  // Joker
  'joker': require('../assets/images/cards/joker.png'),
};

// Background images
const BACKGROUND_IMAGES = {
  'lobby-background': require('../assets/images/lobby-background.png'),
  'tropical-background': require('../assets/images/tropical-background.jpg'),
  'card-back': require('../assets/images/card-back.jpg'),
};

// Combine all images
const ALL_IMAGES = {
  ...CARD_IMAGES,
  ...BACKGROUND_IMAGES,
};

// Get array of all image sources
const getAllImageSources = () => Object.values(ALL_IMAGES);

// Preload all assets
export const preloadAssets = async (
  onProgress?: (loaded: number, total: number) => void
): Promise<void> => {
  const imageSources = getAllImageSources();
  const total = imageSources.length;
  let loaded = 0;

  // Load images in batches to prevent overwhelming the system
  const batchSize = 10;
  const batches: (typeof imageSources)[] = [];
  
  for (let i = 0; i < imageSources.length; i += batchSize) {
    batches.push(imageSources.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (source) => {
        try {
          await Asset.fromModule(source).downloadAsync();
        } catch (error) {
          console.warn('Failed to preload asset:', error);
        }
        loaded++;
        onProgress?.(loaded, total);
      })
    );
  }
};

// Export for use in other files if needed
export { CARD_IMAGES, BACKGROUND_IMAGES };
