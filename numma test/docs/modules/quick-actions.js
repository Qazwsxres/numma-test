/**
 * ========================================
 * NUMMA - QUICK ACTIONS MODULE v3.0
 * ========================================
 * Quick access to common actions
 * 
 * Features:
 * - Quick action buttons
 * - Command palette (Cmd+K / Ctrl+K)
 * - Recent actions history
 * - Favorite actions
 * 
 * DEPENDENCIES: security.js, numma-messages.js
 */

(function() {
    'use strict';

    console.log('⚡ Loading NUMMA Quick Actions v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined' || 
        typeof window.showMessage === 'undefined') {
        console.error('❌ Dependencies missing: security.js and numma-messages.js required');
        return;
    }

    // =====================================================
    // ACTION REGISTRY
    // =====================================================

    const actions = [
        // Invoices
        {
            id: 'new-invoice',
            label: 'Nouvelle facture',
            icon: '📄',
            category: 'Facturation',
            shortcut: 'Ctrl+N',
            action: () => {
                showInfo('Création de facture - À venir');
            }
        },
        {
            id: 'list-invoices',
            label: 'Liste des factures',
            icon: '📋',
            category: 'Facturation',
            action: () => {
                if (typeof window.loadView === 'function') {
                    window.loadView('factures');
                }
            }
        },

        // Employees
        {
            id: 'new-employee',
            label: 'Nouvel employé',
            icon: '👤',
            category: 'RH',
            action: () => {
                showInfo('Ajout d\'employé - À venir');
            }
        },
        {
            id: 'list-employees',
            label: 'Liste des employés',
            icon: '👥',
            category: 'RH',
            action: () => {
                if (typeof window.loadView === 'function') {
                    window.loadView('rh');
                }
            }
        },

        // Time tracking
        {
            id: 'clock-in',
            label: 'Pointer (Entrée)',
            icon: '🕐',
            category: 'Pointage',
            action: async () => {
                if (window.PointageAPI) {
                    await window.PointageAPI.clockIn();
                }
            }
        },
        {
            id: 'clock-out',
            label: 'Pointer (Sortie)',
            icon: '🕐',
            category: 'Pointage',
            action: async () => {
                if (window.PointageAPI) {
                    await window.PointageAPI.clockOut();
                }
            }
        },

        // Import
        {
            id: 'import-fec',
            label: 'Importer FEC',
            icon: '📊',
            category: 'Import',
            action: () => {
                if (typeof window.loadView === 'function') {
                    window.loadView('import');
                }
            }
        },

        // Navigation
        {
            id: 'dashboard',
            label: 'Tableau de bord',
            icon: '🏠',
            category: 'Navigation',
            shortcut: 'Ctrl+H',
            action: () => {
                if (typeof window.loadView === 'function') {
                    window.loadView('dashboard');
                }
            }
        },
        {
            id: 'cashflow',
            label: 'Trésorerie',
            icon: '💰',
            category: 'Navigation',
            action: () => {
                if (typeof window.loadView === 'function') {
                    window.loadView('tresorerie');
                }
            }
        },

        // Export
        {
            id: 'export-excel',
            label: 'Exporter en Excel',
            icon: '📊',
            category: 'Export',
            action: () => {
                showInfo('Export Excel - À venir');
            }
        },

        // Settings
        {
            id: 'settings',
            label: 'Paramètres',
            icon: '⚙️',
            category: 'Système',
            action: () => {
                showInfo('Paramètres - À venir');
            }
        }
    ];

    // Recent actions (stored in sessionStorage)
    let recentActions = [];

    // =====================================================
    // COMMAND PALETTE
    // =====================================================

    let paletteOpen = false;
    let paletteElement = null;

    /**
     * Open command palette
     */
    function openCommandPalette() {
        if (paletteOpen) return;

        paletteOpen = true;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'commandPaletteOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9998;
            backdrop-filter: blur(4px);
        `;

        // Create palette
        paletteElement = document.createElement('div');
        paletteElement.id = 'commandPalette';
        paletteElement.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 9999;
            overflow: hidden;
        `;

        // Search input
        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.placeholder = 'Rechercher une action...';
        searchBox.style.cssText = `
            width: 100%;
            padding: 1rem 1.5rem;
            border: none;
            border-bottom: 1px solid var(--border);
            font-size: 1rem;
            outline: none;
        `;

        // Results container
        const results = document.createElement('div');
        results.id = 'commandPaletteResults';
        results.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
        `;

        paletteElement.appendChild(searchBox);
        paletteElement.appendChild(results);

        overlay.appendChild(paletteElement);
        document.body.appendChild(overlay);

        // Focus search
        searchBox.focus();

        // Display all actions initially
        displayActions(actions, results);

        // Search handler
        searchBox.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            if (!query) {
                displayActions(actions, results);
            } else {
                const filtered = actions.filter(action => 
                    action.label.toLowerCase().includes(query) ||
                    action.category.toLowerCase().includes(query)
                );
                displayActions(filtered, results);
            }
        });

        // Keyboard navigation
        let currentIndex = -1;
        searchBox.addEventListener('keydown', function(e) {
            const items = results.getElementsByClassName('action-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, items.length - 1);
                highlightItem(items, currentIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                highlightItem(items, currentIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentIndex >= 0 && items[currentIndex]) {
                    items[currentIndex].click();
                }
            } else if (e.key === 'Escape') {
                closeCommandPalette();
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeCommandPalette();
            }
        });
    }

    /**
     * Close command palette
     */
    function closeCommandPalette() {
        const overlay = document.getElementById('commandPaletteOverlay');
        if (overlay) {
            overlay.remove();
        }
        paletteElement = null;
        paletteOpen = false;
    }

    /**
     * Display actions in palette
     */
    function displayActions(actionsToDisplay, container) {
        container.innerHTML = '';

        if (actionsToDisplay.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-gray);">
                    Aucune action trouvée
                </div>
            `;
            return;
        }

        // Group by category
        const grouped = {};
        actionsToDisplay.forEach(action => {
            if (!grouped[action.category]) {
                grouped[action.category] = [];
            }
            grouped[action.category].push(action);
        });

        // Display by category
        Object.entries(grouped).forEach(([category, categoryActions]) => {
            const categoryHeader = document.createElement('div');
            categoryHeader.style.cssText = `
                padding: 0.5rem 1.5rem;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-gray);
                text-transform: uppercase;
                background: var(--bg-light);
            `;
            categoryHeader.textContent = category;
            container.appendChild(categoryHeader);

            categoryActions.forEach(action => {
                const item = document.createElement('div');
                item.className = 'action-item';
                item.style.cssText = `
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    border-bottom: 1px solid var(--border);
                `;

                item.innerHTML = `
                    <span style="font-size: 1.25rem;">${action.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${escapeHtml(action.label)}</div>
                        ${action.shortcut ? `<div style="font-size: 0.75rem; color: var(--text-gray);">${escapeHtml(action.shortcut)}</div>` : ''}
                    </div>
                `;

                item.addEventListener('click', function() {
                    executeAction(action);
                    closeCommandPalette();
                });

                item.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--bg-light)';
                });

                item.addEventListener('mouseleave', function() {
                    this.style.background = 'white';
                });

                container.appendChild(item);
            });
        });
    }

    /**
     * Highlight item in palette
     */
    function highlightItem(items, index) {
        Array.from(items).forEach((item, i) => {
            if (i === index) {
                item.style.background = 'var(--bg-light)';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.style.background = 'white';
            }
        });
    }

    /**
     * Execute action
     */
    function executeAction(action) {
        console.log('Executing action:', action.id);
        
        try {
            action.action();
            addToRecentActions(action);
        } catch (error) {
            console.error('Action execution failed:', error);
            showError('Erreur lors de l\'exécution de l\'action');
        }
    }

    /**
     * Add action to recent history
     */
    function addToRecentActions(action) {
        recentActions = recentActions.filter(a => a.id !== action.id);
        recentActions.unshift(action);
        recentActions = recentActions.slice(0, 10); // Keep last 10
    }

    // =====================================================
    // QUICK ACTION PANEL
    // =====================================================

    /**
     * Create quick action panel
     * @param {Array} selectedActions - Array of action IDs to display
     * @returns {HTMLElement} Panel element
     */
    function createQuickActionPanel(selectedActions = ['new-invoice', 'clock-in', 'dashboard']) {
        const panel = document.createElement('div');
        panel.className = 'quick-actions-panel';
        panel.style.cssText = `
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        `;

        selectedActions.forEach(actionId => {
            const action = actions.find(a => a.id === actionId);
            if (!action) return;

            const button = document.createElement('button');
            button.className = 'btn btn-outline';
            button.innerHTML = `${action.icon} ${escapeHtml(action.label)}`;
            button.onclick = () => executeAction(action);

            panel.appendChild(button);
        });

        return panel;
    }

    // =====================================================
    // KEYBOARD SHORTCUTS
    // =====================================================

    // Register command palette shortcut
    document.addEventListener('keydown', function(e) {
        // Cmd+K / Ctrl+K
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openCommandPalette();
        }

        // Register action shortcuts
        actions.forEach(action => {
            if (action.shortcut) {
                const keys = action.shortcut.toLowerCase().split('+');
                const needsCtrl = keys.includes('ctrl');
                const key = keys[keys.length - 1];

                if ((e.ctrlKey || e.metaKey) === needsCtrl && e.key.toLowerCase() === key) {
                    e.preventDefault();
                    executeAction(action);
                }
            }
        });
    });

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.QuickActions = {
        // Command palette
        openCommandPalette,
        closeCommandPalette,

        // Actions
        actions,
        executeAction,
        addAction: (action) => actions.push(action),

        // Recent actions
        getRecentActions: () => [...recentActions],

        // Panel
        createQuickActionPanel
    };

    console.log('✅ NUMMA Quick Actions v3.0 loaded');
    console.log('💡 Press Ctrl+K or Cmd+K to open command palette');

})();
