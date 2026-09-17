import { site } from '../../config/site'
import { enquiryFields } from '../../data/enquiryFields'
import { useEnquiryForm } from '../../hooks/useEnquiryForm'
import { cn } from '../../lib/cn'
import { Button } from '../atoms'
import { EnquirySuccess, FormField } from '../molecules'

export function EnquiryForm({ onDone }: { onDone: () => void }) {
    const { values, errors, status, result, setField, blurField, submit, reset } = useEnquiryForm()

    if (status === 'success') {
        return <EnquirySuccess name={values.firstName} result={result} onClose={() => { reset(); onDone() }} />
    }

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault()
                submit()
            }}
            className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2"
        >
            {enquiryFields.map(({ name, label, wide, ...control }) => (
                <FormField
                    key={name}
                    {...control}
                    id={`enquiry-${name}`}
                    label={label}
                    required
                    value={values[name]}
                    error={errors[name]}
                    onChange={(v) => setField(name, v)}
                    onBlur={() => blurField(name)}
                    className={cn(wide && 'sm:col-span-2')}
                />
            ))}

            {status === 'error' && (
                <p role="alert" className="text-brand sm:col-span-2">
                    Something went wrong sending that. Please try again or email {site.contactEmail}.
                </p>
            )}

            <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onDone}>Cancel</Button>
                <Button type="submit" disabled={status === 'submitting'}>
                    {status === 'submitting' ? 'Sending…' : 'Send project details'}
                </Button>
            </div>
        </form>
    )
}
