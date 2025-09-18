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
        "workspace_uid",
      ]);

      if (result.access_token) {
        this.showScraperSection();

        // Try to get workspace info if available
        let workspaceInfo = null;
        if (result.workspace_uid) {
          try {
            const workspacesResponse =
              await window.workspaceService.getWorkspaces();
            if (
              workspacesResponse.status === 200 &&
              workspacesResponse.data?.length > 0
            ) {
              // Find the current workspace
              for (const account of workspacesResponse.data) {
                if (account.workspaces) {
                  const currentWorkspace = account.workspaces.find(
                    (ws) =>
                      (ws.uid || ws.workspace_uid) === result.workspace_uid
                  );
                  if (currentWorkspace) {
                    workspaceInfo = currentWorkspace;
                    break;
                  }
                } else if (account.uid === result.workspace_uid) {
                  // If the workspace data is directly in the account object
                  workspaceInfo = account;
                  break;
                }
              }
            }
          } catch (error) {
            // Workspace fetch failed, continue without workspace info
          }
        }

        this.updateUserInfo(result.user_data, workspaceInfo);
        this.workspaceUid = result.workspace_uid;
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

      if (!window.workspaceService) {
        this.showError(
          "Workspace service not loaded. Please refresh the extension."
        );
        return;
      }

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

        // Fetch user workspaces
        const workspacesResponse =
          await window.workspaceService.getWorkspaces();

        if (
          workspacesResponse.status === 200 &&
          workspacesResponse.data?.length > 0
        ) {
          // The workspaces response is directly an array, not nested in results
          const firstAccount = workspacesResponse.data[0];

          if (
            firstAccount &&
            firstAccount.workspaces &&
            firstAccount.workspaces.length > 0
          ) {
            // Get first workspace from first account
            const firstWorkspace = firstAccount.workspaces[0];
            await window.storageService.setWorkspaceUid(
              firstWorkspace.uid || firstWorkspace.workspace_uid
            );

            this.showSuccess("Login successful!");
            setTimeout(() => {
              this.showScraperSection();
              this.updateUserInfo(userData, firstWorkspace);
            }, 1000);
          } else if (firstAccount && firstAccount.uid) {
            // If the workspace data is directly in the account object (based on console log)
            await window.storageService.setWorkspaceUid(firstAccount.uid);

            this.showSuccess("Login successful!");
            setTimeout(() => {
              this.showScraperSection();
              this.updateUserInfo(userData, firstAccount);
            }, 1000);
          } else {
            this.showError("No workspaces found in your account");
          }
        } else {
          this.showError("Failed to fetch workspaces");
        }
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

  updateUserInfo(userData, workspace = null) {
    const userStatus = document.getElementById("user-status");
    const workspaceInfo = document.getElementById("workspace-info");

    if (userData) {
      userStatus.textContent = userData.email || "Connected";
      workspaceInfo.textContent = workspace
        ? workspace.name || "Active"
        : "Active";
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

  // Refresh Data Method
  async handleRefreshData() {
    this.refreshDataBtn.disabled = true;
    this.refreshDataBtn.textContent = "Refreshing...";

    try {
      await this.loadScrapedData();
      this.showSuccess("Data refreshed successfully!");
    } catch (error) {
      console.error("Error refreshing data:", error);
      this.showError("Failed to refresh data");
    } finally {
      this.refreshDataBtn.disabled = false;
      this.refreshDataBtn.textContent = "Refresh Data";
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
      if (!this.workspaceUid) {
        this.scrapedData = null;
        this.updateScrapedDataPreview();
        return;
      }

      const response = await this.fetchLastScrapedData();

      if (response && response.data && response.status === 200) {
        const apiData = response.data;

        if (apiData && (apiData.raw_data || apiData.processed_data)) {
          this.scrapedData = apiData.raw_data || apiData.processed_data;
          this.updateScrapedDataPreview();
        } else {
          this.scrapedData = null;
          this.updateScrapedDataPreview();
        }
      } else {
        this.scrapedData = null;
        this.updateScrapedDataPreview();
      }
    } catch (error) {
      this.scrapedData = null;
      this.updateScrapedDataPreview();
    }
  }

  updateScrapedDataPreview() {
    if (this.scrapedData) {
      this.scrapedDataPreview.textContent = JSON.stringify(
        this.scrapedData,
        null,
        2
      );
    } else {
      this.scrapedDataPreview.innerHTML =
        "<p>No scraped data available. Please scrape data from a webpage first.</p>";
    }
  }

  async loadTemplates() {
    if (!this.workspaceUid) {
      this.templatesContainer.innerHTML =
        '<p class="loading">No workspace selected</p>';
      return;
    }

    try {
      this.templatesContainer.innerHTML =
        '<p class="loading">Loading templates...</p>';

      const response = await this.fetchTemplates();

      if (response && response.data && response.data.results) {
        this.templates = response.data.results;
        this.renderTemplates();
      } else {
        this.templatesContainer.innerHTML =
          '<p class="loading">No templates found</p>';
      }
    } catch (error) {
      this.templatesContainer.innerHTML =
        '<p class="loading">Error loading templates</p>';
    }
  }

  async fetchTemplates() {
    const options = await this.getAuthHeaders();
    return await window.apiService.get(
      `/api/metric-tracker/templates/?workspace_uid=${this.workspaceUid}`,
      options
    );
  }

  async fetchLastScrapedData() {
    const options = await this.getAuthHeaders();
    const url = `/api/v2/extension/data/last_scraped_data/?workspace_uid=${this.workspaceUid}`;
    return await window.apiService.get(url, options);
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

      const template = await this.fetchTemplateDetails(templateId);
      this.selectedTemplate = template;

      this.fieldMappingSection.classList.remove("hidden");
      this.renderFieldMapping();
    } catch (error) {
      this.showError("Failed to load template details");
    }
  }

  async fetchTemplateDetails(templateId) {
    const options = await this.getAuthHeaders();
    const response = await window.apiService.get(
      `/api/metric-tracker/templates/${templateId}/data/?page=1&workspace_uid=${this.workspaceUid}`,
      options
    );
    return response.data;
  }

  renderFieldMapping() {
    if (!this.selectedTemplate || !this.scrapedData) {
      this.templateFieldsList.innerHTML =
        '<p class="loading">No template or scraped data available</p>';
      this.scrapedFieldsList.innerHTML =
        '<p class="loading">No scraped data available</p>';
      return;
    }

    // Get template fields from columns
    const templateFields = this.selectedTemplate.template?.columns || [];
    const scrapedFields = Object.keys(this.scrapedData);

    // Render template fields with dropdowns
    this.templateFieldsList.innerHTML = templateFields
      .map((field) => {
        const fieldName = field.name;
        const fieldType = field.data_type || "text";

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
      .map(
        (field) =>
          `<div class="field-mapping-item">
        <label>${field}</label>
        <div style="font-size: 10px; color: rgba(255,255,255,0.7);">
          ${
            typeof this.scrapedData[field] === "object"
              ? JSON.stringify(this.scrapedData[field])
              : String(this.scrapedData[field])
          }
        </div>
      </div>`
      )
      .join("");
  }

  async handleSaveRow() {
    if (!this.selectedTemplate || !this.scrapedData) {
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
        const selectedScrapedField = select.value;

        if (
          selectedScrapedField &&
          this.scrapedData[selectedScrapedField] !== undefined
        ) {
          mappedValues[fieldName] = this.scrapedData[selectedScrapedField];
        }
      });

      if (Object.keys(mappedValues).length === 0) {
        this.showError("Please map at least one field");
        return;
      }

      const response = await this.saveRowToTemplate(mappedValues);

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

  async saveRowToTemplate(mappedValues) {
    const options = await this.getAuthHeaders();
    const payload = { values: mappedValues };

    return await window.apiService.post(
      `/api/metric-tracker/templates/${this.selectedTemplate.template.uid}/data/?workspace_uid=${this.workspaceUid}`,
      payload,
      options
    );
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
    if (
      window.authService &&
      window.workspaceService &&
      window.storageService
    ) {
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
