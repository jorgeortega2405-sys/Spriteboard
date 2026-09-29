export interface AppPluginContext {
  drawer: HTMLElement;
  drawerBody: HTMLElement;
  onBack: () => void;
  onClose: () => void;
}

export interface AppPlugin {
  id: string;
  render(ctx: AppPluginContext): void | Promise<void>;
}
