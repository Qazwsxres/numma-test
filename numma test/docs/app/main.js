/**
 * ========================================
 * NUMMA - Main Application Controller v3.0
 * ========================================
 * Manages view loading, navigation, and app state
 * 
 * DEPENDENCIES: security.js, numma-messages.js
 */

(function() {
    'use strict';

    console.log('🚀 NUMMA Main Application initializing...');

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const APP_CONFIG = {
        views: {
            'dashboard': { title: 'Tableau de bord', file: 'views/dashboard.html' },
            'tresorerie': { title: 'Trésorerie', file: 'views/tresorerie.html' },
            'factures': { title: 'Factures', file: 'views/factures.html' },
            'rh': { title: 'RH & Paie', file: 'views/rh.html' },
            'pointage': { title: 'Pointage', file: 'views/pointage.html' },
            'planning': { title: 'Planning', file: 'views/planning.html' },
            'import': { title: 'Import', file: 'views/import.html' },
            'alertes': { title: 'Alertes', file: 'views/alertes.html' },
            'analyse': { title: 'Analyse fiscale', file: 'views/analyse.html' },
            'espace-client': { title: 'Espace client', file: 'views/espace-client.html' },
            'fec': { title: 'FEC / Comptabilité', file: 'fec-manager.html' }
        },
        defaultView: 'dashboard'
    };

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================

    const AppState = {
        currentView: null,
        currentUser: null,
        viewCache: new Map(),
        initialized: false
    };

    // =====================================================
    // AUTHENTICATION CHECK
    // =====================================================

    function checkAuthentication() {
        console.log('🔐 Checking authentication...');
        
        if (!isAuthenticated()) {
            console.warn('⚠️ Not authenticated, redirecting to login');
            secureRedirect('login.html');
            return false;
        }

        // Load user data
        const userData = sessionStorage.getItem('currentUser');
        if (userData) {
            try {
                AppState.currentUser = JSON.parse(userData);
                console.log('✅ User loaded:', AppState.currentUser.contact_name || 'Unknown');
            } catch (error) {
                console.error('❌ Failed to parse user data:', error);
            }
        }

        return true;
    }

    // =====================================================
    // UI COMPONENTS
    // =====================================================

    function renderSidebar() {
        const container = document.getElementById('sidebarContainer');
        if (!container) return;

        const user = AppState.currentUser || {};

        container.innerHTML = `
            <div class="sidebar">
                <div class="sidebar-header">
                    <div class="logo">
                        <div class="logo-icon">N</div>
                        <span>NUMMA</span>
                    </div>
                </div>

                <div class="user-info">
                    <div class="user-name" id="userName">${escapeHtml(user.contact_name || user.name || 'Utilisateur')}</div>
                    <div class="user-role" id="userCompany">${escapeHtml(user.company_name || 'Entreprise')}</div>
                    <div class="user-role-badge" id="userAccessLevel">${escapeHtml(user.accessLevel || 'Admin')}</div>
                </div>

                <nav class="nav-menu" role="navigation" aria-label="Menu principal">
                    ${Object.entries(APP_CONFIG.views).map(([key, config]) => `
                        <div class="nav-item" 
                             role="button"
                             tabindex="0"
                             data-view="${key}"
                             aria-label="${escapeHtml(config.title)}"
                             onclick="switchView('${key}')"
                             onkeypress="if(event.key==='Enter') switchView('${key}')">
                            <span class="nav-icon">${getViewIcon(key)}</span>
                            <span>${escapeHtml(config.title)}</span>
                        </div>
                    `).join('')}
                </nav>

                <div class="sidebar-footer">
                    <button class="btn-logout" onclick="handleLogout()" aria-label="Se déconnecter">
                        🚪 Déconnexion
                    </button>
                </div>
            </div>
        `;
    }

    function renderTopBar() {
        const container = document.getElementById('topBarContainer');
        if (!container) return;

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        container.innerHTML = `
            <div class="top-bar">
                <div class="page-title" id="pageTitle">Tableau de bord</div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span id="currentDate">${escapeHtml(dateStr)}</span>
                </div>
            </div>
        `;

        // Update date every minute
        setInterval(() => {
            const dateEl = document.getElementById('currentDate');
            if (dateEl) {
                const now = new Date();
                const dateStr = now.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                dateEl.textContent = dateStr;
            }
        }, 60000);
    }

    // =====================================================
    // VIEW MANAGEMENT
    // =====================================================

    async function switchView(viewKey) {
        console.log('📄 Switching to view:', viewKey);

        const viewConfig = APP_CONFIG.views[viewKey];
        if (!viewConfig) {
            console.error('❌ Unknown view:', viewKey);
            showError('Vue introuvable: ' + viewKey);
            return;
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`[data-view="${viewKey}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Update page title
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) {
            titleEl.textContent = viewConfig.title;
        }

        // Load view content
        try {
            await loadView(viewKey, viewConfig.file);
            AppState.currentView = viewKey;
            
            // Trigger view-specific initialization
            initializeViewFeatures(viewKey);
            
        } catch (error) {
            console.error('❌ Failed to load view:', error);
            showError('Erreur de chargement: ' + error.message);
        }
    }

    async function loadView(viewKey, filepath) {
        const container = document.getElementById('viewContainer');
        if (!container) {
            throw new Error('View container not found');
        }

        // Check cache first
        if (AppState.viewCache.has(viewKey)) {
            console.log('📦 Loading view from cache:', viewKey);
            container.innerHTML = AppState.viewCache.get(viewKey);
            return;
        }

        // Show loading
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Chargement de ${escapeHtml(APP_CONFIG.views[viewKey].title)}...</p>
            </div>
        `;

        try {
            console.log('🌐 Fetching view:', filepath);
            const response = await fetch(filepath);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            
            // Cache the view
            AppState.viewCache.set(viewKey, html);
            
            // Render
            container.innerHTML = html;
            console.log('✅ View loaded:', viewKey);
            
        } catch (error) {
            console.error('❌ View loading failed:', error);
            container.innerHTML = `
                <div class="card">
                    <h2>❌ Erreur de chargement</h2>
                    <p>Impossible de charger la vue: ${escapeHtml(error.message)}</p>
                    <button class="btn btn-primary" onclick="switchView('${viewKey}')">
                        Réessayer
                    </button>
                </div>
            `;
            throw error;
        }
    }

    function initializeViewFeatures(viewKey) {
        console.log('⚙️ Initializing features for:', viewKey);

        // Call view-specific initialization
        switch(viewKey) {
            case 'dashboard':
                if (typeof initDashboardChart === 'function') {
                    initDashboardChart();
                }
                break;
            case 'tresorerie':
                if (typeof initCashflowChart === 'function') {
                    initCashflowChart();
                }
                break;
            case 'factures':
                if (typeof loadInvoices === 'function') {
                    loadInvoices();
                }
                break;
            case 'rh':
                if (typeof loadEmployees === 'function') {
                    loadEmployees();
                }
                break;
            case 'pointage':
                if (typeof updateClockHistoryTable === 'function') {
                    updateClockHistoryTable();
                }
                if (typeof updateClockStats === 'function') {
                    updateClockStats();
                }
                break;
            case 'import':
                if (typeof initializeDropZones === 'function') {
                    initializeDropZones();
                }
                break;
        }
    }

    // =====================================================
    // HELPER FUNCTIONS
    // =====================================================

    function getViewIcon(viewKey) {
        const icons = {
            'dashboard': '📊',
            'tresorerie': '💰',
            'factures': '📄',
            'rh': '👥',
            'pointage': '⏰',
            'planning': '📅',
            'import': '📁',
            'alertes': '🔔',
            'analyse': '📈',
            'espace-client': '👤',
            'fec': '📊'
        };
        return icons[viewKey] || '📄';
    }

    function handleLogout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            console.log('👋 Logging out...');
            clearSecureToken();
            sessionStorage.removeItem('currentUser');
            AppState.viewCache.clear();
            secureRedirect('login.html');
        }
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    async function initializeApp() {
        console.log('🎬 Starting NUMMA application...');

        // Check authentication
        if (!checkAuthentication()) {
            return;
        }

        // Render UI components
        renderSidebar();
        renderTopBar();

        // Load default view
        const defaultView = APP_CONFIG.defaultView;
        await switchView(defaultView);

        AppState.initialized = true;
        console.log('✅ NUMMA application ready');

        // Show welcome message
        setTimeout(() => {
            const user = AppState.currentUser;
            showSuccess(`Bienvenue ${user?.contact_name || 'sur NUMMA'}!`);
        }, 500);
    }

    // =====================================================
    // EXPORT GLOBAL FUNCTIONS
    // =====================================================

    window.switchView = switchView;
    window.handleLogout = handleLogout;
    window.AppState = AppState;

    // =====================================================
    // START APPLICATION
    // =====================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    console.log('✅ Main application controller loaded');
})();
