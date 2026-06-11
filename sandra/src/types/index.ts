// ── Intent classification ──
export enum Intent {
  ASSIGNMENT_INSTRUCTION = "ASSIGNMENT_INSTRUCTION",
  STATUS_UPDATE = "STATUS_UPDATE",
  COMPLETION_NOTICE = "COMPLETION_NOTICE",
  QUERY = "QUERY",
  FEEDBACK_REQUEST = "FEEDBACK_REQUEST",
  OTHER = "OTHER",
}

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  extractedEntities: Record<string, string>;
  clarificationMessage: string | null;
}

// ── Agent responses ──
export interface AssignmentInstruction {
  title: string;
  description: string;
  dueDate: string;
  targetStudentName: string | null;
}

export interface StatusUpdateData {
  assignmentTitle: string | null;
  progressDescription: string;
  estimatedPercentage: number;
  sentiment: "stuck" | "on-track" | "ahead";
}

export interface SubmissionData {
  assignmentTitle: string | null;
  textContent: string;
}

export interface FeedbackData {
  assignmentTitle: string | null;
  feedbackText: string;
}

export interface ReminderScheduleItem {
  delayHours: number;
  message: string;
  escalationLevel: "GENTLE" | "MODERATE" | "URGENT" | "OVERDUE";
}

export interface StatusSummaryItem {
  studentName: string;
  summary: string;
  alerts: string[];
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ── API response wrapper ──
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
