import { AppPlugin } from './plugin.types.js';

export class PluginRegistry {
  private plugins = new Map<string, AppPlugin>();

  public register(plugin: AppPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  public get(id: string): AppPlugin | undefined {
    return this.plugins.get(id);
  }

  public has(id: string): boolean {
    return this.plugins.has(id);
  }

  public getAll(): AppPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginRegistry = new PluginRegistry();
