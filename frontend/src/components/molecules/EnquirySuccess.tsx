import { site } from '../../config/site'
import type { SubmitResult } from '../../services/enquiry/submitEnquiry'
import { AnimatedCheck, Button, Heading, Text } from '../atoms'

interface Props {
    name: string
    result: SubmitResult | null
    onClose: () => void
}

export function EnquirySuccess({ name, result, onClose }: Props) {
    return (
        <div role="status" className="py-4 text-center">
            <AnimatedCheck className="mx-auto text-brand" />
            <Heading as="h3" level="card" className="mt-4 mb-2">Thanks, {name}.</Heading>
            <Text muted className="mx-auto mb-6 max-w-sm">
                {result?.via === 'api'
                    ? 'We received your project details and will reply within two working days.'
                    : `Your email app should have opened with everything filled in. If it didn't, write to ${site.contactEmail}.`}
            </Text>
            <Button onClick={onClose}>Close</Button>
        </div>
    )
}
