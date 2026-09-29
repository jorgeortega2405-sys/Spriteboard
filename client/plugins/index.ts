import { googleDrivePlugin } from './apps/google-drive.plugin.js';
import { googleMapsPlugin } from './apps/google-maps.plugin.js';
import { googlePhotosPlugin } from './apps/google-photos.plugin.js';
import { qrCodePlugin } from './apps/qr-code.plugin.js';
import { youtubePlugin } from './apps/youtube.plugin.js';
import { PluginRegistry, pluginRegistry } from './plugin-registry.js';
import { AppPlugin, AppPluginContext } from './plugin.types.js';

pluginRegistry.register(googleDrivePlugin);
pluginRegistry.register(googleMapsPlugin);
pluginRegistry.register(googlePhotosPlugin);
pluginRegistry.register(qrCodePlugin);
pluginRegistry.register(youtubePlugin);

export { PluginRegistry, pluginRegistry };
export type { AppPlugin, AppPluginContext };
