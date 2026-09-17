import { content } from '../../data/content'
import { Modal } from '../molecules'
import { EnquiryForm } from './EnquiryForm'

interface Props {
    open: boolean
    onClose: () => void
}

export function EnquiryModal({ open, onClose }: Props) {
    return (
        <Modal open={open} onClose={onClose} {...content.enquiry}>
            {open && <EnquiryForm onDone={onClose} />}
        </Modal>
    )
}
