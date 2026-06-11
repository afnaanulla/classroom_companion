import { callLLM, parseJSON } from "./LLMProvider";
import { AssignmentInstruction, FeedbackData } from "../types";

const ASSIGNMENT_PROMPT = `You are a teacher assistant agent. Parse the teacher's message to extract assignment details.

Respond ONLY with valid JSON:
{
  "title": "short assignment title",
  "description": "full assignment description",
  "dueDate": "YYYY-MM-DD format or relative like 'in 3 days'",
  "targetStudentName": "student name if mentioned, or null"
}

Parse relative dates: "in 3 days" means 3 days from today, "tomorrow" means 1 day from today, "next week" means 7 days from today.
If any critical field is missing, still return best effort but set the field to a sensible default.
Title should be concise (under 60 chars). Description should capture the full requirement.`;

const FEEDBACK_PROMPT = `You are a teacher assistant agent. The teacher wants to provide feedback on a student's submission.
Generate helpful, constructive, and encouraging feedback based on the teacher's message.

Respond ONLY with valid JSON:
{
  "assignmentTitle": "assignment title if mentioned, or null",
  "feedbackText": "the complete feedback to send to the student"
}

Make the feedback specific, actionable, and encouraging. Include what was done well and what could improve.`;

export async function parseAssignmentInstruction(
  message: string
): Promise<AssignmentInstruction | null> {
  const raw = await callLLM(ASSIGNMENT_PROMPT, message, "TeacherAgent");
  return parseJSON<AssignmentInstruction>(raw);
}

export async function generateFeedback(
  message: string,
  studentName: string,
  assignmentTitle: string
): Promise<FeedbackData | null> {
  const context = `Student: ${studentName}\nAssignment: ${assignmentTitle}\nTeacher's input: ${message}`;
  const raw = await callLLM(FEEDBACK_PROMPT, context, "TeacherAgent");
  return parseJSON<FeedbackData>(raw);
}

const PARSE_FEEDBACK_PROMPT = `You are a teacher assistant agent.
Parse the teacher's message to extract who they are giving feedback to, and what the feedback message is.

Respond ONLY with valid JSON in this exact format:
{
  "targetStudentName": "student name if mentioned, or null",
  "feedbackText": "the raw feedback text to send to the student"
}

Examples:
- "Give Riya feedback: Great work on the essay!" -> { "targetStudentName": "Riya", "feedbackText": "Great work on the essay!" }
- "Tell Harry he did a good job on photosynthesis" -> { "targetStudentName": "Harry", "feedbackText": "Good job on photosynthesis" }
- "Feedback for Arjun: Please proofread again." -> { "targetStudentName": "Arjun", "feedbackText": "Please proofread again." }`;

export async function parseFeedbackInstruction(
  message: string
): Promise<{ targetStudentName: string | null; feedbackText: string } | null> {
  const raw = await callLLM(PARSE_FEEDBACK_PROMPT, message, "TeacherAgent");
  return parseJSON<{ targetStudentName: string | null; feedbackText: string }>(raw);
}
