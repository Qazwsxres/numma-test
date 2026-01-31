/**
 * ========================================
 * NUMMA - INTERACTIVE FEATURES MODULE v3.0
 * ========================================
 * Interactive UI components and features
 * 
 * Features:
 * - Interactive forms
 * - Real-time validation
 * - Autocomplete
 * - Dynamic dropdowns
 * - Context menus
 * - Keyboard shortcuts
 * 
 * DEPENDENCIES: security.js
 */

(function() {
    'use strict';

    console.log('✨ Loading NUMMA Interactive Features v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined') {
        console.error('❌ Dependencies missing: security.js required');
        return;
    }

    // =====================================================
    // AUTOCOMPLETE
    // =====================================================

    /**
     * Create autocomplete for input field
     * @param {HTMLInputElement} input - Input element
     * @param {Array|Function} dataSource - Array of items or function returning promise
     * @param {Object} options - Configuration options
     */
    function createAutocomplete(input, dataSource, options = {}) {
        const config = {
            minChars: 2,
            maxResults: 10,
            renderItem: (item) => escapeHtml(String(item)),
            getValue: (item) => String(item),
            onSelect: () => {},
            ...options
        };

        let currentFocus = -1;
        let autocompleteList = null;

        // Close any existing autocomplete lists
        function closeAllLists() {
            const lists = document.getElementsByClassName('autocomplete-items');
            Array.from(lists).forEach(list => list.remove());
            currentFocus = -1;
        }

        // Handle input
        input.addEventListener('input', async function(e) {
            const val = this.value;
            closeAllLists();

            if (!val || val.length < config.minChars) return;

            currentFocus = -1;

            // Create autocomplete container
            autocompleteList = document.createElement('div');
            autocompleteList.className = 'autocomplete-items';
            autocompleteList.style.cssText = `
                position: absolute;
                border: 1px solid var(--border);
                border-top: none;
                z-index: 99;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: white;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;

            this.parentNode.appendChild(autocompleteList);

            // Get data
            let items = [];
            if (typeof dataSource === 'function') {
                items = await dataSource(val);
            } else {
                items = dataSource.filter(item => {
                    const str = config.getValue(item).toLowerCase();
                    return str.includes(val.toLowerCase());
                });
            }

            // Limit results
            items = items.slice(0, config.maxResults);

            // Render items
            items.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = `
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--border);
                `;
                div.innerHTML = config.renderItem(item);

                div.addEventListener('click', function() {
                    input.value = config.getValue(item);
                    closeAllLists();
                    config.onSelect(item);
                });

                div.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--bg-light)';
                });

                div.addEventListener('mouseleave', function() {
                    this.style.background = 'white';
                });

                autocompleteList.appendChild(div);
            });
        });

        // Handle keyboard navigation
        input.addEventListener('keydown', function(e) {
            let items = autocompleteList ? autocompleteList.getElementsByTagName('div') : [];
            
            if (e.keyCode === 40) { // Down arrow
                e.preventDefault();
                currentFocus++;
                addActive(items);
            } else if (e.keyCode === 38) { // Up arrow
                e.preventDefault();
                currentFocus--;
                addActive(items);
            } else if (e.keyCode === 13) { // Enter
                e.preventDefault();
                if (currentFocus > -1 && items[currentFocus]) {
                    items[currentFocus].click();
                }
            } else if (e.keyCode === 27) { // Escape
                closeAllLists();
            }
        });

        function addActive(items) {
            if (!items) return;
            removeActive(items);
            if (currentFocus >= items.length) currentFocus = 0;
            if (currentFocus < 0) currentFocus = items.length - 1;
            items[currentFocus].style.background = 'var(--bg-light)';
            items[currentFocus].scrollIntoView({ block: 'nearest' });
        }

        function removeActive(items) {
            Array.from(items).forEach(item => {
                item.style.background = 'white';
            });
        }

        // Close on click outside
        document.addEventListener('click', function(e) {
            if (e.target !== input) {
                closeAllLists();
            }
        });

        return {
            close: closeAllLists
        };
    }

    // =====================================================
    // KEYBOARD SHORTCUTS
    // =====================================================

    const shortcuts = new Map();

    /**
     * Register keyboard shortcut
     * @param {string} key - Key combination (e.g., 'Ctrl+S', 'Alt+N')
     * @param {Function} callback - Function to call
     */
    function registerShortcut(key, callback) {
        shortcuts.set(key.toLowerCase(), callback);
    }

    /**
     * Unregister keyboard shortcut
     * @param {string} key - Key combination
     */
    function unregisterShortcut(key) {
        shortcuts.delete(key.toLowerCase());
    }

    // Handle keyboard events
    document.addEventListener('keydown', function(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        const alt = e.altKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        let combination = '';
        if (ctrl) combination += 'ctrl+';
        if (alt) combination += 'alt+';
        if (shift) combination += 'shift+';
        combination += key;

        const handler = shortcuts.get(combination);
        if (handler) {
            e.preventDefault();
            handler(e);
        }
    });

    // =====================================================
    // CONTEXT MENU
    // =====================================================

    let activeContextMenu = null;

    /**
     * Create context menu
     * @param {HTMLElement} element - Element to attach menu to
     * @param {Array} items - Menu items
     */
    function createContextMenu(element, items) {
        element.addEventListener('contextmenu', function(e) {
            e.preventDefault();

            // Close existing menu
            if (activeContextMenu) {
                activeContextMenu.remove();
            }

            // Create menu
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.cssText = `
                position: fixed;
                left: ${e.clientX}px;
                top: ${e.clientY}px;
                background: white;
                border: 1px solid var(--border);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                min-width: 150px;
            `;

            items.forEach(item => {
                if (item === 'separator') {
                    const sep = document.createElement('hr');
                    sep.style.cssText = 'margin: 0; border: none; border-top: 1px solid var(--border);';
                    menu.appendChild(sep);
                } else {
                    const menuItem = document.createElement('div');
                    menuItem.style.cssText = `
                        padding: 10px 15px;
                        cursor: pointer;
                        font-size: 0.875rem;
                    `;
                    menuItem.textContent = item.label;

                    menuItem.addEventListener('click', function() {
                        menu.remove();
                        activeContextMenu = null;
                        if (item.action) item.action();
                    });

                    menuItem.addEventListener('mouseenter', function() {
                        this.style.background = 'var(--bg-light)';
                    });

                    menuItem.addEventListener('mouseleave', function() {
                        this.style.background = 'white';
                    });

                    menu.appendChild(menuItem);
                }
            });

            document.body.appendChild(menu);
            activeContextMenu = menu;
        });

        // Close menu on click outside
        document.addEventListener('click', function() {
            if (activeContextMenu) {
                activeContextMenu.remove();
                activeContextMenu = null;
            }
        });
    }

    // =====================================================
    // DYNAMIC FORM VALIDATION
    // =====================================================

    /**
     * Add real-time validation to form
     * @param {HTMLFormElement} form - Form element
     * @param {Object} rules - Validation rules
     */
    function addFormValidation(form, rules) {
        const fields = form.querySelectorAll('input, select, textarea');

        fields.forEach(field => {
            const fieldName = field.name || field.id;
            const rule = rules[fieldName];

            if (!rule) return;

            // Add validation on blur
            field.addEventListener('blur', function() {
                validateField(field, rule);
            });

            // Add validation on input (for certain types)
            if (field.type === 'text' || field.type === 'email') {
                field.addEventListener('input', function() {
                    if (this.value) {
                        validateField(field, rule);
                    }
                });
            }
        });

        // Validate on submit
        form.addEventListener('submit', function(e) {
            let isValid = true;

            fields.forEach(field => {
                const fieldName = field.name || field.id;
                const rule = rules[fieldName];
                if (rule && !validateField(field, rule)) {
                    isValid = false;
                }
            });

            if (!isValid) {
                e.preventDefault();
            }
        });
    }

    /**
     * Validate single field
     * @param {HTMLElement} field - Form field
     * @param {Object} rule - Validation rule
     */
    function validateField(field, rule) {
        const value = field.value.trim();
        let error = null;

        // Required
        if (rule.required && !value) {
            error = rule.requiredMessage || 'Ce champ est requis';
        }

        // Min length
        if (!error && rule.minLength && value.length < rule.minLength) {
            error = rule.minLengthMessage || `Minimum ${rule.minLength} caractères`;
        }

        // Max length
        if (!error && rule.maxLength && value.length > rule.maxLength) {
            error = rule.maxLengthMessage || `Maximum ${rule.maxLength} caractères`;
        }

        // Pattern
        if (!error && rule.pattern && value && !rule.pattern.test(value)) {
            error = rule.patternMessage || 'Format invalide';
        }

        // Custom validator
        if (!error && rule.validator) {
            error = rule.validator(value);
        }

        // Display error
        showFieldError(field, error);

        return !error;
    }

    /**
     * Show field error
     * @param {HTMLElement} field - Form field
     * @param {string} error - Error message (null to clear)
     */
    function showFieldError(field, error) {
        // Remove existing error
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        if (error) {
            field.style.borderColor = 'var(--danger)';
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.style.cssText = `
                color: var(--danger);
                font-size: 0.75rem;
                margin-top: 0.25rem;
            `;
            errorDiv.textContent = error;
            
            field.parentElement.appendChild(errorDiv);
        } else {
            field.style.borderColor = '';
        }
    }

    // =====================================================
    // TOOLTIPS
    // =====================================================

    /**
     * Add tooltip to element
     * @param {HTMLElement} element - Element
     * @param {string} text - Tooltip text
     * @param {string} position - Position (top, bottom, left, right)
     */
    function addTooltip(element, text, position = 'top') {
        let tooltip = null;

        element.addEventListener('mouseenter', function() {
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = text;
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 0.5rem 0.75rem;
                border-radius: 4px;
                font-size: 0.75rem;
                white-space: nowrap;
                z-index: 9999;
                pointer-events: none;
            `;

            document.body.appendChild(tooltip);

            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            switch (position) {
                case 'top':
                    tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
                    tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
                    break;
                case 'bottom':
                    tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
                    tooltip.style.top = `${rect.bottom + 8}px`;
                    break;
                case 'left':
                    tooltip.style.left = `${rect.left - tooltipRect.width - 8}px`;
                    tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
                    break;
                case 'right':
                    tooltip.style.left = `${rect.right + 8}px`;
                    tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
                    break;
            }
        });

        element.addEventListener('mouseleave', function() {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.InteractiveModule = {
        // Autocomplete
        createAutocomplete,

        // Keyboard shortcuts
        registerShortcut,
        unregisterShortcut,

        // Context menus
        createContextMenu,

        // Form validation
        addFormValidation,
        validateField,
        showFieldError,

        // Tooltips
        addTooltip
    };

    console.log('✅ NUMMA Interactive Features v3.0 loaded');

})();
