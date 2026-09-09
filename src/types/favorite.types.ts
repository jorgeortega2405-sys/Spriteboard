export type FavoriteItemType = 'canvas' | 'template';

export interface UserFavorite {
  id: number;
  user_id: number;
  item_type: FavoriteItemType;
  item_id: string;
  created_at: string;
}

export interface ToggleFavoriteDto {
  itemType: FavoriteItemType;
  itemId: string;
}

export interface UserFavoritesResult {
  favorites: UserFavorite[];
}
