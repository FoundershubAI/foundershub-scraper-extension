// Script to update manifest.json based on .env file
const fs = require("fs");
const path = require("path");

// Read .env file
function readEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const envVars = {};

  envContent.split("\n").forEach((line) => {
    if (line.trim() && !line.trim().startsWith("#")) {
      const [key, value] = line.split("=");
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    }
  });

  return envVars;
}

// Update manifest.json
function updateManifest() {
  try {
    const envVars = readEnvFile();
    const manifestPath = path.join(__dirname, "..", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Extract domain from NEXT_PUBLIC_API_URL
    const apiUrl = envVars.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      const url = new URL(apiUrl);
      const domain = `${url.protocol}//${url.host}/*`;

      // Update host_permissions
      manifest.host_permissions = manifest.host_permissions.filter(
        (permission) =>
          !permission.includes("localhost") &&
          !permission.includes("api.foundershub.ai")
      );

      // Add the API domain from .env
      manifest.host_permissions.push(domain);

      // Write updated manifest
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`Updated manifest.json with API domain: ${domain}`);
    } else {
      console.error("NEXT_PUBLIC_API_URL not found in .env file");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error updating manifest:", error);
    process.exit(1);
  }
}

updateManifest();
