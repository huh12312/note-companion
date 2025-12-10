import { createOpenAI } from "@ai-sdk/openai";

// Create OpenAI provider with configurable baseURL for local LLM support
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
});

// Always use gpt-4o-mini - ignore any model parameter from client
const DEFAULT_MODEL = openaiProvider("gpt-4o-mini");
const DEFAULT_RESPONSES_MODEL = openaiProvider.responses("gpt-4o-mini");

/**
 * Get the default model for chat completion
 * Note: We ignore any model parameter from the client to ensure consistency
 */
export const getModel = (_name?: string) => {
  return DEFAULT_MODEL;
};

/**
 * Get the default model with Responses API (supports web search)
 */
export const getResponsesModel = () => {
  return DEFAULT_RESPONSES_MODEL;
};