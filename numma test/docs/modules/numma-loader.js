/**
 * ========================================
 * NUMMA - MODULE LOADER v3.0
 * ========================================
 * Dynamic module dependency management and loading
 * 
 * Features:
 * - Dependency resolution
 * - Module initialization order
 * - Error handling for missing modules
 * - Module state tracking
 * 
 * DEPENDENCIES: None (loads first after core utilities)
 */

(function() {
    'use strict';

    console.log('🔄 Loading NUMMA Module Loader v3.0...');

    // =====================================================
    // MODULE REGISTRY
    // =====================================================

    const moduleRegistry = {
        // Core utilities (always loaded first)
        'security': {
            loaded: false,
            required: true,
            path: 'utils/security.js',
            global: 'NUMMA_SECURITY'
        },
        'table-helpers': {
            loaded: false,
            required: true,
            path: 'utils/table-helpers.js',
            global: 'TABLE_HELPERS'
        },

        // Message system
        'messages': {
            loaded: false,
            required: true,
            path: 'modules/numma-messages.js',
            global: 'showMessage',
            depends: ['security']
        },

        // API Modules
        'invoices': {
            loaded: false,
            required: false,
            path: 'modules/numma-invoices.js',
            global: 'InvoiceAPI',
            depends: ['security', 'messages']
        },
        'employees': {
            loaded: false,
            required: false,
            path: 'modules/numma-employees.js',
            global: 'EmployeeAPI',
            depends: ['security', 'messages', 'exports']
        },
        'pointages': {
            loaded: false,
            required: false,
            path: 'modules/numma-pointages.js',
            global: 'PointageAPI',
            depends: ['security', 'messages']
        },
        'exports': {
            loaded: false,
            required: false,
            path: 'modules/numma-exports.js',
            global: 'NummaExports',
            depends: ['security']
        },
        'fec': {
            loaded: false,
            required: false,
            path: 'modules/fec-module.js',
            global: 'FECModule',
            depends: []
        },
        'imports': {
            loaded: false,
            required: false,
            path: 'modules/numma-imports.js',
            global: 'ImportsModule',
            depends: ['security', 'messages', 'fec']
        },

        // Interactive modules
        'interactive': {
            loaded: false,
            required: false,
            path: 'modules/numma-interactive-complete.js',
            global: 'InteractiveModule',
            depends: ['security']
        },
        'quick-actions': {
            loaded: false,
            required: false,
            path: 'modules/quick-actions.js',
            global: 'QuickActions',
            depends: ['security', 'messages']
        },

        // Main application
        'main': {
            loaded: false,
            required: true,
            path: 'app/main.js',
            global: 'AppState',
            depends: ['security', 'messages']
        }
    };

    // =====================================================
    // MODULE LOADING STATE
    // =====================================================

    const loadingState = {
        initialized: false,
        errors: [],
        warnings: []
    };

    // =====================================================
    // MODULE CHECKING
    // =====================================================

    /**
     * Check if a module is loaded
     * @param {string} moduleName - Module name from registry
     * @returns {boolean} True if loaded
     */
    function isModuleLoaded(moduleName) {
        const module = moduleRegistry[moduleName];
        if (!module) return false;

        // Check if global variable exists
        if (module.global) {
            const exists = typeof window[module.global] !== 'undefined';
            if (exists && !module.loaded) {
                module.loaded = true;
                console.log(`✅ Module detected: ${moduleName}`);
            }
            return exists;
        }

        return module.loaded;
    }

    /**
     * Check all module dependencies
     * @param {string} moduleName - Module name
     * @returns {Object} { satisfied: boolean, missing: string[] }
     */
    function checkDependencies(moduleName) {
        const module = moduleRegistry[moduleName];
        if (!module || !module.depends) {
            return { satisfied: true, missing: [] };
        }

        const missing = [];
        for (const depName of module.depends) {
            if (!isModuleLoaded(depName)) {
                missing.push(depName);
            }
        }

        return {
            satisfied: missing.length === 0,
            missing
        };
    }

    // =====================================================
    // MODULE INITIALIZATION
    // =====================================================

    /**
     * Initialize and verify all modules
     */
    function initializeModules() {
        console.log('🔄 Initializing NUMMA modules...');

        loadingState.initialized = true;

        // Check all modules
        for (const [moduleName, module] of Object.entries(moduleRegistry)) {
            const loaded = isModuleLoaded(moduleName);

            if (!loaded) {
                const message = `Module ${moduleName} not loaded`;
                
                if (module.required) {
                    loadingState.errors.push(message);
                    console.error(`❌ CRITICAL: ${message}`);
                } else {
                    loadingState.warnings.push(message);
                    console.warn(`⚠️ Optional: ${message}`);
                }
            } else {
                // Check dependencies
                const deps = checkDependencies(moduleName);
                if (!deps.satisfied) {
                    const message = `${moduleName} missing dependencies: ${deps.missing.join(', ')}`;
                    loadingState.warnings.push(message);
                    console.warn(`⚠️ ${message}`);
                }
            }
        }

        // Display summary
        displayLoadingSummary();

        // Check critical errors
        if (loadingState.errors.length > 0) {
            console.error('❌ Critical module loading errors detected');
            if (typeof window.showError === 'function') {
                window.showError('Erreur de chargement des modules critiques');
            }
        } else if (loadingState.warnings.length > 0) {
            console.warn('⚠️ Some optional modules not loaded');
        } else {
            console.log('✅ All modules loaded successfully');
        }

        return loadingState.errors.length === 0;
    }

    /**
     * Display loading summary
     */
    function displayLoadingSummary() {
        console.group('📦 NUMMA Module Loading Summary');

        // Count loaded modules
        const total = Object.keys(moduleRegistry).length;
        const loaded = Object.values(moduleRegistry).filter(m => m.loaded).length;
        const required = Object.values(moduleRegistry).filter(m => m.required).length;
        const requiredLoaded = Object.values(moduleRegistry).filter(m => m.required && m.loaded).length;

        console.log(`Total modules: ${total}`);
        console.log(`Loaded: ${loaded}/${total} (${Math.round(loaded/total*100)}%)`);
        console.log(`Required: ${requiredLoaded}/${required}`);

        if (loadingState.errors.length > 0) {
            console.group('❌ Errors:');
            loadingState.errors.forEach(err => console.error(err));
            console.groupEnd();
        }

        if (loadingState.warnings.length > 0) {
            console.group('⚠️ Warnings:');
            loadingState.warnings.forEach(warn => console.warn(warn));
            console.groupEnd();
        }

        console.groupEnd();
    }

    // =====================================================
    // MODULE DIAGNOSTICS
    // =====================================================

    /**
     * Get detailed module status
     * @returns {Object} Module status report
     */
    function getModuleStatus() {
        const status = {};

        for (const [name, module] of Object.entries(moduleRegistry)) {
            const loaded = isModuleLoaded(name);
            const deps = checkDependencies(name);

            status[name] = {
                loaded,
                required: module.required,
                path: module.path,
                dependencies: module.depends || [],
                dependenciesSatisfied: deps.satisfied,
                missingDependencies: deps.missing
            };
        }

        return status;
    }

    /**
     * Print module status to console
     */
    function printModuleStatus() {
        console.table(getModuleStatus());
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.ModuleLoader = {
        // Module checking
        isModuleLoaded,
        checkDependencies,

        // Initialization
        initializeModules,

        // Diagnostics
        getModuleStatus,
        printModuleStatus,

        // Registry access (read-only)
        getRegistry: () => ({ ...moduleRegistry }),

        // State access
        getState: () => ({ ...loadingState })
    };

    // =====================================================
    // AUTO-INITIALIZE
    // =====================================================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeModules, 100);
        });
    } else {
        // DOM already loaded
        setTimeout(initializeModules, 100);
    }

    console.log('✅ NUMMA Module Loader v3.0 loaded');

})();
