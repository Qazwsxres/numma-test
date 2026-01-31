/**
 * ========================================
 * NUMMA - POINTAGES MODULE v3.0
 * ========================================
 * Time tracking with offline support
 * 
 * Features:
 * - Clock in/out operations
 * - Offline support with pending queue
 * - Auto-sync with retry mechanism
 * - Proper interval cleanup
 * - Timestamp validation
 * - Session management
 * 
 * DEPENDENCIES: security.js, numma-messages.js
 */

(function() {
    'use strict';

    console.log('⏰ Loading NUMMA Pointages Module v3.0...');

    // Dependency check
    if (typeof window.getSecureToken === 'undefined' || 
        typeof window.showMessage === 'undefined') {
        console.error('❌ Dependencies missing');
        return;
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const POINTAGE_CONFIG = {
        API_BASE: 'https://optimis-fiscale-production.up.railway.app',
        SYNC_INTERVAL: 60000, // 1 minute
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 5000,
        PENDING_KEY: 'numma_pending_pointages'
    };

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================

    let state = {
        syncInterval: null,
        pendingPointages: [],
        currentSession: null,
        lastSync: null,
        isSyncing: false
    };

    // =====================================================
    // INITIALIZATION
    // =====================================================

    /**
     * Load pending pointages from storage
     */
    function loadPendingPointages() {
        try {
            const stored = localStorage.getItem(POINTAGE_CONFIG.PENDING_KEY);
            if (stored) {
                state.pendingPointages = JSON.parse(stored);
                console.log('Loaded', state.pendingPointages.length, 'pending pointages');
            }
        } catch (e) {
            console.warn('Failed to load pending pointages:', e);
            state.pendingPointages = [];
        }
    }

    /**
     * Save pending pointages to storage
     */
    function savePendingPointages() {
        try {
            localStorage.setItem(
                POINTAGE_CONFIG.PENDING_KEY,
                JSON.stringify(state.pendingPointages)
            );
        } catch (e) {
            console.warn('Failed to save pending pointages:', e);
        }
    }

    // =====================================================
    // API FUNCTIONS
    // =====================================================

    /**
     * Clock in
     */
    async function clockIn() {
        const timestamp = new Date().toISOString();
        console.log('Clocking in at:', timestamp);

        try {
            // Validate timestamp
            validatePointage({ timestamp });

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${POINTAGE_CONFIG.API_BASE}/api/clock/in`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ timestamp }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            state.currentSession = data.session_id;

            showSuccess('Pointage d\'entrée enregistré');
            console.log('✅ Clocked in, session:', data.session_id);

            return data;

        } catch (error) {
            console.error('❌ Clock in failed, saving offline:', error);

            // Save locally for sync later
            addPendingPointage('in', timestamp);
            showWarning('Pointage enregistré localement, sera synchronisé');

            return {
                timestamp,
                offline: true,
                pending: true
            };
        }
    }

    /**
     * Clock out
     */
    async function clockOut() {
        const timestamp = new Date().toISOString();
        console.log('Clocking out at:', timestamp);

        try {
            // Validate
            validatePointage({ timestamp });

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${POINTAGE_CONFIG.API_BASE}/api/clock/out`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    timestamp,
                    session_id: state.currentSession
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            state.currentSession = null;

            showSuccess('Pointage de sortie enregistré');
            console.log('✅ Clocked out');

            return data;

        } catch (error) {
            console.error('❌ Clock out failed, saving offline:', error);

            // Save locally
            addPendingPointage('out', timestamp, state.currentSession);
            state.currentSession = null;
            showWarning('Pointage enregistré localement');

            return {
                timestamp,
                offline: true,
                pending: true
            };
        }
    }

    /**
     * Get history
     */
    async function getHistory(startDate = null, endDate = null) {
        console.log('Getting pointage history:', startDate, endDate);

        try {
            const token = getSecureToken();
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const url = `${POINTAGE_CONFIG.API_BASE}/api/clock/history${params.toString() ? '?' + params.toString() : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const history = await response.json();
            console.log('✅ History loaded:', history.length, 'entries');

            return history;

        } catch (error) {
            console.error('❌ History loading failed:', error);
            showError('Impossible de charger l\'historique');
            return [];
        }
    }

    /**
     * Get current session
     */
    async function getCurrentSession() {
        console.log('Getting current session...');

        try {
            const token = getSecureToken();
            const response = await fetch(`${POINTAGE_CONFIG.API_BASE}/api/clock/session`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const session = await response.json();
            
            if (session && session.id) {
                state.currentSession = session.id;
                console.log('✅ Current session:', session.id);
            }

            return session;

        } catch (error) {
            console.error('❌ Session loading failed:', error);
            return null;
        }
    }

    /**
     * Get statistics
     */
    async function getStatistics(month = null, year = null) {
        console.log('Getting statistics for:', month, year);

        try {
            const token = getSecureToken();
            const params = new URLSearchParams();
            if (month) params.append('month', month);
            if (year) params.append('year', year);

            const url = `${POINTAGE_CONFIG.API_BASE}/api/clock/statistics${params.toString() ? '?' + params.toString() : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();
            console.log('✅ Statistics loaded');

            return stats;

        } catch (error) {
            console.error('❌ Statistics loading failed:', error);
            return {
                total_hours: 0,
                days_worked: 0,
                average_hours_per_day: 0
            };
        }
    }

    // =====================================================
    // OFFLINE SUPPORT
    // =====================================================

    /**
     * Add pointage to pending queue
     */
    function addPendingPointage(type, timestamp, sessionId = null) {
        const pointage = {
            id: generateId(),
            type: type,
            timestamp: timestamp,
            session_id: sessionId,
            attempts: 0,
            created_at: Date.now()
        };

        state.pendingPointages.push(pointage);
        savePendingPointages();

        console.log('Pending pointage added:', pointage.id);

        // Try to sync immediately
        syncPendingPointages();
    }

    /**
     * Sync all pending pointages
     */
    async function syncPendingPointages() {
        if (state.pendingPointages.length === 0) {
            return;
        }

        if (state.isSyncing) {
            console.log('Already syncing, skipping...');
            return;
        }

        state.isSyncing = true;
        console.log('Syncing', state.pendingPointages.length, 'pending pointages...');

        // Copy array to avoid modification during iteration
        const toSync = [...state.pendingPointages];

        for (const pointage of toSync) {
            try {
                await syncSinglePointage(pointage);

                // Remove from pending
                state.pendingPointages = state.pendingPointages.filter(
                    p => p.id !== pointage.id
                );

                console.log('✅ Synced pointage:', pointage.id);

            } catch (error) {
                pointage.attempts++;

                if (pointage.attempts >= POINTAGE_CONFIG.MAX_RETRY_ATTEMPTS) {
                    console.error('Max retry attempts reached:', pointage.id);
                    showError('Échec de synchronisation du pointage');

                    // Remove failed pointage
                    state.pendingPointages = state.pendingPointages.filter(
                        p => p.id !== pointage.id
                    );
                } else {
                    console.warn(`Sync failed (attempt ${pointage.attempts}/${POINTAGE_CONFIG.MAX_RETRY_ATTEMPTS}):`, error);
                }
            }
        }

        // Save updated pending list
        savePendingPointages();

        state.lastSync = Date.now();
        state.isSyncing = false;

        if (state.pendingPointages.length === 0) {
            console.log('✅ All pointages synced');
        } else {
            console.log('⚠️', state.pendingPointages.length, 'pointages still pending');
        }
    }

    /**
     * Sync single pointage
     */
    async function syncSinglePointage(pointage) {
        const endpoint = pointage.type === 'in'
            ? '/api/clock/in'
            : '/api/clock/out';

        const token = getSecureToken();
        const headers = await addCSRFHeader({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        const body = {
            timestamp: pointage.timestamp
        };

        if (pointage.type === 'out' && pointage.session_id) {
            body.session_id = pointage.session_id;
        }

        const response = await fetch(`${POINTAGE_CONFIG.API_BASE}${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Sync failed: HTTP ${response.status}`);
        }

        return response.json();
    }

    // =====================================================
    // AUTO-SYNC (WITH PROPER CLEANUP)
    // =====================================================

    /**
     * Start auto-sync interval
     */
    function startAutoSync() {
        // Clear existing interval first
        stopAutoSync();

        state.syncInterval = setInterval(() => {
            syncPendingPointages().catch(error => {
                console.error('Auto-sync error:', error);
            });
        }, POINTAGE_CONFIG.SYNC_INTERVAL);

        console.log('✅ Auto-sync started (every', POINTAGE_CONFIG.SYNC_INTERVAL / 1000, 'seconds)');
    }

    /**
     * Stop auto-sync interval
     */
    function stopAutoSync() {
        if (state.syncInterval) {
            clearInterval(state.syncInterval);
            state.syncInterval = null;
            console.log('Auto-sync stopped');
        }
    }

    // =====================================================
    // VALIDATION
    // =====================================================

    /**
     * Validate pointage data
     */
    function validatePointage(data) {
        if (!data.timestamp) {
            throw new Error('Timestamp requis');
        }

        const timestamp = new Date(data.timestamp);
        
        if (isNaN(timestamp.getTime())) {
            throw new Error('Timestamp invalide');
        }

        // Can't clock in/out in the future
        if (timestamp > new Date()) {
            throw new Error('Date future non autorisée');
        }

        // Can't clock in/out more than 24h in the past
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (timestamp < oneDayAgo) {
            throw new Error('Date trop ancienne (max 24h)');
        }

        return true;
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    /**
     * Generate unique ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // =====================================================
    // CLEANUP
    // =====================================================

    /**
     * Cleanup function
     */
    function cleanup() {
        console.log('Cleaning up pointages module...');

        // Stop auto-sync
        stopAutoSync();

        // Sync any remaining pending pointages
        if (state.pendingPointages.length > 0) {
            console.log('Syncing remaining pending pointages...');
            syncPendingPointages().catch(error => {
                console.error('Final sync failed:', error);
            });
        }

        // Clear state
        state.currentSession = null;
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.PointageAPI = {
        // Actions
        clockIn: clockIn,
        clockOut: clockOut,

        // Data
        getHistory: getHistory,
        getCurrentSession: getCurrentSession,
        getStatistics: getStatistics,

        // Sync
        sync: syncPendingPointages,
        startAutoSync: startAutoSync,
        stopAutoSync: stopAutoSync,

        // State
        getPendingCount: () => state.pendingPointages.length,
        hasPending: () => state.pendingPointages.length > 0,
        isCurrentlyClocked: () => state.currentSession !== null,

        // Validation
        validate: validatePointage,

        // Cleanup
        cleanup: cleanup
    };

    // =====================================================
    // INITIALIZATION
    // =====================================================

    // Load pending pointages from storage
    loadPendingPointages();

    // Start auto-sync
    startAutoSync();

    // Get current session if any
    getCurrentSession().catch(console.error);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        cleanup();
    });

    console.log('✅ NUMMA Pointages Module v3.0 loaded');
    console.log('Pending pointages:', state.pendingPointages.length);

})();
