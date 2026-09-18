import { config } from '../config/env.config.js';
import { executeSafeSqlQuery, getDatabaseSchemaMetadata } from './analytics.service.js';
import { logger } from './logger.service.js';

export interface AiChatMessage {
  content: string;
  role: 'assistant' | 'user';
}

export interface AiAssistantQueryResult {
  executionTimeMs: number;
  rowsCount: number;
  sql: string;
}

export interface AiAssistantResponse {
  queriesExecuted: AiAssistantQueryResult[];
  reply: string;
  success: boolean;
}

const TOOLS_DECLARATION = [
  {
    functionDeclarations: [
      {
        description: 'Obtiene los metadatos de las tablas y columnas disponibles en la base de datos para construir consultas SQL precisas.',
        name: 'get_database_schema',
        parameters: {
          properties: {
            tables: {
              description: 'Nombres específicos de tablas a inspeccionar (opcional).',
              items: { type: 'STRING' },
              type: 'ARRAY',
            },
          },
          type: 'OBJECT',
        },
      },
      {
        description: 'Ejecuta una consulta SQL de solo lectura (SELECT, SHOW, DESCRIBE, EXPLAIN) en la base de datos y retorna los resultados.',
        name: 'execute_sql_query',
        parameters: {
          properties: {
            sql: {
              description: 'Instrucción SQL SELECT válida y optimizada para consultar los datos solicitados.',
              type: 'STRING',
            },
          },
          required: ['sql'],
          type: 'OBJECT',
        },
      },
    ],
  },
];

export class AiAssistantService {
  static async askAssistant(
    userPrompt: string,
    history: AiChatMessage[] = [],
    pageContext: string = '/analytics'
  ): Promise<AiAssistantResponse> {
    const trimmed = userPrompt.trim();
    if (!trimmed) {
      return {
        queriesExecuted: [],
        reply: 'Por favor ingresa una pregunta o consulta.',
        success: false,
      };
    }

    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.error('AiAssistantService: GEMINI_API_KEY no configurada');
      return {
        queriesExecuted: [],
        reply: 'El servicio de IA no se encuentra disponible en este momento debido a que no se ha configurado la clave de API.',
        success: false,
      };
    }

    const queriesExecuted: AiAssistantQueryResult[] = [];

    const systemInstruction = `Eres Spriteboard Analyst AI, el asistente experto en inteligencia de datos y analítica interna de la plataforma Spriteboard.
Tienes acceso a herramientas para inspeccionar el esquema de base de datos MySQL (get_database_schema) y ejecutar consultas SQL de solo lectura (execute_sql_query).

REGLAS ESTRICTAS DE OPERACIÓN Y SEGURIDAD:
1. Solo puedes realizar consultas de lectura (SELECT, SHOW, DESCRIBE, EXPLAIN). Jamás intentes modificaciones (INSERT, UPDATE, DELETE, DROP, ALTER).
2. Antes de escribir una consulta SQL sobre una tabla cuya estructura exacta desconozcas, utiliza get_database_schema para verificar nombres de columnas y tipos de datos reales.
3. Si el usuario hace una pregunta cuantitativa sobre lienzos, visitas, usuarios, equipos, suscripciones o logs, utiliza execute_sql_query para obtener datos reales en lugar de inventarlos.
4. Diseña consultas SQL eficientes, limitando los resultados a un número razonable (ej. LIMIT 10 a 50) y ordenando apropiadamente (ORDER BY ... DESC/ASC).
5. Explica los resultados de manera concisa, clara, estructurada y en español formal. Utiliza tablas o listas en Markdown cuando sea apropiado para facilitar la lectura al analista.
6. Si una consulta falla o arroja un error SQL, analiza el motivo, ajusta la consulta y reinténtalo una vez.
7. El analista se encuentra navegando actualmente en la sección: "${pageContext}". Adapta el tono y las sugerencias a este contexto.`;

    const contents: Array<{
      parts: Array<Record<string, any>>;
      role: 'model' | 'user';
    }> = [];

    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      contents.push({
        parts: [{ text: msg.content }],
        role: msg.role === 'assistant' ? 'model' : 'user',
      });
    }

    contents.push({
      parts: [{ text: trimmed }],
      role: 'user',
    });

    const modelName = config.gemini.model || 'gemini-flash-lite-latest';
    const fallbackModels = [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];

    const buildUrl = (m: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

    const maxTurns = 5;
    let turnCount = 0;

    while (turnCount < maxTurns) {
      turnCount++;

      const requestBody = {
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.1,
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        tools: TOOLS_DECLARATION,
      };

      let response: Response | null = null;
      let activeModel = modelName;

      try {
        response = await fetch(buildUrl(activeModel), {
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!response.ok && (response.status === 503 || response.status === 404)) {
          for (const fallback of fallbackModels) {
            if (fallback === activeModel) continue;
            activeModel = fallback;
            response = await fetch(buildUrl(activeModel), {
              body: JSON.stringify(requestBody),
              headers: { 'Content-Type': 'application/json' },
              method: 'POST',
            });
            if (response.ok) break;
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          logger.app.error('AiAssistantService: Error HTTP desde Gemini API', {
            status: response.status,
            text: errText.slice(0, 300),
          });
          return {
            queriesExecuted,
            reply: 'Ocurrió un error de comunicación con el motor de IA al procesar la solicitud.',
            success: false,
          };
        }

        const data = (await response.json()) as any;
        const candidate = data?.candidates?.[0];
        const candidateContent = candidate?.content;

        if (!candidateContent || !Array.isArray(candidateContent.parts) || candidateContent.parts.length === 0) {
          logger.app.warn('AiAssistantService: Respuesta vacía de Gemini', { data });
          return {
            queriesExecuted,
            reply: 'No se recibió respuesta del asistente para la consulta realizada.',
            success: false,
          };
        }

        contents.push(candidateContent);

        const functionCallPart = candidateContent.parts.find((p: any) => p.functionCall);
        if (!functionCallPart) {
          const textParts = candidateContent.parts.filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('\n').trim();
          return {
            queriesExecuted,
            reply: textParts || 'Consulta procesada correctamente.',
            success: true,
          };
        }

        const call = functionCallPart.functionCall;
        const functionName = call.name;
        const functionArgs = call.args || {};

        let functionResponseData: Record<string, any> = {};

        if (functionName === 'get_database_schema') {
          try {
            const schemaMeta = await getDatabaseSchemaMetadata();
            const requestedTables: string[] = Array.isArray(functionArgs.tables) ? functionArgs.tables.map((t: string) => t.toLowerCase()) : [];

            const filteredDbs = schemaMeta.databases.map((db) => {
              const tables = requestedTables.length > 0
                ? db.tables.filter((tb) => requestedTables.includes(tb.tableName.toLowerCase()))
                : db.tables;
              return {
                description: db.description,
                name: db.name,
                tables: tables.map((t) => ({
                  columns: t.columns.map((c) => ({
                    columnName: c.columnName,
                    dataType: c.dataType,
                    isNullable: c.isNullable,
                    key: c.columnKey,
                    type: c.typeFormatted,
                  })),
                  estimatedRows: t.estimatedRows,
                  tableName: t.tableName,
                })),
              };
            });

            functionResponseData = { databases: filteredDbs };
          } catch (err: any) {
            functionResponseData = { error: err.message || 'Error al obtener esquema' };
          }
        } else if (functionName === 'execute_sql_query') {
          const sql = typeof functionArgs.sql === 'string' ? functionArgs.sql : '';
          try {
            const queryResult = await executeSafeSqlQuery(sql);
            queriesExecuted.push({
              executionTimeMs: queryResult.executionTimeMs,
              rowsCount: queryResult.totalRows,
              sql,
            });
            functionResponseData = {
              columns: queryResult.columns,
              executionTimeMs: queryResult.executionTimeMs,
              rows: queryResult.rows,
              totalRows: queryResult.totalRows,
            };
          } catch (err: any) {
            functionResponseData = {
              error: err.message || 'Error al ejecutar SQL',
              sql,
            };
          }
        } else {
          functionResponseData = { error: `Herramienta desconocida: ${functionName}` };
        }

        contents.push({
          parts: [
            {
              functionResponse: {
                name: functionName,
                response: functionResponseData,
              },
            },
          ],
          role: 'user',
        });
      } catch (err: any) {
        logger.app.error('AiAssistantService: Excepción en bucle de ejecución de IA', {
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          queriesExecuted,
          reply: 'Ha ocurrido un error inesperado al procesar la consulta con la base de datos.',
          success: false,
        };
      }
    }

    return {
      queriesExecuted,
      reply: 'Se ha alcanzado el límite máximo de iteraciones para esta consulta.',
      success: false,
    };
  }
}

export default AiAssistantService;
