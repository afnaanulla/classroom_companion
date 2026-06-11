import { callLLM, parseJSON } from "./LLMProvider";
import { ReminderScheduleItem } from "../types";

const SYSTEM_PROMPT = `You are a reminder scheduling agent for a classroom companion bot.
Given an assignment with its deadline, generate a thoughtful reminder schedule.

Respond ONLY with valid JSON:
{
  "reminders": [
    {
      "delayHours": number (hours from now to send this reminder),
      "message": "the reminder message to send to the student",
      "escalationLevel": "GENTLE" | "MODERATE" | "URGENT" | "OVERDUE"
    }
  ]
}

Rules:
- For assignments due in 1 day: 1 urgent reminder immediately
- For assignments due in 2-3 days: 2 reminders (gentle now, urgent 24h before deadline)
- For assignments due in 4-7 days: 3 reminders (gentle at start, moderate midway, urgent 24h before)
- For assignments due in 7+ days: 4 reminders (gentle at start, moderate at 50%, urgent at 75%, critical 24h before)
- Messages should be friendly and encouraging, not robotic
- Include the assignment title in messages
- Use the student's name if provided
- Never send more than 1 reminder per day`;

interface ReminderScheduleResponse {
  reminders: ReminderScheduleItem[];
}

export async function generateReminderSchedule(
  assignmentTitle: string,
  studentName: string,
  deadlineDate: string,
  hoursUntilDeadline: number
): Promise<ReminderScheduleItem[]> {
  const context = `Assignment: "${assignmentTitle}"\nStudent: ${studentName}\nDeadline: ${deadlineDate}\nHours until deadline: ${hoursUntilDeadline}`;
  const raw = await callLLM(SYSTEM_PROMPT, context, "ReminderAgent");
  const parsed = parseJSON<ReminderScheduleResponse>(raw);
  return parsed?.reminders ?? [];
}
