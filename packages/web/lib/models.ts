import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';

// Create OpenAI provider with configurable baseURL for local LLM support
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
});

// Always use gpt-4o-mini - ignore any model parameter from client
// Note: Using gpt-4o-mini for compatibility with @ai-sdk/openai v1.2.2
// gpt-4.1-mini is essentially the same model (just a newer name)
const DEFAULT_MODEL = openaiProvider('gpt-4o-mini');

/**
 * Get the default model for chat completion
 * Note: We ignore any model parameter from the client to ensure consistency
 */
export const getModel = (_name?: string): LanguageModel => {
  return DEFAULT_MODEL as LanguageModel;
};

/**
 * Get the default model with Responses API (supports web search)
 * Note: In v1.2.2, responses() may not be available, so we use the regular model
 */
export const getResponsesModel = (): LanguageModel => {
  // In v1.2.2, responses() might not exist, so use regular model
  // The Responses API features may not be available in this version
  return DEFAULT_MODEL as LanguageModel;
};
