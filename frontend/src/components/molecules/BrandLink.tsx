import symbol from '../../assets/layerto-symbol.png'
import { site } from '../../config/site'

export function BrandLink() {
    return (
        <a href={site.mainUrl} className="group/brand flex items-center gap-2 font-display text-base font-bold whitespace-nowrap no-underline sm:text-lg">
            <img src={symbol} alt="" width="26" height="30" className="transition-transform duration-400 ease-spring group-hover/brand:scale-110 group-hover/brand:-rotate-8" />
            <span>
                Layerto <em className="font-medium text-brand not-italic">Software</em>
            </span>
        </a>
    )
}
