import { Card, Table, THead, Th, Tr, Td } from '@layerto/ui';

/** Every error the vision and workflow APIs return, with what to do about it. */
const ERRORS = [
  ['400', 'invalid_image', 'The file is not a JPG, PNG or WebP image, or it is corrupted.'],
  ['400', 'invalid_request', 'The body is malformed, or the prompt is longer than 1000 characters.'],
  ['401', 'invalid_api_key', 'The API key is missing, revoked or wrong.'],
  ['401', 'api_key_expired', 'This API key has expired. Create a new key in the dashboard.'],
  ['402', 'insufficient_balance', 'Free calls are used up and the balance is below the call price. Nothing was charged.'],
  ['400', 'invalid_images', 'Workflow runs: no images, too many images, or one is not a valid image.'],
  ['400', 'too_many_calls', 'Workflow runs: this many images could need more than 400 model calls. Send fewer images.'],
  ['403', 'account_not_active', 'The account is waiting for approval or is suspended.'],
  ['403', 'forbidden_role', 'Admin accounts cannot call the API.'],
  ['404', 'model_not_found', 'The model name does not exist or the model is turned off.'],
  ['404', 'workflow_not_found', 'No workflow with that ID belongs to this key’s account.'],
  ['422', 'invalid_definition', 'The saved workflow has problems. Open it in the editor, fix them and save.'],
  ['413', 'image_too_large', 'The image is over 10 MB or larger than 8000 × 8000 pixels.'],
  ['429', 'rate_limited', 'More than 60 requests in a minute on one key. Wait and retry.'],
  ['502', 'model_error', 'The model failed. The reserved amount was refunded.'],
  ['504', 'model_timeout', 'The model took longer than 60 seconds. The reserved amount was refunded.'],
  ['500', 'internal_error', 'Something failed on our side before the model ran. Nothing was charged.'],
];

export function ErrorCodesTable() {
  return (
    <Card title="Error codes" subtitle='Errors return {"error": {"code", "message", "request_id"}}.'>
      <Table label="API error codes">
        <THead>
          <Th>Status</Th>
          <Th>Code</Th>
          <Th>Meaning</Th>
        </THead>
        <tbody>
          {ERRORS.map(([status, code, meaning]) => (
            <Tr key={code}>
              <Td className="font-semibold tabular-nums">{status}</Td>
              <Td className="font-mono text-xs text-crimson whitespace-nowrap">{code}</Td>
              <Td className="text-ink-secondary">{meaning}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
