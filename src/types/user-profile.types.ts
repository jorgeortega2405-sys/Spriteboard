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

export interface PublicTemplateItem {
  author_avatar?: string | null;
  author_username?: string;
  canvas_data: any;
  canvas_id: number | null;
  canvas_type: string;
  category: string;
  created_at: string;
  description: string | null;
  id: number;
  is_official: boolean;
  is_premium: boolean;
  preview_thumbnail: string | null;
  status: string;
  tags: string[];
  title: string;
  updated_at: string;
  uses_count: number;
  user_id: number;
  uuid: string;
}

export interface UserTemplatesResponse {
  templates: PublicTemplateItem[];
  total: number;
}
