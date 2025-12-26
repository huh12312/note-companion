import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import * as React from "react";
import { Root, createRoot } from "react-dom/client";
import { AssistantView } from "./organizer/organizer";
import FileOrganizer from "../..";
import { InboxLogs } from "./inbox-logs";
import { SectionHeader } from "./section-header";
import { AppContext } from "./provider";
import AIChatSidebar from "./ai-chat/container";
import ReactMarkdown from "react-markdown";
import { SyncTab } from "./synchronizer/sync-tab";
import { StyledContainer } from "../../components/ui/utils";
import { tw } from "../../lib/utils";
import { Sparkles, Inbox, MessageSquare, Cloud } from "lucide-react";
import { UpgradeButton } from "../../components/upgrade-button";
import { UsageData } from "../..";

export const ORGANIZER_VIEW_TYPE = "fo2k.assistant.sidebar2";

type Tab = "organizer" | "inbox" | "chat" | "sync";

function TabContent({
  activeTab,
  plugin,
  leaf,
  showSyncTab,
  onTokenLimitError,
}: {
  activeTab: Tab;
  plugin: FileOrganizer;
  leaf: WorkspaceLeaf;
  showSyncTab: boolean;
  onTokenLimitError?: (error: string) => void;
}) {
  const [activeFile, setActiveFile] = React.useState<TFile | null>(null);
  const [noteContent, setNoteContent] = React.useState<string>("");
  const [refreshKey, setRefreshKey] = React.useState<number>(0);

  React.useEffect(() => {
    const updateActiveFile = async () => {
      const file = plugin.app.workspace.getActiveFile();
      if (file) {
        const content = await plugin.app.vault.read(file);
        setNoteContent(content);
        setActiveFile(file);
      }
    };
    updateActiveFile();

    const handler = () => {
      updateActiveFile();
    };

    plugin.app.workspace.on("file-open", handler);
    plugin.app.workspace.on("active-leaf-change", handler);

    return () => {
      plugin.app.workspace.off("file-open", handler);
      plugin.app.workspace.off("active-leaf-change", handler);
    };
  }, [plugin.app.workspace, plugin.app.vault]);

  function renderNoteContent(content: string) {
    return (
      <div className={tw("markdown-preview")}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={tw("flex flex-col h-full w-full")}>
      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "organizer" ? "block" : "hidden"
        )}
      >
        <AssistantView plugin={plugin} leaf={leaf} />
      </div>

      <div
        className={tw(
          "flex-1 min-h-0 w-full flex flex-col",
          activeTab === "inbox" ? "block" : "hidden"
        )}
      >
        <SectionHeader text="Inbox Processing" icon="📥 " />
        <InboxLogs />
      </div>

      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "chat" ? "flex flex-col" : "hidden"
        )}
      >
        <AIChatSidebar plugin={plugin} apiKey={plugin.settings.API_KEY} />
      </div>

      {showSyncTab && (
        <div
          className={tw(
            "flex-1 min-h-0 w-full",
            activeTab === "sync" ? "block" : "hidden"
          )}
        >
          <SyncTab plugin={plugin} onTokenLimitError={onTokenLimitError} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  icon,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "px-4 py-2 text-sm transition-all relative flex items-center gap-2",
        isActive
          ? "text-[--text-normal] font-medium"
          : "text-[--text-muted] hover:text-[--text-normal]"
      )}
      style={
        isActive
          ? {
              borderBottom: "2px solid var(--interactive-accent)",
              marginBottom: "-1px",
            }
          : undefined
      }
    >
      {icon && <span className={tw("w-4 h-4 flex-shrink-0")}>{icon}</span>}
      {children}
    </button>
  );
}

function AssistantContent({
  plugin,
  leaf,
  initialTab,
  onTabChange,
}: {
  plugin: FileOrganizer;
  leaf: WorkspaceLeaf;
  initialTab: Tab;
  onTabChange: (setTab: (tab: Tab) => void) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);
  const [usageData, setUsageData] = React.useState<UsageData | null>(null);
  const [forceShowUpgrade, setForceShowUpgrade] = React.useState(false);

  React.useEffect(() => {
    onTabChange(setActiveTab);
  }, [onTabChange]);

  // Fetch usage data on mount
  React.useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await plugin.fetchUsageStats();
        if (data) {
          setUsageData(data);
        }
      } catch (error) {
        console.error("Failed to fetch usage data:", error);
      }
    };

    if (plugin.settings.API_KEY) {
      fetchUsage();
    }
  }, [plugin]);

  // Helper function to check if upgrade button should be shown
  const shouldShowUpgradeButton = () => {
    // Force show if token limit error occurred
    if (forceShowUpgrade) return true;

    if (!usageData) return false;

    const isFreeTier =
      usageData.currentPlan === "Legacy Plan" ||
      usageData.currentPlan === "Free" ||
      usageData.maxTokenUsage === 100000;

    if (!isFreeTier) return false;

    const usagePercent = usageData.tokenUsage / usageData.maxTokenUsage;
    return usagePercent >= 0.8; // 80% threshold
  };

  // Handle token limit errors from child components
  const handleTokenLimitError = React.useCallback(
    (error: string) => {
      setForceShowUpgrade(true);
      // Refresh usage data
      plugin
        .fetchUsageStats()
        .then(data => {
          if (data) {
            setUsageData(data);
          }
        })
        .catch(console.error);
    },
    [plugin]
  );

  const showSyncTab = plugin.settings.showSyncTab;

  return (
    <div className={tw("flex flex-col h-full w-full")}>
      {/* Native tab navigation */}
      <div
        className={tw(
          "flex gap-0 px-3 pt-2 pb-0 border-b border-[--background-modifier-border] bg-[--background-primary] items-center justify-between"
        )}
      >
        <div className={tw("flex gap-0")}>
          <TabButton
            isActive={activeTab === "organizer"}
            onClick={() => setActiveTab("organizer")}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Organizer
          </TabButton>
          <TabButton
            isActive={activeTab === "inbox"}
            onClick={() => setActiveTab("inbox")}
            icon={<Inbox className="w-4 h-4" />}
          >
            Inbox
          </TabButton>
          <TabButton
            isActive={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
            icon={<MessageSquare className="w-4 h-4" />}
          >
            Chat
          </TabButton>
          {showSyncTab && (
            <TabButton
              isActive={activeTab === "sync"}
              onClick={() => setActiveTab("sync")}
              icon={<Cloud className="w-4 h-4" />}
            >
              Sync
            </TabButton>
          )}
        </div>

        {/* Upgrade button - visible when free tier user is at 80%+ usage or token limit error occurred */}
        {shouldShowUpgradeButton() && (
          <div className={tw("ml-auto")}>
            <UpgradeButton
              plugin={plugin}
              variant="compact"
              showMessage={true}
              usageData={usageData}
              isForced={forceShowUpgrade}
            />
          </div>
        )}
      </div>

      {/* Content area - no padding */}
      <div className={tw("flex-1 min-h-0 w-full overflow-hidden")}>
        <TabContent
          activeTab={activeTab}
          plugin={plugin}
          leaf={leaf}
          showSyncTab={showSyncTab}
          onTokenLimitError={handleTokenLimitError}
        />
      </div>
    </div>
  );
}

export class AssistantViewWrapper extends ItemView {
  root: Root | null = null;
  plugin: FileOrganizer;
  private activeTab: Tab = "organizer";
  private setActiveTab: (tab: Tab) => void = () => {};

  constructor(leaf: WorkspaceLeaf, plugin: FileOrganizer) {
    super(leaf);
    this.plugin = plugin;

    // Register commands
    this.plugin.addCommand({
      id: "open-organizer-tab",
      name: "Open Organizer Tab",
      callback: () => this.activateTab("organizer"),
    });

    this.plugin.addCommand({
      id: "open-inbox-tab",
      name: "Open Inbox Tab",
      callback: () => this.activateTab("inbox"),
    });

    this.plugin.addCommand({
      id: "open-chat-tab",
      name: "Open Chat Tab",
      callback: () => this.activateTab("chat"),
    });

    // Only register sync tab command if enabled in settings
    if (this.plugin.settings.showSyncTab) {
      this.plugin.addCommand({
        id: "open-sync-tab",
        name: "Open Sync Tab",
        callback: () => this.activateTab("sync"),
      });
    }
  }

  activateTab(tab: Tab) {
    // Ensure view is open
    this.plugin.app.workspace.revealLeaf(this.leaf);

    // Update tab
    this.activeTab = tab;
    this.setActiveTab(tab);
  }

  getViewType(): string {
    return ORGANIZER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Note Companion";
  }

  getIcon(): string {
    return "sparkle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.addClass("fo2k-view");
    this.root = createRoot(container);
    this.render();
  }

  render(): void {
    this.root?.render(
      <AppContext.Provider value={{ plugin: this.plugin, root: this.root }}>
        <React.StrictMode>
          <StyledContainer>
            <AssistantContent
              plugin={this.plugin}
              leaf={this.leaf}
              initialTab={this.activeTab}
              onTabChange={setTab => {
                this.setActiveTab = setTab;
              }}
            />
          </StyledContainer>
        </React.StrictMode>
      </AppContext.Provider>
    );
  }

  async onClose(): Promise<void> {
    this.containerEl.children[1].removeClass("fo2k-view");
    this.root?.unmount();
  }
}
