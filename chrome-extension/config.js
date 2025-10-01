// Environment configuration loader
class ConfigLoader {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  async loadConfig() {
    try {
      console.log("🔄 Loading .env file...");
      // Try to load .env file
      const response = await fetch(chrome.runtime.getURL(".env"));
      console.log("📡 .env file response:", response.status, response.ok);

      if (response.ok) {
        const envContent = await response.text();
        console.log("📄 .env file content:", envContent);
        this.config = this.parseEnvFile(envContent);
        console.log("✅ Parsed config:", this.config);
      } else {
        // No fallback - require .env file
        throw new Error("Could not load .env file");
      }
    } catch (error) {
      console.error("Failed to load .env file:", error);
      throw new Error(
        "Environment configuration is required. Please ensure .env file exists."
      );
    }
  }

  parseEnvFile(content) {
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

  get(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  getAll() {
    return { ...this.config };
  }
}

// Create config loader instance
const configLoader = new ConfigLoader();

// Export configuration
if (typeof module !== "undefined" && module.exports) {
  module.exports = configLoader;
} else {
  window.CONFIG = configLoader;
}
