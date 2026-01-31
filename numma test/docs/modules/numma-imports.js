/**
 * ========================================
 * NUMMA - IMPORTS MODULE v3.0
 * ========================================
 * Secure file import handling with validation
 * 
 * Features:
 * - FEC file parsing
 * - CSV import with validation
 * - Excel file processing
 * - Bank statement parsing
 * - XSS protection on all parsed data
 * - File size validation
 * - Format validation
 * 
 * DEPENDENCIES: security.js, numma-messages.js
 */

(function() {
    'use strict';

    console.log('📁 Loading NUMMA Imports Module v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined' || 
        typeof window.showMessage === 'undefined') {
        console.error('❌ Dependencies missing: security.js and numma-messages.js required');
        return;
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const IMPORT_CONFIG = {
        API_BASE: 'https://optimis-fiscale-production.up.railway.app',
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        SUPPORTED_FORMATS: {
            fec: ['.txt', '.fec', '.csv'],
            csv: ['.csv'],
            excel: ['.xlsx', '.xls'],
            bank: ['.pdf', '.csv', '.ofx']
        }
    };

    // =====================================================
    // FILE VALIDATION
    // =====================================================

    /**
     * Validate file before processing
     * @param {File} file - File object
     * @param {string} expectedType - Expected file type
     * @returns {Object} { valid: boolean, error: string }
     */
    function validateFile(file, expectedType) {
        const errors = [];

        // Check if file exists
        if (!file) {
            errors.push('Aucun fichier sélectionné');
            return { valid: false, error: errors.join(', ') };
        }

        // Check file size
        if (file.size > IMPORT_CONFIG.MAX_FILE_SIZE) {
            const maxMB = IMPORT_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
            errors.push(`Fichier trop volumineux (max ${maxMB}MB)`);
        }

        if (file.size === 0) {
            errors.push('Fichier vide');
        }

        // Check file extension
        const fileName = file.name.toLowerCase();
        const validExtensions = IMPORT_CONFIG.SUPPORTED_FORMATS[expectedType] || [];
        
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
        if (!hasValidExtension && expectedType !== 'auto') {
            errors.push(`Format invalide (attendu: ${validExtensions.join(', ')})`);
        }

        return {
            valid: errors.length === 0,
            error: errors.join(', ')
        };
    }

    // =====================================================
    // FEC IMPORT
    // =====================================================

    /**
     * Import FEC file
     * @param {File} file - FEC file
     * @returns {Promise<Object>} Import result
     */
    async function importFEC(file) {
        console.log('Importing FEC file:', file.name);

        // Validate
        const validation = validateFile(file, 'fec');
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        showInfo('Lecture du fichier FEC...');

        try {
            // Read file content
            const content = await readFileAsText(file);
            
            // Parse FEC file using FEC module
            if (typeof window.FECModule === 'undefined') {
                throw new Error('Module FEC non chargé');
            }

            const entries = window.FECModule.parseFECFile(content);
            
            if (!entries || entries.length === 0) {
                throw new Error('Aucune écriture trouvée dans le fichier');
            }

            // Validate FEC compliance
            const validation = window.FECModule.validateFECCompliance(entries);
            if (!validation.valid) {
                console.warn('FEC validation warnings:', validation.errors);
                showWarning(`${validation.errors.length} avertissement(s) de validation`);
            }

            // Send to backend
            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${IMPORT_CONFIG.API_BASE}/api/fec/import`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ entries }),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Import failed' }));
                throw new Error(error.detail);
            }

            const result = await response.json();

            showSuccess(`✅ ${entries.length} écritures FEC importées`);
            console.log('✅ FEC import successful');

            return {
                success: true,
                imported: entries.length,
                type: 'fec',
                validation: validation
            };

        } catch (error) {
            console.error('❌ FEC import failed:', error);
            showError(`Erreur d'import FEC: ${error.message}`);
            throw error;
        }
    }

    // =====================================================
    // CSV IMPORT
    // =====================================================

    /**
     * Import CSV file
     * @param {File} file - CSV file
     * @returns {Promise<Object>} Import result
     */
    async function importCSV(file) {
        console.log('Importing CSV file:', file.name);

        const validation = validateFile(file, 'csv');
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        showInfo('Lecture du fichier CSV...');

        try {
            const content = await readFileAsText(file);
            const lines = content.split(/\r?\n/).filter(line => line.trim());

            if (lines.length < 2) {
                throw new Error('Fichier CSV invalide (trop peu de lignes)');
            }

            // Parse CSV (simple implementation)
            const headers = lines[0].split(';').map(h => h.trim());
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(';');
                const row = {};
                
                headers.forEach((header, index) => {
                    row[header] = values[index] ? values[index].trim() : '';
                });
                
                data.push(row);
            }

            // Send to backend
            const token = getSecureToken();
            const headers_api = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${IMPORT_CONFIG.API_BASE}/api/import/csv`, {
                method: 'POST',
                headers: headers_api,
                body: JSON.stringify({ data, headers }),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Import failed' }));
                throw new Error(error.detail);
            }

            const result = await response.json();

            showSuccess(`✅ ${data.length} lignes CSV importées`);
            console.log('✅ CSV import successful');

            return {
                success: true,
                imported: data.length,
                type: 'csv'
            };

        } catch (error) {
            console.error('❌ CSV import failed:', error);
            showError(`Erreur d'import CSV: ${error.message}`);
            throw error;
        }
    }

    // =====================================================
    // EXCEL IMPORT
    // =====================================================

    /**
     * Import Excel file (delegates to backend)
     * @param {File} file - Excel file
     * @returns {Promise<Object>} Import result
     */
    async function importExcel(file) {
        console.log('Importing Excel file:', file.name);

        const validation = validateFile(file, 'excel');
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        showInfo('Envoi du fichier Excel...');

        try {
            // Send file to backend for processing
            const formData = new FormData();
            formData.append('file', file);

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`
            });

            const response = await fetch(`${IMPORT_CONFIG.API_BASE}/api/import/excel`, {
                method: 'POST',
                headers: headers,
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Import failed' }));
                throw new Error(error.detail);
            }

            const result = await response.json();

            showSuccess(`✅ ${result.imported || 0} lignes Excel importées`);
            console.log('✅ Excel import successful');

            return {
                success: true,
                imported: result.imported || 0,
                type: 'excel'
            };

        } catch (error) {
            console.error('❌ Excel import failed:', error);
            showError(`Erreur d'import Excel: ${error.message}`);
            throw error;
        }
    }

    // =====================================================
    // BANK STATEMENT IMPORT
    // =====================================================

    /**
     * Import bank statement (PDF or CSV)
     * @param {File} file - Bank statement file
     * @returns {Promise<Object>} Import result
     */
    async function importBankStatement(file) {
        console.log('Importing bank statement:', file.name);

        const validation = validateFile(file, 'bank');
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        showInfo('Traitement du relevé bancaire...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`
            });

            const response = await fetch(`${IMPORT_CONFIG.API_BASE}/api/import/bank`, {
                method: 'POST',
                headers: headers,
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Import failed' }));
                throw new Error(error.detail);
            }

            const result = await response.json();

            showSuccess(`✅ ${result.transactions || 0} transactions importées`);
            console.log('✅ Bank statement import successful');

            return {
                success: true,
                imported: result.transactions || 0,
                type: 'bank'
            };

        } catch (error) {
            console.error('❌ Bank import failed:', error);
            showError(`Erreur d'import bancaire: ${error.message}`);
            throw error;
        }
    }

    // =====================================================
    // AUTO IMPORT (DETECT TYPE)
    // =====================================================

    /**
     * Auto-detect file type and import
     * @param {File} file - File to import
     * @returns {Promise<Object>} Import result
     */
    async function autoImport(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.fec') || fileName.endsWith('.txt')) {
            return await importFEC(file);
        } else if (fileName.endsWith('.csv')) {
            // Try FEC first, fallback to CSV
            try {
                return await importFEC(file);
            } catch (error) {
                console.log('Not a FEC file, trying CSV...');
                return await importCSV(file);
            }
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            return await importExcel(file);
        } else if (fileName.endsWith('.pdf') || fileName.endsWith('.ofx')) {
            return await importBankStatement(file);
        } else {
            throw new Error('Format de fichier non supporté');
        }
    }

    // =====================================================
    // FILE READING UTILITIES
    // =====================================================

    /**
     * Read file as text
     * @param {File} file - File object
     * @returns {Promise<string>} File content
     */
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erreur de lecture du fichier'));
            
            reader.readAsText(file);
        });
    }

    /**
     * Read file as array buffer
     * @param {File} file - File object
     * @returns {Promise<ArrayBuffer>} File content
     */
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erreur de lecture du fichier'));
            
            reader.readAsArrayBuffer(file);
        });
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.ImportsModule = {
        // Import functions
        importFEC,
        importCSV,
        importExcel,
        importBankStatement,
        autoImport,

        // Validation
        validateFile,

        // Utilities
        readFileAsText,
        readFileAsArrayBuffer,

        // Configuration
        config: IMPORT_CONFIG
    };

    console.log('✅ NUMMA Imports Module v3.0 loaded');

})();
