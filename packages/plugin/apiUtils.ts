import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { logMessage } from "./someUtils";
import { logger } from "./services/logger";

/**
 * Validates an API key format before sending to server
 * Unkey API keys are typically 20+ characters, alphanumeric
 * @param key The API key to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateApiKey(key: string | null | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (!key || typeof key !== "string") {
    return {
      isValid: false,
      error: "API key is required",
    };
  }

  const trimmedKey = key.trim();

  if (trimmedKey.length === 0) {
    return {
      isValid: false,
      error: "API key cannot be empty",
    };
  }

  // Minimum length check (server requires at least 10 characters)
  if (trimmedKey.length < 10) {
    return {
      isValid: false,
      error: `API key is too short (${trimmedKey.length} characters). Valid keys are at least 10 characters long.`,
    };
  }

  // Warn if key seems too short for a valid Unkey key (typically 20+)
  if (trimmedKey.length < 20) {
    return {
      isValid: true, // Still allow it, but it might be invalid
      error: `API key seems too short (${trimmedKey.length} characters). Valid Unkey keys are typically 20+ characters.`,
    };
  }

  return { isValid: true };
}

export async function makeApiRequest<T = any>(
  requestFn: () => Promise<RequestUrlResponse>
): Promise<T> {
  logMessage("Making API request", requestFn);
  const response: RequestUrlResponse = await requestFn();
  if (response.status >= 200 && response.status < 300) {
    return response.json as T;
  }
  if (response.json.error) {
    new Notice(`File Organizer error: ${response.json.error}`, 6000);
    throw new Error(response.json.error);
  }
  throw new Error("Unknown error");
}

export async function checkLicenseKey(
  serverUrl: string,
  key: string
): Promise<boolean> {
  try {
    const response: RequestUrlResponse = await requestUrl({
      url: `${serverUrl}/api/check-key`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
    });
    return response.status === 200;
  } catch (error) {
    logger.error("Error checking API key:", error);
    return false;
  }
}
