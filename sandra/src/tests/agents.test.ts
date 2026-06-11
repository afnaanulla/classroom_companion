import { describe, it, expect, vi } from "vitest";

// Mock the LLMProvider to return custom JSON outputs without making network requests
vi.mock("../agents/LLMProvider", () => ({
  callLLM: vi.fn(),
  parseJSON: (raw: string) => {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch {
      return null;
    }
  },
}));

import { classifyIntent } from "../agents/IntentRouterAgent";
import { parseAssignmentInstruction, parseFeedbackInstruction } from "../agents/TeacherAgent";
import { parseStatusUpdate, parseSubmission } from "../agents/StudentAgent";
import * as LLMProvider from "../agents/LLMProvider";
import { Intent } from "../types";

describe("Classroom Companion Agents", () => {
  it("IntentRouterAgent should classify messages correctly", async () => {
    const mockCall = vi.spyOn(LLMProvider, "callLLM").mockResolvedValue(
      JSON.stringify({
        intent: "ASSIGNMENT_INSTRUCTION",
        confidence: 0.95,
        extractedEntities: {},
        clarificationMessage: null,
      })
    );

    const result = await classifyIntent("Assign Riya photosynthesis essay in 2 days");
    expect(result.intent).toBe(Intent.ASSIGNMENT_INSTRUCTION);
    expect(result.confidence).toBe(0.95);
    expect(mockCall).toHaveBeenCalled();
    mockCall.mockRestore();
  });

  it("TeacherAgent should parse assignment instructions", async () => {
    const mockCall = vi.spyOn(LLMProvider, "callLLM").mockResolvedValue(
      JSON.stringify({
        title: "Photosynthesis Essay",
        description: "Write a 500-word essay",
        dueDate: "in 2 days",
        targetStudentName: "Riya",
      })
    );

    const result = await parseAssignmentInstruction("Assign Riya Photosynthesis Essay, in 2 days");
    expect(result?.title).toBe("Photosynthesis Essay");
    expect(result?.targetStudentName).toBe("Riya");
    expect(result?.dueDate).toBe("in 2 days");
    mockCall.mockRestore();
  });

  it("TeacherAgent should parse feedback instructions", async () => {
    const mockCall = vi.spyOn(LLMProvider, "callLLM").mockResolvedValue(
      JSON.stringify({
        targetStudentName: "Riya",
        feedbackText: "Great job on the essay!",
      })
    );

    const result = await parseFeedbackInstruction("Give Riya feedback: Great job on the essay!");
    expect(result?.targetStudentName).toBe("Riya");
    expect(result?.feedbackText).toBe("Great job on the essay!");
    mockCall.mockRestore();
  });

  it("StudentAgent should parse status updates", async () => {
    const mockCall = vi.spyOn(LLMProvider, "callLLM").mockResolvedValue(
      JSON.stringify({
        assignmentTitle: "Essay",
        progressDescription: "Done 2 paragraphs",
        estimatedPercentage: 40,
        sentiment: "on-track",
      })
    );

    const result = await parseStatusUpdate("Done 2 paragraphs of my essay");
    expect(result?.estimatedPercentage).toBe(40);
    expect(result?.sentiment).toBe("on-track");
    mockCall.mockRestore();
  });

  it("StudentAgent should parse submissions", async () => {
    const mockCall = vi.spyOn(LLMProvider, "callLLM").mockResolvedValue(
      JSON.stringify({
        assignmentTitle: "Essay",
        textContent: "Here is the essay text content.",
      })
    );

    const result = await parseSubmission("Done! Here is the essay text content.");
    expect(result?.textContent).toBe("Here is the essay text content.");
    mockCall.mockRestore();
  });
});
