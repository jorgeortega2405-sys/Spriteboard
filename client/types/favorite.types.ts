export type FavoriteItemType = 'canvas' | 'template';

export interface UserFavoriteItem {
  id: number;
  user_id: number;
  item_type: FavoriteItemType;
  item_id: string;
  created_at: string;
}

export interface ToggleFavoriteResponse {
  success: boolean;
  isFavorite: boolean;
}

export interface FavoritesResponse {
  favorites: UserFavoriteItem[];
}
