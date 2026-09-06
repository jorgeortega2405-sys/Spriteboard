export type ToastType = 'success' | 'error' | 'danger' | 'warning' | 'info';

export interface BannerManager {
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  hideAll: () => void;
  hideError: () => void;
  hideSuccess: () => void;
}

export interface ModalInstance {
  backdrop: HTMLElement;
  card: HTMLElement | null;
  body: HTMLElement;
  errorBanner: HTMLElement | null;
  confirmBtn: HTMLButtonElement | null;
  btnConfirm: HTMLButtonElement | null;
  cancelBtn: HTMLElement | null;
  btnCancel: HTMLElement | null;
  closeBtn: HTMLElement | null;
  setTitle: (newTitle: string, newKey?: string) => void;
  setDescription: (newDesc: string, newKey?: string, params?: Record<string, string | number>) => void;
  setBody: (newBody: string | HTMLElement) => void;
  showError: (message: string) => void;
  clearError: () => void;
  setConfirmLoading: (isLoading: boolean, loadingText?: string) => void;
  setConfirmVisible: (isVisible: boolean) => void;
  setConfirmText: (newText: string) => void;
  close: () => void;
  setOnConfirm: (fn: (inst: ModalInstance) => Promise<boolean | void> | boolean | void) => void;
  [key: string]: any;
}

export interface ModalOptions {
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  descriptionParams?: Record<string, string | number>;
  bodyHtml?: string | HTMLElement;
  cancelText?: string;
  confirmText?: string;
  confirmClass?: string;
  showCancel?: boolean;
  showConfirm?: boolean;
  size?: 'sm' | 'md' | 'lg' | string;
  onConfirm?: ((inst: ModalInstance) => Promise<boolean | void> | boolean | void) | null;
  onCancel?: ((inst: ModalInstance) => void) | null;
  onClose?: (() => void) | null;
}


export interface SkeletonSession {
  finish: (newElements: HTMLElement[], isActiveCheck?: () => boolean) => Promise<void>;
}

export interface Language {
  code: string;
  name: string;
}
