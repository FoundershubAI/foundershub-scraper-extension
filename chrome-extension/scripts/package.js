#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("📦 Packaging FoundersHub Chrome Extension...");

// Read manifest for version
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// Recreate clean dist directory
if (fs.existsSync("dist")) {
  execSync('rm -rf "dist"');
}
fs.mkdirSync("dist");

// Files to include in the package
const filesToCopy = [
  "manifest.json",
  "background.js",
  "config.js",
  ".env",
  "popup",
  "content-scripts",
  "services",
  "utils",
  "icons",
  "README.md",
  "LICENSE",
];


// Copy files to dist
filesToCopy.forEach((file) => {
  const srcPath = path.join(process.cwd(), file);
  const destPath = path.join(process.cwd(), "dist", file);

  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      // Copy directory recursively, preserving folder name
      execSync(`cp -R "${srcPath}" "${path.join(process.cwd(), "dist")}"`);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`✅ Copied: ${file}`);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

// Create ZIP file
const zipName = `foundershub-chrome-extension-v${version}.zip`;
const zipPath = path.join(process.cwd(), zipName);

console.log("🗜️  Creating ZIP archive...");

try {
  execSync(`cd dist && zip -r "../${zipName}" ./*`, { stdio: "inherit" });
  console.log(`✅ Package created: ${zipName}`);
  console.log(`📁 Size: ${(fs.statSync(zipPath).size / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error("❌ Failed to create ZIP:", error.message);
  process.exit(1);
}

console.log("🎉 Packaging complete!");
console.log("\n📋 Next steps:");
console.log("1. Test the extension by loading dist/ folder in Chrome");
console.log("2. Upload the ZIP file to Chrome Web Store");
console.log("3. Or distribute the ZIP file directly");
