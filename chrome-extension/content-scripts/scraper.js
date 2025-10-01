// Main scraper content script
class DataScraper {
  constructor() {
    this.siteType = this.detectSiteType();
    this.init();
  }

  // Detect current website type
  detectSiteType() {
    const hostname = window.location.hostname;

    if (hostname.includes("linkedin.com")) return "linkedin";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "twitter";
    if (hostname.includes("github.com")) return "github";
    if (hostname.includes("flipkart.com")) return "flipkart";
    if (hostname.includes("myntra.com")) return "myntra";
    return "generic";
  }

  // Initialize scraper
  init() {
    this.createScraperUI();
    this.setupMessageListener();
  }

  // Create scraper UI overlay
  createScraperUI() {
    // Remove existing UI if any
    const existingUI = document.getElementById("fh-scraper-ui");
    if (existingUI) existingUI.remove();

    // Create UI container
    const ui = document.createElement("div");
    ui.id = "fh-scraper-ui";
    ui.innerHTML = `
      <div class="fh-scraper-panel">
        <div class="fh-scraper-header">
          <div class="fh-scraper-logo">FH</div>
          <div class="fh-scraper-title">Data Scraper</div>
          <div class="fh-scraper-site">${this.siteType.toUpperCase()}</div>
          <button id="fh-close-btn" class="fh-close-btn" title="Close">×</button>
        </div>
                <div class="fh-scraper-content">
                  <button id="fh-scrape-all-btn" class="fh-scrape-button">
                    <span class="fh-scrape-icon">🔍</span>
                    Scrape All Data
                  </button>
                  <div id="fh-scrape-status" class="fh-scrape-status"></div>
                </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(ui);

    // Add event listeners
    document
      .getElementById("fh-scrape-all-btn")
      .addEventListener("click", () => {
        this.scrapeAllData();
      });

    document.getElementById("fh-close-btn").addEventListener("click", () => {
      this.closeScraperUI();
    });
  }

  // Close the scraper UI
  closeScraperUI() {
    const ui = document.getElementById("fh-scraper-ui");
    if (ui) {
      ui.remove();
    }
  }

  // Scrape both profile and account data in one go
  async scrapeAllData() {
    const button = document.getElementById("fh-scrape-all-btn");
    const status = document.getElementById("fh-scrape-status");

    // Show loading state
    button.disabled = true;
    button.innerHTML = '<span class="fh-scrape-icon">⏳</span> Scraping...';
    status.innerHTML = "";

    // Check if extension is available and wake up service worker
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      status.innerHTML = '<div class="fh-error">❌ Extension not loaded</div>';
      button.innerHTML =
        '<span class="fh-scrape-icon">🔍</span> Scrape All Data';
      button.disabled = false;
      return;
    }

    // Wake up service worker with a ping
    try {
      await chrome.runtime.sendMessage({ action: "ping" });
    } catch (e) {
      // Service worker might be starting up, wait a moment
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      status.innerHTML = '<div class="fh-info">🔍 Extracting all data...</div>';

      // 1. Get profile data using existing site-specific scrapers
      const profileData = this.scrapeProfileData();

      // 2. Get account data using account scraper
      let accountData = {};
      if (window.AccountScraper) {
        const accountScraper = new window.AccountScraper();
        accountData = await accountScraper.scrapeAccountData();
      }

      // 3. Combine both datasets with priority for account data
      const combinedData = {
        // First spread profile data
        ...profileData,
        // Then spread account data (overwrites profile data if same field)
        ...accountData,
        // Keep organized sections for reference
        profile_data: profileData,
        account_data: accountData,
        // Combined scraping info
        scraping_info: {
          profile_fields: Object.keys(profileData).filter(
            (key) =>
              !["source", "url", "scrapedAt", "method", "error"].includes(
                key
              ) && profileData[key]
          ).length,
          account_fields: Object.keys(accountData).filter(
            (key) =>
              !["source", "url", "scrapedAt", "method", "error"].includes(
                key
              ) && accountData[key]
          ).length,
          total_unique_fields: Object.keys({
            ...profileData,
            ...accountData,
          }).filter(
            (key) =>
              ![
                "source",
                "url",
                "scrapedAt",
                "method",
                "error",
                "profile_data",
                "account_data",
                "scraping_info",
              ].includes(key)
          ).length,
          scraped_at: new Date().toISOString(),
          data_priority: "account_data_overwrites_profile_data",
        },
      };

      // 4. Send combined data to background script
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: "saveScrapedData",
          data: {
            url: window.location.href,
            siteType: this.siteType,
            scrapedData: combinedData,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (connectionError) {
        // Service worker might be inactive, try to wake it up
        if (connectionError.message.includes("Receiving end does not exist")) {
          // Wait a moment and retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          response = await chrome.runtime.sendMessage({
            action: "saveScrapedData",
            data: {
              url: window.location.href,
              siteType: this.siteType,
              scrapedData: combinedData,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          throw connectionError;
        }
      }

      if (response && response.success) {
        const totalFields = combinedData.scraping_info.total_unique_fields;
        const profileFields = combinedData.scraping_info.profile_fields;
        const accountFields = combinedData.scraping_info.account_fields;

        // Show available fields in the response
        const availableFields = Object.keys(combinedData).filter(
          (key) =>
            ![
              "profile_data",
              "account_data",
              "scraping_info",
              "source",
              "url",
              "scrapedAt",
              "method",
              "error",
              "scraping_context",
            ].includes(key) &&
            combinedData[key] &&
            combinedData[key] !== ""
        );

        status.innerHTML = `<div class="fh-success">✅ Data saved locally!<br>📊 Profile: ${profileFields} | 👤 Account: ${accountFields}<br>📋 Available: ${availableFields.join(
          ", "
        )}</div>`;
        button.innerHTML = '<span class="fh-scrape-icon">✅</span> ✓';
      } else {
        throw new Error(response?.error || "Failed to save combined data");
      }
    } catch (error) {
      status.innerHTML = `<div class="fh-error">❌ Error: ${error.message}</div>`;
      button.innerHTML =
        '<span class="fh-scrape-icon">🔍</span> Scrape All Data';
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML =
          '<span class="fh-scrape-icon">🔍</span> Scrape All Data';
        status.innerHTML = "";
      }, 3000);
    }
  }

  // Extract profile data using existing site-specific methods
  scrapeProfileData() {
    let profileData = {};

    try {
      // 1. Use existing site-specific scraping methods first
      switch (this.siteType) {
        case "linkedin":
          profileData = this.scrapeLinkedIn();
          break;
        case "twitter":
          profileData = this.scrapeTwitter();
          break;
        case "github":
          profileData = this.scrapeGitHub();
          break;
        case "flipkart":
          profileData = this.scrapeFlipkart();
          break;
        default:
          profileData = this.scrapeGeneric();
      }

      // 2. Enhance with comprehensive DOM data extraction
      const comprehensiveData = this.scrapeComprehensiveDOM();

      // 3. Merge site-specific data with comprehensive data (site-specific takes priority)
      profileData = {
        ...comprehensiveData, // Comprehensive data first
        ...profileData, // Site-specific data overwrites
        // Keep original data for reference
        site_specific_data: profileData,
        comprehensive_data: comprehensiveData,
      };

      // 4. Clean and validate profile data
      profileData = this.cleanData(profileData);
    } catch (error) {
      profileData = {
        error: `Profile scraping failed: ${error.message}`,
        site: this.siteType,
      };
    }

    return profileData;
  }

  // Scrape logged-in user's account data
  async scrapeAccountData() {
    const button = document.getElementById("fh-account-btn");
    const status = document.getElementById("fh-scrape-status");

    // Show loading state
    button.disabled = true;
    button.innerHTML = '<span class="fh-scrape-icon">⏳</span> ...';
    status.innerHTML = "";

    // Check if extension is available and wake up service worker
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      status.innerHTML = '<div class="fh-error">❌ Extension not loaded</div>';
      button.innerHTML = '<span class="fh-scrape-icon">👤</span> Account';
      button.disabled = false;
      return;
    }

    // Wake up service worker with a ping
    try {
      await chrome.runtime.sendMessage({ action: "ping" });
    } catch (e) {
      // Service worker might be starting up, wait a moment
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      status.innerHTML =
        '<div class="fh-info">🔍 Extracting account data...</div>';

      // Initialize account scraper
      if (!window.AccountScraper) {
        throw new Error("AccountScraper not loaded");
      }

      const accountScraper = new window.AccountScraper();
      const accountData = await accountScraper.scrapeAccountData();

      // Send account data to background script
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: "saveAccountData",
          data: {
            url: window.location.href,
            siteType: this.siteType,
            accountData: accountData,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (connectionError) {
        // Service worker might be inactive, try to wake it up
        if (connectionError.message.includes("Receiving end does not exist")) {
          // Wait a moment and retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          response = await chrome.runtime.sendMessage({
            action: "saveAccountData",
            data: {
              url: window.location.href,
              siteType: this.siteType,
              accountData: accountData,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          throw connectionError;
        }
      }

      if (response && response.success) {
        const fields = Object.keys(accountData).filter(
          (key) =>
            !["source", "url", "scrapedAt", "method"].includes(key) &&
            accountData[key]
        ).length;
        status.innerHTML = `<div class="fh-success">✅ Saved ${fields} fields!</div>`;
        button.innerHTML = '<span class="fh-scrape-icon">✅</span> ✓';
      } else {
        throw new Error(response?.error || "Failed to save account data");
      }
    } catch (error) {
      status.innerHTML = `<div class="fh-error">❌ Error: ${error.message}</div>`;
      button.innerHTML = '<span class="fh-scrape-icon">👤</span> Account';
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = '<span class="fh-scrape-icon">👤</span> Account';
        status.innerHTML = "";
      }, 3000);
    }
  }

  // Scrape current page data
  async scrapeCurrentPage() {
    const button = document.getElementById("fh-scrape-btn");
    const status = document.getElementById("fh-scrape-status");

    // Show loading state
    button.disabled = true;
    button.innerHTML = '<span class="fh-scrape-icon">⏳</span> ...';
    status.innerHTML = "";

    // Check if extension is available and wake up service worker
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      status.innerHTML = '<div class="fh-error">❌ Extension not loaded</div>';
      button.innerHTML = '<span class="fh-scrape-icon">📊</span> Go';
      button.disabled = false;
      return;
    }

    // Wake up service worker with a ping
    try {
      await chrome.runtime.sendMessage({ action: "ping" });
    } catch (e) {
      // Service worker might be starting up, wait a moment
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      // Scrape data based on site type
      status.innerHTML = '<div class="fh-info">🔍 Scraping data...</div>';
      let scrapedData = {};

      switch (this.siteType) {
        case "linkedin":
          scrapedData = this.scrapeLinkedIn();
          break;
        case "twitter":
          scrapedData = this.scrapeTwitter();
          break;
        case "github":
          scrapedData = this.scrapeGitHub();
          break;
        case "flipkart":
          scrapedData = this.scrapeFlipkart();
          break;
        default:
          scrapedData = this.scrapeGeneric();
      }

      // Send scraped data to background script
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: "saveScrapedData",
          data: {
            url: window.location.href,
            siteType: this.siteType,
            scrapedData: scrapedData,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (connectionError) {
        // Service worker might be inactive, try to wake it up
        if (connectionError.message.includes("Receiving end does not exist")) {
          // Wait a moment and retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          response = await chrome.runtime.sendMessage({
            action: "saveScrapedData",
            data: {
              url: window.location.href,
              siteType: this.siteType,
              scrapedData: scrapedData,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          throw connectionError;
        }
      }

      if (response && response.success) {
        status.innerHTML = '<div class="fh-success">✅ Saved!</div>';
        button.innerHTML = '<span class="fh-scrape-icon">✅</span> ✓';
      } else {
        throw new Error(response?.error || "Failed to save data");
      }
    } catch (error) {
      status.innerHTML = `<div class="fh-error">❌ Error: ${error.message}</div>`;
      button.innerHTML = '<span class="fh-scrape-icon">📊</span> Go';
    } finally {
      button.disabled = false;
    }
  }

  // LinkedIn scraper
  scrapeLinkedIn() {
    const data = {};

    // Extract name from page title (most reliable)
    const pageTitle = document.title;
    if (pageTitle && pageTitle.includes(" | LinkedIn")) {
      const nameMatch = pageTitle.match(/^(.+?)\s*\|/);
      if (nameMatch) {
        data.full_name = nameMatch[1].trim().replace(/^\(\d+\)\s*/, ""); // Remove notification count
      }
    }

    // Try multiple selectors for headline/bio
    data.bio =
      this.getTextContent("h1.text-heading-xlarge") ||
      this.getTextContent(".text-body-medium.break-words") ||
      this.getTextContent(".pv-top-card-profile-picture__container + div h2");

    // Location
    data.address =
      this.getTextContent(
        ".text-body-small.inline.t-black--light.break-words"
      ) ||
      this.getTextContent(
        ".pv-top-card--list-bullet li:contains('location')"
      ) ||
      this.getTextContent("[data-field='location_text']");

    // About section
    const aboutSection =
      document.querySelector("#about") ||
      document.querySelector("[data-field='summary']");
    if (aboutSection) {
      const aboutText = aboutSection.parentElement
        ?.querySelector(".break-words")
        ?.textContent?.trim();
      if (aboutText && aboutText.length > data.bio?.length) {
        data.bio = aboutText;
      }
    }

    // Company from headline
    const headline = data.bio || "";
    const companyMatch = headline.match(/(?:at|@)\s+([A-Za-z0-9\s&.,'-]+)/i);
    if (companyMatch) {
      data.company = companyMatch[1].trim();
    }

    // Connections and followers from the connections section
    const connectionElements = document.querySelectorAll(
      ".pv-top-card--list-bullet span, .pv-top-card--list-bullet strong"
    );
    connectionElements.forEach((el) => {
      const text = el.textContent.trim();
      if (text.match(/^\d+$/)) {
        if (!data.connections) {
          data.connections = parseInt(text);
        } else if (!data.followers) {
          data.followers = parseInt(text);
        }
      }
    });

    // Profile picture
    const profileImg =
      document.querySelector("img.pv-top-card-profile-picture__image") ||
      document.querySelector("img[alt*='profile']") ||
      document.querySelector(".pv-top-card-profile-picture img");
    if (profileImg) {
      data.profile_picture_url = profileImg.src;
    }

    // Education from structured data
    const eduElements = document.querySelectorAll(
      "[data-field='education'] .pv-entity__summary-info, .education-section .pv-entity__summary-info"
    );
    if (eduElements.length > 0) {
      const education = [];
      eduElements.forEach((edu) => {
        const school = edu.querySelector("h3")?.textContent?.trim();
        const degree = edu
          .querySelector(".pv-entity__degree-name")
          ?.textContent?.trim();
        if (school) {
          education.push(degree ? `${degree} - ${school}` : school);
        }
      });
      if (education.length > 0) {
        data.education = education[0]; // Take the first/most recent
      }
    }

    return this.cleanData(data);
  }

  // Twitter scraper
  scrapeTwitter() {
    const data = {
      username: this.getTextContent('[data-testid="UserName"]'),
      displayName: this.getTextContent('[data-testid="UserName"] span'),
      bio: this.getTextContent('[data-testid="UserDescription"]'),
      location: this.getTextContent('[data-testid="UserLocation"]'),
      website: this.getTextContent('[data-testid="UserUrl"]'),
      joinDate: this.getTextContent('[data-testid="UserJoinDate"]'),
      following: this.getTextContent('[href*="/following"] span'),
      followers: this.getTextContent('[href*="/followers"] span'),
      tweets: this.getTextContent('[href*="/status"] span'),
    };

    return this.cleanData(data);
  }

  // GitHub scraper
  scrapeGitHub() {
    const data = {
      username: this.getTextContent(".p-nickname"),
      name: this.getTextContent(".p-name"),
      bio: this.getTextContent(".p-note"),
      location: this.getTextContent(".p-label"),
      website: this.getTextContent(".p-note a"),
      company: this.getTextContent(".p-org"),
      followers: this.getTextContent('[href*="/followers"] span'),
      following: this.getTextContent('[href*="/following"] span'),
      repositories: this.getTextContent('[href*="/repositories"] span'),
      stars: this.getTextContent('[href*="/stars"] span'),
    };

    return this.cleanData(data);
  }

  // Flipkart scraper
  scrapeFlipkart() {
    const url = window.location.href;

    // Check if this is an account/profile page
    if (url.includes("/account") || url.includes("/profile")) {
      return this.scrapeFlipkartAccount();
    } else {
      return this.scrapeFlipkartProduct();
    }
  }

  // Scrape Flipkart account/profile pages
  scrapeFlipkartAccount() {
    const data = {};

    // Extract name from input fields (first and last name)
    const firstNameInput = document.querySelector(
      'input[placeholder*="First"], input[value*="Ved"], input[name*="first"], input[id*="first"]'
    );
    const lastNameInput = document.querySelector(
      'input[placeholder*="Last"], input[value*="Tiwari"], input[name*="last"], input[id*="last"]'
    );

    if (firstNameInput && firstNameInput.value) {
      data.first_name = firstNameInput.value.trim();
    }
    if (lastNameInput && lastNameInput.value) {
      data.last_name = lastNameInput.value.trim();
    }

    // Combine first and last name
    if (data.first_name || data.last_name) {
      data.full_name = `${data.first_name || ""} ${
        data.last_name || ""
      }`.trim();
    }

    // Extract email from input field or text
    const emailInput = document.querySelector(
      'input[type="email"], input[placeholder*="email"], input[value*="@"]'
    );
    if (emailInput && emailInput.value) {
      data.email = emailInput.value.trim();
    } else {
      // Try to find email in text content
      const emailText = document.body.innerText.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );
      if (emailText) {
        data.email = emailText[0];
      }
    }

    // Extract phone number from input field or text
    const phoneInput = document.querySelector(
      'input[type="tel"], input[placeholder*="Mobile"], input[placeholder*="Phone"], input[value*="+91"]'
    );
    if (phoneInput && phoneInput.value) {
      data.phone = phoneInput.value.trim();
    } else {
      // Try to find phone in text content
      const phoneText = document.body.innerText.match(/\+91\d{10}|\d{10}/);
      if (phoneText) {
        data.phone = phoneText[0];
      }
    }

    // Extract gender from radio buttons or select
    const maleRadio = document.querySelector(
      'input[type="radio"][value="Male"], input[type="radio"]:checked'
    );
    const femaleRadio = document.querySelector(
      'input[type="radio"][value="Female"]'
    );
    if (maleRadio && maleRadio.checked) {
      data.gender = "Male";
    } else if (femaleRadio && femaleRadio.checked) {
      data.gender = "Female";
    }

    // Try to get any other personal info from form fields
    const allInputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"]'
    );
    allInputs.forEach((input) => {
      const value = input.value?.trim();
      const placeholder = input.placeholder?.toLowerCase();
      const name = input.name?.toLowerCase();

      if (value && value.length > 0) {
        // Map common field patterns
        if (
          (placeholder?.includes("email") || name?.includes("email")) &&
          !data.email
        ) {
          data.email = value;
        }
        if (
          (placeholder?.includes("phone") ||
            placeholder?.includes("mobile") ||
            name?.includes("phone")) &&
          !data.phone
        ) {
          data.phone = value;
        }
        if (
          (placeholder?.includes("first") || name?.includes("first")) &&
          !data.first_name
        ) {
          data.first_name = value;
        }
        if (
          (placeholder?.includes("last") || name?.includes("last")) &&
          !data.last_name
        ) {
          data.last_name = value;
        }
      }
    });

    // Get page info
    data.source_domain = "flipkart.com";
    data.scraped_at = new Date().toISOString();

    return this.cleanData(data);
  }

  // Scrape Flipkart product pages
  scrapeFlipkartProduct() {
    const data = {
      // Try multiple selectors for product name
      productName:
        this.getTextContent("h1[class*='B_NuCI']") ||
        this.getTextContent("h1 span") ||
        this.getTextContent("h1") ||
        document.title,

      // Try multiple selectors for price
      price:
        this.getTextContent("div[class*='_30jeq3']") ||
        this.getTextContent("div[class*='_25b18c']") ||
        this.getTextContent("[data-testid='Price']") ||
        this.getTextContent("div._30jeq3"),

      // Original price
      originalPrice:
        this.getTextContent("div[class*='_3I9_wc']") ||
        this.getTextContent("div[class*='_2MRP4d']"),

      // Basic page info
      url: window.location.href,
      title: document.title,
      pageType: this.detectFlipkartPageType(),

      // Get all headings
      headings: this.scrapeHeadings(),
    };

    return this.cleanData(data);
  }

  // Detect what type of Flipkart page this is
  detectFlipkartPageType() {
    const url = window.location.href;
    if (url.includes("/p/")) return "product";
    if (url.includes("/search")) return "search";
    if (url.includes("/category")) return "category";
    return "unknown";
  }

  scrapeFlipkartSpecs() {
    const specs = [];
    const specElements = document.querySelectorAll("div[class*='_1HmOnV']");

    specElements.forEach((spec) => {
      const key = spec
        .querySelector("div[class*='_1hKmbr']")
        ?.textContent?.trim();
      const value = spec
        .querySelector("div[class*='_21lJbe']")
        ?.textContent?.trim();
      if (key && value) {
        specs.push({ key, value });
      }
    });

    return specs;
  }

  scrapeFlipkartImages() {
    const images = [];
    const imgElements = document.querySelectorAll("img[class*='_396cs4']");

    imgElements.forEach((img) => {
      if (img.src && !img.src.includes("placeholder")) {
        images.push({
          src: img.src,
          alt: img.alt || "",
        });
      }
    });

    return images.slice(0, 5); // Limit to first 5 images
  }

  // Myntra scraper
  scrapeMyntra() {
    const data = {};

    // Extract data from Myntra's specific layout
    this.extractMyntraProfileData(data);

    // Fallback to generic extraction
    this.extractFromFormFields(data);
    this.extractFromTextContent(data);

    // Basic page info
    data.source_domain = "myntra.com";
    data.scraped_at = new Date().toISOString();

    return this.cleanData(data);
  }

  // Extract Myntra-specific profile data
  extractMyntraProfileData(data) {
    // Extract from table rows (like in your screenshot)
    const profileTable = document.querySelector("table.profile-infoTable");
    if (profileTable) {
      const rows = profileTable.querySelectorAll("tr");
      rows.forEach((row) => {
        const labelCell = row.querySelector("td:first-child");
        const valueCell = row.querySelector("td:last-child");

        if (labelCell && valueCell) {
          const label = labelCell.textContent?.trim().toLowerCase();
          const value = valueCell.textContent?.trim();

          if (!value || value === "- not added -") return;

          // Map Myntra-specific labels to standard fields
          if (label?.includes("full name")) {
            data.full_name = value;
            // Split into first and last name
            const nameParts = value.split(" ");
            if (nameParts.length >= 2) {
              data.first_name = nameParts[0];
              data.last_name = nameParts.slice(1).join(" ");
            }
          } else if (label?.includes("mobile number")) {
            data.phone = value;
          } else if (label?.includes("email id")) {
            data.email = value;
          } else if (label?.includes("gender")) {
            data.gender = value;
          } else if (label?.includes("date of birth")) {
            data.dob = value;
          } else if (label?.includes("location")) {
            data.address = value;
          } else if (label?.includes("alternate mobile")) {
            data.secondary_phone = value;
          } else if (label?.includes("hint name")) {
            if (!data.username) data.username = value;
          }
        }
      });
    }

    // Also try to extract from any visible text patterns
    const pageText = document.body.innerText;

    // Look for "Full Name: ved tiwari" patterns
    const fullNameMatch = pageText.match(/Full Name[:\s]+([A-Za-z\s]+)/i);
    if (fullNameMatch && !data.full_name) {
      data.full_name = fullNameMatch[1].trim();
      const nameParts = data.full_name.split(" ");
      if (nameParts.length >= 2) {
        data.first_name = nameParts[0];
        data.last_name = nameParts.slice(1).join(" ");
      }
    }

    // Look for "Mobile Number: 9340805774" patterns
    const mobileMatch = pageText.match(/Mobile Number[:\s]+(\+?[\d\s\-()]+)/i);
    if (mobileMatch && !data.phone) {
      data.phone = mobileMatch[1].trim();
    }

    // Look for "Email ID: email@domain.com" patterns
    const emailMatch = pageText.match(
      /Email ID[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    if (emailMatch && !data.email) {
      data.email = emailMatch[1].trim();
    }

    // Look for "Gender: MALE" patterns
    const genderMatch = pageText.match(
      /Gender[:\s]+(MALE|FEMALE|male|female)/i
    );
    if (genderMatch && !data.gender) {
      data.gender = genderMatch[1].trim();
    }
  }

  // Generic scraper
  scrapeGeneric() {
    const data = {};

    // Extract data from form fields (works for most account pages)
    this.extractFromFormFields(data);

    // Extract data from common text patterns
    this.extractFromTextContent(data);

    // Extract data from meta tags
    this.extractFromMetaTags(data);

    // Extract data from structured markup
    this.extractFromStructuredData(data);

    // Basic page info
    data.source_domain = window.location.hostname.replace("www.", "");
    data.scraped_at = new Date().toISOString();

    return this.cleanData(data);
  }

  // Extract personal data from form fields
  extractFromFormFields(data) {
    const inputs = document.querySelectorAll("input, select, textarea");

    inputs.forEach((input) => {
      const value = input.value?.trim();
      const placeholder = input.placeholder?.toLowerCase() || "";
      const name = input.name?.toLowerCase() || "";
      const id = input.id?.toLowerCase() || "";
      const label = input.labels?.[0]?.textContent?.toLowerCase() || "";

      if (!value || value.length === 0) return;

      // Name fields
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "first name",
          "firstname",
          "fname",
          "given name",
        ])
      ) {
        data.first_name = value;
      } else if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "last name",
          "lastname",
          "lname",
          "surname",
          "family name",
        ])
      ) {
        data.last_name = value;
      } else if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "full name",
          "name",
          "display name",
          "username",
        ]) &&
        !data.full_name
      ) {
        data.full_name = value;
      }

      // Email field
      if (
        input.type === "email" ||
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "email",
          "e-mail",
          "mail",
        ]) ||
        value.includes("@")
      ) {
        data.email = value;
      }

      // Phone field
      if (
        input.type === "tel" ||
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "phone",
          "mobile",
          "tel",
          "contact",
        ])
      ) {
        data.phone = value;
      }

      // Gender field
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "gender",
          "sex",
        ])
      ) {
        data.gender = value;
      }

      // Date of birth
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "dob",
          "date of birth",
          "birthday",
          "birth date",
        ])
      ) {
        data.dob = value;
      }

      // Address fields
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "address",
          "street",
          "location",
        ])
      ) {
        data.address = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "city",
        ])
      ) {
        data.city = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "state",
          "province",
          "region",
        ])
      ) {
        data.state = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "country",
          "nation",
        ])
      ) {
        data.country = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "zip",
          "postal",
          "pincode",
        ])
      ) {
        data.zip_code = value;
      }

      // Professional fields
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "company",
          "organization",
          "employer",
          "workplace",
        ])
      ) {
        data.company = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "title",
          "position",
          "role",
          "job",
          "designation",
        ])
      ) {
        data.role = value;
      }
      if (
        this.matchesPattern(placeholder + " " + name + " " + id + " " + label, [
          "bio",
          "about",
          "description",
          "summary",
        ])
      ) {
        data.bio = value;
      }
    });

    // Combine first and last name if available
    if (data.first_name && data.last_name && !data.full_name) {
      data.full_name = `${data.first_name} ${data.last_name}`;
    }
  }

  // Extract data from text content using patterns
  extractFromTextContent(data) {
    const bodyText = document.body.innerText;

    // Enhanced patterns for different field types
    if (!data.full_name) {
      const namePatterns = [
        /Full Name[:\s]+([A-Za-z\s]{2,50})/i,
        /Name[:\s]+([A-Za-z\s]{2,50})/i,
        /Profile Name[:\s]+([A-Za-z\s]{2,50})/i,
      ];
      for (const pattern of namePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.full_name = match[1].trim();
          // Split into first and last name
          const nameParts = data.full_name.split(" ");
          if (nameParts.length >= 2 && !data.first_name) {
            data.first_name = nameParts[0];
            data.last_name = nameParts.slice(1).join(" ");
          }
          break;
        }
      }
    }

    if (!data.email) {
      const emailPatterns = [
        /Email ID[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
        /Email[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      ];
      for (const pattern of emailPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.email = match[1] || match[0];
          break;
        }
      }
    }

    if (!data.phone) {
      const phonePatterns = [
        /Mobile Number[:\s]+(\+?[\d\s\-()]{10,15})/i,
        /Phone[:\s]+(\+?[\d\s\-()]{10,15})/i,
        /Contact[:\s]+(\+?[\d\s\-()]{10,15})/i,
        /(\+91\s?)?[6-9]\d{9}/,
        /\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/,
      ];
      for (const pattern of phonePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.phone = (match[1] || match[0]).replace(/[^\d+]/g, "");
          // Ensure it's a valid phone number length
          if (data.phone.length >= 10 && data.phone.length <= 15) {
            break;
          } else {
            delete data.phone;
          }
        }
      }
    }

    if (!data.gender) {
      const genderMatch = bodyText.match(
        /Gender[:\s]+(MALE|FEMALE|male|female|Male|Female)/i
      );
      if (genderMatch) {
        data.gender = genderMatch[1].trim();
      }
    }

    if (!data.dob) {
      const dobPatterns = [
        /Date of Birth[:\s]+([0-9\/\-\.]{8,12})/i,
        /DOB[:\s]+([0-9\/\-\.]{8,12})/i,
        /Birthday[:\s]+([0-9\/\-\.]{8,12})/i,
      ];
      for (const pattern of dobPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.dob = match[1].trim();
          break;
        }
      }
    }
  }

  // Extract data from meta tags
  extractFromMetaTags(data) {
    const metaTags = document.querySelectorAll("meta");
    metaTags.forEach((meta) => {
      const name = meta.name?.toLowerCase() || "";
      const property = meta.getAttribute("property")?.toLowerCase() || "";
      const content = meta.content?.trim();

      if (!content) return;

      if (
        (name.includes("author") || property.includes("author")) &&
        !data.full_name
      ) {
        data.full_name = content;
      }
      if (
        (name.includes("description") || property.includes("description")) &&
        !data.bio
      ) {
        data.bio = content;
      }
    });
  }

  // Extract structured data (JSON-LD, microdata)
  extractFromStructuredData(data) {
    // Try to find JSON-LD structured data
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    scripts.forEach((script) => {
      try {
        const json = JSON.parse(script.textContent);
        if (json["@type"] === "Person") {
          if (json.name && !data.full_name) data.full_name = json.name;
          if (json.email && !data.email) data.email = json.email;
          if (json.telephone && !data.phone) data.phone = json.telephone;
          if (json.jobTitle && !data.role) data.role = json.jobTitle;
          if (json.worksFor?.name && !data.company)
            data.company = json.worksFor.name;
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });
  }

  // Helper method to check if text matches any of the patterns
  matchesPattern(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  // Helper methods
  getTextContent(selector) {
    const element = document.querySelector(selector);
    return element ? element.textContent.trim() : "";
  }

  getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.getAttribute("content") : "";
  }

  scrapeExperience() {
    const experiences = [];
    const expElements = document.querySelectorAll(
      ".experience-item, .pv-entity__summary-info"
    );

    expElements.forEach((exp) => {
      experiences.push({
        title: this.getTextContent(".pv-entity__summary-info h3", exp),
        company: this.getTextContent(".pv-entity__secondary-title", exp),
        duration: this.getTextContent(".pv-entity__dates", exp),
        description: this.getTextContent(".pv-entity__description", exp),
      });
    });

    return experiences;
  }

  scrapeEducation() {
    const education = [];
    const eduElements = document.querySelectorAll(
      ".education-item, .pv-entity__summary-info"
    );

    eduElements.forEach((edu) => {
      education.push({
        school: this.getTextContent(".pv-entity__school-name", edu),
        degree: this.getTextContent(".pv-entity__degree-name", edu),
        field: this.getTextContent(".pv-entity__fos", edu),
        duration: this.getTextContent(".pv-entity__dates", edu),
      });
    });

    return education;
  }

  scrapeHeadings() {
    const headings = [];
    const headingElements = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

    headingElements.forEach((heading) => {
      headings.push({
        level: heading.tagName,
        text: heading.textContent.trim(),
      });
    });

    return headings;
  }

  scrapeLinks() {
    const links = [];
    const linkElements = document.querySelectorAll("a[href]");

    linkElements.forEach((link) => {
      links.push({
        text: link.textContent.trim(),
        href: link.href,
      });
    });

    return links.slice(0, 20); // Limit to first 20 links
  }

  scrapeImages() {
    const images = [];
    const imgElements = document.querySelectorAll("img[src]");

    imgElements.forEach((img) => {
      images.push({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
      });
    });

    return images.slice(0, 10); // Limit to first 10 images
  }

  cleanData(data) {
    // Remove empty values and clean up data
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== "" && value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length > 0) {
          cleaned[key] = value;
        } else if (!Array.isArray(value)) {
          cleaned[key] = value;
        }
      }
    }

    // Ensure we always have at least some basic data
    if (Object.keys(cleaned).length === 0) {
      cleaned.url = window.location.href;
      cleaned.title = document.title || "No title";
      cleaned.domain = window.location.hostname;
      cleaned.timestamp = new Date().toISOString();
      cleaned.scraped = true;
    }

    return cleaned;
  }

  // Setup message listener
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "scrapePage") {
        this.scrapeCurrentPage();
        sendResponse({ success: true });
      } else if (request.action === "triggerScrape") {
        // Trigger scraping from popup
        this.scrapeCurrentPage()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // Async response
      } else if (request.action === "getScrapedData") {
        // Return current scraped data for template preview
        this.getScrapedDataForPreview()
          .then((data) => {
            sendResponse({ success: true, data });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // Async response
      }
    });
  }

  // Get scraped data for template preview (without saving)
  async getScrapedDataForPreview() {
    let scrapedData = {};

    switch (this.siteType) {
      case "linkedin":
        scrapedData = this.scrapeLinkedIn();
        break;
      case "twitter":
        scrapedData = this.scrapeTwitter();
        break;
      case "github":
        scrapedData = this.scrapeGitHub();
        break;
      case "flipkart":
        scrapedData = this.scrapeFlipkart();
        break;
      case "myntra":
        scrapedData = this.scrapeMyntra();
        break;
      default:
        scrapedData = this.scrapeGeneric();
    }

    return {
      url: window.location.href,
      siteType: this.siteType,
      scrapedData: scrapedData,
      timestamp: new Date().toISOString(),
    };
  }

  // Comprehensive DOM data extraction using patterns and regex
  scrapeComprehensiveDOM() {
    const data = {};

    try {
      // 1. Extract all text content and analyze with regex patterns
      const textData = this.extractTextPatterns();
      Object.assign(data, textData);

      // 2. Extract structured data from common HTML patterns
      const structuredData = this.extractStructuredData();
      Object.assign(data, structuredData);

      // 3. Extract metadata and hidden data
      const metaData = this.extractMetadata();
      Object.assign(data, metaData);

      // 4. Extract form data and input values
      const formData = this.extractFormData();
      Object.assign(data, formData);

      // 5. Extract link and image data
      const mediaData = this.extractMediaData();
      Object.assign(data, mediaData);

      // 6. Extract JSON-LD and microdata
      const schemaData = this.extractSchemaData();
      Object.assign(data, schemaData);

      // 7. Site-specific comprehensive extraction
      const siteSpecificData = this.extractSiteSpecificComprehensive();
      Object.assign(data, siteSpecificData);
    } catch (error) {
      data.extraction_error = error.message;
    }

    return data;
  }

  // Extract data using regex patterns on all text content
  extractTextPatterns() {
    const data = {};
    const bodyText = document.body.innerText || "";
    const htmlContent = document.documentElement.innerHTML || "";

    // Comprehensive regex patterns for different data types
    const patterns = {
      // Contact Information
      emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phones:
        /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}|\+91[-.\s]?[0-9]{10}|\+[0-9]{1,3}[-.\s]?[0-9]{4,14}/g,
      urls: /https?:\/\/[^\s<>"']+/g,

      // Personal Information
      names: /(?:Name|Full Name|Display Name)[:\s]*([A-Za-z\s]{2,50})/gi,
      titles: /(?:Title|Position|Role|Job Title)[:\s]*([A-Za-z\s]{2,100})/gi,
      companies:
        /(?:Company|Organization|Employer|Work at)[:\s]*([A-Za-z0-9\s&.,'-]{2,100})/gi,
      locations:
        /(?:Location|Address|City|Based in)[:\s]*([A-Za-z\s,.-]{2,100})/gi,

      // Social Media
      linkedinUrls: /linkedin\.com\/in\/[a-zA-Z0-9-]+/g,
      twitterHandles: /@[A-Za-z0-9_]+/g,
      githubUrls: /github\.com\/[a-zA-Z0-9-]+/g,

      // Professional Information
      skills:
        /(?:Skills|Expertise|Technologies)[:\s]*([A-Za-z0-9\s,.-]{2,200})/gi,
      experience:
        /(?:Experience|Years|Work History)[:\s]*([A-Za-z0-9\s,.-]{2,200})/gi,
      education:
        /(?:Education|Degree|University|College)[:\s]*([A-Za-z0-9\s,.-]{2,200})/gi,

      // Numbers and Metrics
      followers: /(?:Followers?|Following)[:\s]*([0-9,KMB.]+)/gi,
      connections: /(?:Connections?|Network)[:\s]*([0-9,KMB.]+)/gi,
      ratings: /(?:Rating|Stars?|Score)[:\s]*([0-9.]+)/gi,

      // Dates
      dates:
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/gi,

      // Financial
      prices: /[$£€¥₹]\s*[0-9,]+\.?[0-9]*/g,
      currencies: /\b(?:USD|EUR|GBP|INR|JPY)\s*[0-9,]+\.?[0-9]*/gi,
    };

    // Extract matches for each pattern
    Object.keys(patterns).forEach((key) => {
      const matches = [
        ...new Set([
          ...(bodyText.match(patterns[key]) || []),
          ...(htmlContent.match(patterns[key]) || []),
        ]),
      ];

      if (matches.length > 0) {
        // Clean and filter matches - remove noise
        data[key] = matches
          .map((match) => match.trim())
          .filter((match) => {
            // Remove empty or too long matches
            if (match.length === 0 || match.length > 500) return false;

            // Remove obvious noise patterns
            if (key === "emails") {
              // Filter out image filenames and CSS values that match email pattern
              return (
                !match.includes(".png") &&
                !match.includes(".jpg") &&
                !match.includes(".svg") &&
                !match.includes("@2x") &&
                !match.includes("@1x") &&
                !match.includes("@media") &&
                !match.includes("@keyframes") &&
                match.includes(".")
              );
            }

            if (key === "phones") {
              // Filter out CSS timestamps and random numbers
              return (
                match.length >= 10 &&
                !match.startsWith("17") && // Remove epoch-like timestamps
                !match.startsWith("16") &&
                !match.startsWith("20") &&
                !match.startsWith("12") &&
                (match.includes("+") ||
                  match.includes("(") ||
                  match.includes("-"))
              );
            }

            if (key === "names") {
              // Filter out CSS properties and generic text
              return (
                !match.toLowerCase().includes("rotate") &&
                !match.toLowerCase().includes("position") &&
                !match.toLowerCase().includes("namespace") &&
                !match.toLowerCase().includes("visibility") &&
                match.length >= 3 &&
                match.length <= 50
              );
            }

            if (key === "urls") {
              // Filter out static asset URLs
              return (
                !match.includes("static.licdn.com") &&
                !match.includes("gstatic.com") &&
                !match.includes(".js") &&
                !match.includes(".css") &&
                !match.includes("/sc/h/")
              );
            }

            return true;
          })
          .slice(0, 5); // Limit to top 5 matches per type
      }
    });

    return data;
  }

  // Extract structured data from common HTML patterns
  extractStructuredData() {
    const data = {};

    // Common data attribute patterns
    const dataAttributes = [
      "data-name",
      "data-title",
      "data-email",
      "data-phone",
      "data-company",
      "data-location",
      "data-url",
      "data-id",
      "data-username",
      "data-handle",
      "data-profile",
    ];

    dataAttributes.forEach((attr) => {
      const elements = document.querySelectorAll(`[${attr}]`);
      if (elements.length > 0) {
        const values = Array.from(elements)
          .map((el) => el.getAttribute(attr))
          .filter((val) => val && val.trim().length > 0)
          .slice(0, 5);

        if (values.length > 0) {
          data[attr.replace("data-", "") + "_attributes"] = values;
        }
      }
    });

    // Common class name patterns for data extraction
    const classPatterns = [
      { pattern: /name/i, key: "name_elements" },
      { pattern: /title|headline/i, key: "title_elements" },
      { pattern: /email/i, key: "email_elements" },
      { pattern: /phone|mobile/i, key: "phone_elements" },
      { pattern: /company|organization/i, key: "company_elements" },
      { pattern: /location|address/i, key: "location_elements" },
      { pattern: /bio|about|description/i, key: "bio_elements" },
      { pattern: /skill|expertise/i, key: "skill_elements" },
      { pattern: /follower|connection/i, key: "social_elements" },
    ];

    classPatterns.forEach(({ pattern, key }) => {
      const elements = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const className = el.className.toString();
          const id = el.id || "";
          return pattern.test(className) || pattern.test(id);
        })
        .slice(0, 10);

      if (elements.length > 0) {
        const texts = elements
          .map((el) => el.textContent?.trim())
          .filter((text) => text && text.length > 0 && text.length < 300)
          .slice(0, 5);

        if (texts.length > 0) {
          data[key] = texts;
        }
      }
    });

    return data;
  }

  // Extract metadata and hidden data
  extractMetadata() {
    const data = {};

    // Meta tags
    const metaTags = document.querySelectorAll("meta[name], meta[property]");
    metaTags.forEach((meta) => {
      const name = meta.getAttribute("name") || meta.getAttribute("property");
      const content = meta.getAttribute("content");

      if (name && content && content.length < 500) {
        // Filter relevant meta tags
        if (
          name.match(/title|description|author|keywords|og:|twitter:|profile/i)
        ) {
          data[`meta_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`] =
            content;
        }
      }
    });

    // Title and description
    data.page_title = document.title;

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      data.page_description = description.getAttribute("content");
    }

    // Canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      data.canonical_url = canonical.getAttribute("href");
    }

    return data;
  }

  // Extract form data and input values
  extractFormData() {
    const data = {};

    // Input fields with values
    const inputs = document.querySelectorAll(
      'input[value]:not([type="password"]):not([type="hidden"])'
    );
    const inputData = {};

    inputs.forEach((input, index) => {
      const name = input.name || input.id || `input_${index}`;
      const value = input.value;
      const type = input.type;

      if (value && value.length > 0 && value.length < 200) {
        inputData[`${name}_${type}`] = value;
      }
    });

    if (Object.keys(inputData).length > 0) {
      data.form_data = inputData;
    }

    // Select options
    const selects = document.querySelectorAll("select option[selected]");
    if (selects.length > 0) {
      data.selected_options = Array.from(selects)
        .map((option) => option.textContent?.trim())
        .filter((text) => text && text.length > 0);
    }

    return data;
  }

  // Extract link and image data
  extractMediaData() {
    const data = {};

    // Profile images
    const images = document.querySelectorAll(
      'img[src*="profile"], img[src*="avatar"], img[alt*="profile"], img[alt*="photo"]'
    );
    if (images.length > 0) {
      data.profile_images = Array.from(images)
        .map((img) => img.src)
        .filter((src) => src && src.startsWith("http"))
        .slice(0, 5);
    }

    // External links
    const externalLinks = document.querySelectorAll(
      'a[href^="http"]:not([href*="' + window.location.hostname + '"])'
    );
    if (externalLinks.length > 0) {
      data.external_links = Array.from(externalLinks)
        .map((link) => ({
          url: link.href,
          text: link.textContent?.trim(),
        }))
        .filter(
          (link) => link.text && link.text.length > 0 && link.text.length < 100
        )
        .slice(0, 10);
    }

    return data;
  }

  // Extract JSON-LD and microdata
  extractSchemaData() {
    const data = {};

    // JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    jsonLdScripts.forEach((script, index) => {
      try {
        const jsonData = JSON.parse(script.textContent);
        data[`schema_data_${index}`] = jsonData;
      } catch (e) {
        // Ignore invalid JSON
      }
    });

    // Microdata
    const microdataElements = document.querySelectorAll("[itemscope]");
    if (microdataElements.length > 0) {
      const microdata = [];
      microdataElements.forEach((element) => {
        const itemType = element.getAttribute("itemtype");
        const properties = {};

        const propElements = element.querySelectorAll("[itemprop]");
        propElements.forEach((propEl) => {
          const prop = propEl.getAttribute("itemprop");
          const value =
            propEl.getAttribute("content") || propEl.textContent?.trim();
          if (prop && value) {
            properties[prop] = value;
          }
        });

        if (Object.keys(properties).length > 0) {
          microdata.push({ type: itemType, properties });
        }
      });

      if (microdata.length > 0) {
        data.microdata = microdata;
      }
    }

    return data;
  }

  // Site-specific comprehensive extraction
  extractSiteSpecificComprehensive() {
    const data = {};
    const hostname = window.location.hostname.toLowerCase();

    // Site-specific selectors and patterns
    const siteConfigs = {
      "linkedin.com": {
        selectors: {
          profile_name: ".text-heading-xlarge, .pv-text-details__left-panel h1",
          headline:
            ".text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium",
          location:
            ".text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small",
          about: ".pv-about-section .full-width .text-body-medium.break-words",
          experience:
            ".pv-profile-section.experience-section .pv-entity__summary-info",
          education:
            ".pv-profile-section.education-section .pv-entity__summary-info",
          skills: ".pv-skill-category-entity__name-text",
          connections: ".t-16.t-black.t-normal span",
        },
      },
      "github.com": {
        selectors: {
          username: ".p-nickname.vcard-username",
          name: ".p-name.vcard-fullname",
          bio: ".p-note.user-profile-bio",
          location: ".p-label",
          company: ".p-org",
          website: ".Link--primary",
          repositories: ".Counter",
          followers: ".Link--secondary span",
        },
      },
      "twitter.com": {
        selectors: {
          username: '[data-testid="UserName"]',
          handle: '[data-testid="UserScreenName"]',
          bio: '[data-testid="UserDescription"]',
          location: '[data-testid="UserLocation"]',
          website: '[data-testid="UserUrl"]',
          followers: '[href$="/followers"] span',
          following: '[href$="/following"] span',
        },
      },
    };

    // Apply site-specific extraction
    Object.keys(siteConfigs).forEach((site) => {
      if (hostname.includes(site)) {
        const config = siteConfigs[site];
        Object.keys(config.selectors).forEach((key) => {
          const selector = config.selectors[key];
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const values = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 0 && text.length < 500)
              .slice(0, 3);

            if (values.length > 0) {
              data[`${site.replace(".com", "")}_${key}`] =
                values.length === 1 ? values[0] : values;
            }
          }
        });
      }
    });

    return data;
  }
}

// Initialize scraper when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Wait for extension to be ready
    setTimeout(() => new DataScraper(), 1000);
  });
} else {
  // Wait for extension to be ready
  setTimeout(() => new DataScraper(), 1000);
}
