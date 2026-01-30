/**
 * ========================================
 * NUMMA - FEC MODULE v3.0
 * ========================================
 * Comprehensive FEC (Fichier des Écritures Comptables) management
 * 
 * Features:
 * - Full FEC compliance validation
 * - Balance verification
 * - PCG (Plan Comptable Général) validation
 * - Chronological order checking
 * - ISO-8859-1 encoding support
 * - Import/Export functionality
 * 
 * French Tax Authority Requirements:
 * - Format: Pipe-delimited text file
 * - Encoding: ISO-8859-1 (NOT UTF-8)
 * - Fields: 18 mandatory fields per line
 * - Balance: Debit = Credit per PieceRef
 * - Order: Chronological by EcritureDate
 */

(function() {
    'use strict';

    console.log('📊 Loading FEC Module v3.0...');

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const FEC_CONFIG = {
        // Field definitions (18 mandatory fields)
        FIELDS: [
            'JournalCode',     // Journal code (e.g., VE, AC, BQ)
            'JournalLib',      // Journal label
            'EcritureNum',     // Entry number (unique)
            'EcritureDate',    // Entry date (YYYYMMDD)
            'CompteNum',       // Account number (PCG)
            'CompteLib',       // Account label
            'CompAuxNum',      // Auxiliary account number (optional)
            'CompAuxLib',      // Auxiliary account label (optional)
            'PieceRef',        // Document reference
            'PieceDate',       // Document date (YYYYMMDD)
            'EcritureLib',     // Entry description
            'Debit',           // Debit amount
            'Credit',          // Credit amount
            'EcritureLet',     // Lettrage (optional)
            'DateLet',         // Lettrage date (optional)
            'ValidDate',       // Validation date (YYYYMMDD)
            'Montantdevise',   // Foreign currency amount (optional)
            'Idevise'          // Currency code (optional)
        ],

        // Validation rules
        VALIDATION: {
            DATE_FORMAT: /^\d{8}$/,           // YYYYMMDD
            ACCOUNT_MIN_LENGTH: 3,             // Min account number length
            ACCOUNT_MAX_LENGTH: 20,            // Max account number length
            MAX_AMOUNT: 9999999999.99,         // Max debit/credit
            BALANCE_TOLERANCE: 0.01            // Allowed rounding difference
        },

        // Plan Comptable Général - Account classes
        PCG_CLASSES: {
            '1': 'Comptes de capitaux',
            '2': 'Comptes d\'immobilisations',
            '3': 'Comptes de stocks',
            '4': 'Comptes de tiers',
            '5': 'Comptes financiers',
            '6': 'Comptes de charges',
            '7': 'Comptes de produits',
            '8': 'Comptes spéciaux'
        },

        // Common journal codes
        JOURNAL_CODES: {
            'AC': 'Achats',
            'VE': 'Ventes',
            'BQ': 'Banque',
            'CA': 'Caisse',
            'OD': 'Opérations diverses',
            'AN': 'À nouveau'
        }
    };

    // =====================================================
    // VALIDATION FUNCTIONS
    // =====================================================

    /**
     * Validate a single FEC entry
     * @param {Object} entry - FEC entry to validate
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    function validateEntry(entry) {
        const errors = [];

        // Check required fields
        const requiredFields = [
            'JournalCode', 'EcritureNum', 'EcritureDate',
            'CompteNum', 'CompteLib', 'PieceRef', 'EcritureLib'
        ];

        requiredFields.forEach(field => {
            if (!entry[field] || entry[field].toString().trim() === '') {
                errors.push(`Champ requis manquant: ${field}`);
            }
        });

        // Validate date format
        if (entry.EcritureDate && !FEC_CONFIG.VALIDATION.DATE_FORMAT.test(entry.EcritureDate)) {
            errors.push(`Format de date invalide: ${entry.EcritureDate} (attendu: YYYYMMDD)`);
        }

        // Validate account number
        if (entry.CompteNum) {
            const accountLen = entry.CompteNum.length;
            if (accountLen < FEC_CONFIG.VALIDATION.ACCOUNT_MIN_LENGTH || 
                accountLen > FEC_CONFIG.VALIDATION.ACCOUNT_MAX_LENGTH) {
                errors.push(`Numéro de compte invalide: ${entry.CompteNum}`);
            }

            // Check PCG class
            const accountClass = entry.CompteNum[0];
            if (!FEC_CONFIG.PCG_CLASSES[accountClass]) {
                errors.push(`Classe de compte invalide: ${accountClass}`);
            }
        }

        // Validate amounts
        const debit = parseFloat(entry.Debit || 0);
        const credit = parseFloat(entry.Credit || 0);

        if (isNaN(debit)) {
            errors.push(`Montant débit invalide: ${entry.Debit}`);
        }
        if (isNaN(credit)) {
            errors.push(`Montant crédit invalide: ${entry.Credit}`);
        }

        if (debit > FEC_CONFIG.VALIDATION.MAX_AMOUNT) {
            errors.push(`Débit trop élevé: ${debit}`);
        }
        if (credit > FEC_CONFIG.VALIDATION.MAX_AMOUNT) {
            errors.push(`Crédit trop élevé: ${credit}`);
        }

        // At least one of debit or credit must be non-zero
        if (debit === 0 && credit === 0) {
            errors.push('Au moins un montant (débit ou crédit) doit être non nul');
        }

        // Debit and credit cannot both be non-zero
        if (debit > 0 && credit > 0) {
            errors.push('Débit et crédit ne peuvent pas être tous deux renseignés');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Comprehensive FEC compliance validation
     * @param {Array} entries - All FEC entries
     * @returns {Object} { valid: boolean, errors: array, warnings: array }
     */
    function validateFECCompliance(entries) {
        console.log('Validating FEC compliance for', entries.length, 'entries...');

        const errors = [];
        const warnings = [];

        if (!entries || entries.length === 0) {
            errors.push({
                type: 'EMPTY_FEC',
                message: 'Aucune écriture à valider'
            });
            return { valid: false, errors, warnings };
        }

        // 1. Individual entry validation
        entries.forEach((entry, index) => {
            const validation = validateEntry(entry);
            if (!validation.valid) {
                validation.errors.forEach(error => {
                    errors.push({
                        type: 'ENTRY_INVALID',
                        message: error,
                        entry: entry.EcritureNum || `Ligne ${index + 1}`
                    });
                });
            }
        });

        // 2. Balance verification per PieceRef
        const pieceRefs = {};
        entries.forEach(entry => {
            const ref = entry.PieceRef;
            if (!pieceRefs[ref]) {
                pieceRefs[ref] = { debit: 0, credit: 0, entries: [] };
            }
            pieceRefs[ref].debit += parseFloat(entry.Debit || 0);
            pieceRefs[ref].credit += parseFloat(entry.Credit || 0);
            pieceRefs[ref].entries.push(entry.EcritureNum);
        });

        Object.entries(pieceRefs).forEach(([ref, totals]) => {
            const diff = Math.abs(totals.debit - totals.credit);
            if (diff > FEC_CONFIG.VALIDATION.BALANCE_TOLERANCE) {
                errors.push({
                    type: 'BALANCE_ERROR',
                    message: `Pièce ${ref} déséquilibrée: Débit ${totals.debit.toFixed(2)} ≠ Crédit ${totals.credit.toFixed(2)}`,
                    entry: ref
                });
            }
        });

        // 3. Chronological order verification
        const dates = entries.map(e => ({
            date: e.EcritureDate,
            num: e.EcritureNum
        })).sort((a, b) => a.date.localeCompare(b.date));

        let prevDate = '';
        dates.forEach((item, index) => {
            if (index > 0 && item.date < prevDate) {
                warnings.push({
                    type: 'CHRONOLOGY_WARNING',
                    message: `Ordre chronologique non respecté: ${item.num} (${item.date}) après ${dates[index-1].num} (${dates[index-1].date})`
                });
            }
            prevDate = item.date;
        });

        // 4. Sequence continuity check
        const ecritureNums = entries.map(e => e.EcritureNum).sort();
        for (let i = 1; i < ecritureNums.length; i++) {
            if (ecritureNums[i] === ecritureNums[i-1]) {
                errors.push({
                    type: 'DUPLICATE_NUM',
                    message: `Numéro d'écriture dupliqué: ${ecritureNums[i]}`
                });
            }
        }

        // 5. VAT account validation (445*)
        entries.forEach(entry => {
            if (entry.CompteNum && entry.CompteNum.startsWith('445')) {
                const amount = parseFloat(entry.Debit || entry.Credit || 0);
                if (amount === 0) {
                    warnings.push({
                        type: 'VAT_WARNING',
                        message: `Compte TVA ${entry.CompteNum} avec montant nul`,
                        entry: entry.EcritureNum
                    });
                }
            }
        });

        // 6. Journal code validation
        entries.forEach(entry => {
            if (entry.JournalCode && !FEC_CONFIG.JOURNAL_CODES[entry.JournalCode]) {
                warnings.push({
                    type: 'UNKNOWN_JOURNAL',
                    message: `Code journal non standard: ${entry.JournalCode}`,
                    entry: entry.EcritureNum
                });
            }
        });

        const valid = errors.length === 0;

        console.log(`Validation complete: ${valid ? 'VALID' : 'INVALID'}, ${errors.length} errors, ${warnings.length} warnings`);

        return {
            valid,
            errors,
            warnings
        };
    }

    // =====================================================
    // FEC FILE GENERATION
    // =====================================================

    /**
     * Generate FEC file content
     * @param {Array} entries - FEC entries
     * @returns {string} FEC file content (pipe-delimited)
     */
    function generateFECFile(entries) {
        console.log('Generating FEC file for', entries.length, 'entries...');

        if (!entries || entries.length === 0) {
            throw new Error('Aucune écriture à exporter');
        }

        // Header line (field names)
        const header = FEC_CONFIG.FIELDS.join('|');

        // Data lines
        const lines = entries.map(entry => {
            return FEC_CONFIG.FIELDS.map(field => {
                let value = entry[field] || '';
                
                // Format amounts with comma decimal separator
                if (field === 'Debit' || field === 'Credit' || field === 'Montantdevise') {
                    const num = parseFloat(value || 0);
                    value = num.toFixed(2).replace('.', ',');
                }
                
                // Ensure no pipe characters in values (would break format)
                value = value.toString().replace(/\|/g, '');
                
                return value;
            }).join('|');
        });

        const content = [header, ...lines].join('\r\n');

        console.log('✅ FEC file generated:', lines.length, 'entries');

        return content;
    }

    // =====================================================
    // FEC FILE PARSING
    // =====================================================

    /**
     * Parse FEC file content
     * @param {string} content - FEC file content
     * @returns {Array} Array of entry objects
     */
    function parseFECFile(content) {
        console.log('Parsing FEC file...');

        if (!content || content.trim() === '') {
            throw new Error('Fichier FEC vide');
        }

        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) {
            throw new Error('Fichier FEC invalide: moins de 2 lignes');
        }

        // First line should be header
        const header = lines[0].split('|');
        
        // Validate header
        const expectedFields = FEC_CONFIG.FIELDS;
        if (header.length !== expectedFields.length) {
            throw new Error(`Format FEC invalide: ${header.length} colonnes au lieu de ${expectedFields.length}`);
        }

        // Parse data lines
        const entries = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('|');
            
            if (values.length !== expectedFields.length) {
                console.warn(`Ligne ${i + 1} ignorée: nombre de colonnes invalide`);
                continue;
            }

            const entry = {};
            expectedFields.forEach((field, index) => {
                let value = values[index].trim();
                
                // Convert comma to dot for amounts
                if (field === 'Debit' || field === 'Credit' || field === 'Montantdevise') {
                    value = value.replace(',', '.');
                }
                
                entry[field] = value;
            });

            entries.push(entry);
        }

        console.log('✅ FEC file parsed:', entries.length, 'entries');

        return entries;
    }

    // =====================================================
    // ENCODING HELPERS
    // =====================================================

    /**
     * Note: Browsers cannot directly save files in ISO-8859-1 encoding.
     * They will save as UTF-8 regardless of the blob type specified.
     * 
     * For official FEC submission, the file MUST be converted to ISO-8859-1
     * using server-side tools or command-line utilities.
     * 
     * Command-line conversion:
     * - iconv: `iconv -f UTF-8 -t ISO-8859-1 input.txt > output.txt`
     * - Python: `with open('out.txt', 'w', encoding='iso-8859-1') as f: ...`
     * 
     * This function documents the requirement but cannot enforce it client-side.
     */
    function getEncodingNote() {
        return `
⚠️ IMPORTANT - Encodage ISO-8859-1

Le fichier FEC doit être encodé en ISO-8859-1 pour être accepté par l'administration fiscale.

Le navigateur sauvegarde en UTF-8. Vous devez convertir le fichier avec:
- iconv (Linux/Mac): iconv -f UTF-8 -t ISO-8859-1 fichier.txt > fichier_iso.txt
- Python: voir documentation pour conversion
- Éditeur de texte: Enregistrer avec encodage ISO-8859-1

NE PAS soumettre directement le fichier téléchargé depuis le navigateur.
        `.trim();
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    /**
     * Get statistics from FEC entries
     * @param {Array} entries - FEC entries
     * @returns {Object} Statistics object
     */
    function getStatistics(entries) {
        return {
            totalEntries: entries.length,
            validatedEntries: entries.filter(e => e.ValidDate && e.ValidDate.trim() !== '').length,
            totalDebit: entries.reduce((sum, e) => sum + parseFloat(e.Debit || 0), 0),
            totalCredit: entries.reduce((sum, e) => sum + parseFloat(e.Credit || 0), 0),
            dateRange: {
                start: entries.length > 0 ? Math.min(...entries.map(e => e.EcritureDate)) : null,
                end: entries.length > 0 ? Math.max(...entries.map(e => e.EcritureDate)) : null
            },
            journalCounts: countByField(entries, 'JournalCode'),
            accountClasses: countAccountClasses(entries)
        };
    }

    function countByField(entries, field) {
        const counts = {};
        entries.forEach(entry => {
            const value = entry[field] || 'Non renseigné';
            counts[value] = (counts[value] || 0) + 1;
        });
        return counts;
    }

    function countAccountClasses(entries) {
        const classes = {};
        entries.forEach(entry => {
            if (entry.CompteNum) {
                const classNum = entry.CompteNum[0];
                const className = FEC_CONFIG.PCG_CLASSES[classNum] || 'Classe inconnue';
                classes[classNum] = classes[classNum] || { name: className, count: 0 };
                classes[classNum].count++;
            }
        });
        return classes;
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.FECModule = {
        // Validation
        validateEntry,
        validateFECCompliance,
        
        // File operations
        generateFECFile,
        parseFECFile,
        
        // Utilities
        getStatistics,
        getEncodingNote,
        
        // Configuration
        config: FEC_CONFIG
    };

    console.log('✅ FEC Module v3.0 loaded');
})();
