const ALLOWED_REASONING_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? "gpt-5.4";
}

export function getOpenAIReasoningEffort() {
  const value = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();

  if (!value || !ALLOWED_REASONING_EFFORTS.has(value)) {
    return "high";
  }

  return value;
}
