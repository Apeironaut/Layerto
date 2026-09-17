import { useState } from 'react'
import { emptyEnquiry, validateEnquiry, validateField, type Enquiry, type EnquiryErrors } from '../services/enquiry/validation'
import { submitEnquiry, type SubmitResult } from '../services/enquiry/submitEnquiry'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function useEnquiryForm() {
    const [values, setValues] = useState<Enquiry>(emptyEnquiry)
    const [errors, setErrors] = useState<EnquiryErrors>({})
    const [touched, setTouched] = useState<Partial<Record<keyof Enquiry, boolean>>>({})
    const [status, setStatus] = useState<Status>('idle')
    const [result, setResult] = useState<SubmitResult | null>(null)

    const setField = (name: keyof Enquiry, value: string) => {
        setValues((v) => ({ ...v, [name]: value }))
        // Re-validate live only after the field has been visited once
        if (touched[name]) setErrors((e) => ({ ...e, [name]: validateField(name, value) }))
    }

    const blurField = (name: keyof Enquiry) => {
        setTouched((t) => ({ ...t, [name]: true }))
        setErrors((e) => ({ ...e, [name]: validateField(name, values[name]) }))
    }

    const submit = async () => {
        const nextErrors = validateEnquiry(values)
        setErrors(nextErrors)
        setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])))
        const firstInvalid = Object.keys(nextErrors)[0]
        if (firstInvalid) {
            document.getElementById(`enquiry-${firstInvalid}`)?.focus()
            return
        }
        setStatus('submitting')
        try {
            setResult(await submitEnquiry(values))
            setStatus('success')
        } catch {
            setStatus('error')
        }
    }

    const reset = () => {
        setValues(emptyEnquiry)
        setErrors({})
        setTouched({})
        setStatus('idle')
        setResult(null)
    }

    return { values, errors, status, result, setField, blurField, submit, reset }
}
