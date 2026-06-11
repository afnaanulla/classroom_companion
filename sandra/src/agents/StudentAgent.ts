import { callLLM, parseJSON } from "./LLMProvider";
import { StatusUpdateData, SubmissionData } from "../types";

const STATUS_PROMPT = `You are a student assistant agent for a classroom companion bot.
Interpret the student's message about their assignment progress.

Respond ONLY with valid JSON:
{
  "assignmentTitle": "assignment title if mentioned, or null",
  "progressDescription": "brief summary of what the student said about progress",
  "estimatedPercentage": 0 to 100,
  "sentiment": "stuck" or "on-track" or "ahead"
}

Examples:
- "Done 3 paragraphs out of 5" → 60%, on-track
- "Stuck on the introduction, can't think of anything" → 10%, stuck
- "Almost done, just proofreading" → 90%, ahead
- "Haven't started yet" → 0%, stuck`;

const SUBMISSION_PROMPT = `You are a student assistant agent. The student is submitting their work.
Extract the submission content from their message.

Respond ONLY with valid JSON:
{
  "assignmentTitle": "assignment title if mentioned, or null",
  "textContent": "the actual submission text/content from the student"
}

If the student just says "done" or "submitting", set textContent to their full message as submission confirmation.`;

export async function parseStatusUpdate(
  message: string
): Promise<StatusUpdateData | null> {
  const raw = await callLLM(STATUS_PROMPT, message, "StudentAgent");
  return parseJSON<StatusUpdateData>(raw);
}

export async function parseSubmission(
  message: string
): Promise<SubmissionData | null> {
  const raw = await callLLM(SUBMISSION_PROMPT, message, "StudentAgent");
  return parseJSON<SubmissionData>(raw);
}
