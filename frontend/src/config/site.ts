export const site = {
    name: 'Layerto',
    contactEmail: 'hello@layerto.com',
    mainUrl: import.meta.env.DEV ? '/' : 'https://layerto.com',
    softwareUrl: import.meta.env.DEV ? '/software' : 'https://software.layerto.com',
    /** Optional POST endpoint for project enquiries. Unset → falls back to mailto. */
    enquiryEndpoint: import.meta.env.VITE_ENQUIRY_ENDPOINT as string | undefined,
    fonts: {
        display: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&display=swap',
    },
} as const
