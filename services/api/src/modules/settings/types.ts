/**
 * School scope, resolved from the signed-in user's membership.
 *
 * The configuration area list is intentionally NOT declared here. It comes from
 * `@schoolos/auth` so the API and all four portals share one list and cannot
 * drift: an area that exists in the schema, in the service, and in the admin UI
 * is the same string in all three places.
 */

export { SETTINGS_AREAS, isSettingsArea, type SettingsArea } from '@schoolos/auth';

export interface SchoolScope {
  schoolId: string;
  schoolName: string;
}
