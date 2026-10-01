/**
 * School settings areas.
 *
 * Each section is a thin declaration over `SettingsSection`, which owns loading,
 * dirty tracking, saving and the permission refusal. Adding a ninth area to the
 * API means adding a model, a `SCHEMAS` entry, a section here, and a case in the
 * admin settings page - the list of areas itself comes from `@schoolos/auth`.
 */

export { GeneralSettingsSection } from './GeneralSettingsSection';
export { AcademicSettingsSection } from './AcademicSettingsSection';
export { FinanceSettingsSection } from './FinanceSettingsSection';
export { BrandingSettingsSection } from './BrandingSettingsSection';
export { NotificationsSettingsSection } from './NotificationsSettingsSection';
export { SecuritySettingsSection } from './SecuritySettingsSection';
export { SubscriptionSettingsSection } from './SubscriptionSettingsSection';
export { GlowSettingsSection } from './GlowSettingsSection';
