export type BrandAssetType = 'logo' | 'photo' | 'element' | 'graphic' | 'icon' | 'font';

export type BrandColorType = 'primary' | 'secondary' | 'accent' | 'neutral' | 'background' | 'text' | 'gradient';

export type BrandFontRole = 'title' | 'subtitle' | 'heading_2' | 'body' | 'quote' | 'caption' | string;

export interface GradientStop {
  color: string;
  offset: number;
}

export interface BrandGradientData {
  angle?: number;
  stops: GradientStop[];
  type: 'linear' | 'radial';
}

export interface BrandKit {
  brand_guidelines: Record<string, any> | null;
  brand_voice: string | null;
  color: string;
  created_at: string;
  description: string | null;
  icon: string | null;
  id: number;
  is_default: boolean;
  name: string;
  team_id: number | null;
  updated_at: string;
  user_id: number;
  uuid: string;
}

export interface BrandKitColor {
  brand_kit_id: number;
  color_type: BrandColorType;
  created_at: string;
  gradient_data: BrandGradientData | null;
  hex: string;
  id: number;
  name: string;
  palette_name: string;
  sort_order: number;
  uuid: string;
}

export interface BrandKitFont {
  brand_kit_id: number;
  created_at: string;
  font_family: string;
  font_size: number | null;
  font_style: string;
  font_url: string | null;
  font_weight: string;
  id: number;
  letter_spacing: string | null;
  line_height: number | null;
  role: BrandFontRole;
  uuid: string;
}

export interface BrandKitAsset {
  asset_type: BrandAssetType;
  brand_kit_id: number;
  category: string;
  created_at: string;
  file_path: string;
  height: number | null;
  id: number;
  mime_type: string;
  name: string;
  preview_url: string | null;
  size_bytes: number;
  sort_order: number;
  tags: string[] | null;
  url: string;
  uuid: string;
  width: number | null;
}

export interface BrandKitChart {
  brand_kit_id: number;
  chart_type: string;
  config: Record<string, any> | null;
  created_at: string;
  id: number;
  name: string;
  palette: string[];
  sample_data: any;
  sort_order: number;
  uuid: string;
}

export interface BrandKitTemplate {
  brand_kit_id: number;
  canvas_data: any;
  canvas_id: number | null;
  canvas_type: 'board' | 'presentation' | 'doc';
  created_at: string;
  description: string | null;
  id: number;
  name: string;
  preview_thumbnail: string | null;
  sort_order: number;
  uuid: string;
}

export interface BrandKitDetail extends BrandKit {
  charts: BrandKitChart[];
  colors: BrandKitColor[];
  custom_fonts: BrandKitAsset[];
  elements: BrandKitAsset[];
  fonts: BrandKitFont[];
  logos: BrandKitAsset[];
  photos: BrandKitAsset[];
  templates: BrandKitTemplate[];
}

export interface CreateBrandKitDto {
  brand_guidelines?: Record<string, any>;
  brand_voice?: string;
  color?: string;
  description?: string;
  icon?: string;
  is_default?: boolean;
  name: string;
  team_id?: number | null;
}

export interface UpdateBrandKitDto {
  brand_guidelines?: Record<string, any>;
  brand_voice?: string;
  color?: string;
  description?: string;
  icon?: string;
  is_default?: boolean;
  name?: string;
}

export interface AddBrandColorDto {
  color_type?: BrandColorType;
  gradient_data?: BrandGradientData;
  hex: string;
  name: string;
  palette_name?: string;
  sort_order?: number;
}

export interface SetBrandFontDto {
  font_family: string;
  font_size?: number | null;
  font_style?: string;
  font_url?: string | null;
  font_weight?: string;
  letter_spacing?: string | null;
  line_height?: number | null;
  role: BrandFontRole;
}

export interface AddBrandChartDto {
  chart_type?: string;
  config?: Record<string, any>;
  name: string;
  palette: string[];
  sample_data?: any;
}

export interface AddBrandTemplateDto {
  canvas_data?: any;
  canvas_type?: 'board' | 'presentation' | 'doc';
  canvas_uuid?: string;
  description?: string;
  name: string;
  preview_thumbnail?: string;
}
