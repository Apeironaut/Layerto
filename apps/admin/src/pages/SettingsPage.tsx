import type { User } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Card, ChangePasswordForm, Chip, PageHeader, Reveal } from '@layerto/ui';
import { api } from '../lib/api';

/** The signed-in admin's account and password. */
export function SettingsPage({ user }: { user: User }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || 'Administrator';
  return (
    <>
      <PageHeader title="Settings" description="Your admin account." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Reveal index={0}>
          <Card title="Account">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold">{name}</dd>
              <dt className="text-muted">Username</dt>
              <dd className="font-mono">{user.username ? `@${user.username}` : '—'}</dd>
              <dt className="text-muted">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-muted">Role</dt>
              <dd>
                <Chip variant="brand">Administrator</Chip>
              </dd>
            </dl>
            <p className="mt-5 text-xs text-muted">
              Admin accounts are created on the server with <code>create-admin</code>. If you forget this password, reset it there with <code>--reset-password</code>.
            </p>
          </Card>
        </Reveal>
        <Reveal index={1}>
          <Card title="Change password" subtitle="Signs out every other session.">
            <ChangePasswordForm
              username={user.username}
              email={user.email}
              onSubmit={async (current, next) => {
                await api.changePassword(current, next);
              }}
              describeError={(err) => errorMessage(err, "Couldn't change the password.")}
            />
          </Card>
        </Reveal>
      </div>
    </>
  );
}
