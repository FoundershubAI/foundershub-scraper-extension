// Personal Account Data Scraper
// Extracts logged-in user's personal information from various websites

class AccountScraper {
  constructor() {
    this.siteAdapters = {
      "flipkart.com": new FlipkartAdapter(),
      "myntra.com": new MyntraAdapter(),
      "linkedin.com": new LinkedInAdapter(),
      "facebook.com": new FacebookAdapter(),
      "x.com": new TwitterAdapter(),
      "twitter.com": new TwitterAdapter(),
      "instagram.com": new InstagramAdapter(),
      "amazon.in": new AmazonAdapter(),
      "amazon.com": new AmazonAdapter(),
      "paytm.com": new PaytmAdapter(),
      "phonepe.com": new PhonePeAdapter(),
      "swiggy.com": new SwiggyAdapter(),
      "zomato.com": new ZomatoAdapter(),
      "ola.com": new OlaAdapter(),
      "uber.com": new UberAdapter(),
      "netflix.com": new NetflixAdapter(),
      "hotstar.com": new HotstarAdapter(),
      "gmail.com": new GmailAdapter(),
      "outlook.com": new OutlookAdapter(),
    };

    this.genericExtractors = [
      this.extractFromDOM.bind(this),
      this.extractFromWindowVariables.bind(this),
      this.extractFromLocalStorage.bind(this),
      this.extractFromSessionStorage.bind(this),
      this.extractFromCookies.bind(this),
    ];
  }

  /**
   * Main method to scrape account data from current site
   * @returns {Object} Normalized user account data
   */
  async scrapeAccountData() {
    const hostname = window.location.hostname;
    const domain = this.extractDomain(hostname);

    let accountData = {
      source: domain,
      url: window.location.href,
      scrapedAt: new Date().toISOString(),
      method: "unknown",
    };

    try {
      // 1. Try site-specific adapter first
      if (this.siteAdapters[domain]) {
        // console.log(`🎯 Using site-specific adapter for ${domain}`);
        const adapterData = await this.siteAdapters[domain].extractAccountData();
        if (adapterData && Object.keys(adapterData).length > 0) {
          accountData = { ...accountData, ...adapterData, method: "site-adapter" };
          // console.log(`✅ Site adapter extracted:`, adapterData);
        }
      }

      // 2. Try generic extractors as fallback or supplement
      // console.log(`🔧 Running generic extractors for ${domain}`);
      for (const extractor of this.genericExtractors) {
        try {
          const genericData = await extractor();
          if (genericData && Object.keys(genericData).length > 0) {
            // Merge with existing data, prioritizing site-specific data
            accountData = { ...genericData, ...accountData };
            // console.log(`📊 Generic extractor found:`, genericData);
          }
        } catch (error) {
          // console.warn(`⚠️ Generic extractor failed:`, error.message);
        }
      }

      // 3. Try network request interception
      const networkData = await this.interceptNetworkRequests();
      if (networkData && Object.keys(networkData).length > 0) {
        accountData = { ...accountData, ...networkData, method: "network-intercept" };
        // console.log(`🌐 Network intercept found:`, networkData);
      }

      // 4. Normalize and clean data
      accountData = this.normalizeAccountData(accountData);

      return accountData;
    } catch (error) {
      // console.error(`❌ Error scraping account data:`, error);
      return {
        ...accountData,
        error: error.message,
        method: "failed",
      };
    }
  }

  /**
   * Extract data from DOM elements
   */
  async extractFromDOM() {
    const data = {};

    // Common selectors for user info across sites
    const selectors = {
      name: [
        '[data-testid*="user-name"]',
        '[class*="user-name"]',
        '[class*="profile-name"]',
        '[class*="account-name"]',
        ".user-info .name",
        ".profile-info .name",
        ".account-info .name",
        'h1[class*="name"]',
        'span[class*="display-name"]',
        '[aria-label*="name"]',
      ],
      email: [
        '[data-testid*="email"]',
        '[class*="email"]',
        'input[type="email"]',
        '[href^="mailto:"]',
        ".user-info .email",
        ".profile-info .email",
        ".account-info .email",
      ],
      phone: [
        '[data-testid*="phone"]',
        '[class*="phone"]',
        '[class*="mobile"]',
        'input[type="tel"]',
        '[href^="tel:"]',
        ".user-info .phone",
        ".profile-info .phone",
        ".account-info .mobile",
      ],
      avatar: [
        '[data-testid*="avatar"]',
        '[class*="avatar"]',
        '[class*="profile-pic"]',
        '[class*="user-image"]',
        ".user-info img",
        ".profile-info img",
      ],
    };

    for (const [field, fieldSelectors] of Object.entries(selectors)) {
      for (const selector of fieldSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            let value = null;

            if (field === "avatar" && element.tagName === "IMG") {
              value = element.src;
            } else if (element.tagName === "INPUT") {
              value = element.value;
            } else if (element.tagName === "A" && field === "email") {
              value = element.href.replace("mailto:", "");
            } else if (element.tagName === "A" && field === "phone") {
              value = element.href.replace("tel:", "");
            } else {
              value = element.textContent?.trim();
            }

            if (value && value.length > 0 && this.isValidData(field, value)) {
              data[field] = value;
              break;
            }
          }
          if (data[field]) break;
        } catch (error) {
          continue;
        }
      }
    }

    return data;
  }

  /**
   * Extract data from window/global JavaScript variables
   */
  async extractFromWindowVariables() {
    const data = {};

    // Common window variable patterns
    const windowVars = [
      "window.__INITIAL_STATE__",
      "window.__PRELOADED_STATE__",
      "window.__APOLLO_STATE__",
      "window.__NEXT_DATA__",
      "window._user",
      "window.user",
      "window.currentUser",
      "window.userData",
      "window.userInfo",
      "window.profile",
      "window.account",
      "window.me",
      "window.self",
      "window.config.user",
      "window.app.user",
      "window.store.user",
      "window.state.user",
    ];

    for (const varPath of windowVars) {
      try {
        const value = this.getNestedProperty(window, varPath.replace("window.", ""));
        if (value && typeof value === "object") {
          const extracted = this.extractUserDataFromObject(value);
          if (Object.keys(extracted).length > 0) {
            Object.assign(data, extracted);
            // console.log(`📦 Found data in ${varPath}:`, extracted);
          }
        }
      } catch (error) {
        continue;
      }
    }

    return data;
  }

  /**
   * Extract data from localStorage
   */
  async extractFromLocalStorage() {
    const data = {};

    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (
          key.toLowerCase().includes("user") ||
          key.toLowerCase().includes("profile") ||
          key.toLowerCase().includes("account") ||
          key.toLowerCase().includes("auth")
        ) {
          try {
            const value = localStorage.getItem(key);
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object") {
              const extracted = this.extractUserDataFromObject(parsed);
              if (Object.keys(extracted).length > 0) {
                Object.assign(data, extracted);
                // console.log(`💾 Found data in localStorage[${key}]:`, extracted);
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // console.warn("Cannot access localStorage:", error);
    }

    return data;
  }

  /**
   * Extract data from sessionStorage
   */
  async extractFromSessionStorage() {
    const data = {};

    try {
      const keys = Object.keys(sessionStorage);
      for (const key of keys) {
        if (
          key.toLowerCase().includes("user") ||
          key.toLowerCase().includes("profile") ||
          key.toLowerCase().includes("account") ||
          key.toLowerCase().includes("auth")
        ) {
          try {
            const value = sessionStorage.getItem(key);
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object") {
              const extracted = this.extractUserDataFromObject(parsed);
              if (Object.keys(extracted).length > 0) {
                Object.assign(data, extracted);
                // console.log(`🗂️ Found data in sessionStorage[${key}]:`, extracted);
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // console.warn("Cannot access sessionStorage:", error);
    }

    return data;
  }

  /**
   * Extract data from cookies
   */
  async extractFromCookies() {
    const data = {};

    try {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (
          name &&
          (name.toLowerCase().includes("user") ||
            name.toLowerCase().includes("profile") ||
            name.toLowerCase().includes("email"))
        ) {
          try {
            const decoded = decodeURIComponent(value);
            const parsed = JSON.parse(decoded);
            if (parsed && typeof parsed === "object") {
              const extracted = this.extractUserDataFromObject(parsed);
              if (Object.keys(extracted).length > 0) {
                Object.assign(data, extracted);
                // console.log(`🍪 Found data in cookie[${name}]:`, extracted);
              }
            }
          } catch (error) {
            // Try as plain text
            if (value && this.isValidData("email", value)) {
              data.email = decodeURIComponent(value);
            }
          }
        }
      }
    } catch (error) {
      // console.warn("Cannot access cookies:", error);
    }

    return data;
  }

  /**
   * Intercept network requests to find user data
   */
  async interceptNetworkRequests() {
    // This would need to be implemented with chrome.webRequest API
    // For now, we'll try to make common API calls that sites use
    const data = {};
    const domain = this.extractDomain(window.location.hostname);

    const commonEndpoints = [
      "/api/user",
      "/api/profile",
      "/api/account",
      "/api/me",
      "/user/profile",
      "/account/details",
      "/profile/info",
      "/api/v1/user",
      "/api/v2/user",
      "/graphql", // For GraphQL endpoints
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const response = await fetch(endpoint, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const jsonData = await response.json();
          const extracted = this.extractUserDataFromObject(jsonData);
          if (Object.keys(extracted).length > 0) {
            Object.assign(data, extracted);
            // console.log(`🌐 Found data from ${endpoint}:`, extracted);
            break; // Stop after first successful endpoint
          }
        }
      } catch (error) {
        continue; // Try next endpoint
      }
    }

    return data;
  }

  /**
   * Extract user data from any object recursively
   */
  extractUserDataFromObject(obj, maxDepth = 3, currentDepth = 0) {
    if (!obj || typeof obj !== "object" || currentDepth >= maxDepth) {
      return {};
    }

    const data = {};
    const userFields = {
      // Name variations
      name: [
        "name",
        "fullName",
        "full_name",
        "displayName",
        "display_name",
        "firstName",
        "first_name",
        "lastName",
        "last_name",
        "username",
        "user_name",
      ],
      // Email variations
      email: ["email", "emailAddress", "email_address", "mail", "userEmail", "user_email"],
      // Phone variations
      phone: [
        "phone",
        "phoneNumber",
        "phone_number",
        "mobile",
        "mobileNumber",
        "mobile_number",
        "contact",
        "contactNumber",
      ],
      // Avatar variations
      avatar: [
        "avatar",
        "profilePicture",
        "profile_picture",
        "profileImage",
        "profile_image",
        "photo",
        "picture",
        "image",
      ],
      // Additional fields
      id: ["id", "userId", "user_id", "uid", "accountId", "account_id"],
      address: ["address", "location", "city", "state", "country"],
      dob: ["dob", "dateOfBirth", "date_of_birth", "birthDate", "birth_date"],
      gender: ["gender", "sex"],
    };

    // Direct field matching
    for (const [field, variations] of Object.entries(userFields)) {
      for (const variation of variations) {
        if (obj.hasOwnProperty(variation) && obj[variation]) {
          const value = obj[variation];
          if (this.isValidData(field, value)) {
            data[field] = value;
            break;
          }
        }
      }
    }

    // Recursive search in nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const nestedData = this.extractUserDataFromObject(value, maxDepth, currentDepth + 1);
        Object.assign(data, nestedData);
      }
    }

    return data;
  }

  /**
   * Validate extracted data
   */
  isValidData(field, value) {
    if (!value || typeof value !== "string") return false;

    switch (field) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case "phone":
        return /[\d\s\-\+\(\)]{10,}/.test(value);
      case "name":
        return value.length > 1 && value.length < 100 && !/^\d+$/.test(value);
      case "avatar":
        return value.startsWith("http") || value.startsWith("data:image");
      default:
        return value.length > 0 && value.length < 500;
    }
  }

  /**
   * Normalize account data to consistent format
   */
  normalizeAccountData(data) {
    const normalized = {
      source: data.source,
      url: data.url,
      scrapedAt: data.scrapedAt,
      method: data.method,
    };

    // Normalize name
    if (data.name) {
      normalized.name = data.name;
    } else if (data.firstName && data.lastName) {
      normalized.name = `${data.firstName} ${data.lastName}`;
    } else if (data.firstName) {
      normalized.name = data.firstName;
    } else if (data.displayName) {
      normalized.name = data.displayName;
    }

    // Normalize email
    if (data.email) {
      normalized.email = data.email.toLowerCase();
    }

    // Normalize phone
    if (data.phone) {
      normalized.phone = data.phone.replace(/\D/g, ""); // Keep only digits
      if (normalized.phone.length >= 10) {
        // Format as +91 XXXXX XXXXX for Indian numbers
        if (normalized.phone.length === 10) {
          normalized.phone = `+91 ${normalized.phone}`;
        } else if (normalized.phone.startsWith("91") && normalized.phone.length === 12) {
          normalized.phone = `+${normalized.phone}`;
        }
      }
    }

    // Add other fields
    ["avatar", "id", "address", "dob", "gender"].forEach((field) => {
      if (data[field]) {
        normalized[field] = data[field];
      }
    });

    return normalized;
  }

  /**
   * Helper methods
   */
  extractDomain(hostname) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
  }

  getNestedProperty(obj, path) {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// Site-specific adapters for major websites
class FlipkartAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // Try multiple API endpoints
      const endpoints = [
        "/api/3/user/info",
        "/api/2/user/profile",
        "/api/user/details",
        "/account/api/profile",
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { credentials: "include" });
          if (response.ok) {
            const userInfo = await response.json();
            // Handle different response structures
            const user = userInfo.user || userInfo.data || userInfo;
            if (user && typeof user === "object") {
              if (user.name) data.name = user.name;
              if (user.email) data.email = user.email;
              if (user.phone || user.mobile) data.phone = user.phone || user.mobile;
              if (user.firstName && user.lastName) {
                data.name = `${user.firstName} ${user.lastName}`;
              }

              if (Object.keys(data).length > 0) {
                break; // Stop after first successful extraction
              }
            }
          }
        } catch (apiError) {
          continue; // Try next endpoint
        }
      }
    } catch (error) {
      // console.log("Flipkart API failed, trying DOM and window variables");
    }

    // Try window variables (Flipkart stores data in various places)
    try {
      const windowVars = [
        "window.__INITIAL_STATE__",
        "window.__FLIPKART_STATE__",
        "window.initialState",
        "window.pageData",
        "window.userData",
        "window._user",
      ];

      for (const varPath of windowVars) {
        try {
          const value = this.getNestedProperty(window, varPath.replace("window.", ""));
          if (value && typeof value === "object") {
            const extracted = this.extractUserFromObject(value);
            if (Object.keys(extracted).length > 0) {
              Object.assign(data, extracted);
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // console.log("Flipkart window variables failed");
    }

    // Enhanced DOM extraction with more selectors
    try {
      const selectors = {
        name: [
          '[data-testid="user-name"]',
          ".user-name",
          "._1psGvi",
          "._2aK_gu", // Flipkart user menu
          ".profile-name",
          ".user-profile-name",
          '[class*="userName"]',
          '[class*="displayName"]',
        ],
        email: [
          '[data-testid="user-email"]',
          ".user-email",
          'input[type="email"]',
          '[class*="email"]',
        ],
        phone: [
          '[data-testid="user-phone"]',
          ".user-phone",
          ".user-mobile",
          'input[type="tel"]',
          '[class*="mobile"]',
          '[class*="phone"]',
        ],
      };

      for (const [field, fieldSelectors] of Object.entries(selectors)) {
        if (data[field]) continue; // Skip if already found

        for (const selector of fieldSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              let value = null;

              if (element.tagName === "INPUT") {
                value = element.value;
              } else {
                value = element.textContent?.trim();
              }

              if (value && value.length > 0 && this.isValidData(field, value)) {
                // Skip Flipkart's customer service info
                if (field === "email" && value.includes("flipkart.com")) continue;
                if (field === "phone" && (value.includes("04445614700") || value.length < 10))
                  continue;

                data[field] = value;
                break;
              }
            }
            if (data[field]) break;
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // console.log("Flipkart DOM extraction failed");
    }

    return data;
  }

  // Helper methods
  getNestedProperty(obj, path) {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  extractUserFromObject(obj, maxDepth = 3, currentDepth = 0) {
    if (!obj || typeof obj !== "object" || currentDepth >= maxDepth) {
      return {};
    }

    const data = {};
    const userFields = {
      name: ["name", "fullName", "full_name", "displayName", "userName", "firstName", "lastName"],
      email: ["email", "emailAddress", "email_address", "userEmail"],
      phone: ["phone", "phoneNumber", "mobile", "mobileNumber", "contactNumber"],
    };

    // Direct field matching
    for (const [field, variations] of Object.entries(userFields)) {
      for (const variation of variations) {
        if (obj.hasOwnProperty(variation) && obj[variation]) {
          const value = obj[variation];
          if (this.isValidData(field, value)) {
            data[field] = value;
            break;
          }
        }
      }
    }

    // Handle firstName + lastName combination
    if (!data.name && obj.firstName && obj.lastName) {
      data.name = `${obj.firstName} ${obj.lastName}`;
    }

    // Recursive search in nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const nestedData = this.extractUserFromObject(value, maxDepth, currentDepth + 1);
        // Don't override existing data
        for (const [nestedKey, nestedValue] of Object.entries(nestedData)) {
          if (!data[nestedKey]) {
            data[nestedKey] = nestedValue;
          }
        }
      }
    }

    return data;
  }

  isValidData(field, value) {
    if (!value || typeof value !== "string") return false;

    switch (field) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.includes("flipkart.com");
      case "phone":
        return /[\d\s\-\+\(\)]{10,}/.test(value) && !value.includes("04445614700");
      case "name":
        return value.length > 1 && value.length < 100 && !/^\d+$/.test(value);
      default:
        return value.length > 0 && value.length < 500;
    }
  }
}

class MyntraAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // Check window variables
      if (window.__myx_state__?.user) {
        const user = window.__myx_state__.user;
        data.name = user.name || user.displayName;
        data.email = user.email;
        data.phone = user.mobile;
      }
    } catch (error) {
      // console.log("Myntra window variables failed");
    }

    return data;
  }
}

class LinkedInAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // LinkedIn stores data in window variables
      if (window.voyagerEndpoints) {
        // Try to find user data in voyager state
        const userUrn = document.querySelector('[data-control-name="identity_welcome_message"]');
        if (userUrn) {
          data.name = userUrn.textContent.trim().replace("Hi, ", "").replace("!", "");
        }
      }
    } catch (error) {
      // console.log("LinkedIn extraction failed");
    }

    return data;
  }
}

class FacebookAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // Facebook uses complex state management
      if (window.__additionalDataLoaded) {
        // Try to extract from Facebook's internal state
        const userMenu = document.querySelector('[data-testid="user-menu-button"]');
        if (userMenu) {
          data.name = userMenu.getAttribute("aria-label");
        }
      }
    } catch (error) {
      // console.log("Facebook extraction failed");
    }

    return data;
  }
}

class TwitterAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // Twitter/X stores data in window variables
      if (window.__INITIAL_STATE__?.entities?.users) {
        const users = window.__INITIAL_STATE__.entities.users;
        const currentUser = Object.values(users).find(
          (user) => user.id_str === window.__INITIAL_STATE__.session?.user_id,
        );
        if (currentUser) {
          data.name = currentUser.name;
          data.username = currentUser.screen_name;
          data.avatar = currentUser.profile_image_url_https;
        }
      }
    } catch (error) {
      // console.log("Twitter extraction failed");
    }

    return data;
  }
}

class InstagramAdapter {
  async extractAccountData() {
    const data = {};

    try {
      if (window._sharedData?.config?.viewer) {
        const viewer = window._sharedData.config.viewer;
        data.name = viewer.full_name;
        data.username = viewer.username;
        data.avatar = viewer.profile_pic_url;
      }
    } catch (error) {
      // console.log("Instagram extraction failed");
    }

    return data;
  }
}

class AmazonAdapter {
  async extractAccountData() {
    const data = {};

    try {
      // Amazon account info is usually in nav
      const nameEl = document.querySelector("#nav-link-accountList .nav-line-1");
      if (nameEl) {
        data.name = nameEl.textContent.replace("Hello, ", "").trim();
      }
    } catch (error) {
      // console.log("Amazon extraction failed");
    }

    return data;
  }
}

// Add more adapters for other sites...
class PaytmAdapter {
  async extractAccountData() {
    const data = {};
    try {
      if (window.__PRELOADED_STATE__?.user) {
        const user = window.__PRELOADED_STATE__.user;
        data.name = user.name;
        data.email = user.email;
        data.phone = user.mobile;
      }
    } catch (error) {
      // console.log("Paytm extraction failed");
    }
    return data;
  }
}

class PhonePeAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // PhonePe specific extraction logic
      const userInfo = document.querySelector(".user-profile-name");
      if (userInfo) data.name = userInfo.textContent.trim();
    } catch (error) {
      // console.log("PhonePe extraction failed");
    }
    return data;
  }
}

class SwiggyAdapter {
  async extractAccountData() {
    const data = {};
    try {
      if (window.__PRELOADED_STATE__?.user) {
        const user = window.__PRELOADED_STATE__.user;
        data.name = user.name;
        data.email = user.email;
        data.phone = user.mobile;
      }
    } catch (error) {
      // console.log("Swiggy extraction failed");
    }
    return data;
  }
}

class ZomatoAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Zomato specific extraction
      const nameEl = document.querySelector('[data-testid="user-name"]');
      if (nameEl) data.name = nameEl.textContent.trim();
    } catch (error) {
      // console.log("Zomato extraction failed");
    }
    return data;
  }
}

class OlaAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Ola specific extraction
      if (window.appData?.user) {
        data.name = window.appData.user.name;
        data.phone = window.appData.user.mobile;
      }
    } catch (error) {
      // console.log("Ola extraction failed");
    }
    return data;
  }
}

class UberAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Uber specific extraction
      if (window.__REDUX_STORE__?.getState()?.user) {
        const user = window.__REDUX_STORE__.getState().user;
        data.name = user.firstName + " " + user.lastName;
        data.email = user.email;
      }
    } catch (error) {
      // console.log("Uber extraction failed");
    }
    return data;
  }
}

class NetflixAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Netflix specific extraction
      if (window.netflix?.reactContext?.models?.user) {
        const user = window.netflix.reactContext.models.user;
        data.email = user.email;
        data.name = user.firstName;
      }
    } catch (error) {
      // console.log("Netflix extraction failed");
    }
    return data;
  }
}

class HotstarAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Hotstar specific extraction
      const profileEl = document.querySelector(".profile-name");
      if (profileEl) data.name = profileEl.textContent.trim();
    } catch (error) {
      // console.log("Hotstar extraction failed");
    }
    return data;
  }
}

class GmailAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Gmail specific extraction
      const emailEl = document.querySelector('[data-testid="user-email"], .gb_Ab');
      if (emailEl) data.email = emailEl.textContent.trim();

      const nameEl = document.querySelector('[data-testid="user-name"], .gb_yb');
      if (nameEl) data.name = nameEl.textContent.trim();
    } catch (error) {
      // console.log("Gmail extraction failed");
    }
    return data;
  }
}

class OutlookAdapter {
  async extractAccountData() {
    const data = {};
    try {
      // Outlook specific extraction
      const userEl = document.querySelector('[data-testid="user-displayname"]');
      if (userEl) data.name = userEl.textContent.trim();
    } catch (error) {
      // console.log("Outlook extraction failed");
    }
    return data;
  }
}

// Make the class globally available
(function () {
  const globalScope = typeof window !== "undefined" ? window : self;
  globalScope.AccountScraper = AccountScraper;
})();
