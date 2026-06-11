import { callLLM, parseJSON } from "./LLMProvider";
import { IntentClassification, Intent } from "../types";

const SYSTEM_PROMPT = `You are an intent classification agent for a classroom companion bot.
Classify the user's message into ONE of these intents:
- ASSIGNMENT_INSTRUCTION: Teacher giving an assignment (contains task description, possibly a deadline or student name)
- STATUS_UPDATE: Student reporting progress on an assignment
- COMPLETION_NOTICE: Student saying they finished/completed/submitted work
- QUERY: Someone asking a question about assignments, status, or the system
- FEEDBACK_REQUEST: Teacher wanting to give feedback on student work
- OTHER: Anything that doesn't fit above

Respond ONLY with valid JSON in this exact format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0 to 1.0,
  "extractedEntities": { "key": "value" },
  "clarificationMessage": null or "question to ask user"
}

If confidence is below 0.6, set clarificationMessage to ask the user what they meant.
Extract relevant entities like student names, assignment titles, dates, or percentages mentioned.`;

export async function classifyIntent(message: string): Promise<IntentClassification> {
  const raw = await callLLM(SYSTEM_PROMPT, message, "IntentRouter");
  const parsed = parseJSON<IntentClassification>(raw);

  if (!parsed) {
    return {
      intent: Intent.OTHER,
      confidence: 0,
      extractedEntities: {},
      clarificationMessage: "I couldn't understand that. Could you rephrase?",
    };
  }

  // Validate the intent is a known value
  const validIntents = Object.values(Intent);
  if (!validIntents.includes(parsed.intent as Intent)) {
    parsed.intent = Intent.OTHER;
  }

  return parsed;
}
