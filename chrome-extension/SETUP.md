# 🚀 FoundersHub Chrome Extension Setup Guide

This guide will help you set up the FoundersHub Chrome Extension in a separate repository.

## 📋 Prerequisites

- Git installed on your system
- GitHub account
- Chrome browser (latest version)
- Node.js (optional, for development tools)

## 🗂️ Step-by-Step Repository Setup

### Step 1: Create New GitHub Repository

1. **Go to GitHub** and click "New repository"
2. **Repository Settings**:
   - **Name**: `foundershub-chrome-extension`
   - **Description**: `Chrome extension for scraping data from websites and sending it to FoundersHub backend`
   - **Visibility**: Choose Public or Private
   - **Initialize**: ✅ Add README file

### Step 2: Clone and Setup Local Repository

```bash
# Clone your new repository
git clone https://github.com/YOUR_USERNAME/foundershub-chrome-extension.git
cd foundershub-chrome-extension

# Remove the default README (we have our own)
rm README.md
```

### Step 3: Copy Extension Files

Copy all files from your current `chrome-extension` directory to the new repository:

```bash
# From your current FH-FE project directory
cp -r chrome-extension/* /path/to/foundershub-chrome-extension/

# Or if you're in the chrome-extension directory
cp -r . /path/to/foundershub-chrome-extension/
```

### Step 4: Initialize Git and Commit

```bash
cd /path/to/foundershub-chrome-extension

# Add all files
git add .

# Initial commit
git commit -m "feat: initial Chrome extension setup

- Add manifest.json with extension configuration
- Add popup interface for authentication
- Add content scripts for data scraping
- Add background script for API communication
- Add utility services for data processing
- Support for LinkedIn, Twitter, GitHub, Flipkart, Myntra
- JWT authentication and workspace management"

# Push to GitHub
git push origin main
```

## 🛠️ Development Setup

### Option 1: Simple Setup (No Build Tools)

1. **Load Extension in Chrome**:
   ```bash
   # Navigate to chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked"
   # Select your repository folder
   ```

### Option 2: Full Development Setup (With Build Tools)

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Development Commands**:

   ```bash
   # Lint code
   npm run lint

   # Fix linting issues
   npm run lint:fix

   # Build and package
   npm run build

   # Clean build files
   npm run clean
   ```

## 📦 Repository Structure

```
foundershub-chrome-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── popup/
│   ├── popup.html            # Popup interface
│   └── popup.js              # Popup logic
├── content-scripts/
│   ├── scraper.js            # Main scraping logic
│   └── scraper-styles.css    # Scraper UI styles
├── services/
│   ├── apiService.js         # API communication
│   └── storageService.js     # Chrome storage utilities
├── utils/
│   ├── schemaMapper.js       # Data normalization
│   └── accountScraper.js     # Account data extraction
├── icons/                    # Extension icons
├── scripts/
│   └── package.js            # Build script
├── .gitignore               # Git ignore rules
├── .eslintrc.js             # ESLint configuration
├── package.json             # Node.js dependencies
├── README.md                # Main documentation
├── CONTRIBUTING.md          # Contribution guidelines
├── SETUP.md                 # This setup guide
└── LICENSE                  # MIT license
```

## 🔧 Configuration

### Update package.json URLs

Edit `package.json` and replace `YOUR_USERNAME` with your GitHub username:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/foundershub-chrome-extension.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/foundershub-chrome-extension/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/foundershub-chrome-extension#readme"
}
```

### API Configuration

The extension is configured to work with:

- **Development**: `http://localhost:8000`
- **Production**: Update `API_BASE_URL` in `services/apiService.js`

## 🚀 Distribution

### Chrome Web Store

1. **Build Package**:

   ```bash
   npm run build
   ```

2. **Upload to Chrome Web Store**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Upload the generated ZIP file
   - Fill in store listing details
   - Submit for review

### Direct Distribution

1. **Create Release**:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Release**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Upload the ZIP file as a release asset

## 🔒 Security Notes

- The extension uses JWT authentication
- All API communication is over HTTPS
- No sensitive data is logged
- Tokens are stored securely in Chrome storage

## 📞 Support

- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions
- **Contributing**: See CONTRIBUTING.md

## 🎉 You're Ready!

Your Chrome extension is now set up in a separate repository and ready for development and distribution!
