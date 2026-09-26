import { BoardElement } from '../board/board.types.js';

export type SheetBorderStyle = 'dashed' | 'dotted' | 'solid';

export interface SheetCellBorder {
  color?: string;
  style?: SheetBorderStyle;
  width?: number;
}

export interface SheetCellBorders {
  bottom?: SheetCellBorder;
  left?: SheetCellBorder;
  right?: SheetCellBorder;
  top?: SheetCellBorder;
}

export type SheetNumberFormat = 'currency' | 'date' | 'general' | 'number' | 'percentage';

export interface SheetCellData {
  align?: 'center' | 'left' | 'right';
  backgroundColor?: string;
  bold?: boolean;
  borders?: SheetCellBorders;
  computed?: boolean | number | string | null;
  decimals?: number;
  fontFamily?: string;
  fontSize?: number;
  format?: SheetNumberFormat;
  italic?: boolean;
  raw: string;
  strikethrough?: boolean;
  textColor?: string;
  type?: 'boolean' | 'date' | 'error' | 'formula' | 'number' | 'text';
  underline?: boolean;
  verticalAlign?: 'bottom' | 'middle' | 'top';
  wrapText?: boolean;
}

export interface SheetColumnConfig {
  width: number;
}

export interface SheetRowConfig {
  height: number;
}

export interface SheetRange {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
}

export interface SheetSelection {
  activeCol: number;
  activeRow: number;
  range: SheetRange;
}

export interface SheetData {
  cells: Record<string, SheetCellData>;
  colCount: number;
  columns: Record<number, SheetColumnConfig>;
  id: string;
  name: string;
  rowCount: number;
  rows: Record<number, SheetRowConfig>;
  showGridLines: boolean;
}

export interface SheetProject {
  activeSheetId: string;
  elements: BoardElement[];
  sheets: SheetData[];
  type: 'sheet';
  version: 1;
}

export type SheetTool =
  | 'charts'
  | 'connector'
  | 'eraser'
  | 'hand'
  | 'highlighter'
  | 'image'
  | 'marker'
  | 'mockups'
  | 'pen'
  | 'select'
  | 'shapes'
  | 'sticky'
  | 'text';
