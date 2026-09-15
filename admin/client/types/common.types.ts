export interface ViewController {
  destroy: () => void;
}

export interface Language {
  code: string;
  name: string;
}

export interface ErrorViewOptions {
  actionText?: string;
  actionUrl?: string;
  code?: string;
  description?: string;
  title?: string;
}

export interface ModalOptions {
  bodyHtml?: HTMLElement | string;
  cancelText?: string;
  confirmClass?: string;
  confirmText?: string;
  description?: string;
  onCancel?: (() => void) | null;
  onClose?: (() => void) | null;
  onConfirm?: (() => void | Promise<void>) | null;
  showCancel?: boolean;
  showConfirm?: boolean;
  size?: '825x225' | 'lg' | 'md' | 'sm' | 'split';
  title?: string;
}

export interface ModalInstance {
  backdrop: HTMLElement;
  body: HTMLElement;
  btnCancel?: HTMLElement | null;
  btnConfirm?: HTMLButtonElement | null;
  cancelBtn?: HTMLElement | null;
  card: HTMLElement | null;
  clearError?: () => void;
  close: () => void;
  closeBtn?: HTMLElement | null;
  confirmBtn?: HTMLButtonElement | null;
  errorBanner?: HTMLElement | null;
  setBody?: (body: HTMLElement | string) => void;
  setConfirmLoading?: (loading: boolean, text?: string) => void;
  setConfirmText?: (text: string) => void;
  setDesc?: (desc: string) => void;
  setDescription?: (desc: string) => void;
  setError: (msg: string) => void;
  setTitle: (title: string) => void;
  showError?: (msg: string) => void;
}
