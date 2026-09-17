import { DEFAULT_COUNTRY } from '../../data/countries'

export interface Enquiry {
    firstName: string
    lastName: string
    email: string
    mobile: string
    country: string
    description: string
}

export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>

export const emptyEnquiry: Enquiry = {
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    country: DEFAULT_COUNTRY,
    description: '',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+?[\d\s()-]{7,20}$/

/** Single source of truth for rules — used on blur and on submit. */
export function validateField(name: keyof Enquiry, value: string): string | undefined {
    const v = value.trim()
    switch (name) {
        case 'firstName':
        case 'lastName':
            return v ? undefined : 'Required'
        case 'email':
            if (!v) return 'Required'
            return EMAIL.test(v) ? undefined : 'Enter a valid email'
        case 'mobile':
            if (!v) return 'Required'
            return PHONE.test(v) && v.replace(/\D/g, '').length >= 7 ? undefined : 'Enter a valid mobile number'
        case 'country':
            return v ? undefined : 'Select a country'
        case 'description':
            if (!v) return 'Tell us a little about the project'
            return v.length >= 20 ? undefined : 'A few more details please (20+ characters)'
    }
}

export function validateEnquiry(data: Enquiry): EnquiryErrors {
    const errors: EnquiryErrors = {}
    ;(Object.keys(data) as (keyof Enquiry)[]).forEach((key) => {
        const error = validateField(key, data[key])
        if (error) errors[key] = error
    })
    return errors
}
