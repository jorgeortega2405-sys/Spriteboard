export const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_API_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBFsBn3Hi6CLH904UXGgOHP-rXORvs1-Us';

export type MapTypeOption = 'hybrid' | 'roadmap' | 'satellite' | 'terrain';
export type MapStyleOption = 'dark' | 'retro' | 'silver' | 'standard';

export interface MapPresetLocation {
  address: string;
  country: string;
  name: string;
}

export const MAP_PRESET_LOCATIONS: MapPresetLocation[] = [
  { address: 'Madrid, España', country: 'España', name: 'Madrid' },
  { address: 'Ciudad de México, CDMX, México', country: 'México', name: 'Ciudad de México' },
  { address: 'Paris, France', country: 'Francia', name: 'París' },
  { address: 'New York, NY, USA', country: 'EE. UU.', name: 'Nueva York' },
  { address: 'Tokyo, Japan', country: 'Japón', name: 'Tokio' },
  { address: 'Buenos Aires, Argentina', country: 'Argentina', name: 'Buenos Aires' },
  { address: 'Bogotá, Colombia', country: 'Colombia', name: 'Bogotá' },
  { address: 'Rome, Italy', country: 'Italia', name: 'Roma' },
];

const DARK_MAP_STYLE = 'element:geometry|color:0x242f3e&style=element:labels.text.stroke|color:0x242f3e&style=element:labels.text.fill|color:0x746855&style=feature:administrative.locality|element:labels.text.fill|color:0xd59563&style=feature:poi|element:labels.text.fill|color:0xd59563&style=feature:poi.park|element:geometry|color:0x263c3f&style=feature:poi.park|element:labels.text.fill|color:0x6b9a76&style=feature:road|element:geometry|color:0x38414e&style=feature:road|element:geometry.stroke|color:0x212a37&style=feature:road|element:labels.text.fill|color:0x9ca5b3&style=feature:road.highway|element:geometry|color:0x746855&style=feature:road.highway|element:geometry.stroke|color:0x1f2835&style=feature:road.highway|element:labels.text.fill|color:0xf3d19c&style=feature:transit|element:geometry|color:0x2f3948&style=feature:transit.station|element:labels.text.fill|color:0xd59563&style=feature:water|element:geometry|color:0x17263c&style=feature:water|element:labels.text.fill|color:0x515c6d&style=feature:water|element:labels.text.stroke|color:0x17263c';

const SILVER_MAP_STYLE = 'element:geometry|color:0xf5f5f5&style=element:labels.icon|visibility:off&style=element:labels.text.fill|color:0x616161&style=element:labels.text.stroke|color:0xf5f5f5&style=feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd&style=feature:poi|element:geometry|color:0xeeeeee&style=feature:poi|element:labels.text.fill|color:0x757575&style=feature:poi.park|element:geometry|color:0xe5e5e5&style=feature:poi.park|element:labels.text.fill|color:0x9e9e9e&style=feature:road|element:geometry|color:0xffffff&style=feature:road.arterial|element:labels.text.fill|color:0x757575&style=feature:road.highway|element:geometry|color:0xdadada&style=feature:road.highway|element:labels.text.fill|color:0x616161&style=feature:road.local|element:labels.text.fill|color:0x9e9e9e&style=feature:transit.line|element:geometry|color:0xe5e5e5&style=feature:transit.station|element:geometry|color:0xeeeeee&style=feature:water|element:geometry|color:0xc9c9c9&style=feature:water|element:labels.text.fill|color:0x9e9e9e';

export function buildStaticMapUrl(options: {
  address: string;
  height?: number;
  mapType?: MapTypeOption;
  markerColor?: string;
  showMarker?: boolean;
  styleTheme?: MapStyleOption;
  width?: number;
  zoom?: number;
}): string {
  const address = encodeURIComponent(options.address.trim() || 'Madrid, España');
  const zoom = options.zoom ?? 14;
  const width = options.width ?? 640;
  const height = options.height ?? 400;
  const mapType = options.mapType || 'roadmap';
  const showMarker = options.showMarker !== false;
  const markerColor = options.markerColor || 'red';

  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${address}&zoom=${zoom}&size=${width}x${height}&maptype=${mapType}&scale=2&key=${GOOGLE_MAPS_API_KEY}`;

  if (showMarker) {
    url += `&markers=color:${encodeURIComponent(markerColor)}%7C${address}`;
  }

  if (options.styleTheme === 'dark') {
    url += `&style=${DARK_MAP_STYLE}`;
  } else if (options.styleTheme === 'silver') {
    url += `&style=${SILVER_MAP_STYLE}`;
  }

  return url;
}

export function buildEmbedMapUrl(address: string, zoom = 14): string {
  const q = encodeURIComponent(address.trim() || 'Madrid, España');
  return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${q}&zoom=${zoom}`;
}

export function getGoogleMapsExternalUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export async function fetchMapImageBlob(mapUrl: string): Promise<{ blob: Blob; dataUrl: string }> {
  const res = await fetch(mapUrl);
  if (!res.ok) {
    throw new Error('No se pudo generar la imagen del mapa de Google Maps.');
  }
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al procesar el mapa.'));
    reader.readAsDataURL(blob);
  });
  return { blob, dataUrl };
}
