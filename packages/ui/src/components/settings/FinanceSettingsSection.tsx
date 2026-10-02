'use client';

import { Banknote, Receipt, Settings2, Wallet } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, TextArea, Toggle } from '../SettingsForm';

/**
 * Finance policy.
 *
 * Backs `SchoolFinanceSettings`. The flags for arrears, refunds, credit notes
 * and reconciliation declare intent, but the workflows behind them are not
 * implemented: there is no /api/finance/reconciliation, payments or refunds
 * route, and no Arrears or CreditNote model. A payment is recorded as a Receipt.
 */
interface FinanceSettings {
  currency: string;
  currencySymbol: string;
  currencyPosition: string;
  decimalPlaces: number;
  fiscalYearStartMonth: number;
  feeCategories: string;
  billingPeriod: string;
  invoicePrefix: string;
  receiptPrefix: string;
  receiptFooter: string;
  termsAndConditions: string;
  paymentMethods: string;
  allowPartialPayments: boolean;
  allowOverpayment: boolean;
  arrearsEnabled: boolean;
  arrearsGraceDays: number;
  latePaymentPenalty: number | undefined;
  discountsEnabled: boolean;
  waiversEnabled: boolean;
  refundsEnabled: boolean;
  creditNotesEnabled: boolean;
  reconciliationEnabled: boolean;
  financeNotificationsEnabled: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function FinanceSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="finance"
      title="Finance Settings"
      description="Currency, invoicing, payment policy and the finance workflow switches."
    >
      {(raw, set) => {
        const v = raw as unknown as FinanceSettings;
        return (
          <>
            <SettingsCard
              title="Currency"
              description="Applied to every invoice, receipt and financial report."
              icon={Wallet}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Field label="Currency Code" hint="ISO 4217, e.g. KES">
                  <TextInput
                    value={str(v.currency)}
                    onChange={(e) => set('currency', e.target.value.toUpperCase())}
                    placeholder="KES"
                  />
                </Field>
                <Field label="Symbol" hint="Overrides the code where printed">
                  <TextInput
                    value={str(v.currencySymbol)}
                    onChange={(e) => set('currencySymbol', e.target.value)}
                    placeholder="KSh"
                  />
                </Field>
                <Field label="Symbol Position">
                  <TextInput
                    value={str(v.currencyPosition)}
                    onChange={(e) => set('currencyPosition', e.target.value)}
                    placeholder="before"
                  />
                </Field>
                <Field label="Decimal Places">
                  <TextInput
                    type="number"
                    min={0}
                    max={4}
                    value={str(v.decimalPlaces)}
                    onChange={(e) => set('decimalPlaces', Number(e.target.value))}
                    placeholder="2"
                  />
                </Field>
                <Field label="Fiscal Year Starts" hint="Month">
                  <TextInput
                    value={str(
                      v.fiscalYearStartMonth ? MONTHS[Number(v.fiscalYearStartMonth) - 1] : ''
                    )}
                    onChange={(e) => {
                      const index = MONTHS.indexOf(e.target.value);
                      set('fiscalYearStartMonth', index >= 0 ? index + 1 : 1);
                    }}
                    list="finance-months"
                    placeholder="January"
                  />
                  <datalist id="finance-months">
                    {MONTHS.map((month) => (
                      <option key={month} value={month} />
                    ))}
                  </datalist>
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Invoicing and Receipts"
              description="Numbering and footer copy used by the finance module."
              icon={Receipt}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Invoice Prefix">
                  <TextInput
                    value={str(v.invoicePrefix)}
                    onChange={(e) => set('invoicePrefix', e.target.value)}
                    placeholder="INV"
                  />
                </Field>
                <Field label="Receipt Prefix">
                  <TextInput
                    value={str(v.receiptPrefix)}
                    onChange={(e) => set('receiptPrefix', e.target.value)}
                    placeholder="RCP"
                  />
                </Field>
                <Field label="Billing Period" hint="e.g. term, month">
                  <TextInput
                    value={str(v.billingPeriod)}
                    onChange={(e) => set('billingPeriod', e.target.value)}
                    placeholder="term"
                  />
                </Field>
                <Field label="Fee Categories" hint="JSON array">
                  <TextInput
                    value={str(v.feeCategories)}
                    onChange={(e) => set('feeCategories', e.target.value)}
                    placeholder='["tuition","transport","uniform"]'
                  />
                </Field>
                <Field label="Payment Methods" hint="JSON array">
                  <TextInput
                    value={str(v.paymentMethods)}
                    onChange={(e) => set('paymentMethods', e.target.value)}
                    placeholder='["cash","mpesa","bank_transfer"]'
                  />
                </Field>
              </div>
              <div className="mt-4 space-y-5">
                <Field label="Receipt Footer">
                  <TextArea
                    rows={2}
                    value={str(v.receiptFooter)}
                    onChange={(e) => set('receiptFooter', e.target.value)}
                    placeholder="Received with thanks."
                  />
                </Field>
                <Field label="Terms and Conditions">
                  <TextArea
                    rows={4}
                    value={str(v.termsAndConditions)}
                    onChange={(e) => set('termsAndConditions', e.target.value)}
                    placeholder="terms and conditions"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Payment Policy"
              description="Controls what the finance module permits at the point of payment."
              icon={Banknote}
            >
              <Toggle
                label="Allow partial payments"
                description="Accepts a receipt for less than the invoice amount."
                checked={bool(v.allowPartialPayments)}
                onChange={(checked) => set('allowPartialPayments', checked)}
              />
              <Toggle
                label="Allow overpayment"
                description="Accepts a receipt for more than the invoice amount."
                checked={bool(v.allowOverpayment)}
                onChange={(checked) => set('allowOverpayment', checked)}
              />
              <Toggle
                label="Finance notifications"
                description="Sends a notification when an invoice is raised or settled."
                checked={bool(v.financeNotificationsEnabled)}
                onChange={(checked) => set('financeNotificationsEnabled', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Late Payment Penalty" hint="Percentage, optional">
                  <TextInput
                    type="number"
                    step="any"
                    value={str(v.latePaymentPenalty)}
                    onChange={(e) =>
                      set('latePaymentPenalty', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="2.5"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Arrears, Adjustments and Reconciliation"
              description="These switches declare intent. The workflows behind arrears, refunds, credit notes and reconciliation are not implemented yet."
              icon={Settings2}
            >
              <Toggle
                label="Arrears tracking"
                description="No Arrears model or route exists; outstanding balances are derived from unpaid invoices."
                checked={bool(v.arrearsEnabled)}
                onChange={(checked) => set('arrearsEnabled', checked)}
              />
              <Toggle
                label="Discounts"
                description="No Discount model exists."
                checked={bool(v.discountsEnabled)}
                onChange={(checked) => set('discountsEnabled', checked)}
              />
              <Toggle
                label="Waivers"
                description="No Waiver model exists."
                checked={bool(v.waiversEnabled)}
                onChange={(checked) => set('waiversEnabled', checked)}
              />
              <Toggle
                label="Refunds"
                description="No CreditNote or Refund model exists; a payment is recorded as a Receipt."
                checked={bool(v.refundsEnabled)}
                onChange={(checked) => set('refundsEnabled', checked)}
              />
              <Toggle
                label="Credit notes"
                description="No CreditNote model exists."
                checked={bool(v.creditNotesEnabled)}
                onChange={(checked) => set('creditNotesEnabled', checked)}
              />
              <Toggle
                label="Reconciliation"
                description="No /api/finance/reconciliation route exists."
                checked={bool(v.reconciliationEnabled)}
                onChange={(checked) => set('reconciliationEnabled', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Arrears Grace (days)">
                  <TextInput
                    type="number"
                    min={0}
                    value={str(v.arrearsGraceDays)}
                    onChange={(e) => set('arrearsGraceDays', Number(e.target.value))}
                    placeholder="14"
                  />
                </Field>
              </div>
            </SettingsCard>
          </>
        );
      }}
    </SettingsSection>
  );
}
