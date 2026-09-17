import { useEnquiry } from '../../context/enquiryContext'
import { Button, type ButtonSize, type ButtonVariant } from '../atoms'

interface Props {
    label?: string
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
}

/** Every "Start a project" CTA opens the same enquiry modal. */
export function StartProjectButton({ label = 'Start a project', ...rest }: Props) {
    const { openEnquiry } = useEnquiry()
    return (
        <Button {...rest} onClick={openEnquiry} aria-haspopup="dialog">
            {label}
        </Button>
    )
}
