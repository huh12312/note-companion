import React, { useState } from "react";
import { Button } from "../ai-chat/button";
import { FileText, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { TFile } from "obsidian";
import FileOrganizer from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { logger } from "../../../services/logger";
import { RecordingMetadata, MeetingMetadataManager } from "./meeting-metadata";
import { TranscribeHandler } from "./transcribe-handler";

interface EnhanceNoteHandlerProps {
  plugin: FileOrganizer;
  recording: RecordingMetadata;
  metadataManager: MeetingMetadataManager;
  onEnhanced: () => void;
}

export const EnhanceNoteHandler: React.FC<EnhanceNoteHandlerProps> = ({
  plugin,
  recording,
  metadataManager,
  onEnhanced,
}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enhanceNote = async () => {
    // Check if a note is open
    const activeFile = plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Please open a note to enhance");
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      // Get current note content
      const currentNoteContent = await plugin.app.vault.read(activeFile);

      // Check if this specific recording was already used on this note
      // Also verify the note file still exists (in case it was deleted)
      let isSameRecordingReused = false;
      if (recording.notePath === activeFile.path) {
        // Verify the note file still exists
        const noteFile = plugin.app.vault.getAbstractFileByPath(
          recording.notePath
        );
        if (noteFile && noteFile instanceof TFile) {
          isSameRecordingReused = true;
        } else {
          // Note was deleted, clear the stale reference
          logger.warn(
            `Note file not found: ${recording.notePath}, clearing notePath reference`
          );
          await metadataManager.updateMetadata({
            ...recording,
            notePath: null,
          });
        }
      }

      // Check if note has any enhanced sections (from any recording)
      const hasEnhancedSections =
        currentNoteContent.includes("## Full Transcript") ||
        currentNoteContent.includes("## Discussion Points") ||
        currentNoteContent.includes("## Action Items");

      if (isSameRecordingReused && hasEnhancedSections) {
        const shouldContinue = confirm(
          "This note has already been enhanced with this recording. Re-enhancing will replace the existing enhanced sections. Continue?"
        );
        if (!shouldContinue) {
          return;
        }
      } else if (!isSameRecordingReused && hasEnhancedSections) {
        // Different recording on a note that already has enhanced sections
        // This is allowed - user wants to enhance with multiple recordings
        // The API will handle merging/replacing appropriately
      }

      // Check if recording is transcribed
      // Verify transcription status by checking if transcript file exists and is readable
      let transcript = "";
      let isTranscribed = false;
      let actualTranscriptPath: string | null = null;

      // Debug: Log the recording state
      logger.debug("Enhance note - recording state:", {
        transcribed: recording.transcribed,
        transcriptPath: recording.transcriptPath,
        filePath: recording.filePath,
      });

      // Calculate expected transcript path (same logic as in transcribe-handler.ts)
      const expectedTranscriptPath = `${recording.filePath.replace(
        /\.[^/.]+$/,
        ""
      )}.txt`;

      // Try to find transcript file - check metadata path first, then calculated path
      const transcriptPathsToCheck = [
        recording.transcriptPath, // From metadata
        expectedTranscriptPath, // Calculated from audio file path
      ].filter(Boolean) as string[];

      for (const transcriptPath of transcriptPathsToCheck) {
        try {
          const transcriptFile =
            plugin.app.vault.getAbstractFileByPath(transcriptPath);
          if (transcriptFile && transcriptFile instanceof TFile) {
            // Verify file exists and is readable
            const transcriptContent = await plugin.app.vault.read(
              transcriptFile
            );
            if (transcriptContent && transcriptContent.trim().length > 0) {
              isTranscribed = true;
              transcript = transcriptContent;
              actualTranscriptPath = transcriptPath;
              logger.debug("Using existing transcript from:", transcriptPath);
              break; // Found valid transcript, stop searching
            } else {
              logger.warn(
                `Transcript file exists but is empty: ${transcriptPath}`
              );
            }
          }
        } catch (error) {
          logger.debug(
            `Transcript file not found or unreadable: ${transcriptPath}`,
            error
          );
        }
      }

      if (!isTranscribed) {
        // Need to transcribe
        if (recording.transcribed || recording.transcriptPath) {
          // Metadata says transcribed but file doesn't exist or is unreadable
          logger.warn(
            `Recording metadata indicates transcribed, but transcript file is missing or unreadable. Re-transcribing.`
          );
          new Notice("Re-transcribing recording...");
        } else {
          new Notice("Transcribing recording...");
        }

        const transcriptResult = await TranscribeHandler.transcribeRecording(
          plugin,
          recording,
          metadataManager
        );

        if (!transcriptResult.success) {
          throw new Error(transcriptResult.error || "Transcription failed");
        }

        transcript = transcriptResult.transcript || "";
        actualTranscriptPath = expectedTranscriptPath; // Use calculated path after transcription
      } else {
        // Using existing transcript - update metadata if transcriptPath is missing or different
        if (
          actualTranscriptPath &&
          actualTranscriptPath !== recording.transcriptPath
        ) {
          logger.debug(
            `Updating metadata with transcriptPath: ${actualTranscriptPath}`
          );
          await metadataManager.updateMetadata({
            ...recording,
            transcribed: true,
            transcriptPath: actualTranscriptPath,
          });
        }
        new Notice("Using existing transcript");
      }

      if (!transcript) {
        throw new Error("No transcript available");
      }

      // Call enhancement API
      new Notice("Enhancing note...");

      // Extract existing recording links from original note before removing the section
      // This way we can merge them with the new link
      const originalRecordingSectionPattern =
        /^(Recording[s]?:.*?)\n\n---\n\n/s;
      const originalMatch = currentNoteContent.match(
        originalRecordingSectionPattern
      );

      const existingRecordingLinks: string[] = [];
      if (originalMatch) {
        const existingSection = originalMatch[1];
        // Extract all lines from the section
        const lines = existingSection
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);

        // Parse the new format: - name followed by ![[path]]
        // Or old format: just links
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for embedded link format: ![[path]]
          const embeddedMatch = line.match(/!\[\[(.+?)\]\]/);
          if (embeddedMatch) {
            existingRecordingLinks.push(embeddedMatch[1]); // Store the file path
          } else {
            // Check for regular link format: [[path]]
            const linkMatch = line.match(/\[\[(.+?)\]\]/);
            if (linkMatch) {
              existingRecordingLinks.push(linkMatch[1]); // Store the file path
            }
            // If it's a list item with just a name (starts with "-"),
            // the next line should have the embedded link, so we'll catch it in the next iteration
          }
        }
      }

      // Remove the old "Recording:" section from currentNoteContent before sending to API
      // This prevents the API from preserving it in the response
      const cleanedNoteContent = currentNoteContent.replace(
        originalRecordingSectionPattern,
        ""
      );

      // Format date from recording metadata
      const recordingDate = recording.createdAt
        ? new Date(recording.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;

      const response = await fetch(
        `${plugin.getServerUrl()}/api/enhance-meeting-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plugin.settings.API_KEY}`,
          },
          body: JSON.stringify({
            transcript,
            currentNoteContent: cleanedNoteContent, // Use cleaned content without old recording section
            fileName: activeFile.basename,
            recordingDate,
            recordingDuration: recording.duration,
            recordingFileName:
              recording.filePath.split("/").pop() || recording.filePath,
            recordingFilePath: recording.filePath,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Enhancement failed");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let enhancedContent = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        enhancedContent += chunk;
      }

      // Remove any "Recording:" or "Recordings:" sections that the API might have added
      // We'll add our own properly formatted section
      // Match with separator line (---)
      enhancedContent = enhancedContent.replace(
        /^Recording[s]?:.*?\n\n---\n\n/s,
        ""
      );
      // Also remove if it appears elsewhere (without separator or with different format)
      enhancedContent = enhancedContent.replace(
        /\n\nRecording[s]?:.*?\n\n---\n\n/g,
        "\n\n"
      );
      // Remove old format with just links (without embedded players)
      enhancedContent = enhancedContent.replace(
        /^Recording[s]?:.*?(!?\[\[.*?\]\]).*?\n\n---\n\n/s,
        ""
      );

      // Add embedded audio player at the top of the enhanced note
      // Format: Recordings: - name ![[filepath]]
      const audioFileName =
        recording.filePath.split("/").pop() || recording.filePath;
      const embeddedAudioLink = `![[${recording.filePath}]]`;

      // Check if this specific recording already exists in the content
      // Look for both regular links and embedded links
      const escapedFilePath = recording.filePath.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const linkPattern = new RegExp(`(!?)\\[\\[${escapedFilePath}\\]\\]`, "i");

      // Check if this specific link already exists
      const linkExistsInOriginal = linkPattern.test(currentNoteContent);
      const linkExistsInEnhanced = linkPattern.test(enhancedContent);

      // Only add if this specific recording doesn't exist
      if (!linkExistsInOriginal && !linkExistsInEnhanced) {
        if (existingRecordingLinks.length > 0) {
          // Parse existing recordings from original note
          // Extract filenames and filepaths from existing format
          const existingRecordings: Array<{ name: string; path: string }> = [];

          for (const link of existingRecordingLinks) {
            // Try to extract file path from link (could be [[path]] or ![[path]])
            const match = link.match(/!?\[\[(.+?)\]\]/);
            if (match) {
              const filePath = match[1];
              const fileName = filePath.split("/").pop() || filePath;
              existingRecordings.push({ name: fileName, path: filePath });
            } else {
              // If it's just a filename, try to construct path
              const fileName = link.replace(/^-\s*/, "").trim();
              existingRecordings.push({ name: fileName, path: fileName });
            }
          }

          // Add new recording
          existingRecordings.push({
            name: audioFileName,
            path: recording.filePath,
          });

          // Build the recordings section
          const recordingsSection = existingRecordings
            .map(rec => `- ${rec.name}\n![[${rec.path}]]`)
            .join("\n");

          // Add the merged section at the top
          enhancedContent = `Recordings:\n${recordingsSection}\n\n---\n\n${enhancedContent.trim()}`;
        } else {
          // No existing recording section, add new one
          enhancedContent = `Recordings:\n- ${audioFileName}\n${embeddedAudioLink}\n\n---\n\n${enhancedContent.trim()}`;
        }
      }
      // If recording already exists, don't add it again

      // Replace current note content
      await plugin.app.vault.modify(activeFile, enhancedContent);

      // Update metadata - use the actualTranscriptPath we found/created
      // Reload metadata to get the latest transcriptPath if transcription just happened
      await metadataManager.loadMetadata();
      const latestRecording = metadataManager
        .getRecordings()
        .find(r => r.filePath === recording.filePath);

      await metadataManager.updateMetadata({
        ...recording,
        ...latestRecording, // Get latest values including transcriptPath
        transcribed: true,
        transcriptPath:
          actualTranscriptPath ||
          latestRecording?.transcriptPath ||
          expectedTranscriptPath,
        notePath: activeFile.path,
      });

      new Notice("Note enhanced successfully!");
      onEnhanced();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to enhance note";
      logger.error("Error enhancing note:", error);
      setError(errorMessage);
      new Notice(`Failed to enhance note: ${errorMessage}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className={tw("flex flex-col gap-2")}>
      {error && (
        <div
          className={tw("flex items-center gap-2 text-xs text-[--text-error]")}
        >
          <AlertCircle className="w-3 h-3" />
          <span className={tw("flex-1")}>{error}</span>
        </div>
      )}
      <Button
        onClick={enhanceNote}
        disabled={isEnhancing}
        className={tw("flex items-center gap-2 text-xs")}
      >
        {isEnhancing ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Enhancing...
          </>
        ) : error ? (
          <>
            <RotateCcw className="w-3 h-3" />
            Retry
          </>
        ) : (
          <>
            <FileText className="w-3 h-3" />
            Enhance Note
          </>
        )}
      </Button>
    </div>
  );
};
