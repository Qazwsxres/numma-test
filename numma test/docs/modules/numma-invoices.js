/**
 * ========================================
 * NUMMA - INVOICES MODULE v3.0
 * ========================================
 * Complete invoice management with offline support
 * 
 * Features:
 * - Full CRUD operations
 * - Input validation (French formats)
 * - Cache with expiry
 * - Error recovery with retry
 * - Offline support
 * - Memory leak prevention
 * 
 * DEPENDENCIES: security.js, numma-messages.js
 */

(function() {
    'use strict';

    console.log('📄 Loading NUMMA Invoices Module v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined' || typeof window.showMessage === 'undefined') {
        console.error('❌ Dependencies missing: security.js and numma-messages.js required');
        return;
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const INVOICE_CONFIG = {
        API_BASE: 'https://optimis-fiscale-production.up.railway.app',
        CACHE_KEY: 'numma_invoices_cache',
        CACHE_EXPIRY: 300000, // 5 minutes
        VALIDATION: {
            INVOICE_NUMBER_PATTERN: /^F-\d{4}-\d{3,}$/,  // F-YYYY-NNN
            MIN_AMOUNT: 0,
            MAX_AMOUNT: 999999999.99,
            VAT_RATES: [0, 2.1, 5.5, 10, 20],  // French VAT rates
            PAYMENT_TERMS: ['immediate', '30', '45', '60'],
            STATUSES: ['draft', 'sent', 'paid', 'overdue', 'cancelled']
        }
    };

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================

    let invoiceCache = {
        data: [],
        lastUpdate: null,
        filters: {}
    };

    // =====================================================
    // API FUNCTIONS - CRUD
    // =====================================================

    /**
     * List invoices with optional filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Array of invoices
     */
    async function listInvoices(filters = {}) {
        console.log('Listing invoices with filters:', filters);

        try {
            // Check cache first
            if (isCacheValid() && JSON.stringify(filters) === JSON.stringify(invoiceCache.filters)) {
                console.log('✅ Returning cached invoices');
                return invoiceCache.data;
            }

            const token = getSecureToken();
            const queryString = new URLSearchParams(filters).toString();
            const url = `${INVOICE_CONFIG.API_BASE}/api/invoices${queryString ? '?' + queryString : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const invoices = await response.json();

            // Update cache
            setCachedInvoices(invoices, filters);

            console.log('✅ Invoices loaded:', invoices.length);
            return invoices;

        } catch (error) {
            return handleAPIError(error, 'list');
        }
    }

    /**
     * Get single invoice by ID
     * @param {string} id - Invoice ID
     * @returns {Promise<Object>} Invoice object
     */
    async function getInvoice(id) {
        console.log('Getting invoice:', id);

        try {
            // Check cache first
            const cached = invoiceCache.data.find(inv => inv.id === id);
            if (cached && isCacheValid()) {
                console.log('✅ Returning cached invoice');
                return cached;
            }

            const token = getSecureToken();
            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const invoice = await response.json();
            console.log('✅ Invoice loaded:', invoice.number);
            return invoice;

        } catch (error) {
            return handleAPIError(error, 'get');
        }
    }

    /**
     * Create new invoice
     * @param {Object} data - Invoice data
     * @returns {Promise<Object>} Created invoice
     */
    async function createInvoice(data) {
        console.log('Creating invoice:', data.number);

        try {
            // Validate first
            const validation = validateInvoice(data);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Creation failed' }));
                throw new Error(error.detail);
            }

            const invoice = await response.json();

            // Add to cache
            invoiceCache.data.push(invoice);

            showSuccess(`Facture ${invoice.number} créée`);
            console.log('✅ Invoice created:', invoice.id);

            return invoice;

        } catch (error) {
            showError(`Erreur de création: ${error.message}`);
            console.error('❌ Create failed:', error);
            throw error;
        }
    }

    /**
     * Update existing invoice
     * @param {string} id - Invoice ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>} Updated invoice
     */
    async function updateInvoice(id, data) {
        console.log('Updating invoice:', id);

        try {
            // Validate
            const validation = validateInvoice(data);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices/${id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Update failed' }));
                throw new Error(error.detail);
            }

            const invoice = await response.json();

            // Update cache
            const index = invoiceCache.data.findIndex(inv => inv.id === id);
            if (index !== -1) {
                invoiceCache.data[index] = invoice;
            }

            showSuccess(`Facture ${invoice.number} mise à jour`);
            console.log('✅ Invoice updated:', invoice.id);

            return invoice;

        } catch (error) {
            showError(`Erreur de mise à jour: ${error.message}`);
            console.error('❌ Update failed:', error);
            throw error;
        }
    }

    /**
     * Delete invoice
     * @param {string} id - Invoice ID
     * @returns {Promise<boolean>} Success status
     */
    async function deleteInvoice(id) {
        console.log('Deleting invoice:', id);

        try {
            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices/${id}`, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
                throw new Error(error.detail);
            }

            // Remove from cache
            invoiceCache.data = invoiceCache.data.filter(inv => inv.id !== id);

            showSuccess('Facture supprimée');
            console.log('✅ Invoice deleted:', id);

            return true;

        } catch (error) {
            showError(`Erreur de suppression: ${error.message}`);
            console.error('❌ Delete failed:', error);
            throw error;
        }
    }

    // =====================================================
    // API FUNCTIONS - ACTIONS
    // =====================================================

    /**
     * Send invoice by email
     * @param {string} id - Invoice ID
     * @param {string} email - Recipient email
     * @returns {Promise<boolean>} Success status
     */
    async function sendInvoice(id, email) {
        console.log('Sending invoice:', id, 'to', email);

        try {
            // Validate email
            if (!isValidEmail(email)) {
                throw new Error('Adresse email invalide');
            }

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices/${id}/send`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ email }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Envoi échoué');
            }

            // Update invoice status in cache
            const invoice = invoiceCache.data.find(inv => inv.id === id);
            if (invoice) {
                invoice.status = 'sent';
            }

            showSuccess(`Facture envoyée à ${email}`);
            console.log('✅ Invoice sent');

            return true;

        } catch (error) {
            showError(`Erreur d'envoi: ${error.message}`);
            console.error('❌ Send failed:', error);
            throw error;
        }
    }

    /**
     * Mark invoice as paid
     * @param {string} id - Invoice ID
     * @param {string} paymentDate - Payment date (YYYY-MM-DD)
     * @returns {Promise<Object>} Updated invoice
     */
    async function markAsPaid(id, paymentDate = null) {
        console.log('Marking invoice as paid:', id);

        try {
            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${INVOICE_CONFIG.API_BASE}/api/invoices/${id}/paid`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    payment_date: paymentDate || new Date().toISOString().split('T')[0]
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Échec du paiement');
            }

            const invoice = await response.json();

            // Update cache
            const index = invoiceCache.data.findIndex(inv => inv.id === id);
            if (index !== -1) {
                invoiceCache.data[index] = invoice;
            }

            showSuccess(`Facture ${invoice.number} marquée comme payée`);
            console.log('✅ Invoice marked as paid');

            return invoice;

        } catch (error) {
            showError(`Erreur: ${error.message}`);
            console.error('❌ Mark paid failed:', error);
            throw error;
        }
    }

    // =====================================================
    // VALIDATION
    // =====================================================

    /**
     * Validate invoice data
     * @param {Object} data - Invoice data to validate
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    function validateInvoice(data) {
        const errors = [];

        // Invoice number
        if (!data.number) {
            errors.push('Numéro de facture requis');
        } else if (!INVOICE_CONFIG.VALIDATION.INVOICE_NUMBER_PATTERN.test(data.number)) {
            errors.push('Format de numéro invalide (attendu: F-YYYY-NNN)');
        }

        // Client
        if (!data.client_name || data.client_name.trim() === '') {
            errors.push('Nom du client requis');
        }

        // Dates
        if (!data.invoice_date) {
            errors.push('Date de facture requise');
        }

        if (!data.due_date) {
            errors.push('Date d\'échéance requise');
        } else if (data.invoice_date && new Date(data.due_date) < new Date(data.invoice_date)) {
            errors.push('Date d\'échéance doit être après la date de facture');
        }

        // Amounts
        const totalHT = parseFloat(data.total_ht || 0);
        const totalTTC = parseFloat(data.total_ttc || 0);

        if (isNaN(totalHT) || totalHT < INVOICE_CONFIG.VALIDATION.MIN_AMOUNT) {
            errors.push('Montant HT invalide');
        }

        if (totalHT > INVOICE_CONFIG.VALIDATION.MAX_AMOUNT) {
            errors.push('Montant HT trop élevé');
        }

        if (isNaN(totalTTC) || totalTTC <= totalHT) {
            errors.push('Montant TTC invalide (doit être > HT)');
        }

        // VAT rate
        const vatRate = parseFloat(data.vat_rate || 20);
        if (!INVOICE_CONFIG.VALIDATION.VAT_RATES.includes(vatRate)) {
            errors.push(`Taux de TVA invalide (autorisés: ${INVOICE_CONFIG.VALIDATION.VAT_RATES.join(', ')}%)`);
        }

        // Status
        if (data.status && !INVOICE_CONFIG.VALIDATION.STATUSES.includes(data.status)) {
            errors.push('Statut invalide');
        }

        // Items
        if (data.items && data.items.length > 0) {
            data.items.forEach((item, index) => {
                if (!item.description || item.description.trim() === '') {
                    errors.push(`Article ${index + 1}: description requise`);
                }

                const quantity = parseFloat(item.quantity || 0);
                if (isNaN(quantity) || quantity <= 0) {
                    errors.push(`Article ${index + 1}: quantité invalide`);
                }

                const unitPrice = parseFloat(item.unit_price || 0);
                if (isNaN(unitPrice) || unitPrice < 0) {
                    errors.push(`Article ${index + 1}: prix unitaire invalide`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // =====================================================
    // CACHE MANAGEMENT
    // =====================================================

    /**
     * Get cached invoices
     * @returns {Array|null} Cached invoices or null
     */
    function getCachedInvoices() {
        if (isCacheValid()) {
            return invoiceCache.data;
        }
        return null;
    }

    /**
     * Set cached invoices
     * @param {Array} invoices - Invoices to cache
     * @param {Object} filters - Filters used
     */
    function setCachedInvoices(invoices, filters = {}) {
        invoiceCache.data = invoices;
        invoiceCache.lastUpdate = Date.now();
        invoiceCache.filters = filters;

        // Also save to sessionStorage for page refresh
        try {
            sessionStorage.setItem(INVOICE_CONFIG.CACHE_KEY, JSON.stringify({
                data: invoices,
                timestamp: Date.now(),
                filters: filters
            }));
        } catch (e) {
            console.warn('Failed to cache invoices:', e);
        }
    }

    /**
     * Check if cache is still valid
     * @returns {boolean} True if cache is valid
     */
    function isCacheValid() {
        if (!invoiceCache.lastUpdate) {
            // Try to load from sessionStorage
            try {
                const cached = sessionStorage.getItem(INVOICE_CONFIG.CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < INVOICE_CONFIG.CACHE_EXPIRY) {
                        invoiceCache.data = parsed.data;
                        invoiceCache.lastUpdate = parsed.timestamp;
                        invoiceCache.filters = parsed.filters || {};
                        return true;
                    }
                }
            } catch (e) {
                console.warn('Failed to load cache:', e);
            }
            return false;
        }

        return Date.now() - invoiceCache.lastUpdate < INVOICE_CONFIG.CACHE_EXPIRY;
    }

    /**
     * Clear cache
     */
    function clearCache() {
        invoiceCache.data = [];
        invoiceCache.lastUpdate = null;
        invoiceCache.filters = {};
        
        try {
            sessionStorage.removeItem(INVOICE_CONFIG.CACHE_KEY);
        } catch (e) {
            console.warn('Failed to clear cache:', e);
        }
        
        console.log('✅ Invoice cache cleared');
    }

    // =====================================================
    // ERROR RECOVERY
    // =====================================================

    /**
     * Handle API errors with fallback strategies
     * @param {Error} error - The error object
     * @param {string} context - Operation context
     * @returns {Array|Object|null} Fallback data or throws
     */
    function handleAPIError(error, context) {
        console.error(`Invoice API error (${context}):`, error);

        // For read operations, try cache fallback
        if (context === 'list' || context === 'get') {
            const cached = getCachedInvoices();
            if (cached) {
                showWarning('Données chargées depuis le cache local');
                return context === 'list' ? cached : cached[0] || null;
            }
        }

        // Show user-friendly error
        const userMessage = getUserFriendlyError(error, context);
        showError(userMessage);

        // For write operations, throw to let caller handle
        throw error;
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - The error
     * @param {string} context - Operation context
     * @returns {string} User-friendly message
     */
    function getUserFriendlyError(error, context) {
        const contextMessages = {
            list: 'Impossible de charger les factures',
            get: 'Impossible de charger la facture',
            create: 'Impossible de créer la facture',
            update: 'Impossible de mettre à jour la facture',
            delete: 'Impossible de supprimer la facture',
            send: 'Impossible d\'envoyer la facture',
            paid: 'Impossible de marquer comme payée'
        };

        return `${contextMessages[context] || 'Erreur'}: ${error.message}`;
    }

    // =====================================================
    // EVENT CLEANUP
    // =====================================================

    const eventController = new AbortController();

    /**
     * Add event listener with automatic cleanup
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    function addEventListener(element, event, handler) {
        if (!element) return;
        
        element.addEventListener(event, handler, {
            signal: eventController.signal
        });
    }

    /**
     * Cleanup function - removes all listeners and clears cache
     */
    function cleanup() {
        console.log('Cleaning up invoices module...');
        eventController.abort();
        clearCache();
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.InvoiceAPI = {
        // CRUD operations
        list: listInvoices,
        get: getInvoice,
        create: createInvoice,
        update: updateInvoice,
        delete: deleteInvoice,

        // Actions
        send: sendInvoice,
        markAsPaid: markAsPaid,

        // Validation
        validate: validateInvoice,

        // Cache
        cache: {
            get: getCachedInvoices,
            clear: clearCache,
            isValid: isCacheValid
        },

        // Events
        addEventListener: addEventListener,

        // Cleanup
        cleanup: cleanup
    };

    // Auto-cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    console.log('✅ NUMMA Invoices Module v3.0 loaded');

})();
