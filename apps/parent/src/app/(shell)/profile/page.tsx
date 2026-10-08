'use client';

import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  SectionHeader,
  StatusPill,
  roleLabel,
  type DataTableColumn,
} from '@schoolos/ui';

export default function ProfilePage() {
  const { user, permissions } = useAuth();

  const columns: Array<DataTableColumn<{ key: string; value: string }>> = [
    { id: 'field', header: 'Field', cell: (row) => row.key },
    { id: 'value', header: 'Value', cell: (row) => row.value },
  ];

  const rows = [
    { key: 'Full name', value: user?.name ?? user?.firstName ?? 'Not set' },
    { key: 'Email', value: user?.email ?? '-' },
    { key: 'Account type', value: roleLabel(user?.role ?? '') },
    { key: 'User ID', value: user?.id ?? '-' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="My Profile" description="Your identity in the school platform." />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Account details</h2>
        <DataTable
          caption="Account details for the signed-in user"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.key}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">What you can access</h2>
        <div className="flex flex-wrap gap-1.5">
          {permissions.map((permission) => (
            <StatusPill key={permission} label={permission} tone="neutral" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          These capabilities come from the backend session. Hiding a control in the interface is
          never the security boundary - every API request is authorized independently.
        </p>
      </section>
    </div>
  );
}
