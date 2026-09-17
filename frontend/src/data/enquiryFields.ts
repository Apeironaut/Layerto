import type { ControlProps } from '../components/molecules/FormField'
import type { Enquiry } from '../services/enquiry/validation'
import { countries } from './countries'

export type EnquiryField = { name: keyof Enquiry; label: string; wide?: boolean } & ControlProps

// Adding a field = one entry here + one rule in services/enquiry/validation.ts
export const enquiryFields: EnquiryField[] = [
    { name: 'firstName', label: 'First name', autoComplete: 'given-name' },
    { name: 'lastName', label: 'Last name', autoComplete: 'family-name' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.com' },
    { name: 'mobile', label: 'Mobile number', type: 'tel', autoComplete: 'tel', placeholder: '+94 77 123 4567' },
    { name: 'country', label: 'Country', as: 'select', options: countries, wide: true },
    { name: 'description', label: 'Project description', as: 'textarea', wide: true, placeholder: 'What should it do, who will use it, and any deadline or budget in mind.' },
]
