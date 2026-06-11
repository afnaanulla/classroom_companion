import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("GROQ_API_KEY is missing from environment variables");
}

export const groqClient = new Groq({ apiKey });
export const GROQ_MODEL = "llama-3.3-70b-versatile";
