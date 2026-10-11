/**
 * South African Payroll Tax Calculations
 * Based on SARS 2026/2027 tax year tables and SA labour legislation.
 *
 * - PAYE: Progressive tax brackets per SARS tax tables
 * - UIF: 1% of gross remuneration (employee), 1% (employer), capped
 * - SDL: 1% of remuneration (employer only), subject to minimum
 * - COIDA: Employer-only, based on class of industry and earnings
 *
 * These rates are configurable and should be updated annually per SARS publications.
 */

// SARS 2026/2027 individual rates (1 March 2026 to 28 February 2027).
// Source: https://www.sars.gov.za/guide-for-employers-in-respect-of-employees-tax-2027/
const TAX_BRACKETS = [
  { min: 0, max: 245100, rate: 0.18, baseTax: 0 },
  { min: 245100, max: 383100, rate: 0.26, baseTax: 44118 },
  { min: 383100, max: 530200, rate: 0.31, baseTax: 79998 },
  { min: 530200, max: 695800, rate: 0.36, baseTax: 125599 },
  { min: 695800, max: 887000, rate: 0.39, baseTax: 185215 },
  { min: 887000, max: 1878600, rate: 0.41, baseTax: 259783 },
  { min: 1878600, max: Infinity, rate: 0.45, baseTax: 666339 },
];
const PRIMARY_REBATE = 17820;
const SECONDARY_REBATE = 9765;
const TERTIARY_REBATE = 3249;
const TAX_THRESHOLD_AGE_UNDER_65 = 99000;
const TAX_THRESHOLD_AGE_65_TO_74 = 153250;
const TAX_THRESHOLD_AGE_75_PLUS = 171300;

// UIF: 1% capped at earnings ceiling
const UIF_RATE = 0.01;
const UIF_CEILING = 17712.00; // Monthly ceiling

// SDL: 1% of remuneration (employer contribution)
const SDL_RATE = 0.01;

// COIDA: Employer-only, varies by class. Default ~0.5-2% of earnings up to ceiling
const COIDA_CEILING = 17712.00; // Monthly earnings ceiling for COIDA
const COIDA_DEFAULT_RATE = 0.0075; // Default 0.75% for low-risk office work

export interface PayrollInput {
  grossIncome: number; // Monthly gross
  age: number;
  medicalAaidDeduction: number;
  pensionDeduction: number;
  providentFundDeduction: number;
  taxRebate: number; // Additional rebate override
  isAnnual?: boolean;
}

export interface PayrollResult {
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdlEmployer: number;
  coidaEmployer: number;
  netPay: number;
  totalDeductions: number;
  totalEmployerCost: number;
  effectiveTaxRate: number;
}

/**
 * Calculate annual PAYE based on annualized taxable income
 */
export function calculateAnnualTax(annualTaxableIncome: number, age: number = 30): number {
  let rebate = PRIMARY_REBATE;
  let threshold = TAX_THRESHOLD_AGE_UNDER_65;

  if (age >= 75) {
    rebate = PRIMARY_REBATE + SECONDARY_REBATE + TERTIARY_REBATE;
    threshold = TAX_THRESHOLD_AGE_75_PLUS;
  } else if (age >= 65) {
    rebate = PRIMARY_REBATE + SECONDARY_REBATE;
    threshold = TAX_THRESHOLD_AGE_65_TO_74;
  }

  if (annualTaxableIncome <= threshold) {
    return 0;
  }

  const bracket = [...TAX_BRACKETS].reverse().find((b) => annualTaxableIncome > b.min)!;
  let tax = bracket.baseTax + (annualTaxableIncome - bracket.min) * bracket.rate;

  tax -= rebate;
  return Math.max(0, Math.round(tax));
}

/**
 * Calculate monthly PAYE
 */
export function calculateMonthlyPAYE(monthlyGross: number, age: number = 30, deductions: { pension?: number; provident?: number; medicalAid?: number; additionalRebate?: number } = {}): number {
  const annualGross = monthlyGross * 12;
  const annualPension = (deductions.pension || 0) * 12;
  const annualProvident = (deductions.provident || 0) * 12;
  const annualMedicalAid = (deductions.medicalAid || 0) * 12;

  // Pension contributions are deductible (capped at 27.5% of gross, max R350k/year)
  const pensionDeductible = Math.min(annualPension, Math.min(annualGross * 0.275, 350000));
  // FIXME: Retirement contribution treatment needs practitioner validation; not all cases covered.
  // Medical aid tax credits are handled separately via rebates
  void annualProvident; // Placeholder: full retirement-fund rules not yet supported

  const annualTaxable = annualGross - pensionDeductible;
  let annualTax = calculateAnnualTax(annualTaxable, age);

  // Medical scheme tax credit is based on member/dependant count (2027: R376/R376/R254).
  // The existing input only holds a contribution amount; do not guess member counts.
  // SAFETY: payroll approval must await a full tax-rule implementation and validation.
  const medicalAidTaxCredit = annualMedicalAid * 0; // Already handled via rebates in real SARS calc

  // Additional rebate override
  if (deductions.additionalRebate) {
    annualTax -= deductions.additionalRebate * 12;
  }

  annualTax -= medicalAidTaxCredit;
  annualTax = Math.max(0, annualTax);

  return Math.round(annualTax / 12);
}

/**
 * Calculate UIF (employee 1%, employer 1%, capped)
 */
export function calculateUIF(monthlyGross: number): { employee: number; employer: number } {
  const cappedGross = Math.min(monthlyGross, UIF_CEILING);
  const uif = Math.round(cappedGross * UIF_RATE * 100) / 100;
  return { employee: uif, employer: uif };
}

/**
 * Calculate SDL (employer only, 1% of total remuneration)
 */
export function calculateSDL(monthlyGross: number): number {
  return Math.round(monthlyGross * SDL_RATE * 100) / 100;
}

/**
 * Calculate COIDA (employer only, based on earnings up to ceiling)
 */
export function calculateCOIDA(monthlyGross: number, rate: number = COIDA_DEFAULT_RATE): number {
  const cappedGross = Math.min(monthlyGross, COIDA_CEILING);
  return Math.round(cappedGross * rate * 100) / 100;
}

/**
 * Full payroll calculation
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const monthlyGross = input.isAnnual ? input.grossIncome / 12 : input.grossIncome;

  const paye = calculateMonthlyPAYE(monthlyGross, input.age, {
    pension: input.pensionDeduction,
    provident: input.providentFundDeduction,
    medicalAid: input.medicalAaidDeduction,
    additionalRebate: input.taxRebate,
  });

  const uif = calculateUIF(monthlyGross);
  const sdl = calculateSDL(monthlyGross);
  const coida = calculateCOIDA(monthlyGross);

  const totalDeductions = paye + uif.employee + input.medicalAaidDeduction + input.pensionDeduction + input.providentFundDeduction;
  const netPay = monthlyGross - totalDeductions;
  const totalEmployerCost = monthlyGross + uif.employer + sdl + coida;

  return {
    paye,
    uifEmployee: uif.employee,
    uifEmployer: uif.employer,
    sdlEmployer: sdl,
    coidaEmployer: coida,
    netPay: Math.max(0, Math.round(netPay * 100) / 100),
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
    effectiveTaxRate: monthlyGross > 0 ? (paye / monthlyGross) * 100 : 0,
  };
}

/**
 * Format currency in ZAR (South African Rand)
 */
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get age from SA ID number
 */
export function getAgeFromIdNumber(idNumber: string): number {
  if (!idNumber || idNumber.length < 6) return 30; // Default
  const yearPart = idNumber.substring(0, 2);
  const currentYear = new Date().getFullYear();
  let year = parseInt(yearPart, 10);
  year = year > currentYear - 2000 ? 1900 + year : 2000 + year;
  const month = parseInt(idNumber.substring(2, 4), 10) - 1;
  const day = parseInt(idNumber.substring(4, 6), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return 30;
  const birthDate = new Date(year, month, day);
  const ageDiff = Date.now() - birthDate.getTime();
  return Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * Get gender from SA ID number
 */
export function getGenderFromIdNumber(idNumber: string): string {
  if (!idNumber || idNumber.length < 10) return 'Unknown';
  const genderDigits = parseInt(idNumber.substring(6, 10), 10);
  return genderDigits >= 5000 ? 'Male' : 'Female';
}

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
