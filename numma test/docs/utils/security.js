/**
 * ========================================
 * NUMMA - SECURITY UTILITIES v3.0
 * ========================================
 * Centralized security functions for XSS prevention,
 * CSRF protection, and secure token management
 * 
 * MUST BE LOADED BEFORE ANY OTHER MODULE
 */

(function() {
    'use strict';

    console.log('🔒 Loading NUMMA Security Utilities...');

    // =====================================================
    // XSS PREVENTION
    // =====================================================

    /**
     * Escape HTML to prevent XSS attacks
     * @param {string} text - Unsafe text from user input or API
     * @returns {string} HTML-safe string
     */
    window.escapeHtml = function(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    };

    /**
     * Sanitize user input by removing dangerous characters
     * @param {string} input - Raw user input
     * @returns {string} Sanitized string
     */
    window.sanitizeInput = function(input) {
        if (!input) return '';
        
        return String(input)
            .trim()
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
    };

    /**
     * Safely set innerHTML with automatic escaping
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content (will be escaped)
     */
    window.safeSetHTML = function(element, html) {
        if (!element) return;
        element.textContent = ''; // Clear first
        element.insertAdjacentHTML('beforeend', escapeHtml(html));
    };

    /**
     * Create safe HTML string with escaped values
     * Use template: createSafeHTML`<div>${userInput}</div>`
     */
    window.createSafeHTML = function(strings, ...values) {
        let result = strings[0];
        for (let i = 0; i < values.length; i++) {
            result += escapeHtml(values[i]) + strings[i + 1];
        }
        return result;
    };

    // =====================================================
    // CSRF PROTECTION
    // =====================================================

    let csrfToken = null;

    /**
     * Get CSRF token (fetch from backend or generate)
     * @returns {Promise<string>} CSRF token
     */
    window.getCSRFToken = async function() {
        if (csrfToken) return csrfToken;

        try {
            const API_BASE = window.NUMMA_CONFIG?.API_BASE || 
                           'https://optimis-fiscale-production.up.railway.app';
            
            const response = await fetch(`${API_BASE}/api/csrf-token`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${getSecureToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                csrfToken = data.token;
                return csrfToken;
            }
        } catch (error) {
            console.warn('⚠️ CSRF token fetch failed, generating client-side token');
        }

        // Fallback: generate client-side token
        csrfToken = generateRandomToken();
        return csrfToken;
    };

    /**
     * Add CSRF token to FormData
     * @param {FormData} formData - Form data object
     * @returns {Promise<FormData>} FormData with CSRF token
     */
    window.addCSRFToken = async function(formData) {
        const token = await getCSRFToken();
        formData.append('csrf_token', token);
        return formData;
    };

    /**
     * Add CSRF token to fetch headers
     * @param {Object} headers - Existing headers
     * @returns {Promise<Object>} Headers with CSRF token
     */
    window.addCSRFHeader = async function(headers = {}) {
        const token = await getCSRFToken();
        return {
            ...headers,
            'X-CSRF-Token': token
        };
    };

    // =====================================================
    // SECURE TOKEN MANAGEMENT
    // =====================================================

    const TOKEN_KEY = 'numma_auth_token';
    const TOKEN_EXPIRY_KEY = 'numma_token_expiry';

    /**
     * Store authentication token securely
     * @param {string} token - JWT token
     * @param {number} expiresIn - Seconds until expiry (default: 24 hours)
     */
    window.setSecureToken = function(token, expiresIn = 86400) {
        if (!token) {
            console.warn('⚠️ Attempted to store empty token');
            return;
        }

        const expiryTime = Date.now() + (expiresIn * 1000);
        
        // Use sessionStorage for better security (cleared on tab close)
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        
        console.log('✅ Token stored securely (expires in', expiresIn, 'seconds)');
    };

    /**
     * Get authentication token if valid
     * @returns {string|null} Token or null if expired/missing
     */
    window.getSecureToken = function() {
        const token = sessionStorage.getItem(TOKEN_KEY);
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

        if (!token || !expiry) {
            return null;
        }

        // Check if expired
        if (Date.now() > parseInt(expiry)) {
            console.warn('⚠️ Token expired');
            clearSecureToken();
            return null;
        }

        return token;
    };

    /**
     * Clear authentication token
     */
    window.clearSecureToken = function() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
        csrfToken = null; // Also clear CSRF token
        console.log('🔓 Token cleared');
    };

    /**
     * Check if user is authenticated
     * @returns {boolean} True if valid token exists
     */
    window.isAuthenticated = function() {
        return getSecureToken() !== null;
    };

    /**
     * Refresh token before expiry
     * @returns {Promise<boolean>} True if refresh successful
     */
    window.refreshToken = async function() {
        const currentToken = getSecureToken();
        if (!currentToken) return false;

        try {
            const API_BASE = window.NUMMA_CONFIG?.API_BASE || 
                           'https://optimis-fiscale-production.up.railway.app';

            const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSecureToken(data.token, data.expires_in);
                console.log('✅ Token refreshed');
                return true;
            }
        } catch (error) {
            console.error('❌ Token refresh failed:', error);
        }

        return false;
    };

    // Auto-refresh token 5 minutes before expiry
    setInterval(async () => {
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
        if (expiry) {
            const timeUntilExpiry = parseInt(expiry) - Date.now();
            if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
                console.log('🔄 Auto-refreshing token...');
                await refreshToken();
            }
        }
    }, 60 * 1000); // Check every minute

    // =====================================================
    // INPUT VALIDATION
    // =====================================================

    /**
     * Validate email format
     * @param {string} email - Email address
     * @returns {boolean} True if valid
     */
    window.isValidEmail = function(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    /**
     * Validate SIRET number (French business ID)
     * @param {string} siret - SIRET number
     * @returns {boolean} True if valid
     */
    window.isValidSIRET = function(siret) {
        const cleaned = siret.replace(/\s/g, '');
        return /^\d{14}$/.test(cleaned);
    };

    /**
     * Validate date format YYYYMMDD
     * @param {string} date - Date string
     * @returns {boolean} True if valid
     */
    window.isValidDateYYYYMMDD = function(date) {
        if (!/^\d{8}$/.test(date)) return false;
        
        const year = parseInt(date.substr(0, 4));
        const month = parseInt(date.substr(4, 2));
        const day = parseInt(date.substr(6, 2));
        
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        if (year < 1900 || year > 2100) return false;
        
        return true;
    };

    /**
     * Validate amount (positive number with max 2 decimals)
     * @param {string|number} amount - Amount to validate
     * @returns {boolean} True if valid
     */
    window.isValidAmount = function(amount) {
        const num = parseFloat(amount);
        if (isNaN(num) || num < 0) return false;
        
        // Check max 2 decimal places
        const str = num.toString();
        const decimals = str.split('.')[1];
        return !decimals || decimals.length <= 2;
    };

    // =====================================================
    // UTILITIES
    // =====================================================

    /**
     * Generate cryptographically secure random token
     * @param {number} length - Token length in bytes (default: 32)
     * @returns {string} Random token
     */
    function generateRandomToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Secure redirect that prevents open redirects
     * @param {string} url - Target URL
     */
    window.secureRedirect = function(url) {
        // Only allow relative URLs or same origin
        if (url.startsWith('/') || url.startsWith('./') || 
            url.startsWith(window.location.origin)) {
            window.location.href = url;
        } else {
            console.error('❌ Blocked redirect to external URL:', url);
        }
    };

    /**
     * Rate limiter for API calls
     */
    class RateLimiter {
        constructor(maxCalls, timeWindow) {
            this.maxCalls = maxCalls;
            this.timeWindow = timeWindow;
            this.calls = [];
        }

        canCall() {
            const now = Date.now();
            this.calls = this.calls.filter(time => now - time < this.timeWindow);
            
            if (this.calls.length < this.maxCalls) {
                this.calls.push(now);
                return true;
            }
            
            return false;
        }

        reset() {
            this.calls = [];
        }
    }

    window.RateLimiter = RateLimiter;

    // =====================================================
    // EXPORT & INITIALIZATION
    // =====================================================

    window.NUMMA_SECURITY = {
        version: '3.0.0',
        escapeHtml,
        sanitizeInput,
        safeSetHTML,
        createSafeHTML,
        getCSRFToken,
        addCSRFToken,
        addCSRFHeader,
        setSecureToken,
        getSecureToken,
        clearSecureToken,
        isAuthenticated,
        refreshToken,
        isValidEmail,
        isValidSIRET,
        isValidDateYYYYMMDD,
        isValidAmount,
        secureRedirect,
        RateLimiter
    };

    console.log('✅ NUMMA Security Utilities loaded');
})();
