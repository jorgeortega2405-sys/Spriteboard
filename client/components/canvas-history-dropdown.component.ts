import { CanvasHistoryModalController, CanvasHistoryModalOptions, openCanvasHistoryModal } from './canvas-history-modal.component.js';

export type CanvasHistoryDropdownOptions = CanvasHistoryModalOptions;
export type CanvasHistoryDropdownController = CanvasHistoryModalController;

export function setupCanvasHistoryDropdown(options: CanvasHistoryDropdownOptions): CanvasHistoryDropdownController {
  return openCanvasHistoryModal(options);
}

