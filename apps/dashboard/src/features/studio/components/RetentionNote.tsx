import type { Dataset } from '@layerto/types';
import { Alert } from '@layerto/ui';
import { fromNow, shortDate } from '../lib/format';

/** Explains when a dataset's images will be deleted. */
export function RetentionNote({ d }: { d: Dataset }) {
  if (d.purged_at) {
    return <Alert>The images were deleted on {shortDate(d.purged_at)}. Models trained from them keep working.</Alert>;
  }
  if (d.keep) return <Alert tone="success">Kept: these images stay until you delete them.</Alert>;
  if (!d.delete_after) return null;
  return (
    <Alert>
      {d.trained
        ? <>Training is done, so the images will be deleted <strong>{fromNow(d.delete_after)}</strong> ({shortDate(d.delete_after)}). Turn on “Keep dataset” to keep them.</>
        : <>Images are kept until you train. If the dataset sits unused, it is deleted {fromNow(d.delete_after)} ({shortDate(d.delete_after)}).</>}
    </Alert>
  );
}
