/**
 * Schema Mapper Utility
 * Maps raw scraped data to standardized field names using regex patterns
 */

// Predefined mapping of regex patterns to standard fields
const userFieldRegexMap = {
  full_name: /\b(full[\s_]*name|name|account[\s_]*name|profile[\s_]*name)\b/i,
  first_name: /\b(first[\s_]*name|fname|given[\s_]*name)\b/i,
  last_name: /\b(last[\s_]*name|lname|surname|family[\s_]*name)\b/i,
  username: /\b(user[\s_]*name|handle|login[\s_]*id|screen[\s_]*name|hint[\s_]*name)\b/i,

  email: /\b(e[\s_]*mail|email[\s_]*address|mail[\s_]*id)\b/i,

  phone: /\b(phone|mobile|mobile[\s_]*number|contact[\s_]*number|cell)\b/i,
  secondary_email: /\b(alt[\s_]*email|backup[\s_]*email|secondary[\s_]*email)\b/i,
  secondary_phone:
    /\b(alt[\s_]*phone|backup[\s_]*phone|secondary[\s_]*phone|alternate[\s_]*mobile)\b/i,

  address: /\b(address|street|residence|location)\b/i,
  city: /\b(city|town)\b/i,
  state: /\b(state|province|region)\b/i,
  country: /\b(country|nation)\b/i,
  zip_code: /\b(zip|postal[\s_]*code|pincode)\b/i,

  profile_url: /\b(profile[\s_]*url|account[\s_]*url|link|website)\b/i,
  profile_picture_url: /\b(profile[\s_]*pic|avatar|photo|image[\s_]*url)\b/i,

  bio: /\b(bio|about|description|headline|summary)\b/i,
  company: /\b(company|organization|employer|workplace)\b/i,
  role: /\b(role|designation|position|title|job)\b/i,
  industry: /\b(industry|sector|domain)\b/i,
  education: /\b(education|school|college|university|degree)\b/i,

  dob: /\b(dob|birth[\s_]*date|birthday|date[\s_]*of[\s_]*birth)\b/i,
  gender: /\b(gender|sex)\b/i,

  followers: /\b(followers|fans)\b/i,
  following: /\b(following|subscriptions)\b/i,
  connections: /\b(connections|contacts|network)\b/i,
  friends_count: /\b(friends|friend[\s_]*count)\b/i,
  likes_count: /\b(likes|hearts|upvotes)\b/i,

  joined_date: /\b(joined|created[\s_]*at|registration[\s_]*date)\b/i,
  last_login: /\b(last[\s_]*login|last[\s_]*active|recent[\s_]*login)\b/i,
  source_domain: /\b(domain|source|website)\b/i,
  scraped_at: /\b(scraped[\s_]*at|captured[\s_]*at|timestamp)\b/i,
  scraper_version: /\b(scraper[\s_]*version|extension[\s_]*version)\b/i,
};

/**
 * Maps raw scraped data to standardized schema fields
 * @param {Record<string, any>} rawData - Raw scraped data with unknown key names
 * @returns {Record<string, any>} - Normalized object with ONLY standard field names
 */
function mapToSchema(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return {};
  }

  const normalizedData = {};
  const processedKeys = new Set();

  // Get all raw data keys
  const rawKeys = Object.keys(rawData);

  // ONLY process fields that are defined in userFieldRegexMap
  Object.keys(userFieldRegexMap).forEach((standardField) => {
    const regex = userFieldRegexMap[standardField];
    let bestMatch = null;
    let bestMatchScore = 0;

    // Find the best matching raw key for this standard field
    rawKeys.forEach((rawKey) => {
      if (processedKeys.has(rawKey)) {
        return; // Skip already processed keys
      }

      if (regex.test(rawKey)) {
        // Calculate match score (more specific matches get higher scores)
        const matchScore = calculateMatchScore(rawKey, regex, standardField);

        if (matchScore > bestMatchScore) {
          bestMatch = rawKey;
          bestMatchScore = matchScore;
        }
      }
    });

    // If we found a match, use it
    if (bestMatch && rawData[bestMatch] != null) {
      const value = rawData[bestMatch];

      // Only include non-empty values
      if (isValidValue(value)) {
        const cleanedValue = cleanValue(value, standardField);
        // Only add if cleaning didn't return null
        if (cleanedValue != null) {
          normalizedData[standardField] = cleanedValue;
          processedKeys.add(bestMatch);
        }
      }
    }
  });

  // Return ONLY the fields from userFieldRegexMap - no extra fields
  return normalizedData;
}

/**
 * Calculates a match score for prioritizing more specific matches
 * @param {string} rawKey - The raw key being tested
 * @param {RegExp} regex - The regex pattern
 * @param {string} standardField - The standard field name
 * @returns {number} - Match score (higher = better match)
 */
function calculateMatchScore(rawKey, regex, standardField) {
  let score = 1;

  // Exact matches get highest priority
  if (rawKey.toLowerCase() === standardField.toLowerCase()) {
    score += 100;
  }

  // More specific fields get higher priority
  const specificityBonus = {
    first_name: 50,
    last_name: 50,
    secondary_email: 40,
    secondary_phone: 40,
    profile_picture_url: 30,
    profile_url: 30,
    friends_count: 20,
    likes_count: 20,
    zip_code: 20,
  };

  if (specificityBonus[standardField]) {
    score += specificityBonus[standardField];
  }

  // Shorter keys that match are often more specific
  score += Math.max(0, 20 - rawKey.length);

  // Keys without special characters are preferred
  if (!/[_\-\s]/.test(rawKey)) {
    score += 5;
  }

  return score;
}

/**
 * Checks if a value is valid (not empty, null, undefined)
 * @param {any} value - Value to check
 * @returns {boolean} - Whether the value is valid
 */
function isValidValue(value) {
  if (value == null || value === "") {
    return false;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Filter out obvious noise
    if (trimmed.length === 0) return false;
    if (trimmed.length > 200) return false; // Too long to be useful

    // Filter out CSS/JS patterns
    if (
      trimmed.includes("position:") ||
      trimmed.includes("@keyframes") ||
      trimmed.includes("@media") ||
      trimmed.includes("@2x") ||
      trimmed.includes("@1x") ||
      trimmed.includes(".svg") ||
      trimmed.includes(".png") ||
      trimmed.includes(".jpg")
    ) {
      return false;
    }

    // Filter out random technical strings
    if (trimmed.match(/^[0-9]{10,}$/)) return false; // Long numbers
    if (trimmed.match(/^[a-f0-9]{32,}$/i)) return false; // Hash-like strings

    return trimmed.length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.some((item) => isValidValue(item));
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return true;
}

/**
 * Cleans and normalizes values based on field type
 * @param {any} value - Raw value to clean
 * @param {string} fieldName - Standard field name
 * @returns {any} - Cleaned value
 */
function cleanValue(value, fieldName) {
  if (value == null) {
    return value;
  }

  // Convert arrays to strings for most fields (except specific ones)
  if (Array.isArray(value)) {
    const arrayFields = ["education", "industry", "bio"];
    if (arrayFields.includes(fieldName)) {
      const validItems = value.filter((item) => {
        if (!isValidValue(item)) return false;

        // For education, filter out random text that doesn't look like education
        if (fieldName === "education") {
          const itemStr = String(item).toLowerCase();
          // Skip items that look like random product descriptions or marketing text
          if (
            itemStr.includes("college cool") ||
            itemStr.includes("college favourites") ||
            itemStr.includes("slim-fit") ||
            itemStr.includes("washed denims") ||
            itemStr.length < 10
          ) {
            return false;
          }
          // Only keep items that look like actual education
          return (
            itemStr.includes("university") ||
            itemStr.includes("college") ||
            itemStr.includes("school") ||
            itemStr.includes("degree") ||
            itemStr.includes("bachelor") ||
            itemStr.includes("master") ||
            itemStr.includes("phd") ||
            itemStr.includes("diploma")
          );
        }

        return true;
      });

      return validItems.length > 0 ? validItems : null;
    } else {
      // For single-value fields, take the first valid item
      const firstValid = value.find((item) => isValidValue(item));
      return firstValid != null ? cleanValue(firstValid, fieldName) : null;
    }
  }

  // String cleaning
  if (typeof value === "string") {
    let cleaned = value.trim();

    // Clean phone numbers
    if (fieldName === "phone" || fieldName === "secondary_phone") {
      cleaned = cleaned.replace(/[^\d+\-\s()]/g, "");

      // Validate phone format - must be at least 10 digits
      const digitsOnly = cleaned.replace(/[^\d]/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return null; // Invalid phone length
      }

      // Filter out obvious timestamps and random numbers
      if (
        digitsOnly.startsWith("17") ||
        digitsOnly.startsWith("16") ||
        digitsOnly.startsWith("20") ||
        digitsOnly.startsWith("12")
      ) {
        // These look like timestamps, not phone numbers
        if (digitsOnly.length === 10 || digitsOnly.length === 13) {
          return null;
        }
      }
    }

    // Clean email addresses
    if (fieldName === "email" || fieldName === "secondary_email") {
      cleaned = cleaned.toLowerCase();

      // Validate email format
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleaned)) {
        return null; // Invalid email format
      }

      // Filter out common non-email patterns
      if (
        cleaned.includes(".png") ||
        cleaned.includes(".jpg") ||
        cleaned.includes(".svg") ||
        cleaned.includes("@2x") ||
        cleaned.includes("@1x")
      ) {
        return null;
      }
    }

    // Clean URLs
    if (fieldName === "profile_url" || fieldName === "profile_picture_url") {
      if (cleaned && !cleaned.startsWith("http")) {
        cleaned = "https://" + cleaned;
      }
    }

    // Clean numeric fields
    const numericFields = ["followers", "following", "connections", "friends_count", "likes_count"];
    if (numericFields.includes(fieldName)) {
      // Only process if it looks like a number
      const numMatch = cleaned.match(/^\d+[\.,]?\d*[KMB]?[\+]?$/i);
      if (numMatch) {
        let num = cleaned.replace(/[^\d\.KMB]/gi, "");

        // Handle K, M, B suffixes
        if (num.toLowerCase().includes("k")) {
          num = parseFloat(num.replace(/k/gi, "")) * 1000;
        } else if (num.toLowerCase().includes("m")) {
          num = parseFloat(num.replace(/m/gi, "")) * 1000000;
        } else if (num.toLowerCase().includes("b")) {
          num = parseFloat(num.replace(/b/gi, "")) * 1000000000;
        } else {
          num = parseFloat(num);
        }

        return Math.floor(num);
      } else {
        // If it doesn't look like a number, return null
        return null;
      }
    }

    return cleaned;
  }

  // Return numbers and other types as-is
  return value;
}

/**
 * Enhanced mapping function that also handles nested objects
 * @param {Record<string, any>} rawData - Raw scraped data
 * @param {number} maxDepth - Maximum depth to traverse (default: 3)
 * @returns {Record<string, any>} - Normalized object with ONLY schema fields
 */
function mapToSchemaDeep(rawData, maxDepth = 3) {
  if (!rawData || typeof rawData !== "object" || maxDepth <= 0) {
    return {};
  }

  // First, map the top-level object
  let normalizedData = mapToSchema(rawData);

  // Then, recursively process nested objects
  Object.keys(rawData).forEach((key) => {
    const value = rawData[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedMapped = mapToSchemaDeep(value, maxDepth - 1);

      // Merge nested results, but don't override existing fields
      // ONLY add fields that are in userFieldRegexMap
      Object.keys(nestedMapped).forEach((nestedKey) => {
        if (
          !normalizedData.hasOwnProperty(nestedKey) &&
          userFieldRegexMap.hasOwnProperty(nestedKey)
        ) {
          normalizedData[nestedKey] = nestedMapped[nestedKey];
        }
      });
    }
  });

  // Final filter: ensure we ONLY return fields from userFieldRegexMap
  const finalData = {};
  Object.keys(userFieldRegexMap).forEach((schemaField) => {
    if (normalizedData.hasOwnProperty(schemaField)) {
      finalData[schemaField] = normalizedData[schemaField];
    }
  });

  return finalData;
}

// Make functions globally available
(function () {
  const globalScope = typeof window !== "undefined" ? window : self;
  globalScope.mapToSchema = mapToSchema;
  globalScope.mapToSchemaDeep = mapToSchemaDeep;
  globalScope.userFieldRegexMap = userFieldRegexMap;
})();
