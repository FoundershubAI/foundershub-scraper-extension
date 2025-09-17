// Load configuration from .env file
let config = { NEXT_PUBLIC_API_URL: null };

// Load config asynchronously
async function loadConfig() {
  try {
    // Check if we're in a service worker context
    if (typeof document === "undefined") {
      // Service worker context - load config directly
      const response = await fetch(chrome.runtime.getURL(".env"));
      if (response.ok) {
        const envContent = await response.text();
        config = parseEnvFile(envContent);
      } else {
        throw new Error("Could not load .env file");
      }
      return config;
    } else {
      // Content script context - load via script tag
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("config.js");

      return new Promise((resolve) => {
        script.onload = async () => {
          if (window.CONFIG) {
            // Wait for config to be loaded
            await window.CONFIG.loadConfig();
            config = window.CONFIG.getAll();
          }
          resolve(config);
        };
        script.onerror = () => {
          console.warn("Could not load config.js, using defaults");
          resolve(config);
        };
        document.head.appendChild(script);
      });
    }
  } catch (error) {
    console.warn("Error loading config:", error);
    return config;
  }
}

// Parse .env file content
function parseEnvFile(content) {
  const lines = content.split("\n");
  const config = {};

  lines.forEach((line) => {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      return;
    }

    // Parse KEY=VALUE format
    const equalIndex = line.indexOf("=");
    if (equalIndex > 0) {
      const key = line.substring(0, equalIndex).trim();
      let value = line.substring(equalIndex + 1).trim();

      // Convert string values to appropriate types
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (!isNaN(value) && value !== "") value = Number(value);

      config[key] = value;
    }
  });

  return config;
}

// Base API configuration - will be updated when config loads
let NEXT_PUBLIC_API_URL = null;

// Create axios-like fetch wrapper
class ApiService {
  constructor() {
    this.baseURL = NEXT_PUBLIC_API_URL;
  }

  // Update base URL when config loads
  updateBaseURL() {
    this.baseURL = config.NEXT_PUBLIC_API_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    console.log("Making API request to:", url);
    console.log("Base URL:", this.baseURL);
    console.log("Endpoint:", endpoint);

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      return {
        status: data.status || response.status,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  // GET request
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  // POST request
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // PATCH request
  async patch(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }

  // Add authorization header
  async addAuthHeader(options = {}) {
    try {
      const result = await chrome.storage.local.get(["access_token"]);
      const token = result.access_token;

      if (token) {
        return {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        };
      }
      return {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      };
    } catch (error) {
      return {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      };
    }
  }
}

// Create singleton instance
const apiService = new ApiService();

// Initialize config loading
loadConfig().then(() => {
  console.log("Configuration loaded:", config);
  console.log("NEXT_PUBLIC_API_URL from config:", config.NEXT_PUBLIC_API_URL);
  // Update NEXT_PUBLIC_API_URL and apiService baseURL
  NEXT_PUBLIC_API_URL = config.NEXT_PUBLIC_API_URL;
  console.log("NEXT_PUBLIC_API_URL updated to:", NEXT_PUBLIC_API_URL);
  // Update the local apiService instance
  apiService.updateBaseURL();
  console.log("apiService baseURL updated to:", apiService.baseURL);
});

// Authentication endpoints
const authService = {
  // Login user
  login: async (email, password) => {
    return apiService.post("/user/login/", { email, password });
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    return apiService.post("/api/token/refresh/", { refresh: refreshToken });
  },

  // Logout user
  logout: async () => {
    const options = await apiService.addAuthHeader();
    return apiService.post("/user/logout/", {}, options);
  },

  // Get user profile
  getProfile: async () => {
    const options = await apiService.addAuthHeader();
    return apiService.get("/user/user_details/", options);
  },
};

// Data endpoints
const dataService = {
  // Save scraped data
  saveData: async (url, rawData, siteDomain) => {
    const options = await apiService.addAuthHeader();
    return apiService.post(
      "/api/v2/extension/data/save-data/",
      {
        url,
        raw_data: rawData,
        site_domain: siteDomain,
      },
      options
    );
  },

  // Save scraped data with workspace UID
  saveScrapedData: async (url, rawData, siteDomain, workspaceUid) => {
    const options = await apiService.addAuthHeader();
    return apiService.post(
      `/api/v2/extension/data/save_data/?workspace_uid=${workspaceUid}`,
      {
        url,
        raw_data: rawData,
        site_domain: siteDomain,
      },
      options
    );
  },

  // Bulk save data
  bulkSaveData: async (dataArray) => {
    const options = await apiService.addAuthHeader();
    return apiService.post(
      "/api/v2/extension/data/bulk-save-data/",
      {
        data: dataArray,
      },
      options
    );
  },

  // Get all data
  getData: async (filters = {}) => {
    const options = await apiService.addAuthHeader();
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams
      ? `/api/v2/extension/data/get-data/?${queryParams}`
      : "/api/v2/extension/data/get-data/";
    return apiService.get(endpoint, options);
  },

  // Get specific data item
  getDataItem: async (uid) => {
    const options = await apiService.addAuthHeader();
    return apiService.get(`/api/v2/extension/data/${uid}/get-item/`, options);
  },

  // Delete data item
  deleteDataItem: async (uid) => {
    const options = await apiService.addAuthHeader();
    return apiService.delete(`/api/v2/extension/data/${uid}/delete/`, options);
  },
};

// Workspace endpoints
const workspaceService = {
  // Get user workspaces
  getWorkspaces: async () => {
    const options = await apiService.addAuthHeader();
    return apiService.get("/api/v2/workspaces/", options);
  },

  // Switch workspace
  switchWorkspace: async (workspaceUid) => {
    const options = await apiService.addAuthHeader();
    return apiService.post(
      "/api/v2/workspaces/switch/",
      { workspace_uid: workspaceUid },
      options
    );
  },
};

// Make services globally available (works in both window and service worker contexts)
(function () {
  const globalScope = typeof window !== "undefined" ? window : self;
  globalScope.apiService = apiService;
  globalScope.authService = authService;
  globalScope.dataService = dataService;
  globalScope.workspaceService = workspaceService;
})();
