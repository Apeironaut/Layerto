import type { User } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Card, ChangePasswordForm, Chip, CopyButton, PageHeader, Reveal } from '@layerto/ui';
import { ProfileForm } from '../components/settings/ProfileForm';
import { api } from '../lib/api';

export interface SettingsPageProps {
  user: User;
  onUserChange: (user: User) => void;
}

function initials(user: User): string {
  const a = user.first_name?.[0] ?? user.email[0];
  const b = user.last_name?.[0] ?? '';
  return (a + b).toUpperCase();
}

export function SettingsPage({ user, onUserChange }: SettingsPageProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  return (
    <>
      <PageHeader title="Settings" description="Your profile and sign-in security." />
      <Reveal index={0}>
        <Card padded>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid place-items-center h-14 w-14 rounded-full bg-crimson text-white text-lg font-bold dark:bg-crimson-fill" aria-hidden="true">
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold truncate">{fullName}</p>
              <p className="text-sm text-muted truncate">
                {user.username ? `@${user.username} · ` : ''}
                {user.email}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant={user.status === 'active' ? 'active' : 'pending'}>{user.status === 'active' ? 'Active' : 'Pending'}</Chip>
              {user.created_at && <Chip variant="neutral">Member since {new Date(user.created_at).toLocaleDateString()}</Chip>}
              <CopyButton text={user.id} label="Copy account ID" />
            </div>
          </div>
        </Card>
      </Reveal>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Reveal index={1}>
          <Card title="Profile" subtitle="How your name appears in Layerto.">
            <ProfileForm user={user} onSaved={onUserChange} />
          </Card>
        </Reveal>
        <Reveal index={2}>
          <Card title="Password" subtitle="Changing it signs out every other device.">
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
