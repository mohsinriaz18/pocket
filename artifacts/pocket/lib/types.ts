export type Entity = 'accounts' | 'transactions' | 'bills' | 'goals' | 'investments' | 'debts';
export type Money = number | string;
export interface BaseRecord { id: string; user_id: string; created_at: string }
export interface Account extends BaseRecord { name: string; bank: string; last_four: string; currency: string; type: string; opening_balance: Money; archived: boolean }
export interface Transaction extends BaseRecord { type: 'in' | 'out' | 'transfer'; amount: Money; currency: string; category: string; account_id: string; to_account_id: string | null; date: string; note: string; bill_id: string | null; debt_id: string | null; payment_period?: string | null }
export interface Bill extends BaseRecord { name: string; amount: Money; currency: string; due_day: number; repeats: string; category: string; paid: boolean; last_paid_at: string | null }
export interface Goal extends BaseRecord { name: string; category: string; currency: string; target: Money; target_date: string | null; saved: Money; notes: string }
export interface Investment extends BaseRecord { name: string; currency: string; type: string; platform: string; invested: Money; current_value: Money; quantity: Money | null; purchase_price: Money | null; purchase_date: string; notes: string }
export interface Debt extends BaseRecord { name: string; currency: string; type: string; lender: string; original_amount: Money; outstanding: Money; interest_rate: Money; minimum_payment: Money; frequency: string; due_day: number; start_date: string | null; payoff_by: string | null; notes: string; direction: 'owed' | 'lent' }
export interface Profile { id: string; name: string; email: string; primary_currency: string; secondary_currency: string; appearance: 'light' | 'dark' | 'system'; reminder_enabled: boolean; reminder_time: string }
export interface ExchangeRate { base_currency: string; quote_currency: string; rate: Money; effective_date: string }
export interface Valuation { id: string; investment_id: string; user_id: string; value: Money; date: string; created_at: string }
export interface PocketData { accounts: Account[]; transactions: Transaction[]; bills: Bill[]; goals: Goal[]; investments: Investment[]; debts: Debt[]; exchange_rates: ExchangeRate[]; investment_valuations: Valuation[]; profile: Profile | null }
export const emptyData: PocketData = { accounts: [], transactions: [], bills: [], goals: [], investments: [], debts: [], exchange_rates: [], investment_valuations: [], profile: null };
export const currencies = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD', 'INR'];
export const outCategories = ['Ai subscription', 'Atm withdrawal', 'Charity', 'Debt Payment', 'Dining', 'Education', 'Entertainment', 'Family', 'Food', 'Fuel', 'Groceries', 'Health', 'Investment Purchase', 'Mobile & Internet', 'Other', 'Rent', 'Shopping', 'Transport', 'Travel', 'Utilities'];
export const inCategories = ['Salary', 'Business', 'Loan refund', 'Investment Income', 'Gift', 'Other'];
export const goalCategories = ['Emergency Fund', 'Vacation', 'New Car', 'House', 'Investment', 'Business', 'Education', 'Custom'];
