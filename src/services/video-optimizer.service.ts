import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from './logger.service.js';

const execAsync = promisify(exec);

export class VideoOptimizerService {
  public static async makeFastStart(inputPath: string): Promise<boolean> {
    if (!fs.existsSync(inputPath)) {
      return false;
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const tempOutput = path.join(dir, `${base}_faststart${ext}`);

    try {
      await execAsync(`ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart "${tempOutput}"`);
      if (fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 0) {
        fs.unlinkSync(inputPath);
        fs.renameSync(tempOutput, inputPath);
        logger.app.info('Video optimizado con FastStart exitosamente', { inputPath });
        return true;
      }
      return false;
    } catch (err) {
      if (fs.existsSync(tempOutput)) {
        try { fs.unlinkSync(tempOutput); } catch {}
      }
      logger.app.warn('No se pudo aplicar FastStart con FFmpeg, conservando archivo original', err);
      return false;
    }
  }
}
