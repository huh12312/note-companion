import { TFile } from "obsidian";
import { logger } from "../../../services/logger";
import FileOrganizer from "../../../index";
import { RecordingMetadata, MeetingMetadataManager } from "./meeting-metadata";
import { Notice } from "obsidian";

export interface TranscribeResult {
  success: boolean;
  transcript?: string;
  error?: string;
}

export class TranscribeHandler {
  static async transcribeRecording(
    plugin: FileOrganizer,
    recording: RecordingMetadata,
    metadataManager?: MeetingMetadataManager
  ): Promise<TranscribeResult> {
    try {
      // Get the audio file
      const file = plugin.app.vault.getAbstractFileByPath(
        recording.filePath
      ) as TFile | null;

      if (!file) {
        return {
          success: false,
          error: "Recording file not found",
        };
      }

      // Check file size (25MB limit)
      const fileSizeInMB = file.stat.size / (1024 * 1024);
      if (fileSizeInMB > 25) {
        return {
          success: false,
          error: `Recording is too large (${fileSizeInMB.toFixed(2)} MB). Maximum is 25MB. Please record a shorter meeting or split into multiple recordings.`,
        };
      }

      // Check quota before uploading
      const quotaCheck = await this.checkQuota(plugin, file);
      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.error || "Quota exceeded",
        };
      }

      // Read file as ArrayBuffer
      const audioBuffer = await plugin.app.vault.readBinary(file);

      // Upload and transcribe
      const response = await plugin.transcribeAudio(
        audioBuffer,
        file.extension
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || "Transcription failed",
        };
      }

      const data = await response.json();
      const transcript = data.text;

      // Store transcript in vault
      const transcriptPath = `${recording.filePath.replace(/\.[^/.]+$/, "")}.txt`;

      // Check if transcript file already exists
      const existingTranscriptFile = plugin.app.vault.getAbstractFileByPath(transcriptPath);
      if (existingTranscriptFile && existingTranscriptFile instanceof TFile) {
        // File exists, update it
        await plugin.app.vault.modify(existingTranscriptFile, transcript);
      } else {
        // File doesn't exist, create it
        await plugin.app.vault.create(transcriptPath, transcript);
      }

      // Update metadata if manager provided
      if (metadataManager) {
        await metadataManager.updateMetadata({
          ...recording,
          transcribed: true,
          transcriptPath,
        });
      }

      return {
        success: true,
        transcript,
      };
    } catch (error) {
      logger.error("Error transcribing recording:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async checkQuota(
    plugin: FileOrganizer,
    file: TFile
  ): Promise<{ allowed: boolean; error?: string }> {
    try {
      // Estimate duration from file size
      const fileSizeInMB = file.stat.size / (1024 * 1024);
      // Conservative estimate: 1MB ≈ 2 minutes at 32kbps
      const estimatedMinutes = Math.ceil(fileSizeInMB * 2);

      // Get usage info
      const usageResponse = await fetch(
        `${plugin.getServerUrl()}/api/usage`,
        {
          headers: {
            Authorization: `Bearer ${plugin.settings.API_KEY}`,
          },
        }
      );

      if (!usageResponse.ok) {
        return {
          allowed: false,
          error: "Failed to check quota",
        };
      }

      const usageData = await usageResponse.json();
      const remainingMinutes =
        usageData.maxAudioTranscriptionMinutes -
        usageData.audioTranscriptionMinutes;

      if (remainingMinutes < estimatedMinutes) {
        return {
          allowed: false,
          error: `You've reached your monthly transcription limit. You have ${remainingMinutes} minutes remaining, but this recording is approximately ${estimatedMinutes} minutes. Please upgrade your plan or wait for the next billing cycle.`,
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error("Error checking quota:", error);
      return {
        allowed: false,
        error: "Failed to check quota",
      };
    }
  }

  static async getAudioDuration(file: TFile): Promise<number> {
    // Estimate duration from file size
    // At 32kbps: ~0.23MB per minute
    const fileSizeInMB = file.stat.size / (1024 * 1024);
    return Math.ceil(fileSizeInMB / 0.23);
  }
}

