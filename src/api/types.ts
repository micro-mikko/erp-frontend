export interface LoginResponse {
  token: string;
  user: User;
}

export interface CompanyMembership {
  id: string;
  name: string;
  role: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  company: Company;
  companies: CompanyMembership[];
}

export interface SuperuserCompany {
  id: string;
  name: string;
  businessId: string;
  userCount: number;
  createdAt: string;
}

export interface SuperuserUser {
  id: string;
  name: string;
  email: string;
  isSuperuser: boolean;
  createdAt: string;
  companies: CompanyMembership[];
}

export interface Company {
  id: string;
  name: string;
  vatNumber?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  createdAt: string;
  // C8: Inkluderas vid GET /:id — används för att visa rätt bekräftelsedialog vid radering
  invoiceCount?: number;
  subscriptionCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  businessId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  createdAt: string;
}

// ─── Dimensioner ─────────────────────────────────────────────────────────────

export type DimensionType = 'PROJECT' | 'DEPARTMENT' | 'REGION' | 'OTHER';

export interface DimensionAccountRule {
  id: string;
  accountId: string;
  account: { accountNumber: string; nameSv: string };
  required: boolean;
}

export interface Dimension {
  id: string;
  name: string;
  code?: string;
  type: DimensionType;
  budget?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  // Hierarki
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  accountRules?: DimensionAccountRule[];
  // Inkluderas om ?includeBudget=true
  budgetUsed?: number | null;
  budgetRemaining?: number | null;
}

// ─── Kategorier ──────────────────────────────────────────────────────────────

export interface Subcategory {
  id: string;
  name: string;
  accounts: { debit: string; credit: string };
}

export interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

export interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  amount?: number;
  categoryId?: string;
  subcategoryId?: string;
  dimensionId?: string;
  dimensionNameSnapshot?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid';
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  paymentDate?: string;
  paymentReference?: string;
  customer?: Customer;
  customerId: string;
  lines?: InvoiceLine[];
  createdAt: string;
}

export interface DocumentRef {
  id: string;
  filename: string;
  mimeType: string;
}

export interface ExpenseLine {
  id: string;
  expenseId: string;
  description: string;
  amount: number;       // totalt inkl moms
  vatRate: number;      // 0 | 10 | 14 | 25.5
  vatAmount: number;
  categoryId?: string;
  subcategoryId?: string;
  dimensionId?: string;
  dimensionNameSnapshot?: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  vatAmount?: number;
  categoryId?: string;
  subcategoryId?: string;
  supplier?: string;
  supplierId?: string;
  supplierRel?: Supplier;
  status: 'PENDING' | 'PAID';
  dueDate?: string;
  paymentDate?: string;
  receiptUrl?: string;
  documents?: DocumentRef[];
  lines?: ExpenseLine[];
  createdAt: string;
}

export interface ExtractedDocumentData {
  vendor?: string;
  vendorVatNumber?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  date?: string;
  totalAmount?: number;
  vatAmount?: number;
  vatDetails?: { rate: number; amount: number }[];
  suggestedCategory?: string;
  matchedSuppliers?: { id: string; name: string }[];
  currency?: string;
  invoiceNumber?: string;
  description?: string;
  lineItems?: { description: string; amount: number; vatRate?: number }[];
}

export interface Document {
  id: string;
  filename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'MATCHED';
  notes?: string;
  extractedData?: ExtractedDocumentData;
  expenseId?: string;
  transactionId?: string;
  bankTransactionId?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  nameSv: string;
  nameEn?: string;
  type: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  voucherNumber: string;
  categoryId?: string;
  subcategoryId?: string;
  lines: TransactionLine[];
  documents?: DocumentRef[];
  createdAt: string;
}

export interface TransactionLine {
  id: string;
  debit: number;
  credit: number;
  account: Account;
}

export interface DashboardData {
  revenue: { total: number; invoiceCount: number };
  expenses: { total: number; count: number };
  outstanding: { total: number; count: number };
  recentInvoices: Invoice[];
}

// ─── Dashboard v2 — period-baserade typer ────────────────────────────────────

export type PeriodKey = 'ytd' | 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom';

export interface DashboardKPIs {
  revenue:     { current: number; previous: number; changePercent: number; invoiceCount: number };
  outstanding: { current: number; count: number };
  expenses:    { current: number; previous: number; changePercent: number; count: number };
  profit:      { current: number; previous: number; changePercent: number; marginPercent: number };
}

export interface TrendPoint {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  count: number;
  isUrgent: boolean;
}

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  revenue: number;
  invoiceCount: number;
}

// ─── Annual Report (Bokslut) ──────────────────────────────────────────────────

export interface AnnualReportAccountLine {
  accountNumber: string;
  nameSv: string;
  nameFi: string;
  type: string;
  debit: number;
  credit: number;
  net: number;
}

export interface AnnualReportSection {
  accounts: AnnualReportAccountLine[];
  total: number;
}

export interface AnnualReportIncomeStatement {
  revenue: AnnualReportSection;
  cogs: AnnualReportSection;
  personnel: AnnualReportSection;
  depreciation: AnnualReportSection;
  otherOperating: AnnualReportSection;
  operatingProfit: number;
  financial: AnnualReportSection;
  profitBeforeTax: number;
  taxes: AnnualReportSection;
  netProfit: number;
}

export interface AnnualReportEquitySection {
  accounts: AnnualReportAccountLine[];
  retainedEarnings: number;
  netProfit: number;
  total: number;
}

export interface AnnualReportBalanceSheet {
  assets: {
    nonCurrent: AnnualReportSection;
    current: AnnualReportSection;
    total: number;
  };
  liabilitiesAndEquity: {
    equity: AnnualReportEquitySection;
    longTermLiabilities: AnnualReportSection;
    shortTermLiabilities: AnnualReportSection;
    total: number;
  };
}

export interface AnnualReportPeriod {
  incomeStatement: AnnualReportIncomeStatement;
  balanceSheet: AnnualReportBalanceSheet;
  assetDetails?: AssetDetails;
}

export interface AnnualReportData {
  year: number;
  prevYear: number;
  company: {
    name: string;
    businessId: string;
    vatNumber: string;
    address?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    email?: string;
  };
  current: AnnualReportPeriod;
  prev: AnnualReportPeriod;
}

// ─── Anläggningstillgångar ───────────────────────────────────────────────────

export type AssetType = 'COMPUTER_IT' | 'PHONE_TABLET' | 'VEHICLE' | 'MACHINERY' | 'FURNITURE' | 'BUILDING' | 'OTHER';
export type AssetStatus = 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
export type DepreciationStart = 'ACQUISITION_MONTH' | 'NEXT_MONTH' | 'FISCAL_YEAR_START';

export interface DepreciationRun {
  id: string;
  assetId: string;
  year: number;
  amount: number;
  transactionId: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  assetType: AssetType;
  description?: string;
  acquisitionDate: string;
  acquisitionValue: number;
  depreciationYears: number;
  depreciationStart: DepreciationStart;
  status: AssetStatus;
  expenseId?: string;
  documentId?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields from enrichAsset()
  currentBookValue?: number;
  yearlyDepreciation?: number;
  fullyDepreciatedDate?: string;
  depreciationRuns?: DepreciationRun[];
}

export interface AssetSummary {
  totalAcquisitionValue: number;
  totalDepreciated: number;
  totalBookValue: number;
  activeCount: number;
}

export interface DepreciationPreviewItem {
  assetId: string;
  assetName: string;
  year: number;
  amount: number;
  bookValueAfter: number;
}

export interface DepreciationPreview {
  items: DepreciationPreviewItem[];
  totalAmount: number;
}

export interface AssetTypeBreakdown {
  assetType: string;
  count: number;
  acquisitionValue: number;
  bookValue: number;
}

export interface AssetDetails {
  totalAcquisitionValue: number;
  totalBookValue: number;
  totalDepreciated: number;
  byType: AssetTypeBreakdown[];
}

export interface SubscriptionLine {
  id: string;
  subscriptionId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  categoryId?: string;
  subcategoryId?: string;
}

export interface Subscription {
  id: string;
  name: string;
  customerId: string;
  companyId: string;
  billingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  billingTiming: 'IN_ADVANCE' | 'IN_ARREARS';
  nextInvoicingDate: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  lines?: SubscriptionLine[];
  invoices?: {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    total: number;
    periodStart?: string;
    periodEnd?: string;
  }[];
}
