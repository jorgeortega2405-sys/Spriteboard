import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { getObject } from './s3.service.js';
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SubtitleWord {
  end: number;
  start: number;
  word: string;
}

export interface SubtitleItem {
  end: number;
  start: number;
  text: string;
  words?: SubtitleWord[];
}

export interface SubtitleGenerationResult {
  durationSeconds: number;
  language?: string;
  subtitles: SubtitleItem[];
}

async function resolveMediaToLocalFile(assetUrl: string): Promise<{ cleanup: boolean; filePath: string }> {
  const cleanUrl = assetUrl.split('?')[0];

  if (cleanUrl.includes('/uploads/')) {
    const relativePart = cleanUrl.substring(cleanUrl.indexOf('/uploads/'));
    const fullPath = path.resolve(process.cwd(), 'public', relativePart.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      return { cleanup: false, filePath: fullPath };
    }
    const s3Key = relativePart.replace(/^\//, '');
    try {
      const s3Obj = await getObject(s3Key);
      if (s3Obj && s3Obj.buffer) {
        const tempPath = path.join(os.tmpdir(), `s3_input_${crypto.randomBytes(8).toString('hex')}_${path.basename(cleanUrl)}`);
        await fs.promises.writeFile(tempPath, s3Obj.buffer);
        return { cleanup: true, filePath: tempPath };
      }
    } catch {}
  }

  if (fs.existsSync(cleanUrl)) {
    return { cleanup: false, filePath: cleanUrl };
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    const response = await fetch(assetUrl);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo de medios (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const tempPath = path.join(os.tmpdir(), `http_input_${crypto.randomBytes(8).toString('hex')}_${path.basename(cleanUrl)}`);
    await fs.promises.writeFile(tempPath, Buffer.from(arrayBuffer));
    return { cleanup: true, filePath: tempPath };
  }

  throw new Error('Archivo de medios no encontrado o no accesible');
}

export async function generateVideoSubtitles(
  mediaUrl: string,
  options: { language?: string; maxWordsPerSegment?: number; offsetSeconds?: number } = {}
): Promise<SubtitleGenerationResult> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    throw new Error('El servicio de IA para subtítulos no está configurado.');
  }

  const { cleanup, filePath: sourceMediaFile } = await resolveMediaToLocalFile(mediaUrl);
  const tempAudioFile = path.join(os.tmpdir(), `sub_extract_${crypto.randomBytes(8).toString('hex')}.mp3`);

  try {
    const ffmpegArgs = [
      '-y',
      '-i', sourceMediaFile,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'libmp3lame',
      '-b:a', '32k',
      tempAudioFile,
    ];

    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 30000 });

    const audioBuffer = await fs.promises.readFile(tempAudioFile);
    const base64Audio = audioBuffer.toString('base64');

    const languagePrompt = options.language && options.language !== 'auto'
      ? `Language requested: ${options.language}.`
      : 'Detect spoken language automatically.';

    const systemPrompt = `You are an expert audio transcription and subtitle synchronization system.
Your task is to transcribe the speech from the provided audio file accurately and generate synchronized subtitle segments with exact start and end timestamps in seconds.
Guidelines:
- Return ONLY valid JSON matching the schema with a "subtitles" array.
- Each subtitle object must contain "start" (float number in seconds), "end" (float number in seconds), "text" (clean transcribed string), and optionally "words" array with {"word": string, "start": float, "end": float}.
- Break subtitles into short, natural, concise phrases (2 to 7 words per segment) ideal for video captions.
- Timestamps must be relative to the start of the audio file (0.00s onwards) and strictly ordered chronologically.
- Remove filler words or repetitions if appropriate, maintaining high fidelity.
- ${languagePrompt}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType: 'audio/mp3',
              },
            },
            {
              text: 'Transcribe this audio into accurate, synchronized subtitle segments in JSON format.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          properties: {
            detectedLanguage: { type: 'STRING' },
            subtitles: {
              items: {
                properties: {
                  end: { type: 'NUMBER' },
                  start: { type: 'NUMBER' },
                  text: { type: 'STRING' },
                  words: {
                    items: {
                      properties: {
                        end: { type: 'NUMBER' },
                        start: { type: 'NUMBER' },
                        word: { type: 'STRING' },
                      },
                      required: ['start', 'end', 'word'],
                      type: 'OBJECT',
                    },
                    type: 'ARRAY',
                  },
                },
                required: ['start', 'end', 'text'],
                type: 'OBJECT',
              },
              type: 'ARRAY',
            },
          },
          required: ['subtitles'],
          type: 'OBJECT',
        },
        temperature: 0.2,
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const modelName = config.gemini.model || 'gemini-flash-latest';
    const fallbackModels = [
      'gemini-flash-latest',
      'gemini-1.5-flash',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
    ];

    const buildUrl = (m: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

    const fetchOptions = {
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST' as const,
    };

    let response = await fetch(buildUrl(modelName), fetchOptions);

    if (!response.ok && (response.status === 503 || response.status === 404)) {
      for (const fallback of fallbackModels) {
        if (fallback === modelName) continue;
        response = await fetch(buildUrl(fallback), fetchOptions);
        if (response.ok) break;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.app.error('VideoSubtitlesService: Error HTTP desde Gemini API', {
        response: errorText.slice(0, 300),
        status: response.status,
      });
      throw new Error('Error al conectar con el motor de transcripción IA.');
    }

    const data = (await response.json()) as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText || typeof rawText !== 'string') {
      logger.app.warn('VideoSubtitlesService: Respuesta vacía de Gemini API', { data });
      return { durationSeconds: 0, subtitles: [] };
    }

    let parsedResult: { detectedLanguage?: string; subtitles?: SubtitleItem[] };
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedResult = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.app.error('VideoSubtitlesService: Error al parsear JSON de Gemini', { parseErr, rawText });
      return { durationSeconds: 0, subtitles: [] };
    }

    const offset = Number(options.offsetSeconds) || 0;
    const items: SubtitleItem[] = (parsedResult.subtitles || [])
      .filter((s) => typeof s.text === 'string' && s.text.trim().length > 0 && typeof s.start === 'number' && typeof s.end === 'number')
      .map((s) => {
        const segStart = Math.round((Math.max(0, s.start) + offset) * 100) / 100;
        const segEnd = Math.round((Math.max(s.start + 0.2, s.end) + offset) * 100) / 100;
        const rawText = s.text.trim();
        const duration = Math.max(0.2, segEnd - segStart);

        let words: SubtitleWord[] = [];
        if (Array.isArray(s.words) && s.words.length > 0) {
          words = s.words
            .filter((w) => typeof w.word === 'string' && w.word.trim().length > 0)
            .map((w) => ({
              end: Math.round(Math.min(duration, Math.max(0.05, (w.end ?? duration) - (w.start >= s.start ? s.start : 0))) * 100) / 100,
              start: Math.round(Math.max(0, (w.start ?? 0) - (w.start >= s.start ? s.start : 0)) * 100) / 100,
              word: w.word.trim(),
            }));
        }

        if (words.length === 0) {
          const splitWords = rawText.split(/\s+/).filter(Boolean);
          const totalChars = splitWords.reduce((sum, w) => sum + w.length, 0) || 1;
          let currentElapsed = 0;
          words = splitWords.map((w) => {
            const wDur = Math.max(0.1, (w.length / totalChars) * duration);
            const wStart = Math.round(currentElapsed * 100) / 100;
            currentElapsed += wDur;
            const wEnd = Math.round(Math.min(duration, currentElapsed) * 100) / 100;
            return {
              end: Math.max(wStart + 0.05, wEnd),
              start: wStart,
              word: w,
            };
          });
        }

        return {
          end: segEnd,
          start: segStart,
          text: rawText,
          words,
        };
      });

    logger.app.info('VideoSubtitlesService: Subtítulos generados con éxito', {
      clipUrl: mediaUrl,
      count: items.length,
      language: parsedResult.detectedLanguage,
    });

    return {
      durationSeconds: items.length > 0 ? items[items.length - 1].end : 0,
      language: parsedResult.detectedLanguage,
      subtitles: items,
    };
  } finally {
    if (cleanup && fs.existsSync(sourceMediaFile)) {
      void fs.promises.unlink(sourceMediaFile).catch(() => {});
    }
    if (fs.existsSync(tempAudioFile)) {
      void fs.promises.unlink(tempAudioFile).catch(() => {});
    }
  }
}