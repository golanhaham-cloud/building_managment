export type UserRole = "resident" | "admin";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type TransactionType = "income" | "expense";
export type RequestStatus =
  | "new"
  | "in_progress"
  | "vendor_ordered"
  | "awaiting_quote"
  | "resolved"
  | "closed";
export type ProjectStatus =
  | "idea"
  | "costing"
  | "quotes"
  | "vote"
  | "approved"
  | "ordered"
  | "in_progress"
  | "done";

export interface AppUser {
  id: string;
  auth_id: string;
  resident_id: string | null;
  building_id: string | null;
  role: UserRole;
}

export interface Apartment {
  id: string;
  building_id: string;
  floor: number;
  apartment_number: string;
  is_rented: boolean;
  monthly_fee: number;
  owner_resident_id: string | null;
}

export interface Resident {
  id: string;
  apartment_id: string;
  full_name: string;
  ownership: "owner" | "tenant";
  phone: string | null;
  email: string | null;
  is_primary_contact: boolean;
}

export interface Transaction {
  id: string;
  building_id: string;
  type: TransactionType;
  date: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  supplier_id: string | null;
  receipt_url: string | null;
  invoice_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface MonthlyPayment {
  id: string;
  apartment_id: string;
  year: number;
  month: number;
  amount_due: number;
  amount_paid: number;
  paid_date: string | null;
  status: PaymentStatus;
}

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "שולם",
  partial: "שולם חלקית",
  unpaid: "טרם שולם",
};

export const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: "bg-status-paid",
  partial: "bg-status-partial",
  unpaid: "bg-status-unpaid",
};
