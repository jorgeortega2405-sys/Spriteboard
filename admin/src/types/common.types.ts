export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  ok?: boolean;
}

export interface ViewController {
  destroy: () => void;
}
