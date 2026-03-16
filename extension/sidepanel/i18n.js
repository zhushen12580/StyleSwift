/**
 * StyleSwift - i18n Helper Module
 * 
 * Provides internationalization utilities for the extension.
 * Uses Chrome's built-in i18n system with automatic language detection.
 * 
 * Usage:
 * - In HTML: data-i18n="messageKey" for text, data-i18n-placeholder="messageKey" for placeholders
 * - In JS: i18n.getMessage('messageKey') or i18n.getMessage('messageKey', substitutions)
 */

/**
 * Get a localized message from the i18n system
 * @param {string} key - The message key (from messages.json)
 * @param {string|string[]} [substitutions] - Optional substitutions for placeholders
 * @returns {string} - The localized message or the key if not found
 */
export function getMessage(key, substitutions) {
  try {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch (error) {
    console.warn(`[i18n] Failed to get message for key "${key}":`, error);
    return key;
  }
}

/**
 * Get a localized message with plural handling
 * @param {string} key - The base message key
 * @param {number} count - The count for pluralization
 * @param {Object} [substitutions] - Additional substitutions
 * @returns {string} - The localized message
 */
export function getPluralMessage(key, count, substitutions = {}) {
  const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
  const message = getMessage(pluralKey, { ...substitutions, count });
  
  // If no plural form found, try the base key
  if (message === pluralKey) {
    return getMessage(key, { ...substitutions, count });
  }
  
  return message;
}

/**
 * Apply i18n translations to all elements with data-i18n attributes
 * Call this after DOM is loaded
 */
export function applyTranslations() {
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const message = getMessage(key);
      if (message !== key) {
        element.textContent = message;
      }
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key) {
      const message = getMessage(key);
      if (message !== key) {
        element.setAttribute('placeholder', message);
      }
    }
  });

  // Translate title attributes
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title');
    if (key) {
      const message = getMessage(key);
      if (message !== key) {
        element.setAttribute('title', message);
      }
    }
  });

  // Translate aria-label attributes
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.getAttribute('data-i18n-aria-label');
    if (key) {
      const message = getMessage(key);
      if (message !== key) {
        element.setAttribute('aria-label', message);
      }
    }
  });

  // Update HTML lang attribute
  const lang = getUILanguage();
  document.documentElement.setAttribute('lang', lang);
}

/**
 * Get the current UI language
 * @returns {string} - The UI language code (e.g., 'en', 'zh-CN')
 */
export function getUILanguage() {
  try {
    return chrome.i18n.getUILanguage();
  } catch (error) {
    console.warn('[i18n] Failed to get UI language:', error);
    return 'en';
  }
}

/**
 * Check if the current language is Chinese
 * @returns {boolean}
 */
export function isChineseLanguage() {
  const lang = getUILanguage();
  return lang.startsWith('zh');
}

/**
 * Get the current locale string
 * @returns {string} - The locale string (e.g., 'en', 'zh_CN')
 */
export function getLocale() {
  const lang = getUILanguage();
  // Normalize: 'zh-CN' -> 'zh_CN', 'zh-TW' -> 'zh_TW'
  return lang.replace('-', '_');
}

/**
 * Initialize i18n system
 * Should be called once at app startup
 */
export function initI18n() {
  // Apply translations on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
  
  console.log(`[i18n] Initialized with language: ${getUILanguage()}`);
}

/**
 * Format a message with substitutions
 * @param {string} key - The message key
 * @param {Object} params - Substitution parameters
 * @returns {string} - The formatted message
 */
export function formatMessage(key, params) {
  let message = getMessage(key);
  
  // Replace {placeholder} with params values
  Object.entries(params).forEach(([placeholder, value]) => {
    message = message.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value));
  });
  
  return message;
}

// Create a default export object for convenience
export default {
  getMessage,
  getPluralMessage,
  applyTranslations,
  getUILanguage,
  isChineseLanguage,
  getLocale,
  initI18n,
  formatMessage,
};