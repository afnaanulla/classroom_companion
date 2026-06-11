import { callLLM } from "./LLMProvider";

const SYSTEM_PROMPT = `You are a status summarizer agent for a classroom companion bot.
Given information about students and their assignments, generate a narrative summary for the teacher.

Write a clear, concise summary that:
- Groups information by student
- Highlights exceptions (overdue, stuck, no activity)
- Uses a friendly professional tone
- Mentions specific assignments by name
- Notes any submissions pending review
- Keeps each student summary to 1-2 sentences

Do NOT return JSON. Return a plain text summary formatted with line breaks between students.
Start with an overall status line, then list each student.`;

export async function generateStatusSummary(
  teacherName: string,
  studentsData: string
): Promise<string> {
  const context = `Teacher: ${teacherName}\n\nStudent Data:\n${studentsData}`;
  const raw = await callLLM(SYSTEM_PROMPT, context, "SummarizerAgent");
  return raw || "No summary available at this time.";
}
