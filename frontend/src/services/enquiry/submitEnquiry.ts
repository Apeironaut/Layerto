import { site } from '../../config/site'
import { countryName } from '../../data/countries'
import type { Enquiry } from './validation'

export type SubmitResult = { via: 'api' } | { via: 'email' }

/**
 * Sends the enquiry to VITE_ENQUIRY_ENDPOINT when configured,
 * otherwise opens the visitor's mail client with everything filled in.
 */
export async function submitEnquiry(data: Enquiry): Promise<SubmitResult> {
    const payload = { ...data, countryName: countryName(data.country), submittedAt: new Date().toISOString() }

    if (site.enquiryEndpoint) {
        const res = await fetch(site.enquiryEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`Enquiry failed (${res.status})`)
        return { via: 'api' }
    }

    const subject = `Project enquiry from ${data.firstName} ${data.lastName}`
    const body = [
        `Name: ${data.firstName} ${data.lastName}`,
        `Email: ${data.email}`,
        `Mobile: ${data.mobile}`,
        `Country: ${payload.countryName}`,
        '',
        data.description,
    ].join('\n')
    window.location.href = `mailto:${site.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    return { via: 'email' }
}
