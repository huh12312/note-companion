import React, { useRef, useState, useEffect } from "react";
import { Button } from "../ai-chat/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { logger } from "../../../services/logger";
import FileOrganizer from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { MeetingMetadataManager } from "./meeting-metadata";
import { getAvailablePath } from "../../../fileUtils";

interface MeetingRecorderProps {
  plugin: FileOrganizer;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ plugin }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const metadataManager = React.useRef(
    new MeetingMetadataManager(plugin)
  ).current;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use audio/mp4 (M4A) for better compression
      // 32 kbps mono, 16kHz sample rate
      const options: MediaRecorderOptions = {
        mimeType: "audio/mp4",
        audioBitsPerSecond: 32000,
      };

      // Fallback to webm if mp4 not supported
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        logger.warn("MP4 not supported, falling back to webm", e);
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 32000,
        });
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      startTimeRef.current = new Date();

      // Update duration every second
      intervalRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed =
            (new Date().getTime() - startTimeRef.current.getTime()) / 1000;
          setDuration(elapsed);
        }
      }, 1000);
    } catch (error) {
      logger.error("Error accessing microphone:", error);
      new Notice("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    try {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      await new Promise<void>(resolve => {
        if (!mediaRecorderRef.current) {
          resolve();
          return;
        }

        mediaRecorderRef.current.onstop = async () => {
          try {
            if (audioChunks.current.length === 0) {
              throw new Error("No audio data recorded");
            }

            setIsSaving(true);

            const blob = new Blob(audioChunks.current, {
              type: mediaRecorderRef.current?.mimeType || "audio/webm",
            });

            // Convert blob to ArrayBuffer
            const arrayBuffer = await blob.arrayBuffer();

            // Generate filename: YYYY-MM-DD Meeting.m4a (or .webm)
            const now = new Date();
            const dateStr = now.toISOString().split("T")[0];
            const extension = blob.type.includes("mp4") ? "m4a" : "webm";
            const baseFileName = `${dateStr} Meeting.${extension}`;
            const desiredPath = `${plugin.settings.recordingsFolderPath}/${baseFileName}`;

            // Ensure folder exists
            await plugin.app.vault.adapter.mkdir(
              plugin.settings.recordingsFolderPath
            );

            // Get available path (handles duplicates by appending number)
            const filePath = await getAvailablePath(plugin.app, desiredPath);

            // Save to vault
            await plugin.app.vault.createBinary(filePath, arrayBuffer);

            // Load existing metadata first to preserve discovered recordings
            await metadataManager.loadMetadata();

            // Add to metadata (convert seconds to minutes)
            const recordingDurationInMinutes = duration / 60;
            await metadataManager.updateMetadata({
              filePath,
              createdAt: now.toISOString(),
              duration: recordingDurationInMinutes,
              transcribed: false,
              discovered: false,
            });

            const savedFileName = filePath.split("/").pop() || baseFileName;
            new Notice(`Recording saved: ${savedFileName}`);
            setDuration(0);
            audioChunks.current = [];

            // Trigger refresh of recent meetings list
            window.dispatchEvent(new CustomEvent("meeting-recorded"));

            resolve();
          } catch (error) {
            logger.error("Error saving recording:", error);
            new Notice(
              `Failed to save recording: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            resolve();
          } finally {
            setIsSaving(false);
          }
        };
      });
    } catch (error) {
      logger.error("Error stopping recording:", error);
      setIsRecording(false);
      setIsSaving(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className={tw("border-b border-[--background-modifier-border] p-4")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <div className={tw("flex items-center gap-3")}>
          <div
            className={tw(
              "h-3 w-3 rounded-full transition-all",
              isRecording ? "bg-red-500 animate-pulse" : "bg-[--text-muted]"
            )}
          />
          <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
            Meeting Recorder
          </h3>
        </div>
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isSaving}
          className={tw(
            "flex items-center gap-2",
            isRecording && "bg-red-500 hover:bg-red-600"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : isRecording ? (
            <>
              <Square className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Start Recording
            </>
          )}
        </Button>
      </div>
      {isRecording && (
        <div
          className={tw("flex items-center gap-2 text-sm text-[--text-muted]")}
        >
          <span>Recording: {formatDuration(duration)}</span>
        </div>
      )}
    </div>
  );
};
