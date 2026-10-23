import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ResearcherProfile, User } from '@layerto/types';
import { Alert, Button, Card, Icon, Input, Skeleton, Switch, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { SITE_URL } from '../../config';

/** Public researcher profile: headline, affiliation, bio and visibility of /@username. */
export function ProfileCard({ user }: { user: User }) {
  const notify = useNotify();
  const profile = useResource(() => api.studioProfile(), 'studio-profile');
  const [form, setForm] = useState<ResearcherProfile | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile.data) setForm(profile.data);
  }, [profile.data]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      setForm(await api.studioSaveProfile(form));
      notify('Profile saved', 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't save your profile."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const url = user.username ? `${SITE_URL}/@${user.username}` : null;
  return (
    <Card
      title="Public profile"
      subtitle="A portfolio page with your public projects and published models."
      actions={url && form?.is_public && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-crimson inline-flex items-center gap-1">
          View <Icon name="external" size={14} />
        </a>
      )}
    >
      {!form ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          {!user.username && <Alert>Pick a username in Settings to get a profile address.</Alert>}
          <Switch
            checked={form.is_public}
            onChange={(v) => setForm({ ...form, is_public: v })}
            label="Show my profile publicly"
            description={url ? url : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Headline" placeholder="Computer vision researcher" value={form.headline} maxLength={120} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
            <Input label="Affiliation" placeholder="University of Moratuwa" value={form.affiliation} maxLength={120} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
          </div>
          <Input label="Website" placeholder="https://" value={form.website} maxLength={200} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">Bio</span>
            <textarea
              className="w-full min-h-24 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              value={form.bio}
              maxLength={2000}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
          <div className="flex justify-end">
            <Button onClick={save} loading={busy}>Save profile</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
