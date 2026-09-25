export interface PublicUserProfile {
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  country: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
  id: number;
  is_designer: boolean;
  is_following: boolean;
  is_me: boolean;
  role: string;
  roles: string[];
  subscription_tier: string;
  templates_count: number;
  username: string;
  uuid: string;
  website_url: string | null;
}

export interface ToggleFollowResult {
  followers_count: number;
  following: boolean;
  success: boolean;
}
