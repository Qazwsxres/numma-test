/**
 * ========================================
 * NUMMA Messages System v3.1
 * ========================================
 * Professional notification system with XSS protection
 * 
 * DEPENDENCIES: security.js (MUST BE LOADED FIRST)
 */

(function() {
    'use strict';

    console.log('📢 Loading NUMMA Messages System...');

    // =====================================================
    // DEPENDENCY CHECK
    // =====================================================

    if (typeof window.escapeHtml === 'undefined') {
        console.error('❌ CRITICAL: security.js must be loaded BEFORE numma-messages.js');
        alert('Security module not loaded. Please refresh the page.');
        return;
    }

    // =====================================================
    // GLOBAL STATE
    // =====================================================

    window.nummaMessages = [];

    // =====================================================
    // MESSAGE DISPLAY FUNCTIONS
    // =====================================================

    /**
     * Show notification message (XSS-safe)
     * @param {string} message - Message text (will be escaped)
     * @param {string} type - Message type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms (0 = permanent)
     */
    window.showMessage = function(message, type = 'info', duration = 5000) {
        const container = getOrCreateContainer();
        
        const messageEl = document.createElement('div');
        messageEl.className = `numma-message numma-message-${type}`;
        
        const icon = getIcon(type);
        
        // ✅ SECURITY FIX: Use escapeHtml to prevent XSS
        const safeMessage = window.escapeHtml(message);
        
        messageEl.innerHTML = `
            <div class="numma-message-icon">${icon}</div>
            <div class="numma-message-text">${safeMessage}</div>
            <button class="numma-message-close" onclick="this.parentElement.remove()" aria-label="Fermer">×</button>
        `;
        
        container.appendChild(messageEl);
        
        // Add to history
        window.nummaMessages.push({
            message: safeMessage,
            type,
            timestamp: new Date()
        });
        
        // Auto-remove if duration set
        if (duration > 0) {
            setTimeout(() => {
                messageEl.classList.add('numma-message-fade');
                setTimeout(() => {
                    if (messageEl.parentElement) {
                        messageEl.remove();
                    }
                }, 300);
            }, duration);
        }
        
        return messageEl;
    };

    /**
     * Show success message
     */
    window.showSuccess = function(message, duration = 3000) {
        return window.showMessage(message, 'success', duration);
    };

    /**
     * Show error message
     */
    window.showError = function(message, duration = 5000) {
        return window.showMessage(message, 'error', duration);
    };

    /**
     * Show warning message
     */
    window.showWarning = function(message, duration = 4000) {
        return window.showMessage(message, 'warning', duration);
    };

    /**
     * Show info message
     */
    window.showInfo = function(message, duration = 3000) {
        return window.showMessage(message, 'info', duration);
    };

    /**
     * Clear all messages
     */
    window.clearMessages = function() {
        const container = document.getElementById('numma-messages-container');
        if (container) {
            container.innerHTML = '';
        }
        window.nummaMessages = [];
    };

    // =====================================================
    // HELPER FUNCTIONS
    // =====================================================

    /**
     * Get or create messages container
     */
    function getOrCreateContainer() {
        let container = document.getElementById('numma-messages-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'numma-messages-container';
            container.className = 'numma-messages-container';
            container.setAttribute('role', 'alert');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        
        return container;
    }

    /**
     * Get icon for message type
     */
    function getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // =====================================================
    // STYLES
    // =====================================================

    const style = document.createElement('style');
    style.textContent = `
        .numma-messages-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            pointer-events: none;
        }

        .numma-message {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            background: white;
            border-left: 4px solid;
            animation: nummaSlideIn 0.3s ease;
            position: relative;
            pointer-events: auto;
        }

        .numma-message-success {
            border-left-color: #10b981;
            background: #f0fdf4;
        }

        .numma-message-error {
            border-left-color: #ef4444;
            background: #fef2f2;
        }

        .numma-message-warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }

        .numma-message-info {
            border-left-color: #3b82f6;
            background: #eff6ff;
        }

        .numma-message-icon {
            font-size: 20px;
            font-weight: bold;
            flex-shrink: 0;
        }

        .numma-message-success .numma-message-icon {
            color: #10b981;
        }

        .numma-message-error .numma-message-icon {
            color: #ef4444;
        }

        .numma-message-warning .numma-message-icon {
            color: #f59e0b;
        }

        .numma-message-info .numma-message-icon {
            color: #3b82f6;
        }

        .numma-message-text {
            flex: 1;
            font-size: 14px;
            color: #374151;
            line-height: 1.5;
            word-break: break-word;
        }

        .numma-message-close {
            background: none;
            border: none;
            font-size: 20px;
            color: #9ca3af;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .numma-message-close:hover {
            background: rgba(0,0,0,0.05);
            color: #374151;
        }

        .numma-message-close:focus {
            outline: 2px solid #2563eb;
            outline-offset: 2px;
        }

        .numma-message-fade {
            animation: nummaSlideOut 0.3s ease forwards;
        }

        @keyframes nummaSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes nummaSlideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @media (max-width: 768px) {
            .numma-messages-container {
                left: 10px;
                right: 10px;
                max-width: none;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .numma-message {
                animation: none;
            }
            .numma-message-fade {
                animation: none;
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    console.log('✅ NUMMA Messages System loaded (XSS-protected)');
})();
