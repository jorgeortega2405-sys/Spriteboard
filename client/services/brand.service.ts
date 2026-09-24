import { API_ROUTES } from '../config/api-routes.js';
import { deleteApi, getApi, patchApi, postApi, postFormApi } from './api.service.js';
import { AddBrandChartDto, AddBrandColorDto, AddBrandTemplateDto, BrandAssetType, BrandKit, BrandKitAsset, BrandKitChart, BrandKitColor, BrandKitDetail, BrandKitFont, BrandKitTemplate, CreateBrandKitDto, SetBrandFontDto, UpdateBrandKitDto } from '../types/brand.types.js';

export async function getBrandKitsApi(): Promise<{ error?: string; kits?: BrandKit[]; success: boolean }> {
  try {
    const res = await getApi(API_ROUTES.brandKits.base);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al cargar kits de marca', success: false };
    }
    const data = await res.json();
    return { kits: data.kits || [], success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión al cargar kits de marca', success: false };
  }
}

export async function getBrandKitDetailApi(uuid: string): Promise<{ error?: string; kit?: BrandKitDetail; success: boolean }> {
  try {
    const res = await getApi(API_ROUTES.brandKits.byId(uuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al cargar el kit de marca', success: false };
    }
    const data = await res.json();
    return { kit: data.kit, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function createBrandKitApi(dto: CreateBrandKitDto): Promise<{ error?: string; kit?: BrandKitDetail; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.base, dto);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al crear kit de marca', success: false };
    }
    const data = await res.json();
    return { kit: data.kit, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function updateBrandKitApi(uuid: string, dto: UpdateBrandKitDto): Promise<{ error?: string; kit?: BrandKitDetail; success: boolean }> {
  try {
    const res = await patchApi(API_ROUTES.brandKits.byId(uuid), dto);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al actualizar kit de marca', success: false };
    }
    const data = await res.json();
    return { kit: data.kit, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandKitApi(uuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.byId(uuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar kit de marca', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function duplicateBrandKitApi(uuid: string): Promise<{ error?: string; kit?: BrandKitDetail; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.duplicate(uuid), {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al duplicar kit de marca', success: false };
    }
    const data = await res.json();
    return { kit: data.kit, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function setDefaultBrandKitApi(uuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.default(uuid), {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al definir kit predeterminado', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function addBrandColorApi(kitUuid: string, dto: AddBrandColorDto): Promise<{ color?: BrandKitColor; error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.colors(kitUuid), dto);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al añadir color', success: false };
    }
    const data = await res.json();
    return { color: data.color, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandColorApi(kitUuid: string, colorUuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.colorById(kitUuid, colorUuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar color', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function setBrandFontsApi(kitUuid: string, fonts: SetBrandFontDto[]): Promise<{ error?: string; fonts?: BrandKitFont[]; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.fonts(kitUuid), { fonts });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al guardar tipografías', success: false };
    }
    const data = await res.json();
    return { fonts: data.fonts, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandFontApi(kitUuid: string, fontUuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.fontById(kitUuid, fontUuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar tipografía', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function uploadBrandAssetApi(
  kitUuid: string,
  file: File,
  assetType: BrandAssetType,
  category = 'general',
  name?: string,
  tags?: string[]
): Promise<{ asset?: BrandKitAsset; error?: string; success: boolean }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', assetType);
    formData.append('category', category);
    if (name) formData.append('name', name);
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags));

    const res = await postFormApi(API_ROUTES.brandKits.assets(kitUuid), formData);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al subir recurso de marca', success: false };
    }
    const data = await res.json();
    return { asset: data.asset, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandAssetApi(kitUuid: string, assetUuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.assetById(kitUuid, assetUuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar recurso de marca', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function addBrandChartApi(kitUuid: string, dto: AddBrandChartDto): Promise<{ chart?: BrandKitChart; error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.charts(kitUuid), dto);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al guardar gráfica de marca', success: false };
    }
    const data = await res.json();
    return { chart: data.chart, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandChartApi(kitUuid: string, chartUuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.chartById(kitUuid, chartUuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar gráfica', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function addBrandTemplateApi(kitUuid: string, dto: AddBrandTemplateDto): Promise<{ error?: string; success: boolean; template?: BrandKitTemplate }> {
  try {
    const res = await postApi(API_ROUTES.brandKits.templates(kitUuid), dto);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al vincular plantilla de marca', success: false };
    }
    const data = await res.json();
    return { success: true, template: data.template };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}

export async function deleteBrandTemplateApi(kitUuid: string, templateUuid: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.brandKits.templateById(kitUuid, templateUuid));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Error al eliminar plantilla', success: false };
    }
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error de conexión', success: false };
  }
}
