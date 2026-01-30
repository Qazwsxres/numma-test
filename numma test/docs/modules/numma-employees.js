/**
 * ========================================
 * NUMMA - EMPLOYEES MODULE v3.0
 * ========================================
 * Complete employee & payroll management
 * 
 * Features:
 * - Full CRUD operations
 * - Payslip generation with French social security
 * - Input validation
 * - Secure cache (non-sensitive data only)
 * - Error recovery
 * - Memory leak prevention
 * 
 * DEPENDENCIES: security.js, numma-messages.js, numma-exports.js
 */

(function() {
    'use strict';

    console.log('👥 Loading NUMMA Employees Module v3.0...');

    // Dependency check
    if (typeof window.escapeHtml === 'undefined' || 
        typeof window.showMessage === 'undefined') {
        console.error('❌ Dependencies missing: security.js and numma-messages.js required');
        return;
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const EMPLOYEE_CONFIG = {
        API_BASE: 'https://optimis-fiscale-production.up.railway.app',
        CACHE_KEY: 'numma_employees_cache',
        CACHE_EXPIRY: 300000, // 5 minutes
        VALIDATION: {
            MIN_SALARY: 0,
            MAX_SALARY: 999999,
            CONTRACT_TYPES: ['CDI', 'CDD', 'Interim', 'Stage', 'Apprentissage'],
            REQUIRED_FIELDS: ['first_name', 'last_name', 'position']
        },
        // French social security rates 2024
        SOCIAL_SECURITY: {
            CSG_CRDS: 0.097,              // 9.7%
            SECURITE_SOCIALE: {
                employee: 0.13,            // 13%
                employer: 0.42             // 42%
            },
            RETRAITE_COMPLEMENTAIRE: {
                employee: 0.0787,          // 7.87%
                employer: 0.1177           // 11.77%
            },
            CHOMAGE: {
                employee: 0,               // 0% (employer only since 2019)
                employer: 0.0405           // 4.05%
            },
            PREVOYANCE: {
                employee: 0.015,           // 1.5%
                employer: 0.015            // 1.5%
            }
        }
    };

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================

    let employeeCache = {
        data: [],
        lastUpdate: null
    };

    // =====================================================
    // API FUNCTIONS - CRUD
    // =====================================================

    /**
     * List employees with optional filters
     */
    async function listEmployees(filters = {}) {
        console.log('Listing employees with filters:', filters);

        try {
            // Check cache first
            if (isCacheValid()) {
                console.log('✅ Returning cached employees');
                return employeeCache.data;
            }

            const token = getSecureToken();
            const queryString = new URLSearchParams(filters).toString();
            const url = `${EMPLOYEE_CONFIG.API_BASE}/api/employees${queryString ? '?' + queryString : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const employees = await response.json();

            // Update cache (non-sensitive data only)
            setCachedEmployees(employees);

            console.log('✅ Employees loaded:', employees.length);
            return employees;

        } catch (error) {
            return handleAPIError(error, 'list');
        }
    }

    /**
     * Get single employee by ID
     */
    async function getEmployee(id) {
        console.log('Getting employee:', id);

        try {
            // Check cache
            const cached = employeeCache.data.find(emp => emp.id === id);
            if (cached && isCacheValid()) {
                // But fetch full data from backend (cache might not have sensitive data)
                console.log('Cache hit, but fetching full data...');
            }

            const token = getSecureToken();
            const response = await fetch(`${EMPLOYEE_CONFIG.API_BASE}/api/employees/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const employee = await response.json();
            console.log('✅ Employee loaded:', employee.first_name, employee.last_name);
            return employee;

        } catch (error) {
            return handleAPIError(error, 'get');
        }
    }

    /**
     * Create new employee
     */
    async function createEmployee(data) {
        console.log('Creating employee:', data.first_name, data.last_name);

        try {
            // Validate
            const validation = validateEmployee(data);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${EMPLOYEE_CONFIG.API_BASE}/api/employees`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Creation failed' }));
                throw new Error(error.detail);
            }

            const employee = await response.json();

            // Clear cache to force refresh
            clearCache();

            showSuccess(`Employé ${employee.first_name} ${employee.last_name} créé`);
            console.log('✅ Employee created:', employee.id);

            return employee;

        } catch (error) {
            showError(`Erreur de création: ${error.message}`);
            console.error('❌ Create failed:', error);
            throw error;
        }
    }

    /**
     * Update existing employee
     */
    async function updateEmployee(id, data) {
        console.log('Updating employee:', id);

        try {
            // Validate
            const validation = validateEmployee(data);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${EMPLOYEE_CONFIG.API_BASE}/api/employees/${id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Update failed' }));
                throw new Error(error.detail);
            }

            const employee = await response.json();

            // Clear cache
            clearCache();

            showSuccess(`Employé ${employee.first_name} ${employee.last_name} mis à jour`);
            console.log('✅ Employee updated:', employee.id);

            return employee;

        } catch (error) {
            showError(`Erreur de mise à jour: ${error.message}`);
            console.error('❌ Update failed:', error);
            throw error;
        }
    }

    /**
     * Delete employee
     */
    async function deleteEmployee(id) {
        console.log('Deleting employee:', id);

        try {
            const token = getSecureToken();
            const headers = await addCSRFHeader({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            });

            const response = await fetch(`${EMPLOYEE_CONFIG.API_BASE}/api/employees/${id}`, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
                throw new Error(error.detail);
            }

            // Clear cache
            clearCache();

            showSuccess('Employé supprimé');
            console.log('✅ Employee deleted:', id);

            return true;

        } catch (error) {
            showError(`Erreur de suppression: ${error.message}`);
            console.error('❌ Delete failed:', error);
            throw error;
        }
    }

    // =====================================================
    // PAYSLIP GENERATION
    // =====================================================

    /**
     * Generate payslip PDF for employee
     */
    async function generatePayslip(employeeId, month, year) {
        console.log('Generating payslip for employee:', employeeId, month, year);

        try {
            // Get employee data
            const employee = await getEmployee(employeeId);

            if (!employee.gross_salary) {
                throw new Error('Salaire brut non renseigné pour cet employé');
            }

            // Calculate payslip data
            const payslipData = {
                period: `${String(month).padStart(2, '0')}/${year}`,
                base_hours: 151.67, // 35h/week standard
                gross_salary: parseFloat(employee.gross_salary),
                deductions: calculateDeductions(employee),
                net_pay: calculateNetPay(employee)
            };

            // Use NummaExports module
            if (typeof window.NummaExports === 'undefined') {
                throw new Error('Module d\'export non chargé');
            }

            await window.NummaExports.generatePayslipPDF(employee, payslipData);

            showSuccess('Fiche de paie générée');
            console.log('✅ Payslip generated');

            return payslipData;

        } catch (error) {
            showError(`Erreur: ${error.message}`);
            console.error('❌ Payslip generation failed:', error);
            throw error;
        }
    }

    /**
     * Calculate French social security deductions
     */
    function calculateDeductions(employee) {
        const grossSalary = parseFloat(employee.gross_salary || 0);
        const ss = EMPLOYEE_CONFIG.SOCIAL_SECURITY;

        return [
            {
                label: 'Sécurité sociale',
                base: grossSalary,
                rate: ss.SECURITE_SOCIALE.employee * 100,
                employee_amount: grossSalary * ss.SECURITE_SOCIALE.employee,
                employer_amount: grossSalary * ss.SECURITE_SOCIALE.employer
            },
            {
                label: 'Retraite complémentaire',
                base: grossSalary,
                rate: ss.RETRAITE_COMPLEMENTAIRE.employee * 100,
                employee_amount: grossSalary * ss.RETRAITE_COMPLEMENTAIRE.employee,
                employer_amount: grossSalary * ss.RETRAITE_COMPLEMENTAIRE.employer
            },
            {
                label: 'Assurance chômage',
                base: grossSalary,
                rate: 0,
                employee_amount: 0,
                employer_amount: grossSalary * ss.CHOMAGE.employer
            },
            {
                label: 'CSG/CRDS',
                base: grossSalary * 0.9825, // 98.25% du brut
                rate: ss.CSG_CRDS * 100,
                employee_amount: grossSalary * 0.9825 * ss.CSG_CRDS,
                employer_amount: 0
            },
            {
                label: 'Prévoyance',
                base: grossSalary,
                rate: ss.PREVOYANCE.employee * 100,
                employee_amount: grossSalary * ss.PREVOYANCE.employee,
                employer_amount: grossSalary * ss.PREVOYANCE.employer
            }
        ];
    }

    /**
     * Calculate net pay after all deductions
     */
    function calculateNetPay(employee) {
        const gross = parseFloat(employee.gross_salary || 0);
        const deductions = calculateDeductions(employee);
        
        const totalDeductions = deductions.reduce(
            (sum, d) => sum + d.employee_amount, 
            0
        );

        return gross - totalDeductions;
    }

    // =====================================================
    // VALIDATION
    // =====================================================

    /**
     * Validate employee data
     */
    function validateEmployee(data) {
        const errors = [];
        const cfg = EMPLOYEE_CONFIG.VALIDATION;

        // Required fields
        if (!data.first_name || data.first_name.trim() === '') {
            errors.push('Prénom requis');
        }

        if (!data.last_name || data.last_name.trim() === '') {
            errors.push('Nom requis');
        }

        if (!data.position || data.position.trim() === '') {
            errors.push('Poste requis');
        }

        // Salary
        if (data.gross_salary !== undefined) {
            const salary = parseFloat(data.gross_salary);
            if (isNaN(salary)) {
                errors.push('Salaire brut invalide');
            } else if (salary < cfg.MIN_SALARY || salary > cfg.MAX_SALARY) {
                errors.push(`Salaire doit être entre ${cfg.MIN_SALARY} et ${cfg.MAX_SALARY}`);
            }
        }

        // Contract type
        if (data.contract_type && !cfg.CONTRACT_TYPES.includes(data.contract_type)) {
            errors.push(`Type de contrat invalide (autorisés: ${cfg.CONTRACT_TYPES.join(', ')})`);
        }

        // Email
        if (data.email && !isValidEmail(data.email)) {
            errors.push('Format email invalide');
        }

        // Hire date
        if (data.hire_date) {
            const hireDate = new Date(data.hire_date);
            if (isNaN(hireDate.getTime())) {
                errors.push('Date d\'embauche invalide');
            } else if (hireDate > new Date()) {
                errors.push('Date d\'embauche ne peut pas être dans le futur');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // =====================================================
    // CACHE MANAGEMENT (NON-SENSITIVE DATA ONLY)
    // =====================================================

    /**
     * Get cached employees
     */
    function getCachedEmployees() {
        if (isCacheValid()) {
            return employeeCache.data;
        }
        return null;
    }

    /**
     * Set cached employees (non-sensitive fields only)
     */
    function setCachedEmployees(employees) {
        // IMPORTANT: Only cache non-sensitive fields
        const safeData = employees.map(emp => ({
            id: emp.id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            position: emp.position,
            contract_type: emp.contract_type,
            hire_date: emp.hire_date
            // DO NOT cache: SSN, salary, bank details, personal info
        }));

        employeeCache.data = safeData;
        employeeCache.lastUpdate = Date.now();

        // Also save to sessionStorage
        try {
            sessionStorage.setItem(EMPLOYEE_CONFIG.CACHE_KEY, JSON.stringify({
                data: safeData,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache employees:', e);
        }
    }

    /**
     * Check if cache is valid
     */
    function isCacheValid() {
        if (!employeeCache.lastUpdate) {
            // Try sessionStorage
            try {
                const cached = sessionStorage.getItem(EMPLOYEE_CONFIG.CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < EMPLOYEE_CONFIG.CACHE_EXPIRY) {
                        employeeCache.data = parsed.data;
                        employeeCache.lastUpdate = parsed.timestamp;
                        return true;
                    }
                }
            } catch (e) {
                console.warn('Failed to load cache:', e);
            }
            return false;
        }

        return Date.now() - employeeCache.lastUpdate < EMPLOYEE_CONFIG.CACHE_EXPIRY;
    }

    /**
     * Clear cache
     */
    function clearCache() {
        employeeCache.data = [];
        employeeCache.lastUpdate = null;

        try {
            sessionStorage.removeItem(EMPLOYEE_CONFIG.CACHE_KEY);
        } catch (e) {
            console.warn('Failed to clear cache:', e);
        }

        console.log('✅ Employee cache cleared');
    }

    // =====================================================
    // ERROR RECOVERY
    // =====================================================

    function handleAPIError(error, context) {
        console.error(`Employee API error (${context}):`, error);

        // For read operations, try cache
        if (context === 'list' || context === 'get') {
            const cached = getCachedEmployees();
            if (cached) {
                showWarning('Données chargées depuis le cache');
                return context === 'list' ? cached : cached[0] || null;
            }
        }

        // Show error
        showError(`Erreur: ${error.message}`);
        throw error;
    }

    // =====================================================
    // EVENT CLEANUP
    // =====================================================

    const eventController = new AbortController();

    function cleanup() {
        console.log('Cleaning up employees module...');
        eventController.abort();
        clearCache();
    }

    // =====================================================
    // EXPORT MODULE
    // =====================================================

    window.EmployeeAPI = {
        // CRUD
        list: listEmployees,
        get: getEmployee,
        create: createEmployee,
        update: updateEmployee,
        delete: deleteEmployee,

        // Actions
        generatePayslip: generatePayslip,

        // Validation
        validate: validateEmployee,

        // Calculations
        calculateNetPay: calculateNetPay,
        calculateDeductions: calculateDeductions,

        // Cache
        cache: {
            get: getCachedEmployees,
            clear: clearCache,
            isValid: isCacheValid
        },

        // Cleanup
        cleanup: cleanup
    };

    // Auto-cleanup
    window.addEventListener('beforeunload', cleanup);

    console.log('✅ NUMMA Employees Module v3.0 loaded');

})();
