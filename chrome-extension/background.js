// Background script for Chrome extension
// Handles extension lifecycle, message passing, and background tasks

// Load API service, storage service and schema mapper dynamically
self.importScripts("services/apiService.js");
self.importScripts("services/storageService.js");
self.importScripts("utils/schemaMapper.js");

let backgroundManager = null;

// Initialize when the service worker starts
chrome.runtime.onInstalled.addListener((details) => {
  initializeBackground();
  handleInstallation(details);
});

chrome.runtime.onStartup.addListener(() => {
  initializeBackground();
});

// Keep service worker alive
chrome.runtime.onMessage.addListener((_request, _sender, _sendResponse) => {
  // This listener keeps the service worker active
  return true;
});

// Initialize background manager
function initializeBackground() {
  if (!backgroundManager) {
    backgroundManager = new BackgroundManager();
  }
}

// Handle installation
async function handleInstallation(_details) {
  try {
    // Set default settings
    await setDefaultSettings();
  } catch (error) {
    // Silent error handling
  }
}

// Set default settings
async function setDefaultSettings() {
  const defaultSettings = {
    scrapingDelay: 1000,
    defaultExportFormat: "json",
  };

  try {
    await chrome.storage.local.set(defaultSettings);
  } catch (error) {
    // Silent error handling
  }
}

// Background manager class
class BackgroundManager {
  constructor() {
    this.setupEventListeners();
    this.initializeExtension();
  }

  setupEventListeners() {
    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // Storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });
  }

  async initializeExtension() {
    try {
      const isAuthenticated = await this.isAuthenticated();

      this.updateBadge(isAuthenticated ? "active" : "inactive");
    } catch (error) {
      this.updateBadge("error");
    }
  }

  async isAuthenticated() {
    try {
      const result = await chrome.storage.local.get(["access_token"]);
      return !!result.access_token;
    } catch (error) {
      return false;
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === "complete" && tab.url) {
      try {
        const isAuthenticated = await this.isAuthenticated();
        this.updateBadge(isAuthenticated ? "active" : "inactive");
      } catch (error) {
        this.updateBadge("error");
      }
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "saveScrapedData": {
          const scrapedResult = await this.handleSaveScrapedData(
            request,
            sender
          );
          sendResponse(scrapedResult);
          break;
        }
        case "checkAuth": {
          const authStatus = await this.isAuthenticated();
          sendResponse({ success: true, authenticated: authStatus });
          break;
        }
        case "ping":
          sendResponse({ success: true, message: "Service worker alive" });
          break;
        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStorageChange(changes, _namespace) {
    if (changes.access_token || changes.refresh_token) {
      const isAuthenticated = await this.isAuthenticated();
      this.updateBadge(isAuthenticated ? "active" : "inactive");
    }
  }

  updateBadge(status, siteType = "") {
    const badgeConfig = {
      active: { text: "✓", color: "#48bb78" },
      ready: { text: "●", color: "#4299e1" },
      inactive: { text: "○", color: "#a0aec0" },
      error: { text: "!", color: "#f56565" },
    };

    const config = badgeConfig[status] || badgeConfig.inactive;

    try {
      chrome.action.setBadgeText({ text: config.text });
      chrome.action.setBadgeBackgroundColor({ color: config.color });

      const titles = {
        active: "FoundersHub Data Scraper - Connected",
        ready: `FoundersHub Data Scraper - Ready for ${siteType}`,
        inactive: "FoundersHub Data Scraper - Not connected",
        error: "FoundersHub Data Scraper - Error",
      };

      chrome.action.setTitle({ title: titles[status] || titles.inactive });
    } catch (error) {
      // Silent error handling
    }
  }

  async handleSaveScrapedData(request, _sender) {
    try {
      console.log("🔍 Starting to save scraped data...");
      console.log("Request data:", request.data);

      const { access_token, user_data } = await chrome.storage.local.get([
        "access_token",
        "user_data",
      ]);

      if (!access_token) {
        console.log("❌ Not authenticated");
        return { success: false, error: "Not authenticated" };
      }

      console.log("✅ User authenticated:", user_data?.email);

      // Prioritize site-specific data, then normalize comprehensive data
      let prioritizedData = {};

      // 1. Start with site-specific data (highest priority)
      if (request.data.scrapedData.site_specific_data) {
        prioritizedData = { ...request.data.scrapedData.site_specific_data };
      }

      // 2. Add profile data (medium priority)
      if (request.data.scrapedData.profile_data) {
        Object.keys(request.data.scrapedData.profile_data).forEach((key) => {
          if (!prioritizedData[key]) {
            prioritizedData[key] = request.data.scrapedData.profile_data[key];
          }
        });
      }

      // 3. Add account data (medium priority)
      if (request.data.scrapedData.account_data) {
        Object.keys(request.data.scrapedData.account_data).forEach((key) => {
          if (!prioritizedData[key]) {
            prioritizedData[key] = request.data.scrapedData.account_data[key];
          }
        });
      }

      // 4. Add direct fields from main object (high priority)
      const directFields = [
        "full_name",
        "name",
        "email",
        "phone",
        "bio",
        "company",
        "address",
        "education",
      ];
      directFields.forEach((field) => {
        if (request.data.scrapedData[field] && !prioritizedData[field]) {
          prioritizedData[field] = request.data.scrapedData[field];
        }
      });

      // Normalize the prioritized data to standard schema
      const normalizedData = self.mapToSchemaDeep
        ? self.mapToSchemaDeep(prioritizedData)
        : prioritizedData;

      // Use ONLY the normalized schema fields - no extra data
      // Combine all data without scraping context
      const enhancedData = {
        ...normalizedData,
      };

      // Save data to local storage instead of backend
      if (!self.storageService) {
        console.log("❌ Storage service not available");
        throw new Error("Storage service not available");
      }

      console.log("💾 Saving data to local storage...");
      console.log("Enhanced data:", enhancedData);

      // Save ONLY the new scraped data (replace all previous data)
      console.log(
        "💾 Saving new scraped data (replacing all previous data)..."
      );

      // Get active workspace UID from localStorage
      const workspaceUid = this.getActiveWorkspaceUid();
      console.log("🏢 Using workspace UID:", workspaceUid);

      const newDataItem = {
        url: request.data.url,
        siteType: request.data.siteType,
        scrapedData: enhancedData,
        timestamp: request.data.timestamp,
        user_id: user_data?.uid || "unknown",
        workspace_uid: workspaceUid,
      };

      // Replace all scraped data with just this one item
      await self.storageService.setScrapedData([newDataItem]);

      // Update statistics
      await self.storageService.incrementScrapedCount();

      console.log("✅ Data saved successfully to local storage");
      return { success: true, message: "Data saved locally" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Workspace Management Functions
  async getActiveWorkspaceUid() {
    try {
      // In service worker context, we need to use chrome.storage.local instead of localStorage
      const result = await chrome.storage.local.get(["active_workspace_uid"]);
      const workspaceUid = result.active_workspace_uid;
      console.log(
        "🔍 Retrieved active workspace UID from storage:",
        workspaceUid
      );
      return workspaceUid;
    } catch (error) {
      console.error("❌ Error retrieving workspace UID:", error);
      return null;
    }
  }
}
