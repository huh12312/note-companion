import { TFile } from "obsidian";
import { logger } from "../../../services/logger";
import FileOrganizer from "../../../index";
import { VALID_AUDIO_EXTENSIONS } from "../../../constants";

export interface RecordingMetadata {
  filePath: string;
  createdAt: string;
  duration?: number;
  transcribed: boolean;
  transcriptPath?: string | null;
  notePath?: string | null;
  discovered: boolean;
  originalLocation?: string;
}

export interface MeetingsMetadata {
  recordings: RecordingMetadata[];
  lastScan?: string;
}

const METADATA_FILE = "_NoteCompanion/.meetings.json";

export class MeetingMetadataManager {
  private plugin: FileOrganizer;
  private metadata: MeetingsMetadata = { recordings: [] };

  constructor(plugin: FileOrganizer) {
    this.plugin = plugin;
  }

  async loadMetadata(): Promise<MeetingsMetadata> {
    try {
      const exists = await this.plugin.app.vault.adapter.exists(METADATA_FILE);
      if (exists) {
        const content = await this.plugin.app.vault.adapter.read(METADATA_FILE);
        this.metadata = JSON.parse(content);
        return this.metadata;
      }
    } catch (error) {
      logger.warn("Failed to load meeting metadata, starting fresh", error);
    }
    this.metadata = { recordings: [] };
    return this.metadata;
  }

  async saveMetadata(): Promise<void> {
    try {
      const content = JSON.stringify(this.metadata, null, 2);

      // Ensure parent directory exists
      const dirPath = METADATA_FILE.split("/").slice(0, -1).join("/");
      if (dirPath) {
        await this.plugin.app.vault.adapter.mkdir(dirPath);
      }

      // Write or create the file
      const exists = await this.plugin.app.vault.adapter.exists(METADATA_FILE);
      if (exists) {
        await this.plugin.app.vault.adapter.write(METADATA_FILE, content);
      } else {
        await this.plugin.app.vault.create(METADATA_FILE, content);
      }
    } catch (error) {
      logger.error("Failed to save meeting metadata", error);
    }
  }

  async updateMetadata(recording: RecordingMetadata): Promise<void> {
    const index = this.metadata.recordings.findIndex(
      (r) => r.filePath === recording.filePath
    );
    if (index >= 0) {
      this.metadata.recordings[index] = recording;
    } else {
      this.metadata.recordings.push(recording);
    }
    await this.saveMetadata();
  }

  async discoverRecordings(): Promise<RecordingMetadata[]> {
    const discovered: RecordingMetadata[] = [];
    const existingPaths = new Set(this.metadata.recordings.map((r) => r.filePath));

    try {
      // Get all files in vault
      const allFiles = this.plugin.app.vault.getAllLoadedFiles();
      const audioFiles = allFiles.filter(
        (file): file is TFile =>
          file instanceof TFile &&
          VALID_AUDIO_EXTENSIONS.includes(file.extension.toLowerCase())
      );

      for (const file of audioFiles) {
        // Skip if already in metadata
        if (existingPaths.has(file.path)) {
          continue;
        }

        const stat = file.stat;
        const discoveredRecording: RecordingMetadata = {
          filePath: file.path,
          createdAt: new Date(stat.ctime).toISOString(),
          transcribed: false,
          discovered: true,
        };

        discovered.push(discoveredRecording);
        this.metadata.recordings.push(discoveredRecording);
      }

      this.metadata.lastScan = new Date().toISOString();
      await this.saveMetadata();

      return discovered;
    } catch (error) {
      logger.error("Failed to discover recordings", error);
      return [];
    }
  }

  getAllAudioFiles(): TFile[] {
    const allFiles = this.plugin.app.vault.getAllLoadedFiles();
    return allFiles.filter(
      (file): file is TFile =>
        file instanceof TFile &&
        VALID_AUDIO_EXTENSIONS.includes(file.extension.toLowerCase())
    );
  }

  getRecordings(): RecordingMetadata[] {
    return this.metadata.recordings;
  }

  async removeRecording(filePath: string): Promise<void> {
    this.metadata.recordings = this.metadata.recordings.filter(
      (r) => r.filePath !== filePath
    );
    await this.saveMetadata();
  }
}

