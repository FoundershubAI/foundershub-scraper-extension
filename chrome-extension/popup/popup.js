class PopupManager {
  constructor() {
    this.loginSection = document.getElementById("login-section");
    this.scraperSection = document.getElementById("scraper-section");
    this.statusDiv = document.getElementById("status");
    this.loginBtn = document.getElementById("login-btn");
    this.logoutBtn = document.getElementById("logout-btn");

    // Template mapping elements
    this.templateMappingSection = document.getElementById(
      "template-mapping-section"
    );
    this.scrapedDataPreview = document.getElementById("scraped-data-preview");
    this.templatesContainer = document.getElementById("templates-container");
    this.fieldMappingSection = document.getElementById("field-mapping-section");
    this.templateFieldsList = document.getElementById("template-fields-list");
    this.scrapedFieldsList = document.getElementById("scraped-fields-list");
    this.saveRowBtn = document.getElementById("save-row-btn");
    this.refreshDataBtn = document.getElementById("refresh-data-btn");

    // Template mapping state
    this.templates = [];
    this.selectedTemplate = null;
    this.scrapedData = null;
    this.workspaceUid = null;

    this.setupEventListeners();
    this.checkAuthStatus();
  }

  setupEventListeners() {
    this.loginBtn.addEventListener("click", () => this.handleLogin());
    this.logoutBtn.addEventListener("click", () => this.handleLogout());
    this.saveRowBtn.addEventListener("click", () => this.handleSaveRow());
    this.refreshDataBtn.addEventListener("click", () =>
      this.handleRefreshData()
    );

    // Password toggle
    const passwordToggle = document.getElementById("password-toggle");
    const passwordInput = document.getElementById("password");

    passwordToggle.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      passwordToggle.textContent = isPassword ? "🙈" : "👁️";
    });

    // Enter key support
    document.addEventListener("keypress", (e) => {
      if (
        e.key === "Enter" &&
        !this.loginSection.classList.contains("hidden")
      ) {
        this.handleLogin();
      }
    });
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get([
        "access_token",
        "user_data",
      ]);

      if (result.access_token) {
        this.showScraperSection();

        // Get active workspace UID from localStorage
        const workspaceUid = this.getActiveWorkspaceUid();

        this.updateUserInfo(result.user_data, workspaceUid);
        await this.initializeTemplateMapping();
      } else {
        this.showLoginSection();
      }
    } catch (error) {
      this.showError("Failed to check authentication status");
      this.showLoginSection();
    }
  }

  async handleLogin() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      this.showError("Please enter both email and password");
      return;
    }

    this.setLoading(true);

    try {
      // Check if services are available
      if (!window.authService) {
        this.showError("API service not loaded. Please refresh the extension.");
        return;
      }

      // Workspace service removed - not needed for local storage only

      if (!window.storageService) {
        this.showError(
          "Storage service not loaded. Please refresh the extension."
        );
        return;
      }

      // Use the API service for login
      const response = await window.authService.login(email, password);

      if (response.status === 200 || response.status === 201) {
        const { access, ...userData } = response.data;

        // Store JWT token and user data
        await window.storageService.setAuthTokens(access, null);
        await window.storageService.setUserData(userData);

        // Initialize active workspace from login response
        const workspaceUid = await this.initializeActiveWorkspace(userData);
        console.log("🏢 Active workspace UID:", workspaceUid);

        this.showSuccess("Login successful!");
        setTimeout(() => {
          this.showScraperSection();
          this.updateUserInfo(userData, workspaceUid);
        }, 1000);
      } else {
        this.showError(response.message || "Login failed");
      }
    } catch (error) {
      this.showError("Login failed: " + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  async handleLogout() {
    try {
      await chrome.storage.local.clear();
      this.showSuccess("Logged out successfully");
      setTimeout(() => {
        this.showLoginSection();
        this.clearForm();
      }, 1000);
    } catch (error) {
      this.showError("Logout failed: " + error.message);
    }
  }

  showLoginSection() {
    this.loginSection.classList.remove("hidden");
    this.scraperSection.classList.add("hidden");
  }

  showScraperSection() {
    this.loginSection.classList.add("hidden");
    this.scraperSection.classList.remove("hidden");
    // Refresh scraped data when showing scraper section
    this.loadScrapedData();
  }

  updateUserInfo(userData, workspaceUid = null) {
    const userStatus = document.getElementById("user-status");
    const workspaceInfo = document.getElementById("workspace-info");

    if (userData) {
      userStatus.textContent = userData.email || "Connected";

      if (workspaceUid) {
        workspaceInfo.textContent = `Workspace: ${workspaceUid.substring(
          0,
          8
        )}...`;
      } else {
        workspaceInfo.textContent = "No workspace";
      }
    }
  }

  clearForm() {
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
  }

  setLoading(isLoading) {
    this.loginBtn.disabled = isLoading;
    this.loginBtn.textContent = isLoading ? "Logging in..." : "Login";
  }

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.classList.remove("hidden");

    setTimeout(() => {
      this.statusDiv.classList.add("hidden");
    }, 3000);
  }

  showSuccess(message) {
    this.showStatus(message, "success");
  }

  showError(message) {
    this.showStatus(message, "error");
  }

  // Refresh Data Method - Clear all data
  async handleRefreshData() {
    console.log("🔄 Refresh data button clicked - clearing all data");
    this.refreshDataBtn.disabled = true;
    this.refreshDataBtn.textContent = "Clearing...";

    try {
      // Clear all scraped data
      await window.storageService.setScrapedData([]);

      // Update the preview to show no data
      this.scrapedData = null;
      this.updateScrapedDataPreview();

      this.showSuccess("All data cleared successfully!");
    } catch (error) {
      console.error("❌ Error clearing data:", error);
      this.showError("Failed to clear data");
    } finally {
      this.refreshDataBtn.disabled = false;
      this.refreshDataBtn.textContent = "Clear Data";
    }
  }

  // Template Mapping Methods
  async initializeTemplateMapping() {
    try {
      await this.loadScrapedData();
      await this.loadTemplates();
    } catch (error) {
      // Silent error handling
    }
  }

  async loadScrapedData() {
    try {
      console.log("🔄 Loading scraped data from local storage...");

      // Load scraped data from local storage (should be only one item)
      const scrapedDataArray = await window.storageService.getScrapedData();

      console.log("📊 Found scraped data:", scrapedDataArray);

      if (scrapedDataArray && scrapedDataArray.length > 0) {
        // Store the data for preview (should be only one item)
        this.scrapedData = scrapedDataArray;
        this.updateScrapedDataPreview();
        console.log("✅ Loaded scraped data");
      } else {
        this.scrapedData = null;
        this.updateScrapedDataPreview();
        console.log("ℹ️ No scraped data found");
      }
    } catch (error) {
      console.error("❌ Error loading scraped data:", error);
      this.scrapedData = null;
      this.updateScrapedDataPreview();
    }
  }

  updateScrapedDataPreview() {
    if (this.scrapedData && this.scrapedData.length > 0) {
      console.log("📋 Updating preview with scraped data");

      // Show only the actual scraped data (should be only one item now)
      const scrapedDataItem = this.scrapedData[0];
      const actualScrapedData = scrapedDataItem.scrapedData;

      this.scrapedDataPreview.textContent = JSON.stringify(
        actualScrapedData,
        null,
        2
      );
    } else {
      this.scrapedDataPreview.innerHTML =
        "<p>No scraped data available. Please scrape data from a webpage first.</p>";
    }
  }

  async loadTemplates() {
    try {
      console.log("🔄 Loading templates...");

      // Wait for config to be loaded
      console.log("⏳ Waiting for config to load...");
      await this.waitForConfig();

      const workspaceUid = this.getActiveWorkspaceUid();
      console.log("🔍 Retrieved workspace UID:", workspaceUid);

      if (!workspaceUid) {
        console.log("❌ No workspace UID found");
        this.templatesContainer.innerHTML =
          '<p class="loading">No workspace selected</p>';
        return;
      }

      this.templatesContainer.innerHTML =
        '<p class="loading">Loading templates...</p>';

      console.log("📡 Fetching templates for workspace:", workspaceUid);
      const response = await this.fetchTemplates(workspaceUid);
      console.log("📡 Templates response:", response);

      if (response && response.data && response.data.results) {
        this.templates = response.data.results;
        console.log("✅ Templates loaded:", this.templates.length);
        this.renderTemplates();
      } else {
        console.log("❌ No templates in response");
        this.templatesContainer.innerHTML =
          '<p class="loading">No templates found</p>';
      }
    } catch (error) {
      console.error("❌ Error loading templates:", error);
      this.templatesContainer.innerHTML =
        '<p class="loading">Error loading templates</p>';
    }
  }

  async waitForConfig() {
    return new Promise((resolve) => {
      const checkConfig = () => {
        if (
          window.apiService &&
          window.apiService.baseURL &&
          window.apiService.baseURL !== null
        ) {
          console.log("✅ Config loaded, API URL:", window.apiService.baseURL);
          resolve();
        } else {
          console.log(
            "⏳ Config not ready yet, API URL:",
            window.apiService?.baseURL
          );
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    });
  }

  // Template API Methods - Re-enabled with workspace support
  async fetchTemplates(workspaceUid) {
    const options = await this.getAuthHeaders();
    return await window.apiService.get(
      `/api/metric-tracker/templates/?workspace_uid=${workspaceUid}`,
      options
    );
  }

  renderTemplates() {
    if (this.templates.length === 0) {
      this.templatesContainer.innerHTML =
        '<p class="loading">No templates available</p>';
      return;
    }

    this.templatesContainer.innerHTML = this.templates
      .map((template) => {
        return `<button class="template-btn" data-template-id="${
          template.id || template.uid
        }">
            ${template.name || `Template ${template.id || template.uid}`}
          </button>`;
      })
      .join("");

    this.templatesContainer.querySelectorAll(".template-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.selectTemplate(e.target.dataset.templateId)
      );
    });
  }

  async selectTemplate(templateId) {
    try {
      this.templatesContainer
        .querySelectorAll(".template-btn")
        .forEach((btn) => {
          btn.classList.remove("selected");
        });
      document
        .querySelector(`[data-template-id="${templateId}"]`)
        .classList.add("selected");

      const workspaceUid = this.getActiveWorkspaceUid();
      const template = await this.fetchTemplateDetails(
        templateId,
        workspaceUid
      );
      this.selectedTemplate = template;

      this.fieldMappingSection.classList.remove("hidden");
      this.renderFieldMapping();
    } catch (error) {
      this.showError("Failed to load template details");
    }
  }

  async fetchTemplateDetails(templateId, workspaceUid) {
    const options = await this.getAuthHeaders();
    const response = await window.apiService.get(
      `/api/metric-tracker/templates/${templateId}/data/?page=1&workspace_uid=${workspaceUid}`,
      options
    );
    return response.data;
  }

  renderFieldMapping() {
    if (
      !this.selectedTemplate ||
      !this.scrapedData ||
      this.scrapedData.length === 0
    ) {
      this.templateFieldsList.innerHTML =
        '<p class="loading">No template or scraped data available</p>';
      this.scrapedFieldsList.innerHTML =
        '<p class="loading">No scraped data available</p>';
      return;
    }

    // Get template fields from columns
    const templateFields = this.selectedTemplate.template?.columns || [];
    const scrapedFields = Object.keys(this.scrapedData[0].scrapedData);

    // Render template fields with dropdowns
    this.templateFieldsList.innerHTML = templateFields
      .map((field) => {
        const fieldName = field.name;
        const fieldType = field.data_type || "text";

        // For user and select fields, only show template options
        if (fieldType === "user" && field.options) {
          return `
            <div class="field-mapping-item">
              <label>${fieldName} (${fieldType})</label>
              <select data-template-field="${fieldName}">
                <option value="">-- Select user --</option>
                ${field.options
                  .map(
                    (option) =>
                      `<option value="template_option:${
                        option.user_id || option.value
                      }">${
                        option.value || option.display_name || option.email
                      }</option>`
                  )
                  .join("")}
              </select>
            </div>
          `;
        } else if (fieldType === "select" && field.options) {
          return `
            <div class="field-mapping-item">
              <label>${fieldName} (${fieldType})</label>
              <select data-template-field="${fieldName}">
                <option value="">-- Select option --</option>
                ${field.options
                  .map(
                    (option) =>
                      `<option value="template_option:${option.value}">${option.value}</option>`
                  )
                  .join("")}
              </select>
            </div>
          `;
        }

        // For other field types, show scraped fields
        return `
          <div class="field-mapping-item">
            <label>${fieldName} (${fieldType})</label>
            <select data-template-field="${fieldName}">
              <option value="">-- Select scraped field --</option>
              ${scrapedFields
                .map(
                  (scrapedField) =>
                    `<option value="${scrapedField}">${scrapedField}</option>`
                )
                .join("")}
            </select>
          </div>
        `;
      })
      .join("");

    // Render scraped fields info
    this.scrapedFieldsList.innerHTML = scrapedFields
      .map((field) => {
        const value = this.scrapedData[0].scrapedData[field];
        const displayValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);

        return `
            <div class="scraped-field-item">
              <span class="field-name">${field}</span>
              <div class="field-value">${displayValue}</div>
            </div>
          `;
      })
      .join("");
  }

  async handleSaveRow() {
    if (
      !this.selectedTemplate ||
      !this.scrapedData ||
      this.scrapedData.length === 0
    ) {
      this.showError("No template selected or scraped data available");
      return;
    }

    try {
      this.saveRowBtn.disabled = true;
      this.saveRowBtn.textContent = "Saving...";

      const mappedValues = {};
      const templateFields = this.selectedTemplate.template?.columns || [];

      templateFields.forEach((field) => {
        const fieldName = field.name;
        const select = document.querySelector(
          `[data-template-field="${fieldName}"]`
        );
        const selectedValue = select.value;

        if (selectedValue) {
          if (selectedValue.startsWith("template_option:")) {
            // Handle template option selection
            const optionValue = selectedValue.replace("template_option:", "");
            mappedValues[fieldName] = optionValue;
          } else if (
            this.scrapedData[0].scrapedData[selectedValue] !== undefined
          ) {
            // Handle scraped field selection
            mappedValues[fieldName] =
              this.scrapedData[0].scrapedData[selectedValue];
          }
        }
      });

      if (Object.keys(mappedValues).length === 0) {
        this.showError("Please map at least one field");
        return;
      }

      const workspaceUid = this.getActiveWorkspaceUid();
      const response = await this.saveRowToTemplate(mappedValues, workspaceUid);

      if (response && (response.status === 200 || response.status === 201)) {
        this.showSuccess("Row saved successfully!");
        this.fieldMappingSection.classList.add("hidden");
        this.templatesContainer
          .querySelectorAll(".template-btn")
          .forEach((btn) => {
            btn.classList.remove("selected");
          });
        this.selectedTemplate = null;
      } else {
        this.showError(
          "Failed to save row: " + (response.message || "Unknown error")
        );
      }
    } catch (error) {
      this.showError("Failed to save row: " + error.message);
    } finally {
      this.saveRowBtn.disabled = false;
      this.saveRowBtn.textContent = "Save Row";
    }
  }

  async saveRowToTemplate(mappedValues, workspaceUid) {
    const options = await this.getAuthHeaders();
    const payload = { values: mappedValues };

    return await window.apiService.post(
      `/api/metric-tracker/templates/${this.selectedTemplate.template.uid}/data/?workspace_uid=${workspaceUid}`,
      payload,
      options
    );
  }

  // Workspace Management Functions
  async initializeActiveWorkspace(userData) {
    try {
      console.log("🏢 Initializing active workspace from user data:", userData);

      if (!userData.accounts || userData.accounts.length === 0) {
        console.log("❌ No accounts found in user data");
        return null;
      }

      // Priority 1: Find owner account with default workspace
      for (const account of userData.accounts) {
        if (account.is_owner && account.workspaces) {
          const defaultWorkspace = account.workspaces.find(
            (ws) => ws.is_default === true
          );
          if (defaultWorkspace) {
            console.log(
              "✅ Found owner account with default workspace:",
              defaultWorkspace.uid
            );
            await this.setActiveWorkspaceUid(defaultWorkspace.uid);
            return defaultWorkspace.uid;
          }
        }
      }

      // Priority 2: Find any default workspace
      for (const account of userData.accounts) {
        if (account.workspaces) {
          const defaultWorkspace = account.workspaces.find(
            (ws) => ws.is_default === true
          );
          if (defaultWorkspace) {
            console.log("✅ Found default workspace:", defaultWorkspace.uid);
            await this.setActiveWorkspaceUid(defaultWorkspace.uid);
            return defaultWorkspace.uid;
          }
        }
      }

      // Priority 3: Use first available workspace
      for (const account of userData.accounts) {
        if (account.workspaces && account.workspaces.length > 0) {
          const firstWorkspace = account.workspaces[0];
          console.log(
            "✅ Using first available workspace:",
            firstWorkspace.uid
          );
          await this.setActiveWorkspaceUid(firstWorkspace.uid);
          return firstWorkspace.uid;
        }
      }

      console.log("❌ No workspaces found in any account");
      return null;
    } catch (error) {
      console.error("❌ Error initializing active workspace:", error);
      return null;
    }
  }

  async setActiveWorkspaceUid(workspaceUid) {
    try {
      // Store in both localStorage and chrome.storage.local for cross-context access
      localStorage.setItem("active_workspace_uid", workspaceUid);
      await chrome.storage.local.set({ active_workspace_uid: workspaceUid });
      console.log("💾 Stored active workspace UID:", workspaceUid);
    } catch (error) {
      console.error("❌ Error storing workspace UID:", error);
    }
  }

  getActiveWorkspaceUid() {
    try {
      const workspaceUid = localStorage.getItem("active_workspace_uid");
      console.log(
        "🔍 Retrieved active workspace UID from localStorage:",
        workspaceUid
      );

      // Also check chrome.storage.local for debugging
      chrome.storage.local.get(["active_workspace_uid"]).then((result) => {
        console.log(
          "🔍 Retrieved active workspace UID from chrome.storage.local:",
          result.active_workspace_uid
        );
      });

      return workspaceUid;
    } catch (error) {
      console.error("❌ Error retrieving workspace UID:", error);
      return null;
    }
  }

  async getAuthHeaders() {
    try {
      const result = await chrome.storage.local.get(["access_token"]);
      const token = result.access_token;

      if (token) {
        return {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };
      }
      return { headers: { "Content-Type": "application/json" } };
    } catch (error) {
      return { headers: { "Content-Type": "application/json" } };
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Wait for services to be available
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  const initPopup = () => {
    if (window.authService && window.storageService) {
      new PopupManager();
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(initPopup, 100);
    } else {
      // Initialize anyway and let the error handling in PopupManager deal with it
      new PopupManager();
    }
  };

  initPopup();
});
