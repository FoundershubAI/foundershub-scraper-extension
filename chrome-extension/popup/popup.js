class PopupManager {
  constructor() {
    this.loginSection = document.getElementById("login-section");
    this.scraperSection = document.getElementById("scraper-section");
    this.statusDiv = document.getElementById("status");
    this.loginBtn = document.getElementById("login-btn");
    this.logoutBtn = document.getElementById("logout-btn");

    this.setupEventListeners();
    this.checkAuthStatus();
  }

  setupEventListeners() {
    this.loginBtn.addEventListener("click", () => this.handleLogin());
    this.logoutBtn.addEventListener("click", () => this.handleLogout());

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
      if (e.key === "Enter" && !this.loginSection.classList.contains("hidden")) {
        this.handleLogin();
      }
    });
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get(["access_token", "user_data", "workspace_uid"]);

      if (result.access_token) {
        this.showScraperSection();

        // Try to get workspace info if available
        let workspaceInfo = null;
        if (result.workspace_uid) {
          try {
            const workspacesResponse = await window.workspaceService.getWorkspaces();
            if (workspacesResponse.status === 200 && workspacesResponse.data?.length > 0) {
              // Find the current workspace
              for (const account of workspacesResponse.data) {
                if (account.workspaces) {
                  const currentWorkspace = account.workspaces.find(
                    (ws) => (ws.uid || ws.workspace_uid) === result.workspace_uid,
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
        this.showError("Workspace service not loaded. Please refresh the extension.");
        return;
      }

      if (!window.storageService) {
        this.showError("Storage service not loaded. Please refresh the extension.");
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
        const workspacesResponse = await window.workspaceService.getWorkspaces();

        if (workspacesResponse.status === 200 && workspacesResponse.data?.length > 0) {
          // The workspaces response is directly an array, not nested in results
          const firstAccount = workspacesResponse.data[0];

          if (firstAccount && firstAccount.workspaces && firstAccount.workspaces.length > 0) {
            // Get first workspace from first account
            const firstWorkspace = firstAccount.workspaces[0];
            await window.storageService.setWorkspaceUid(
              firstWorkspace.uid || firstWorkspace.workspace_uid,
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
  }

  updateUserInfo(userData, workspace = null) {
    const userStatus = document.getElementById("user-status");
    const workspaceInfo = document.getElementById("workspace-info");

    if (userData) {
      userStatus.textContent = userData.email || "Connected";
      workspaceInfo.textContent = workspace ? workspace.name || "Active" : "Active";
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
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Wait for services to be available
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  const initPopup = () => {
    if (window.authService && window.workspaceService && window.storageService) {
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
