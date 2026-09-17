/** Inject a stylesheet <link> once. Used for web fonts so a blocked host can't break app CSS. */
export function loadStylesheet(id: string, href: string) {
    if (document.getElementById(id)) return
    document.head.appendChild(Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href }))
}
