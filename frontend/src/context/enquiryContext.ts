import { createContext, useContext } from 'react'

export interface EnquiryContextValue {
    openEnquiry: () => void
}

export const EnquiryContext = createContext<EnquiryContextValue | null>(null)

export function useEnquiry() {
    const ctx = useContext(EnquiryContext)
    if (!ctx) throw new Error('useEnquiry must be used inside <EnquiryProvider>')
    return ctx
}
