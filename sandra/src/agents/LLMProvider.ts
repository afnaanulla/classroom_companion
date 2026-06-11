import { groqClient, GROQ_MODEL } from "../config/groq";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { ExternalServiceError } from "../utils/errors";

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  agentType: string
): Promise<string> {
  const startTime = Date.now();

  try {
    const response = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const output = response.choices[0]?.message?.content ?? "";
    const durationMs = Date.now() - startTime;

    await prisma.agentLog.create({
      data: {
        agentType,
        input: userMessage.substring(0, 2000),
        output: output.substring(0, 2000),
        durationMs,
      },
    }).catch((logError) => {
      logger.warn("LLMProvider", "Failed to log agent call", { error: String(logError) });
    });

    logger.info("LLMProvider", `${agentType} completed in ${durationMs}ms`);
    return output;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("LLMProvider", `${agentType} failed after ${durationMs}ms`, {
      error: String(error),
    });
    throw new ExternalServiceError(`LLM call failed for ${agentType}: ${String(error)}`);
  }
}

export function parseJSON<T>(raw: string): T | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}
