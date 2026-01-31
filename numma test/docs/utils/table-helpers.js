/**
 * ========================================
 * NUMMA - SAFE TABLE RENDERING UTILITIES v3.0
 * ========================================
 * XSS-safe table rendering functions
 * 
 * DEPENDENCIES: security.js (REQUIRED)
 */

(function() {
    'use strict';

    console.log('📊 Loading Table Helpers...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined') {
        console.error('❌ security.js must be loaded before table-helpers.js');
        return;
    }

    // =====================================================
    // SAFE TABLE RENDERING
    // =====================================================

    /**
     * Safely render table rows with automatic XSS protection
     * @param {Array} data - Array of row objects
     * @param {Object} columnConfig - Column configuration
     * @param {HTMLElement} tbody - Target tbody element
     * @param {string} emptyMessage - Message when no data
     */
    window.renderTableRows = function(data, columnConfig, tbody, emptyMessage = 'Aucune donnée') {
        if (!tbody) {
            console.error('❌ Table body element not found');
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${Object.keys(columnConfig).length}" 
                        style="text-align: center; padding: 2rem; color: var(--text-gray);">
                        ${escapeHtml(emptyMessage)}
                    </td>
                </tr>
            `;
            return;
        }

        const rows = data.map(row => {
            const cells = Object.entries(columnConfig).map(([key, config]) => {
                const value = row[key];
                const cellContent = config.render 
                    ? config.render(value, row)
                    : escapeHtml(value || config.default || '-');
                
                const style = config.style ? ` style="${config.style}"` : '';
                const className = config.className ? ` class="${config.className}"` : '';
                
                return `<td${style}${className}>${cellContent}</td>`;
            }).join('');
            
            return `<tr>${cells}</tr>`;
        }).join('');

        tbody.innerHTML = rows;
    };

    /**
     * Create safe badge HTML
     * @param {string} text - Badge text
     * @param {string} type - Badge type: success, warning, danger, info
     */
    window.createBadge = function(text, type = 'info') {
        const safeText = escapeHtml(text);
        const className = `badge badge-${type}`;
        return `<span class="${className}">${safeText}</span>`;
    };

    /**
     * Create safe button HTML
     * @param {string} label - Button label
     * @param {string} onclick - onclick handler (function name only, no params)
     * @param {string} className - CSS class
     * @param {Object} data - Data attributes
     */
    window.createButton = function(label, onclick, className = 'btn btn-outline', data = {}) {
        const safeLabel = escapeHtml(label);
        const dataAttrs = Object.entries(data)
            .map(([key, value]) => `data-${key}="${escapeHtml(String(value))}"`)
            .join(' ');
        
        return `<button class="${className}" 
                        onclick="${onclick}" 
                        ${dataAttrs}
                        style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                    ${safeLabel}
                </button>`;
    };

    /**
     * Format currency safely
     * @param {number|string} amount - Amount to format
     * @param {string} currency - Currency symbol
     */
    window.formatCurrency = function(amount, currency = '€') {
        const num = parseFloat(amount || 0);
        if (isNaN(num)) return '-';
        
        return `${currency} ${num.toFixed(2)}`;
    };

    /**
     * Format date safely
     * @param {string} dateString - Date string
     * @param {string} format - Format type: 'short', 'long', 'time'
     */
    window.formatDate = function(dateString, format = 'short') {
        if (!dateString) return '-';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return escapeHtml(dateString);
            
            const options = {
                short: { day: '2-digit', month: 'short', year: 'numeric' },
                long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                time: { hour: '2-digit', minute: '2-digit' }
            };
            
            return date.toLocaleDateString('fr-FR', options[format] || options.short);
        } catch (error) {
            console.error('Date formatting error:', error);
            return escapeHtml(dateString);
        }
    };

    /**
     * Format YYYYMMDD date to DD/MM/YYYY
     * @param {string} dateStr - Date in YYYYMMDD format
     */
    window.formatFECDate = function(dateStr) {
        if (!dateStr || dateStr.length !== 8) {
            return escapeHtml(dateStr || '-');
        }
        
        const day = dateStr.substr(6, 2);
        const month = dateStr.substr(4, 2);
        const year = dateStr.substr(0, 4);
        
        return `${day}/${month}/${year}`;
    };

    // =====================================================
    // EXAMPLE COLUMN CONFIGURATIONS
    // =====================================================

    /**
     * Example: Employee table configuration
     */
    window.EMPLOYEE_COLUMNS = {
        name: {
            render: (value, row) => `<strong>${escapeHtml(row.first_name)} ${escapeHtml(row.last_name)}</strong>`
        },
        position: {
            render: (value) => escapeHtml(value || 'N/A')
        },
        contract_type: {
            render: (value) => createBadge(value || 'CDI', 'success')
        },
        gross_salary: {
            render: (value) => formatCurrency(value),
            style: 'text-align: right;'
        },
        status: {
            render: () => createBadge('Actif', 'success')
        },
        actions: {
            render: (value, row) => `
                ${createButton('Voir', `viewEmployee('${row.id}')`)}
                ${createButton('Fiche', `generatePayslip('${row.id}')`, 'btn btn-primary')}
            `
        }
    };

    /**
     * Example: Invoice table configuration
     */
    window.INVOICE_COLUMNS = {
        number: {
            render: (value) => `<strong>${escapeHtml(value)}</strong>`
        },
        client_name: {
            render: (value) => escapeHtml(value || 'Client')
        },
        invoice_date: {
            render: (value) => formatDate(value)
        },
        due_date: {
            render: (value) => formatDate(value)
        },
        total_ht: {
            render: (value) => formatCurrency(value),
            style: 'text-align: right;'
        },
        total_ttc: {
            render: (value) => formatCurrency(value),
            style: 'text-align: right;'
        },
        status: {
            render: (value) => {
                const badges = {
                    'draft': createBadge('Brouillon', 'info'),
                    'sent': createBadge('Envoyée', 'warning'),
                    'paid': createBadge('Payée', 'success'),
                    'overdue': createBadge('En retard', 'danger')
                };
                return badges[value] || createBadge(value, 'info');
            }
        },
        actions: {
            render: (value, row) => `
                ${createButton('Voir', `viewInvoice('${row.id}')`)}
                ${createButton('PDF', `downloadInvoicePDF('${row.id}')`, 'btn btn-primary')}
            `
        }
    };

    /**
     * Example: FEC entries configuration
     */
    window.FEC_COLUMNS = {
        EcritureNum: {
            render: (value) => escapeHtml(value)
        },
        EcritureDate: {
            render: (value) => formatFECDate(value)
        },
        JournalCode: {
            render: (value) => escapeHtml(value)
        },
        CompteNum: {
            render: (value) => escapeHtml(value)
        },
        EcritureLib: {
            render: (value) => escapeHtml(value)
        },
        Debit: {
            render: (value) => formatCurrency(parseFloat(value || 0), ''),
            style: 'text-align: right;'
        },
        Credit: {
            render: (value) => formatCurrency(parseFloat(value || 0), ''),
            style: 'text-align: right;'
        },
        ValidDate: {
            render: (value, row) => {
                if (value && value.trim() !== '') {
                    return `<span class="validated">✅ Validée</span>`;
                }
                return `<span class="not-validated">⏳ Brouillon</span>`;
            }
        },
        actions: {
            render: (value, row) => {
                if (row.ValidDate && row.ValidDate.trim() !== '') {
                    return '<span style="color: #999;">Intangible</span>';
                }
                return createButton('🗑️', `deleteEntry('${escapeHtml(row.EcritureNum)}')`, 'btn btn-danger');
            }
        }
    };

    /**
     * Example: Transaction table configuration
     */
    window.TRANSACTION_COLUMNS = {
        date: {
            render: (value) => formatDate(value)
        },
        description: {
            render: (value) => escapeHtml(value)
        },
        category: {
            render: (value) => createBadge(value || 'Autre', 'info')
        },
        amount: {
            render: (value) => {
                const num = parseFloat(value || 0);
                const color = num >= 0 ? 'var(--success)' : 'var(--danger)';
                const sign = num >= 0 ? '+' : '';
                return `<span style="color: ${color}; font-weight: 600;">${sign}${formatCurrency(num)}</span>`;
            },
            style: 'text-align: right;'
        }
    };

    // =====================================================
    // EXPORT
    // =====================================================

    window.TABLE_HELPERS = {
        renderTableRows,
        createBadge,
        createButton,
        formatCurrency,
        formatDate,
        formatFECDate,
        EMPLOYEE_COLUMNS,
        INVOICE_COLUMNS,
        FEC_COLUMNS,
        TRANSACTION_COLUMNS
    };

    console.log('✅ Table Helpers loaded (XSS-protected)');
})();
