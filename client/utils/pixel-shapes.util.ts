export type ShapeCategory = 'shapes' | 'templates';
export type ShapeColorMode = 'original' | 'primary';

export interface PixelShape {
  id: string;
  name: string;
  category: ShapeCategory;
  type: 'vector' | 'sticker';
  file?: string;
  pathD?: string;
  width: number;
  height: number;
}

export const SHAPE_SVG_PATHS: Record<string, string> = {
  arch: 'M 6 42 V 24 A 18 18 0 0 1 42 24 V 42 Z',
  arrow_double_horizontal: 'M 16 12 L 4 24 L 16 36 V 28 H 32 V 36 L 44 24 L 32 12 V 20 H 16 Z',
  arrow_double_vertical: 'M 12 16 L 24 4 L 36 16 H 28 V 32 H 36 L 24 44 L 12 32 H 20 V 16 Z',
  arrow_down: 'M 16 4 V 24 H 6 L 24 44 L 42 24 H 32 V 4 Z',
  arrow_left: 'M 44 16 H 24 V 6 L 4 24 L 24 42 V 32 H 44 Z',
  arrow_pointed_double: 'M 14 12 L 4 24 L 14 36 L 8 24 Z M 34 12 L 44 24 L 34 36 L 40 24 Z M 8 20 H 40 V 28 H 8 Z',
  arrow_pointed_left: 'M 44 14 L 32 24 L 44 34 H 24 V 42 L 4 24 L 24 6 V 14 Z',
  arrow_ribbon: 'M 4 10 H 30 L 44 24 L 30 38 H 4 Z',
  arrow_right: 'M 4 16 H 24 V 6 L 44 24 L 24 42 V 32 H 4 Z',
  arrow_up: 'M 16 44 V 24 H 6 L 24 4 L 42 24 H 32 V 44 Z',
  banner_horizontal_ribbon: 'M 2 12 L 10 24 L 2 36 H 46 L 38 24 L 46 12 Z',
  banner_rounded_notch: 'M 14 4 H 34 A 6 6 0 0 1 40 10 V 44 L 24 34 L 8 44 V 10 A 6 6 0 0 1 14 4 Z',
  banner_rounded_point: 'M 14 4 H 34 A 6 6 0 0 1 40 10 V 34 L 24 44 L 8 34 V 10 A 6 6 0 0 1 14 4 Z',
  banner_vertical_notch: 'M 8 4 H 40 V 44 L 24 34 L 8 44 Z',
  banner_vertical_point: 'M 8 4 H 40 V 34 L 24 44 L 8 34 Z',
  barrel: 'M 6 12 Q 24 4 42 12 V 36 Q 24 44 6 36 Z',
  burst_10: 'M 24 4 L 28.64 9.73 L 35.76 7.82 L 36.14 15.18 L 43.02 17.82 L 39 24 L 43.02 30.18 L 36.14 32.82 L 35.76 40.18 L 28.64 38.27 L 24 44 L 19.36 38.27 L 12.24 40.18 L 11.86 32.82 L 4.98 30.18 L 9 24 L 4.98 17.82 L 11.86 15.18 L 12.24 7.82 L 19.36 9.73 Z',
  burst_12: 'M 24 4 L 28.14 8.55 L 34 6.68 L 35.31 12.69 L 41.32 14 L 39.45 19.86 L 44 24 L 39.45 28.14 L 41.32 34 L 35.31 35.31 L 34 41.32 L 28.14 39.45 L 24 44 L 19.86 39.45 L 14 41.32 L 12.69 35.31 L 6.68 34 L 8.55 28.14 L 4 24 L 8.55 19.86 L 6.68 14 L 12.69 12.69 L 14 6.68 L 19.86 8.55 Z',
  burst_16: 'M 24 4 L 27.32 7.33 L 31.65 5.52 L 33.44 9.87 L 38.14 9.86 L 38.13 14.56 L 42.48 16.35 L 40.67 20.68 L 44 24 L 40.67 27.32 L 42.48 31.65 L 38.13 33.44 L 38.14 38.14 L 33.44 38.13 L 31.65 42.48 L 27.32 40.67 L 24 44 L 20.68 40.67 L 16.35 42.48 L 14.56 38.13 L 9.86 38.14 L 9.87 33.44 L 5.52 31.65 L 7.33 27.32 L 4 24 L 7.33 20.68 L 5.52 16.35 L 9.87 14.56 L 9.86 9.86 L 14.56 9.87 L 16.35 5.52 L 20.68 7.33 Z',
  burst_20: 'M 24 4 L 26.74 6.72 L 30.18 4.98 L 31.94 8.41 L 35.76 7.82 L 36.37 11.63 L 40.18 12.24 L 39.59 16.06 L 43.02 17.82 L 41.28 21.26 L 44 24 L 41.28 26.74 L 43.02 30.18 L 39.59 31.94 L 40.18 35.76 L 36.37 36.37 L 35.76 40.18 L 31.94 39.59 L 30.18 43.02 L 26.74 41.28 L 24 44 L 21.26 41.28 L 17.82 43.02 L 16.06 39.59 L 12.24 40.18 L 11.63 36.37 L 7.82 35.76 L 8.41 31.94 L 4.98 30.18 L 6.72 26.74 L 4 24 L 6.72 21.26 L 4.98 17.82 L 8.41 16.06 L 7.82 12.24 L 11.63 11.63 L 12.24 7.82 L 16.06 8.41 L 17.82 4.98 L 21.26 6.72 Z',
  burst_24: 'M 24 4 L 26.35 6.15 L 29.18 4.68 L 30.89 7.37 L 34 6.68 L 34.96 9.72 L 38.14 9.86 L 38.28 13.04 L 41.32 14 L 40.63 17.11 L 43.32 18.82 L 41.85 21.65 L 44 24 L 41.85 26.35 L 43.32 29.18 L 40.63 30.89 L 41.32 34 L 38.28 34.96 L 38.14 38.14 L 34.96 38.28 L 34 41.32 L 30.89 40.63 L 29.18 43.32 L 26.35 41.85 L 24 44 L 21.65 41.85 L 18.82 43.32 L 17.11 40.63 L 14 41.32 L 13.04 38.28 L 9.86 38.14 L 9.72 34.96 L 6.68 34 L 7.37 30.89 L 4.68 29.18 L 6.15 26.35 L 4 24 L 6.15 21.65 L 4.68 18.82 L 7.37 17.11 L 6.68 14 L 9.72 13.04 L 9.86 9.86 L 13.04 9.72 L 14 6.68 L 17.11 7.37 L 18.82 4.68 L 21.65 6.15 Z',
  callout_cloud: 'M 14 16 C 12 10 20 6 26 8 C 30 5 38 8 38 14 C 43 15 45 23 41 27 C 44 32 39 38 33 37 C 30 40 22 39 20 36 C 15 39 8 34 9 29 C 4 26 6 18 14 16 Z M 10 42 A 2 2 0 1 0 10 38 A 2 2 0 1 0 10 42 Z M 6 45 A 1.5 1.5 0 1 0 6 42 A 1.5 1.5 0 1 0 6 45 Z',
  callout_curved_tail: 'M 14 6 H 34 A 8 8 0 0 1 42 14 V 26 A 8 8 0 0 1 34 34 H 18 Q 12 40 6 44 Q 10 38 10 34 H 14 A 8 8 0 0 1 6 26 V 14 A 8 8 0 0 1 14 6 Z',
  callout_oval: 'M 24 6 C 35 6 44 12 44 20 C 44 28 35 34 24 34 C 20 34 16 33 13 31 L 6 38 L 8 28 C 5 26 4 23 4 20 C 4 12 13 6 24 6 Z',
  callout_rectangular: 'M 4 6 H 44 V 34 H 18 L 8 44 V 34 H 4 Z',
  callout_rounded_rect: 'M 14 6 H 34 A 8 8 0 0 1 42 14 V 26 A 8 8 0 0 1 34 34 H 18 L 8 44 V 34 H 14 A 8 8 0 0 1 6 26 V 14 A 8 8 0 0 1 14 6 Z',
  chamfer_square: 'M 14 4 H 34 L 44 14 V 34 L 34 44 H 14 L 4 34 V 14 Z',
  chevron_right: 'M 8 6 H 24 L 40 24 L 24 42 H 8 L 24 24 Z',
  circle: 'M 24 4 A 20 20 0 1 0 24 44 A 20 20 0 1 0 24 4 Z',
  cloud_flat_base_multi: 'M 6 36 H 42 C 45 36 46 31 43 28 C 45 23 41 18 36 19 C 34 13 26 12 23 17 C 20 14 14 15 13 20 C 8 21 6 26 8 31 C 6 33 5 36 6 36 Z',
  cloud_flat_base_triple: 'M 6 36 H 42 C 45 36 45 28 40 27 C 41 18 29 14 24 19 C 20 15 10 18 10 26 C 6 28 5 36 6 36 Z',
  cloud_fluffy_soft: 'M 6 36 H 42 C 46 36 45 26 39 25 C 38 16 26 14 22 21 C 18 17 8 20 8 28 C 5 30 5 36 6 36 Z',
  cloud_puffy_full: 'M 16 16 C 14 10 22 6 28 9 C 33 5 41 9 40 16 C 45 18 46 26 41 30 C 44 36 38 42 32 40 C 28 43 20 42 18 38 C 12 40 6 35 8 29 C 4 24 7 17 16 16 Z',
  cloud_round_dome: 'M 8 36 H 40 C 44 36 44 26 38 25 C 36 12 18 12 14 25 C 7 26 6 36 8 36 Z',
  clover_4_leaves: 'M 24 24 C 16 20 8 16 12 8 C 16 4 20 8 24 16 C 28 8 32 4 36 8 C 40 16 32 20 24 24 C 28 32 32 40 36 36 C 40 28 32 28 24 24 C 16 28 8 28 12 36 C 16 40 20 32 24 24 Z',
  cross: 'M 18 4 H 30 V 18 H 44 V 30 H 30 V 44 H 18 V 30 H 4 V 18 H 18 Z',
  decagon: 'M 24 4 L 35.76 7.82 L 43.02 17.82 L 43.02 30.18 L 35.76 40.18 L 24 44 L 12.24 40.18 L 4.98 30.18 L 4.98 17.82 L 12.24 7.82 Z',
  diamond: 'M 24 4 L 44 24 L 24 44 L 4 24 Z',
  flow_data: 'M 14 8 H 44 L 34 40 H 4 Z',
  flow_decision: 'M 24 4 L 44 24 L 24 44 L 4 24 Z',
  flow_delay: 'M 6 8 H 28 A 16 16 0 0 1 28 40 H 6 Z',
  flow_document: 'M 4 6 H 44 V 36 Q 34 30 24 38 Q 14 46 4 38 Z',
  flow_manual: 'M 4 8 H 44 L 36 40 H 12 Z',
  flow_merge: 'M 24 42 L 4 8 H 44 Z',
  flow_offpage: 'M 6 8 H 36 L 44 24 L 36 40 H 6 Z',
  flow_preparation: 'M 12 6 H 36 L 46 24 L 36 42 H 12 L 2 24 Z',
  flow_process: 'M 4 10 H 44 V 38 H 4 Z',
  flow_shield: 'M 6 8 H 42 V 32 L 24 42 L 6 32 Z',
  flow_terminator: 'M 14 10 H 34 A 14 14 0 0 1 34 38 H 14 A 14 14 0 0 1 14 10 Z',
  flower_4_petals_cross: 'M 24 24 C 18 18 14 8 24 4 C 34 8 30 18 24 24 C 30 30 40 26 44 36 C 36 46 30 30 24 24 C 18 30 8 34 4 24 C 14 14 18 30 24 24 Z',
  flower_6_petals_center_hole: 'M 24 11 L 29.44 3.72 L 34.5 5.81 L 33.19 14.81 L 35.26 17.5 L 44.28 18.56 L 45 24 L 36.56 27.36 L 35.26 30.5 L 38.85 38.85 L 34.5 42.19 L 27.36 36.56 L 24 37 L 18.56 44.28 L 13.5 42.19 L 14.81 33.19 L 12.74 30.5 L 3.72 29.44 L 3 24 L 11.44 20.64 L 12.74 17.5 L 9.15 9.15 L 13.5 5.81 L 20.64 11.44 Z M 20 24 A 4 4 0 1 0 28 24 A 4 4 0 1 0 20 24 Z',
  flower_6_petals_drop: 'M 24 4 C 21 12 21 16 24 24 C 27 16 27 12 24 4 Z M 41 14 C 33 16 30 19 24 24 C 32 23 35 21 41 14 Z M 41 34 C 35 27 32 25 24 24 C 30 29 33 32 41 34 Z M 24 44 C 27 36 27 32 24 24 C 21 32 21 36 24 44 Z M 7 34 C 15 32 18 29 24 24 C 16 25 13 27 7 34 Z M 7 14 C 13 21 16 23 24 24 C 18 19 15 16 7 14 Z',
  flower_8_petals_round: 'M 24 3 L 29.36 11.07 L 38.85 9.15 L 36.93 18.64 L 45 24 L 36.93 29.36 L 38.85 38.85 L 29.36 36.93 L 24 45 L 18.64 36.93 L 9.15 38.85 L 11.07 29.36 L 3 24 L 11.07 18.64 L 9.15 9.15 L 18.64 11.07 Z',
  flower_8_petals_sharp: 'M 24 3 L 26.68 17.53 L 38.85 9.15 L 30.47 21.32 L 45 24 L 30.47 26.68 L 38.85 38.85 L 26.68 30.47 L 24 45 L 21.32 30.47 L 9.15 38.85 L 17.53 26.68 L 3 24 L 17.53 21.32 L 9.15 9.15 L 21.32 17.53 Z',
  gear_12_teeth_large_hole: 'M 24 9 L 26.74 3.18 L 29.44 3.72 L 29.74 10.14 L 31.5 11.01 L 36.78 7.34 L 38.85 9.15 L 35.9 14.87 L 36.99 16.5 L 43.4 15.96 L 44.28 18.56 L 38.87 22.04 L 39 24 L 44.82 26.74 L 44.28 29.44 L 37.86 29.74 L 36.99 31.5 L 40.66 36.78 L 38.85 38.85 L 33.13 35.9 L 31.5 36.99 L 32.04 43.4 L 29.44 44.28 L 25.96 38.87 L 24 39 L 21.26 44.82 L 18.56 44.28 L 18.26 37.86 L 16.5 36.99 L 11.22 40.66 L 9.15 38.85 L 12.1 33.13 L 11.01 31.5 L 4.6 32.04 L 3.72 29.44 L 9.13 25.96 L 9 24 L 3.18 21.26 L 3.72 18.56 L 10.14 18.26 L 11.01 16.5 L 7.34 11.22 L 9.15 9.15 L 14.87 12.1 L 16.5 11.01 L 15.96 4.6 L 18.56 3.72 L 22.04 9.13 Z M 14 24 A 10 10 0 1 0 34 24 A 10 10 0 1 0 14 24 Z',
  gear_12_teeth_pointed: 'M 24 3 L 27.62 10.48 L 34.5 5.81 L 33.9 14.1 L 42.19 13.5 L 37.52 20.38 L 45 24 L 37.52 27.62 L 42.19 34.5 L 33.9 33.9 L 34.5 42.19 L 27.62 37.52 L 24 45 L 20.38 37.52 L 13.5 42.19 L 14.1 33.9 L 5.81 34.5 L 10.48 27.62 L 3 24 L 10.48 20.38 L 5.81 13.5 L 14.1 14.1 L 13.5 5.81 L 20.38 10.48 Z M 16 24 A 8 8 0 1 0 32 24 A 8 8 0 1 0 16 24 Z',
  gear_12_teeth_small_hole: 'M 24 9 L 26.74 3.18 L 29.44 3.72 L 29.74 10.14 L 31.5 11.01 L 36.78 7.34 L 38.85 9.15 L 35.9 14.87 L 36.99 16.5 L 43.4 15.96 L 44.28 18.56 L 38.87 22.04 L 39 24 L 44.82 26.74 L 44.28 29.44 L 37.86 29.74 L 36.99 31.5 L 40.66 36.78 L 38.85 38.85 L 33.13 35.9 L 31.5 36.99 L 32.04 43.4 L 29.44 44.28 L 25.96 38.87 L 24 39 L 21.26 44.82 L 18.56 44.28 L 18.26 37.86 L 16.5 36.99 L 11.22 40.66 L 9.15 38.85 L 12.1 33.13 L 11.01 31.5 L 4.6 32.04 L 3.72 29.44 L 9.13 25.96 L 9 24 L 3.18 21.26 L 3.72 18.56 L 10.14 18.26 L 11.01 16.5 L 7.34 11.22 L 9.15 9.15 L 14.87 12.1 L 16.5 11.01 L 15.96 4.6 L 18.56 3.72 L 22.04 9.13 Z M 20 24 A 4 4 0 1 0 28 24 A 4 4 0 1 0 20 24 Z',
  gear_14_teeth_pointed: 'M 24 3 L 27.12 10.35 L 33.11 5.08 L 32.73 13.05 L 40.42 10.91 L 36.61 17.93 L 44.47 19.33 L 38 24 L 44.47 28.67 L 36.61 30.07 L 40.42 37.09 L 32.73 34.95 L 33.11 42.92 L 27.12 37.65 L 24 45 L 20.88 37.65 L 14.89 42.92 L 15.27 34.95 L 7.58 37.09 L 11.39 30.07 L 3.53 28.67 L 10 24 L 3.53 19.33 L 11.39 17.93 L 7.58 10.91 L 15.27 13.05 L 14.89 5.08 L 20.88 10.35 Z M 18 24 A 6 6 0 1 0 30 24 A 6 6 0 1 0 18 24 Z',
  gear_16_teeth_large_hole: 'M 24 8 L 26.06 3.1 L 28.1 3.4 L 28.64 8.69 L 30.12 9.22 L 33.9 5.48 L 35.67 6.54 L 34.15 11.63 L 35.31 12.69 L 40.23 10.68 L 41.46 12.33 L 38.11 16.46 L 38.78 17.88 L 44.1 17.9 L 44.6 19.9 L 39.92 22.43 L 40 24 L 44.9 26.06 L 44.6 28.1 L 39.31 28.64 L 38.78 30.12 L 42.52 33.9 L 41.46 35.67 L 36.37 34.15 L 35.31 35.31 L 37.32 40.23 L 35.67 41.46 L 31.54 38.11 L 30.12 38.78 L 30.1 44.1 L 28.1 44.6 L 25.57 39.92 L 24 40 L 21.94 44.9 L 19.9 44.6 L 19.36 39.31 L 17.88 38.78 L 14.1 42.52 L 12.33 41.46 L 13.85 36.37 L 12.69 35.31 L 7.77 37.32 L 6.54 35.67 L 9.89 31.54 L 9.22 30.12 L 3.9 30.1 L 3.4 28.1 L 8.08 25.57 L 8 24 L 3.1 21.94 L 3.4 19.9 L 8.69 19.36 L 9.22 17.88 L 5.48 14.1 L 6.54 12.33 L 11.63 13.85 L 12.69 12.69 L 10.68 7.77 L 12.33 6.54 L 16.46 9.89 L 17.88 9.22 L 17.9 3.9 L 19.9 3.4 L 22.43 8.08 Z M 13 24 A 11 11 0 1 0 35 24 A 11 11 0 1 0 13 24 Z',
  gear_16_teeth_pointed: 'M 24 3 L 26.93 9.29 L 32.04 4.6 L 32.33 11.53 L 38.85 9.15 L 36.47 15.67 L 43.4 15.96 L 38.71 21.07 L 45 24 L 38.71 26.93 L 43.4 32.04 L 36.47 32.33 L 38.85 38.85 L 32.33 36.47 L 32.04 43.4 L 26.93 38.71 L 24 45 L 21.07 38.71 L 15.96 43.4 L 15.67 36.47 L 9.15 38.85 L 11.53 32.33 L 4.6 32.04 L 9.29 26.93 L 3 24 L 9.29 21.07 L 4.6 15.96 L 11.53 15.67 L 9.15 9.15 L 15.67 11.53 L 15.96 4.6 L 21.07 9.29 Z M 16 24 A 8 8 0 1 0 32 24 A 8 8 0 1 0 16 24 Z',
  heart_classic: 'M 24 40 C 14 30 4 22 4 14 A 10 10 0 0 1 24 10 A 10 10 0 0 1 44 14 C 44 22 34 30 24 40 Z',
  heart_narrow: 'M 24 42 C 16 32 8 22 8 13 A 8 8 0 0 1 24 10 A 8 8 0 0 1 40 13 C 40 22 32 32 24 42 Z',
  heart_playful: 'M 24 38 C 10 26 4 19 6 12 A 9 9 0 0 1 24 14 A 9 9 0 0 1 42 10 C 45 17 38 26 24 38 Z',
  heart_rounded: 'M 24 40 C 16 32 6 24 6 16 A 9 9 0 0 1 24 12 A 9 9 0 0 1 42 16 C 42 24 32 32 24 40 Z',
  heart_wide: 'M 24 38 C 12 28 2 21 2 13 A 11 11 0 0 1 24 10 A 11 11 0 0 1 46 13 C 46 21 36 28 24 38 Z',
  heptagon: 'M 24 4 L 39.64 11.53 L 43.5 28.45 L 32.68 42.02 L 15.32 42.02 L 4.5 28.45 L 8.36 11.53 Z',
  hexagon_flat: 'M 44 24 L 34 41.32 L 14 41.32 L 4 24 L 14 6.68 L 34 6.68 Z',
  hexagon_pointy: 'M 24 4 L 41.32 14 L 41.32 34 L 24 44 L 6.68 34 L 6.68 14 Z',
  leaf_curved: 'M 6 42 Q 6 6 42 6 Q 42 42 6 42 Z',
  octagon: 'M 42.48 31.65 L 31.65 42.48 L 16.35 42.48 L 5.52 31.65 L 5.52 16.35 L 16.35 5.52 L 31.65 5.52 L 42.48 16.35 Z',
  parallelogram_left: 'M 4 6 H 34 L 44 42 H 14 Z',
  parallelogram_right: 'M 14 6 H 44 L 34 42 H 4 Z',
  pentagon: 'M 24 4 L 43.02 17.82 L 35.76 40.18 L 12.24 40.18 L 4.98 17.82 Z',
  quadrant_ring: 'M 6 42 H 20 A 22 22 0 0 1 42 20 V 6 A 36 36 0 0 0 6 42 Z',
  quarter_circle: 'M 6 42 H 42 A 36 36 0 0 0 6 6 Z',
  rounded_rectangle: 'M 12 6 H 36 A 6 6 0 0 1 42 12 V 36 A 6 6 0 0 1 36 42 H 12 A 6 6 0 0 1 6 36 V 12 A 6 6 0 0 1 12 6 Z',
  seal_scallop_32: 'M 24 4 L 25.76 6.09 L 27.9 4.38 L 29.23 6.78 L 31.65 5.52 L 32.49 8.13 L 35.11 7.37 L 35.42 10.09 L 38.14 9.86 L 37.91 12.58 L 40.63 12.89 L 39.87 15.51 L 42.48 16.35 L 41.22 18.77 L 43.62 20.1 L 41.91 22.24 L 44 24 L 41.91 25.76 L 43.62 27.9 L 41.22 29.23 L 42.48 31.65 L 39.87 32.49 L 40.63 35.11 L 37.91 35.42 L 38.14 38.14 L 35.42 37.91 L 35.11 40.63 L 32.49 39.87 L 31.65 42.48 L 29.23 41.22 L 27.9 43.62 L 25.76 41.91 L 24 44 L 22.24 41.91 L 20.1 43.62 L 18.77 41.22 L 16.35 42.48 L 15.51 39.87 L 12.89 40.63 L 12.58 37.91 L 9.86 38.14 L 10.09 35.42 L 7.37 35.11 L 8.13 32.49 L 5.52 31.65 L 6.78 29.23 L 4.38 27.9 L 6.09 25.76 L 4 24 L 6.09 22.24 L 4.38 20.1 L 6.78 18.77 L 5.52 16.35 L 8.13 15.51 L 7.37 12.89 L 10.09 12.58 L 9.86 9.86 L 12.58 10.09 L 12.89 7.37 L 15.51 8.13 L 16.35 5.52 L 18.77 6.78 L 20.1 4.38 L 22.24 6.09 Z',
  semi_circle: 'M 4 36 H 44 A 20 20 0 0 0 4 36 Z',
  semi_ring: 'M 4 36 H 16 A 8 8 0 0 1 32 36 H 44 A 20 20 0 0 0 4 36 Z',
  shield_u: 'M 6 6 H 42 V 24 C 42 35 24 43 24 43 C 24 43 6 35 6 24 Z',
  sparkle_12: 'M 24 3 L 25.29 19.17 L 34.5 5.81 L 27.54 20.46 L 42.19 13.5 L 28.83 22.71 L 45 24 L 28.83 25.29 L 42.19 34.5 L 27.54 27.54 L 34.5 42.19 L 25.29 28.83 L 24 45 L 22.71 28.83 L 13.5 42.19 L 20.46 27.54 L 5.81 34.5 L 19.17 25.29 L 3 24 L 19.17 22.71 L 5.81 13.5 L 20.46 20.46 L 13.5 5.81 L 22.71 19.17 Z',
  sparkle_8: 'M 24 3 L 26.3 18.46 L 38.85 9.15 L 29.54 21.7 L 45 24 L 29.54 26.3 L 38.85 38.85 L 26.3 29.54 L 24 45 L 21.7 29.54 L 9.15 38.85 L 18.46 26.3 L 3 24 L 18.46 21.7 L 9.15 9.15 L 21.7 18.46 Z',
  square: 'M 6 6 H 42 V 42 H 6 Z',
  star_4_sparkle: 'M 24 4 Q 24 24 44 24 Q 24 24 24 44 Q 24 24 4 24 Q 24 24 24 4 Z',
  star_5: 'M 24 4 L 29 17.12 L 43.02 17.82 L 32.08 26.63 L 35.76 40.18 L 24 32.5 L 12.24 40.18 L 15.92 26.63 L 4.98 17.82 L 19 17.12 Z',
  star_6: 'M 24 4 L 29.5 14.47 L 41.32 14 L 35 24 L 41.32 34 L 29.5 33.53 L 24 44 L 18.5 33.53 L 6.68 34 L 13 24 L 6.68 14 L 18.5 14.47 Z',
  star_7: 'M 24 4 L 28.12 15.44 L 39.64 11.53 L 33.26 21.89 L 43.5 28.45 L 31.43 29.92 L 32.68 42.02 L 24 33.5 L 15.32 42.02 L 16.57 29.92 L 4.5 28.45 L 14.74 21.89 L 8.36 11.53 L 19.88 15.44 Z',
  star_8: 'M 24 4 L 28.97 11.99 L 38.14 9.86 L 36.01 19.03 L 44 24 L 36.01 28.97 L 38.14 38.14 L 28.97 36.01 L 24 44 L 19.03 36.01 L 9.86 38.14 L 11.99 28.97 L 4 24 L 11.99 19.03 L 9.86 9.86 L 19.03 11.99 Z',
  sunburst_16: 'M 24 3 L 25.07 18.61 L 32.04 4.6 L 27.06 19.43 L 38.85 9.15 L 28.57 20.94 L 43.4 15.96 L 29.39 22.93 L 45 24 L 29.39 25.07 L 43.4 32.04 L 28.57 27.06 L 38.85 38.85 L 27.06 28.57 L 32.04 43.4 L 25.07 29.39 L 24 45 L 22.93 29.39 L 15.96 43.4 L 20.94 28.57 L 9.15 38.85 L 19.43 27.06 L 4.6 32.04 L 18.61 25.07 L 3 24 L 18.61 22.93 L 4.6 15.96 L 19.43 20.94 L 9.15 9.15 L 20.94 19.43 L 15.96 4.6 L 22.93 18.61 Z',
  tear_curved_flame: 'M 26 4 C 30 12 18 16 12 24 A 16 16 0 0 0 38 36 C 44 28 38 16 26 4 Z',
  tear_narrow: 'M 24 4 C 24 4 11 22 11 30 A 13 13 0 0 0 37 30 C 37 22 24 4 24 4 Z',
  tear_straight: 'M 24 4 C 24 4 8 20 8 28 A 16 16 0 0 0 40 28 C 40 20 24 4 24 4 Z',
  tear_tilted: 'M 28 4 C 28 4 8 18 8 28 A 15 15 0 0 0 38 38 C 43 33 44 22 28 4 Z',
  tear_wide: 'M 24 5 C 24 5 6 19 6 26 A 18 18 0 0 0 42 26 C 42 19 24 5 24 5 Z',
  ticket: 'M 6 6 H 42 V 18 A 6 6 0 0 0 42 30 V 42 H 6 V 30 A 6 6 0 0 0 6 18 Z',
  trapezoid_down: 'M 4 6 H 44 L 34 42 H 14 Z',
  trapezoid_up: 'M 14 6 H 34 L 44 42 H 4 Z',
  triangle_down: 'M 24 43 L 5 7 H 43 Z',
  triangle_right_angle: 'M 6 6 V 42 H 42 Z',
  triangle_up: 'M 24 5 L 43 41 H 5 Z',
  wave_multi_ribbon: 'M 4 20 Q 10 14 18 20 T 32 20 T 44 20 V 28 Q 38 22 30 28 T 16 28 T 4 28 Z',
  wave_s_curve: 'M 4 18 Q 14 8 24 18 T 44 18 V 26 Q 34 16 24 26 T 4 26 Z',
};

const GEOMETRIC_SHAPE_NAMES: Record<string, string> = {
  arch: 'Arco',
  arrow_double_horizontal: 'Flecha Doble H',
  arrow_double_vertical: 'Flecha Doble V',
  arrow_down: 'Flecha Abajo',
  arrow_left: 'Flecha Izquierda',
  arrow_pointed_double: 'Flecha Doble Puntas',
  arrow_pointed_left: 'Flecha Puntiaguda',
  arrow_ribbon: 'Flecha Cinta',
  arrow_right: 'Flecha Derecha',
  arrow_up: 'Flecha Arriba',
  banner_horizontal_ribbon: 'Cinta Horizontal',
  banner_rounded_notch: 'Estandarte Ranura',
  banner_rounded_point: 'Estandarte Curvo',
  banner_vertical_notch: 'Estandarte Muesca',
  banner_vertical_point: 'Estandarte Punto',
  barrel: 'Barril',
  burst_10: 'Explosión 10',
  burst_12: 'Explosión 12',
  burst_16: 'Explosión 16',
  burst_20: 'Explosión 20',
  burst_24: 'Explosión 24',
  callout_cloud: 'Bocadillo Nube',
  callout_curved_tail: 'Bocadillo Curvo',
  callout_oval: 'Bocadillo Oval',
  callout_rectangular: 'Bocadillo Recto',
  callout_rounded_rect: 'Bocadillo Redondo',
  chamfer_square: 'Cuadrado Chaflán',
  chevron_right: 'Galón Derecha',
  circle: 'Círculo',
  cloud_flat_base_multi: 'Nube Plana Múltiple',
  cloud_flat_base_triple: 'Nube Triple',
  cloud_fluffy_soft: 'Nube Suave',
  cloud_puffy_full: 'Nube Esponjosa',
  cloud_round_dome: 'Nube Cúpula',
  clover_4_leaves: 'Trébol 4 Hojas',
  cross: 'Cruz',
  decagon: 'Decágono',
  diamond: 'Rombo',
  flow_data: 'Datos Flujo',
  flow_decision: 'Decisión Flujo',
  flow_delay: 'Retardo Flujo',
  flow_document: 'Documento Flujo',
  flow_manual: 'Manual Flujo',
  flow_merge: 'Fusión Flujo',
  flow_offpage: 'Fuera de Página',
  flow_preparation: 'Preparación',
  flow_process: 'Proceso Flujo',
  flow_shield: 'Escudo Flujo',
  flow_terminator: 'Terminador',
  flower_4_petals_cross: 'Flor 4 Pétalos',
  flower_6_petals_center_hole: 'Flor 6 Pétalos Centro',
  flower_6_petals_drop: 'Flor 6 Gotas',
  flower_8_petals_round: 'Flor 8 Redonda',
  flower_8_petals_sharp: 'Flor 8 Puntiaguda',
  gear_12_teeth_large_hole: 'Engranaje 12 Grande',
  gear_12_teeth_pointed: 'Engranaje 12 Dientes',
  gear_12_teeth_small_hole: 'Engranaje 12 Chico',
  gear_14_teeth_pointed: 'Engranaje 14',
  gear_16_teeth_large_hole: 'Engranaje 16 Grande',
  gear_16_teeth_pointed: 'Engranaje 16',
  heart_classic: 'Corazón Clásico',
  heart_narrow: 'Corazón Angosto',
  heart_playful: 'Corazón Dinámico',
  heart_rounded: 'Corazón Redondo',
  heart_wide: 'Corazón Ancho',
  heptagon: 'Heptágono',
  hexagon_flat: 'Hexágono Plano',
  hexagon_pointy: 'Hexágono Punta',
  leaf_curved: 'Hoja Curva',
  octagon: 'Octágono',
  parallelogram_left: 'Paralelogramo Izq',
  parallelogram_right: 'Paralelogramo Der',
  pentagon: 'Pentágono',
  quadrant_ring: 'Anillo Cuadrante',
  quarter_circle: 'Cuarto Círculo',
  rounded_rectangle: 'Rectángulo Redondo',
  seal_scallop_32: 'Sello Ondulado 32',
  semi_circle: 'Semicírculo',
  semi_ring: 'Semianillo',
  shield_u: 'Escudo U',
  sparkle_12: 'Destello 12',
  sparkle_8: 'Destello 8',
  square: 'Cuadrado',
  star_4_sparkle: 'Estrella 4',
  star_5: 'Estrella 5',
  star_6: 'Estrella 6',
  star_7: 'Estrella 7',
  star_8: 'Estrella 8',
  sunburst_16: 'Sol Radiante 16',
  tear_curved_flame: 'Gota Curva Llama',
  tear_narrow: 'Gota Estrecha',
  tear_straight: 'Gota Recta',
  tear_tilted: 'Gota Inclinada',
  tear_wide: 'Gota Ancha',
  ticket: 'Boleto',
  trapezoid_down: 'Trapecio Invertido',
  trapezoid_up: 'Trapecio',
  triangle_down: 'Triángulo Invertido',
  triangle_right_angle: 'Triángulo Recto',
  triangle_up: 'Triángulo',
  wave_multi_ribbon: 'Onda Cinta',
  wave_s_curve: 'Onda S',
};

export const STICKERS_CATALOG_DATA = [
  { id: 'sticker_sword_hero', name: 'Espada de Héroe', file: 'sword_hero.svg' },
  { id: 'sticker_shield_royal', name: 'Escudo Real', file: 'shield_royal.svg' },
  { id: 'sticker_battle_axe', name: 'Hacha de Batalla', file: 'battle_axe.svg' },
  { id: 'sticker_potion_health', name: 'Poción de Vida', file: 'potion_health.svg' },
  { id: 'sticker_potion_mana', name: 'Poción de Maná', file: 'potion_mana.svg' },
  { id: 'sticker_treasure_chest', name: 'Cofre del Tesoro', file: 'treasure_chest.svg' },
  { id: 'sticker_magic_wand', name: 'Varita Mágica', file: 'magic_wand.svg' },
  { id: 'sticker_knight_helmet', name: 'Yelmo de Caballero', file: 'knight_helmet.svg' },
  { id: 'sticker_elven_bow', name: 'Arco Élfico', file: 'elven_bow.svg' },
  { id: 'sticker_spell_scroll', name: 'Pergamino Sagrado', file: 'spell_scroll.svg' },
  { id: 'sticker_gold_coin', name: 'Moneda de Oro', file: 'gold_coin.svg' },
  { id: 'sticker_ruby_gem', name: 'Gema Rubí', file: 'ruby_gem.svg' },
  { id: 'sticker_golden_crown', name: 'Corona Real', file: 'golden_crown.svg' },
  { id: 'sticker_ancient_key', name: 'Llave Antigua', file: 'ancient_key.svg' },
  { id: 'sticker_champion_trophy', name: 'Trofeo de Campeón', file: 'champion_trophy.svg' },
  { id: 'sticker_gold_ingot', name: 'Lingote de Oro', file: 'gold_ingot.svg' },
  { id: 'sticker_holy_grail', name: 'Cáliz Sagrado', file: 'holy_grail.svg' },
  { id: 'sticker_diamond_ring', name: 'Anillo de Diamante', file: 'diamond_ring.svg' },
  { id: 'sticker_gem_sack', name: 'Bolsa de Gemas', file: 'gem_sack.svg' },
  { id: 'sticker_emerald_crystal', name: 'Esmeralda Mística', file: 'emerald_crystal.svg' },
  { id: 'sticker_hero_knight', name: 'Caballero Valiente', file: 'hero_knight.svg' },
  { id: 'sticker_wise_wizard', name: 'Mago Arcano', file: 'wise_wizard.svg' },
  { id: 'sticker_shadow_rogue', name: 'Pícaro Sombrío', file: 'shadow_rogue.svg' },
  { id: 'sticker_royal_princess', name: 'Princesa Real', file: 'royal_princess.svg' },
  { id: 'sticker_king_monarch', name: 'Rey Soberano', file: 'king_monarch.svg' },
  { id: 'sticker_undead_skeleton', name: 'Esqueleto Guerrero', file: 'undead_skeleton.svg' },
  { id: 'sticker_goblin_scout', name: 'Duende Pícaro', file: 'goblin_scout.svg' },
  { id: 'sticker_baby_dragon', name: 'Dragón Bebé', file: 'baby_dragon.svg' },
  { id: 'sticker_stone_golem', name: 'Gólem de Piedra', file: 'stone_golem.svg' },
  { id: 'sticker_cute_witch', name: 'Brujita Mágica', file: 'cute_witch.svg' },
  { id: 'sticker_tabby_cat', name: 'Gatito Naranja', file: 'tabby_cat.svg' },
  { id: 'sticker_happy_dog', name: 'Perrito Feliz', file: 'happy_dog.svg' },
  { id: 'sticker_red_fox', name: 'Zorro Rojo', file: 'red_fox.svg' },
  { id: 'sticker_night_owl', name: 'Búho Nocturno', file: 'night_owl.svg' },
  { id: 'sticker_tree_frog', name: 'Ranita Verde', file: 'tree_frog.svg' },
  { id: 'sticker_white_bunny', name: 'Conejito Blanco', file: 'white_bunny.svg' },
  { id: 'sticker_yellow_chick', name: 'Pollito Pío', file: 'yellow_chick.svg' },
  { id: 'sticker_pink_axolotl', name: 'Ajolote Rosado', file: 'pink_axolotl.svg' },
  { id: 'sticker_cute_penguin', name: 'Pingüino Alegre', file: 'cute_penguin.svg' },
  { id: 'sticker_panda_bear', name: 'Panda Glotón', file: 'panda_bear.svg' },
  { id: 'sticker_pizza_slice', name: 'Rebanada de Pizza', file: 'pizza_slice.svg' },
  { id: 'sticker_cheeseburger', name: 'Hamburguesa Clásica', file: 'cheeseburger.svg' },
  { id: 'sticker_glazed_donut', name: 'Dona Glaseada', file: 'glazed_donut.svg' },
  { id: 'sticker_strawberry_cake', name: 'Pastel de Fresa', file: 'strawberry_cake.svg' },
  { id: 'sticker_ice_cream', name: 'Helado Tricolor', file: 'ice_cream.svg' },
  { id: 'sticker_coffee_cup', name: 'Taza de Café', file: 'coffee_cup.svg' },
  { id: 'sticker_ramen_bowl', name: 'Tazón de Ramen', file: 'ramen_bowl.svg' },
  { id: 'sticker_salmon_sushi', name: 'Sushi de Salmón', file: 'salmon_sushi.svg' },
  { id: 'sticker_red_apple', name: 'Manzana Roja', file: 'red_apple.svg' },
  { id: 'sticker_soda_bottle', name: 'Botella de Refresco', file: 'soda_bottle.svg' },
  { id: 'sticker_oak_tree', name: 'Árbol de Roble', file: 'oak_tree.svg' },
  { id: 'sticker_pine_tree', name: 'Pino Nevado', file: 'pine_tree.svg' },
  { id: 'sticker_palm_tree', name: 'Palmera Tropical', file: 'palm_tree.svg' },
  { id: 'sticker_sunflower', name: 'Flor Girasol', file: 'sunflower.svg' },
  { id: 'sticker_red_mushroom', name: 'Hongo Rojo Mágico', file: 'red_mushroom.svg' },
  { id: 'sticker_desert_cactus', name: 'Cactus del Desierto', file: 'desert_cactus.svg' },
  { id: 'sticker_four_leaf_clover', name: 'Trébol de la Suerte', file: 'four_leaf_clover.svg' },
  { id: 'sticker_berry_bush', name: 'Arbusto de Bayas', file: 'berry_bush.svg' },
  { id: 'sticker_lotus_flower', name: 'Flor de Loto', file: 'lotus_flower.svg' },
  { id: 'sticker_maple_leaf', name: 'Hoja de Arce', file: 'maple_leaf.svg' },
  { id: 'sticker_space_rocket', name: 'Cohete Espacial', file: 'space_rocket.svg' },
  { id: 'sticker_saturn_planet', name: 'Planeta Anillado', file: 'saturn_planet.svg' },
  { id: 'sticker_alien_ufo', name: 'OVNI Alienígena', file: 'alien_ufo.svg' },
  { id: 'sticker_astronaut_helmet', name: 'Casco Astronauta', file: 'astronaut_helmet.svg' },
  { id: 'sticker_orbit_satellite', name: 'Satélite Orbital', file: 'orbit_satellite.svg' },
  { id: 'sticker_crystal_asteroid', name: 'Asteroide Cristal', file: 'crystal_asteroid.svg' },
  { id: 'sticker_space_telescope', name: 'Telescopio Espacial', file: 'space_telescope.svg' },
  { id: 'sticker_cosmic_portal', name: 'Portal Cósmico', file: 'cosmic_portal.svg' },
  { id: 'sticker_android_robot', name: 'Robot Androide', file: 'android_robot.svg' },
  { id: 'sticker_laser_gun', name: 'Pistola Láser', file: 'laser_gun.svg' },
  { id: 'sticker_retro_gamepad', name: 'Control Retro', file: 'retro_gamepad.svg' },
  { id: 'sticker_game_cartridge', name: 'Cartucho Clásico', file: 'game_cartridge.svg' },
  { id: 'sticker_arcade_cabinet', name: 'Máquina Arcade', file: 'arcade_cabinet.svg' },
  { id: 'sticker_arcade_ghost', name: 'Fantasma Pixel', file: 'arcade_ghost.svg' },
  { id: 'sticker_8bit_heart', name: 'Corazón 8-Bit', file: '8bit_heart.svg' },
  { id: 'sticker_arcade_coin', name: 'Moneda Arcade', file: 'arcade_coin.svg' },
  { id: 'sticker_power_star', name: 'Estrella de Poder', file: 'power_star.svg' },
  { id: 'sticker_fuse_bomb', name: 'Bomba Explosiva', file: 'fuse_bomb.svg' },
  { id: 'sticker_pixel_sword', name: 'Espada Pixelada', file: 'pixel_sword.svg' },
  { id: 'sticker_victory_cup', name: 'Copa de Victoria', file: 'victory_cup.svg' },
  { id: 'sticker_heart_love', name: 'Corazón Brillante', file: 'heart_love.svg' },
  { id: 'sticker_broken_heart', name: 'Corazón Roto', file: 'broken_heart.svg' },
  { id: 'sticker_pirate_skull', name: 'Calavera Pirata', file: 'pirate_skull.svg' },
  { id: 'sticker_smiley_face', name: 'Carita Feliz', file: 'smiley_face.svg' },
  { id: 'sticker_wink_face', name: 'Carita Guiño', file: 'wink_face.svg' },
  { id: 'sticker_cool_glasses', name: 'Carita con Lentes', file: 'cool_glasses.svg' },
  { id: 'sticker_fire_flame', name: 'Llama Ardiente', file: 'fire_flame.svg' },
  { id: 'sticker_thunder_bolt', name: 'Rayo Trueno', file: 'thunder_bolt.svg' },
  { id: 'sticker_shooting_star', name: 'Estrella Fugaz', file: 'shooting_star.svg' },
  { id: 'sticker_peace_sign', name: 'Símbolo de Paz', file: 'peace_sign.svg' },
  { id: 'sticker_radiant_sun', name: 'Sol Radiante', file: 'radiant_sun.svg' },
  { id: 'sticker_full_moon', name: 'Luna Llena', file: 'full_moon.svg' },
  { id: 'sticker_crescent_moon', name: 'Luna Creciente', file: 'crescent_moon.svg' },
  { id: 'sticker_rain_cloud', name: 'Nube Lluviosa', file: 'rain_cloud.svg' },
  { id: 'sticker_storm_lightning', name: 'Tormenta Eléctrica', file: 'storm_lightning.svg' },
  { id: 'sticker_magic_rainbow', name: 'Arcoíris Mágico', file: 'magic_rainbow.svg' },
  { id: 'sticker_snow_crystal', name: 'Copo de Nieve', file: 'snow_crystal.svg' },
  { id: 'sticker_wind_gust', name: 'Remolino de Viento', file: 'wind_gust.svg' },
  { id: 'sticker_night_sparkle', name: 'Destello Nocturno', file: 'night_sparkle.svg' },
  { id: 'sticker_fiery_comet', name: 'Cometa de Fuego', file: 'fiery_comet.svg' },
  { id: 'sticker_sports_car', name: 'Auto Deportivo', file: 'sports_car.svg' },
  { id: 'sticker_steam_train', name: 'Tren Clásico', file: 'steam_train.svg' },
  { id: 'sticker_sail_boat', name: 'Barco Velero', file: 'sail_boat.svg' },
  { id: 'sticker_jet_plane', name: 'Avión Comercial', file: 'jet_plane.svg' },
  { id: 'sticker_hot_air_balloon', name: 'Globo Aerostático', file: 'hot_air_balloon.svg' },
  { id: 'sticker_city_bicycle', name: 'Bicicleta Urbana', file: 'city_bicycle.svg' },
  { id: 'sticker_lunar_lander', name: 'Módulo Lunar', file: 'lunar_lander.svg' },
  { id: 'sticker_yellow_submarine', name: 'Submarino Amarillo', file: 'yellow_submarine.svg' },
  { id: 'sticker_wooden_wagon', name: 'Carreta de Madera', file: 'wooden_wagon.svg' },
  { id: 'sticker_skate_board', name: 'Patineta Skater', file: 'skate_board.svg' },
  { id: 'sticker_lit_candle', name: 'Vela Encendida', file: 'lit_candle.svg' },
  { id: 'sticker_iron_lantern', name: 'Farol de Hierro', file: 'iron_lantern.svg' },
  { id: 'sticker_hour_glass', name: 'Reloj de Arena', file: 'hour_glass.svg' },
  { id: 'sticker_spell_book', name: 'Libro de Conjuros', file: 'spell_book.svg' },
  { id: 'sticker_potion_flask', name: 'Frasco Alquimia', file: 'potion_flask.svg' },
  { id: 'sticker_magic_mirror', name: 'Espejo Mágico', file: 'magic_mirror.svg' },
  { id: 'sticker_oil_lamp', name: 'Lámpara de Aceite', file: 'oil_lamp.svg' },
  { id: 'sticker_art_painting', name: 'Cuadro de Arte', file: 'art_painting.svg' },
  { id: 'sticker_crystal_ball', name: 'Esfera de Cristal', file: 'crystal_ball.svg' },
  { id: 'sticker_sea_anchor', name: 'Ancla Marina', file: 'sea_anchor.svg' },
];

export const PIXEL_SHAPES: PixelShape[] = [
  ...Object.entries(SHAPE_SVG_PATHS).map(([key, pathD]) => ({
    id: `shape_${key}`,
    name: GEOMETRIC_SHAPE_NAMES[key] || key,
    category: 'shapes' as ShapeCategory,
    type: 'vector' as const,
    file: `${key}.svg`,
    pathD,
    width: 32,
    height: 32,
  })),
  ...STICKERS_CATALOG_DATA.map((item) => ({
    id: item.id,
    name: item.name,
    category: 'templates' as ShapeCategory,
    type: 'sticker' as const,
    file: item.file,
    width: 32,
    height: 32,
  })),
];

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

const path2dCache = new Map<string, Path2D>();

export function rasterizeSvgPathToPixels(pathString: string, w: number, h: number, isFill = true): Array<{ x: number; y: number }> {
  if (!pathString || w <= 0 || h <= 0 || typeof document === 'undefined') return [];

  let basePath = path2dCache.get(pathString);
  if (!basePath) {
    try {
      basePath = new Path2D(pathString);
      path2dCache.set(pathString, basePath);
    } catch {
      return [];
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.imageSmoothingEnabled = false;

  let pathObj = basePath;
  if (typeof DOMMatrix !== 'undefined') {
    const matrix = new DOMMatrix([w / 48, 0, 0, h / 48, 0, 0]);
    const transformedPath = new Path2D();
    transformedPath.addPath(basePath, matrix);
    pathObj = transformedPath;
  }

  if (isFill) {
    ctx.fillStyle = '#000000';
    ctx.fill(pathObj, 'evenodd');
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke(pathObj);
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const points: Array<{ x: number; y: number }> = [];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const alpha = data[(py * w + px) * 4 + 3];
      if (alpha > 48) {
        points.push({ x: px, y: py });
      }
    }
  }

  return points;
}

export function renderShapeCanvas(
  shape: PixelShape,
  colorMode: ShapeColorMode,
  primaryColor: string,
  rotation = 0,
  flipH = false,
  flipV = false,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const w = targetWidth && targetWidth > 0 ? targetWidth : shape.width || 32;
  const h = targetHeight && targetHeight > 0 ? targetHeight : shape.height || 32;

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = w;
  rawCanvas.height = h;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
  rawCtx.imageSmoothingEnabled = false;

  if (shape.type === 'vector' && shape.pathD) {
    const points = rasterizeSvgPathToPixels(shape.pathD, w, h, true);
    rawCtx.fillStyle = colorMode === 'primary' ? primaryColor : primaryColor || '#000000';
    for (let i = 0; i < points.length; i++) {
      rawCtx.fillRect(points[i].x, points[i].y, 1, 1);
    }
  } else if (shape.type === 'sticker' && shape.file) {
    const imgUrl = `/assets/img/stickers/${shape.file}`;
    const cachedImg = imageCache.get(imgUrl);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      rawCtx.drawImage(cachedImg, 0, 0, w, h);
      if (colorMode === 'primary') {
        const imgData = rawCtx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const rgb = hexToRgb(primaryColor);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 32) {
            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
          }
        }
        rawCtx.putImageData(imgData, 0, 0);
      }
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(imgUrl, img);
      };
      img.src = imgUrl;
    }
  }

  const isRotated90or270 = rotation === 90 || rotation === 270;
  const outW = isRotated90or270 ? h : w;
  const outH = isRotated90or270 ? w : h;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = outW;
  finalCanvas.height = outH;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.imageSmoothingEnabled = false;

  finalCtx.save();
  finalCtx.translate(outW / 2, outH / 2);
  finalCtx.rotate((rotation * Math.PI) / 180);
  finalCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  finalCtx.drawImage(rawCanvas, -w / 2, -h / 2);
  finalCtx.restore();

  return finalCanvas;
}

export function renderShapeThumbnail(shape: PixelShape): HTMLElement | SVGElement {
  if (shape.type === 'vector' && shape.pathD) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'currentColor');
    svg.style.display = 'block';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shape.pathD);
    svg.appendChild(path);
    return svg;
  }

  if (shape.type === 'sticker' && shape.file) {
    const img = document.createElement('img');
    img.src = `/assets/img/stickers/${shape.file}`;
    img.alt = shape.name;
    img.loading = 'lazy';
    img.width = 24;
    img.height = 24;
    img.style.display = 'block';
    img.style.imageRendering = 'pixelated';
    img.style.objectFit = 'contain';
    img.style.maxWidth = '24px';
    img.style.maxHeight = '24px';
    return img;
  }

  const placeholder = document.createElement('div');
  placeholder.style.width = '24px';
  placeholder.style.height = '24px';
  return placeholder;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
