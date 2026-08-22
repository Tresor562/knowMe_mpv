export type GameCenterCard = {
  key: string;
  version: number;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  categories: string[];
  modes: string[];
  estimatedMinutes: number;
  guestEligible: boolean;
  authoritativeServer: boolean;
  replayAvailable: boolean;
  economicStakeAllowed: boolean;
  favoritedAt?: string;
};

export type GameLibraryCard = {
  sessionId: string;
  game: { key: string; version: number; name: string; description: string };
  status: string;
  participantStatus: string;
  yourTurn: boolean;
  updatedAt: string;
};

export type GameCenterLibrary = {
  favorites: GameCenterCard[];
  continuePlaying: GameLibraryCard[];
  invitations: GameLibraryCard[];
  recent: GameLibraryCard[];
};

export const EMPTY_GAME_LIBRARY: GameCenterLibrary = {
  favorites: [],
  continuePlaying: [],
  invitations: [],
  recent: []
};

export function gameCenterCategories(catalog: GameCenterCard[]) {
  return [...new Set(catalog.flatMap((game) => game.categories))].sort();
}

export function filterGameCenterCatalog(
  catalog: GameCenterCard[],
  query: string,
  category: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return catalog.filter((game) => {
    if (category && !game.categories.includes(category)) return false;
    if (!normalizedQuery) return true;
    return `${game.name} ${game.description} ${game.categories.join(' ')}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}

export function gameFavoriteKeys(library: GameCenterLibrary) {
  return new Set(library.favorites.map((game) => game.key));
}
