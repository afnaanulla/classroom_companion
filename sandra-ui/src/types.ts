export interface Assignment {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "FEEDBACK_GIVEN";
  studentName?: string;
  studentTelegramId?: string;
  teacherName?: string;
  teacherTelegramId?: string;
  submissions: Submission[];
  feedbacks: FeedbackItem[];
  recentProgress: ProgressItem[];
  createdAt: string;
}

export interface Submission {
  id: string;
  textContent: string;
  filePath?: string;
  reviewed: boolean;
  submittedAt: string;
}

export interface FeedbackItem {
  id: string;
  message: string;
  createdAt: string;
  assignmentTitle?: string;
  teacherName?: string;
}

export interface ProgressItem {
  message: string;
  createdAt: string;
}

export interface StudentInfo {
  id: string;
  name: string;
  linkedAt: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
