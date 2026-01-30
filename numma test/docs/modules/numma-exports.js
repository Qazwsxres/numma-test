/**
 * ========================================
 * NUMMA - EXPORTS MODULE v3.0
 * ========================================
 * Safe document export functionality
 * 
 * Features:
 * - PDF generation (invoices, reports, payslips)
 * - Excel export
 * - CSV export
 * - Secure rendering (no eval, no document.write)
 * - XSS protection on all user data
 * 
 * DEPENDENCIES: security.js (REQUIRED)
 */

(function() {
    'use strict';

    console.log('📥 Loading NUMMA Exports Module v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined') {
        console.error('❌ security.js must be loaded before numma-exports.js');
        alert('Erreur: Module de sécurité manquant');
        return;
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const EXPORT_CONFIG = {
        API_BASE: 'https://optimis-fiscale-production.up.railway.app',
        PDF_OPTIONS: {
            margin: '20mm',
            format: 'A4',
            printBackground: true
        },
        COMPANY_INFO: {
            name: 'Votre Entreprise',
            address: '123 Rue Example',
            city: '75001 Paris',
            siret: '123 456 789 00012',
            phone: '01 23 45 67 89',
            email: 'contact@exemple.fr'
        }
    };

    // =====================================================
    // PDF GENERATION (SECURE - NO EVAL)
    // =====================================================

    /**
     * Generate invoice PDF
     * @param {Object} invoice - Invoice data
     */
    async function generateInvoicePDF(invoice) {
        console.log('Generating invoice PDF:', invoice.number);

        if (!invoice) {
            throw new Error('Invoice data required');
        }

        // Generate HTML content (all data escaped)
        const html = createInvoiceHTML(invoice);
        
        // Use Blob URL (SECURE - no eval, no document.write)
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Open in new window for printing
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            throw new Error('Popup bloqué. Autorisez les popups pour imprimer.');
        }

        // Clean up after window loads
        printWindow.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            
            // Auto-print after short delay
            setTimeout(() => {
                printWindow.print();
            }, 500);
        });

        return true;
    }

    /**
     * Create invoice HTML (XSS-protected)
     * @param {Object} invoice - Invoice data
     * @returns {string} HTML content
     */
    function createInvoiceHTML(invoice) {
        const company = EXPORT_CONFIG.COMPANY_INFO;
        
        // All user data is escaped
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture ${escapeHtml(invoice.number)}</title>
    <style>
        @page {
            margin: 20mm;
        }
        
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        
        .company-info {
            flex: 1;
        }
        
        .company-name {
            font-size: 24px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 10px;
        }
        
        .invoice-title {
            flex: 1;
            text-align: right;
        }
        
        .invoice-number {
            font-size: 28px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 10px;
        }
        
        .invoice-parties {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .party {
            flex: 1;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
        }
        
        .party + .party {
            margin-left: 20px;
        }
        
        .party-title {
            font-weight: 700;
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        
        .party-name {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        thead {
            background: #2563eb;
            color: white;
        }
        
        th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        tbody tr:hover {
            background: #f8fafc;
        }
        
        .text-right {
            text-align: right;
        }
        
        .totals {
            margin-left: auto;
            width: 300px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            font-size: 16px;
        }
        
        .total-row.grand-total {
            border-top: 2px solid #2563eb;
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            padding-top: 15px;
        }
        
        .invoice-footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #64748b;
            text-align: center;
        }
        
        .payment-info {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin-bottom: 30px;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="invoice-header">
        <div class="company-info">
            <div class="company-name">${escapeHtml(company.name)}</div>
            <div>${escapeHtml(company.address)}</div>
            <div>${escapeHtml(company.city)}</div>
            <div>SIRET: ${escapeHtml(company.siret)}</div>
            <div>Tél: ${escapeHtml(company.phone)}</div>
            <div>Email: ${escapeHtml(company.email)}</div>
        </div>
        <div class="invoice-title">
            <div class="invoice-number">FACTURE</div>
            <div class="invoice-number">${escapeHtml(invoice.number)}</div>
            <div style="margin-top: 10px;">
                Date: ${escapeHtml(formatDate(invoice.invoice_date))}<br>
                Échéance: ${escapeHtml(formatDate(invoice.due_date))}
            </div>
        </div>
    </div>

    <!-- Parties -->
    <div class="invoice-parties">
        <div class="party">
            <div class="party-title">Émetteur</div>
            <div class="party-name">${escapeHtml(company.name)}</div>
            <div>${escapeHtml(company.address)}</div>
            <div>${escapeHtml(company.city)}</div>
        </div>
        <div class="party">
            <div class="party-title">Client</div>
            <div class="party-name">${escapeHtml(invoice.client_name || 'Client')}</div>
            ${invoice.client_address ? `<div>${escapeHtml(invoice.client_address)}</div>` : ''}
            ${invoice.client_city ? `<div>${escapeHtml(invoice.client_city)}</div>` : ''}
            ${invoice.client_siret ? `<div>SIRET: ${escapeHtml(invoice.client_siret)}</div>` : ''}
        </div>
    </div>

    <!-- Payment Info -->
    ${invoice.status !== 'paid' ? `
    <div class="payment-info">
        <strong>Conditions de paiement:</strong> ${escapeHtml(invoice.payment_terms || 'Paiement à réception')}<br>
        <strong>Mode de règlement:</strong> ${escapeHtml(invoice.payment_method || 'Virement bancaire')}
    </div>
    ` : ''}

    <!-- Line Items -->
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th class="text-right">Quantité</th>
                <th class="text-right">Prix unitaire HT</th>
                <th class="text-right">TVA</th>
                <th class="text-right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            ${(invoice.items || []).map(item => `
                <tr>
                    <td>${escapeHtml(item.description || '-')}</td>
                    <td class="text-right">${escapeHtml(item.quantity || 1)}</td>
                    <td class="text-right">${formatCurrency(item.unit_price || 0)}</td>
                    <td class="text-right">${escapeHtml(item.vat_rate || 20)}%</td>
                    <td class="text-right">${formatCurrency(item.total || 0)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
        <div class="total-row">
            <span>Total HT:</span>
            <strong>${formatCurrency(invoice.total_ht || 0)}</strong>
        </div>
        <div class="total-row">
            <span>TVA (${escapeHtml(invoice.vat_rate || 20)}%):</span>
            <strong>${formatCurrency(invoice.total_vat || 0)}</strong>
        </div>
        <div class="total-row grand-total">
            <span>Total TTC:</span>
            <strong>${formatCurrency(invoice.total_ttc || 0)}</strong>
        </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
        ${escapeHtml(company.name)} - SIRET ${escapeHtml(company.siret)}<br>
        ${escapeHtml(company.address)} - ${escapeHtml(company.city)}<br>
        Tél: ${escapeHtml(company.phone)} - Email: ${escapeHtml(company.email)}
        ${invoice.notes ? `<br><br><em>${escapeHtml(invoice.notes)}</em>` : ''}
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    }

    /**
     * Format currency
     */
    function formatCurrency(amount) {
        const num = parseFloat(amount || 0);
        return num.toFixed(2).replace('.', ',') + ' €';
    }

    // =====================================================
    // PAYSLIP PDF GENERATION
    // =====================================================

    /**
     * Generate payslip PDF
     * @param {Object} employee - Employee data
     * @param {Object} payslipData - Payslip details
     */
    async function generatePayslipPDF(employee, payslipData) {
        console.log('Generating payslip PDF:', employee.name);

        const html = createPayslipHTML(employee, payslipData);
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            throw new Error('Popup bloqué');
        }

        printWindow.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            setTimeout(() => printWindow.print(), 500);
        });

        return true;
    }

    /**
     * Create payslip HTML
     */
    function createPayslipHTML(employee, data) {
        const company = EXPORT_CONFIG.COMPANY_INFO;
        
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Fiche de paie - ${escapeHtml(employee.name)}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; font-weight: 600; }
        .text-right { text-align: right; }
        .total { font-weight: bold; background: #e8e8e8; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">BULLETIN DE PAIE</div>
        <div style="margin-top: 10px;">
            Période: ${escapeHtml(data.period)}<br>
            Employeur: ${escapeHtml(company.name)}
        </div>
    </div>
    
    <div style="margin-bottom: 30px;">
        <strong>Salarié:</strong> ${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}<br>
        <strong>Poste:</strong> ${escapeHtml(employee.position)}<br>
        <strong>Matricule:</strong> ${escapeHtml(employee.id)}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Libellé</th>
                <th class="text-right">Base</th>
                <th class="text-right">Taux</th>
                <th class="text-right">Salarié</th>
                <th class="text-right">Employeur</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Salaire de base</td>
                <td class="text-right">${escapeHtml(data.base_hours || 151.67)} h</td>
                <td class="text-right">${formatCurrency((data.gross_salary || 0) / (data.base_hours || 151.67))}/h</td>
                <td class="text-right">${formatCurrency(data.gross_salary || 0)}</td>
                <td class="text-right">-</td>
            </tr>
            ${(data.deductions || []).map(d => `
                <tr>
                    <td>${escapeHtml(d.label)}</td>
                    <td class="text-right">${formatCurrency(d.base || 0)}</td>
                    <td class="text-right">${escapeHtml(d.rate || 0)}%</td>
                    <td class="text-right">-${formatCurrency(d.employee_amount || 0)}</td>
                    <td class="text-right">-${formatCurrency(d.employer_amount || 0)}</td>
                </tr>
            `).join('')}
            <tr class="total">
                <td colspan="3">NET À PAYER</td>
                <td class="text-right">${formatCurrency(data.net_pay || 0)}</td>
                <td class="text-right">-</td>
            </tr>
        </tbody>
    </table>
    
    <div style="margin-top: 40px; font-size: 12px; color: #666;">
        Document généré le ${new Date().toLocaleDateString('fr-FR')}
    </div>
</body>
</html>
        `.trim();
    }

    // =====================================================
    // EXCEL EXPORT (SERVER-SIDE)
    // =====================================================

    /**
     * Export data to Excel
     * @param {Array} data - Data to export
     * @param {string} filename - Output filename
     * @param {string} endpoint - API endpoint
     */
    async function exportToExcel(data, filename, endpoint = '/api/export/excel') {
        console.log('Exporting to Excel:', filename);

        try {
            const token = window.getSecureToken();
            const response = await fetch(`${EXPORT_CONFIG.API_BASE}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.status}`);
            }

            // Download file
            const blob = await response.blob();
            downloadBlob(blob, filename);

            return true;

        } catch (error) {
            console.error('Excel export failed:', error);
            throw error;
        }
    }

    // =====================================================
    // CSV EXPORT (CLIENT-SIDE)
    // =====================================================

    /**
     * Export data to CSV
     * @param {Array} data - Array of objects
     * @param {string} filename - Output filename
     */
    function exportToCSV(data, filename) {
        console.log('Exporting to CSV:', filename);

        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Create CSV content (all values escaped)
        const csvLines = [
            headers.join(';'),  // Header row
            ...data.map(row => 
                headers.map(header => {
                    let value = row[header];
                    if (value === null || value === undefined) value = '';
                    value = String(value);
                    // Escape quotes and wrap in quotes if contains semicolon
                    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                }).join(';')
            )
        ];

        const csvContent = csvLines.join('\r\n');
        
        // Add BOM for Excel UTF-8 support
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        
        downloadBlob(blob, filename);

        return true;
    }

    // =====================================================
    // DOWNLOAD HELPER
    // =====================================================

    /**
     * Download blob as file
     * @param {Blob} blob - Blob to download
     * @param {string} filename - Filename
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.NummaExports = {
        // PDF Generation
        generateInvoicePDF,
        generatePayslipPDF,
        
        // Excel Export
        exportToExcel,
        
        // CSV Export
        exportToCSV,
        
        // Configuration
        config: EXPORT_CONFIG,
        
        // Helpers
        formatDate,
        formatCurrency
    };

    console.log('✅ NUMMA Exports Module v3.0 loaded');
})();
