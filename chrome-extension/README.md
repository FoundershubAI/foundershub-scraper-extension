# 🔧 **FoundersHub Data Scraper - Chrome Extension**

## 📋 **Overview**

Chrome extension for scraping personal data from websites and sending it to FoundersHub backend.

## 🎯 **Features**

- **Universal Data Scraping**: Works on any website with personal information
- **Site-Specific Scrapers**: Optimized for LinkedIn, Twitter, GitHub, Flipkart, Myntra
- **Schema Mapping**: Automatically normalizes data to standard fields
- **Secure Authentication**: JWT-based authentication with FoundersHub backend
- **Clean Data Output**: Only returns predefined schema fields

## 🏗️ **Architecture**

### **Core Files**

```
chrome-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker for API calls
├── popup/
│   ├── popup.html            # Simple login/status popup
│   └── popup.js              # Popup functionality
├── content-scripts/
│   ├── scraper.js            # Main scraping logic
│   └── scraper-styles.css    # Scraper UI styles
├── services/
│   ├── apiService.js         # API communication
│   └── storageService.js     # Chrome storage utilities
├── utils/
│   ├── schemaMapper.js       # Data normalization
│   └── accountScraper.js     # Personal account data extraction
└── icons/                    # Extension icons
```

## 🔧 **Installation**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## 🚀 **Usage**

1. **Login**: Click extension icon, enter your email and password
2. **Auto-Workspace**: Extension automatically selects your first available workspace
3. **Scrape Data**: Navigate to any profile page and click "Scrape All Data"
4. **View Results**: Data is automatically sent to FoundersHub backend

## 🌐 **Supported Sites**

- **LinkedIn**: Profile pages, connections, experience
- **Twitter/X**: Profile information, follower counts
- **GitHub**: User profiles, repositories, stats
- **Flipkart**: Account pages, personal information
- **Myntra**: Profile pages, personal details
- **Generic**: Any website with form fields or structured data

## 📊 **Data Fields**

Returns only standardized schema fields:

- **Personal**: `full_name`, `first_name`, `last_name`, `email`, `phone`, `gender`, `dob`
- **Location**: `address`, `city`, `state`, `country`, `zip_code`
- **Professional**: `company`, `role`, `industry`, `education`, `bio`
- **Social**: `followers`, `following`, `connections`
- **URLs**: `profile_url`, `profile_picture_url`
- **Metadata**: `source_domain`, `scraped_at`

## 🔐 **Security**

- JWT tokens stored securely in Chrome storage
- Automatic token refresh
- HTTPS-only API communication
- No sensitive data logged

## 🛠️ **Development**

- **Lint**: Check code quality
- **Test**: Load unpacked extension for testing

## 🎯 **API Integration**

- **Base URL**: `http://localhost:8000` (configurable)
- **Authentication**: JWT Bearer tokens
- **Data Endpoint**: `/api/v2/extension/data/save_data/`
- **Workspace**: Auto-fetched from user's available workspaces

## 📝 **Version**

- **Current**: 1.0.0
- **Manifest**: Version 3
- **Chrome**: Minimum version 88+

---

**🎉 Clean, focused Chrome extension for universal data scraping!**
