import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { User } from '@layerto/types';
import { Button, Card, ChangePasswordForm, CopyButton, Tabs } from '@layerto/ui';
import { ProfileForm } from '../../components/settings/ProfileForm';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { ProfileCard } from './ProfileCard';
import { TRACK_BADGE } from '../home/util';

type Tab = 'profile' | 'public' | 'security' | 'type';

/** Account settings shown in a pop-up from the name in the sidebar. */
export function AccountSettings({ user, onUserChange, onChangeTrack, initial = 'profile' }: { user: User; onUserChange: (u: User) => void; onChangeTrack: () => void; initial?: Tab }) {
  const { track, plan } = useHub();
  const [tab, setTab] = useState<Tab>(initial);
  const badge = TRACK_BADGE[track];
  return (
    <div className="space-y-5">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'profile', label: 'Profile', icon: 'user' },
          { value: 'public', label: 'Public profile', icon: 'globe' },
          { value: 'security', label: 'Password', icon: 'shield' },
          { value: 'type', label: 'Account type', icon: 'compass' },
        ]}
      />
      {tab === 'profile' && (
        <div className="space-y-4">
          <ProfileForm user={user} onSaved={onUserChange} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-page px-3 py-2 text-xs text-muted">
            <span>
              {user.email}
              {user.created_at && ` · member since ${new Date(user.created_at).toLocaleDateString()}`}
            </span>
            <CopyButton text={user.id} label="Copy account ID" />
          </div>
        </div>
      )}
      {tab === 'public' && <ProfileCard user={user} />}
      {tab === 'security' && (
        <Card>
          <ChangePasswordForm
            username={user.username}
            email={user.email}
            onSubmit={async (current, next) => {
              await api.changePassword(current, next);
            }}
            describeError={(err) => errorMessage(err, "Couldn't change the password.")}
          />
        </Card>
      )}
      {tab === 'type' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Your account type tailors the sidebar, your home feed and the plans we suggest. Features come from your plan.</p>
          <div className="flex flex-wrap items-center gap-3 rounded-l2 border border-line p-4">
            <div className="flex-1">
              <div className="text-xs text-muted">Account type</div>
              <div className="mt-0.5 font-semibold">{badge?.label ?? 'Not chosen'}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted">Plan</div>
              <div className="mt-0.5 font-semibold">{plan?.limits.name ?? '—'}</div>
            </div>
            <Button variant="secondary" onClick={onChangeTrack}>
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
