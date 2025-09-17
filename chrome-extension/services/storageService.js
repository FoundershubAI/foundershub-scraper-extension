// Storage service for Chrome extension
class StorageService {
  constructor() {
    this.storage = chrome.storage.local;
  }

  // Generic get method
  async get(keys) {
    try {
      return await this.storage.get(keys);
    } catch (error) {
      throw new Error(`Storage get failed: ${error.message}`);
    }
  }

  // Generic set method
  async set(items) {
    try {
      return await this.storage.set(items);
    } catch (error) {
      throw new Error(`Storage set failed: ${error.message}`);
    }
  }

  // Generic remove method
  async remove(keys) {
    try {
      return await this.storage.remove(keys);
    } catch (error) {
      throw new Error(`Storage remove failed: ${error.message}`);
    }
  }

  // Clear all storage
  async clear() {
    try {
      return await this.storage.clear();
    } catch (error) {
      throw new Error(`Storage clear failed: ${error.message}`);
    }
  }

  // Authentication methods
  async getAuthTokens() {
    const result = await this.get(["access_token", "refresh_token"]);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
  }

  async setAuthTokens(accessToken, refreshToken) {
    return this.set({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  async clearAuthTokens() {
    return this.remove(["access_token", "refresh_token"]);
  }

  async isAuthenticated() {
    const { accessToken } = await this.getAuthTokens();
    return !!accessToken;
  }

  // User data methods
  async getUserData() {
    const result = await this.get(["user_data"]);
    return result.user_data || null;
  }

  async setUserData(userData) {
    return this.set({ user_data: userData });
  }

  // Workspace methods
  async getCurrentWorkspace() {
    const result = await this.get(["current_workspace"]);
    return result.current_workspace || null;
  }

  async setCurrentWorkspace(workspace) {
    return this.set({ current_workspace: workspace });
  }

  async setWorkspaceUid(workspaceUid) {
    return this.set({ workspace_uid: workspaceUid });
  }

  // Scraped data methods
  async getScrapedData() {
    const result = await this.get(["scraped_data"]);
    return result.scraped_data || [];
  }

  async setScrapedData(data) {
    return this.set({ scraped_data: data });
  }

  async addScrapedDataItem(item) {
    const currentData = await this.getScrapedData();
    const newData = [...currentData, { ...item, id: Date.now() }];
    return this.setScrapedData(newData);
  }

  // Settings methods
  async getSettings() {
    const result = await this.get(["settings"]);
    return result.settings || {};
  }

  async setSettings(settings) {
    return this.set({ settings });
  }

  async updateSettings(newSettings) {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    return this.setSettings(updatedSettings);
  }

  // Templates methods
  async getTemplates() {
    const result = await this.get(["templates"]);
    return result.templates || [];
  }

  async setTemplates(templates) {
    return this.set({ templates });
  }

  async addTemplate(template) {
    const currentTemplates = await this.getTemplates();
    const newTemplate = { ...template, id: Date.now() };
    const newTemplates = [...currentTemplates, newTemplate];
    return this.setTemplates(newTemplates);
  }

  async updateTemplate(templateId, updatedTemplate) {
    const currentTemplates = await this.getTemplates();
    const newTemplates = currentTemplates.map((template) =>
      template.id === templateId ? { ...template, ...updatedTemplate } : template,
    );
    return this.setTemplates(newTemplates);
  }

  async deleteTemplate(templateId) {
    const currentTemplates = await this.getTemplates();
    const newTemplates = currentTemplates.filter((template) => template.id !== templateId);
    return this.setTemplates(newTemplates);
  }

  // Statistics methods
  async getStats() {
    const result = await this.get(["stats"]);
    return (
      result.stats || {
        totalScraped: 0,
        todayScraped: 0,
        sessionsCount: 0,
      }
    );
  }

  async updateStats(newStats) {
    const currentStats = await this.getStats();
    const updatedStats = { ...currentStats, ...newStats };
    return this.set({ stats: updatedStats });
  }

  async incrementScrapedCount() {
    const currentStats = await this.getStats();
    const today = new Date().toDateString();
    const todayCount = currentStats.todayScraped || 0;

    return this.updateStats({
      totalScraped: (currentStats.totalScraped || 0) + 1,
      todayScraped: todayCount + 1,
      lastScrapedDate: today,
    });
  }
}

// Create singleton instance
const storageService = new StorageService();

// Make storageService globally available
(function () {
  const globalScope = typeof window !== "undefined" ? window : self;
  globalScope.storageService = storageService;
})();
