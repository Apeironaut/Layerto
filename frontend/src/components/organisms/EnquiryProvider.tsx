import { useState, type ReactNode } from 'react'
import { EnquiryContext } from '../../context/enquiryContext'
import { EnquiryModal } from './EnquiryModal'

/** Owns the single enquiry modal; any descendant opens it with useEnquiry(). */
export function EnquiryProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false)

    return (
        <EnquiryContext.Provider value={{ openEnquiry: () => setOpen(true) }}>
            {children}
            <EnquiryModal open={open} onClose={() => setOpen(false)} />
        </EnquiryContext.Provider>
    )
}
