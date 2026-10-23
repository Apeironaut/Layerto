package studio

import (
	"regexp"
	"strings"
)

var latexAccentRe = regexp.MustCompile(`\\([` + "`" + `'^"~=.uvHc])\s*\{?\\?([A-Za-z])\}?`)

var latexMarks = map[string]rune{"'": '́', "`": '̀', "^": '̂', "\"": '̈', "~": '̃', "=": '̄',
	".": '̇', "u": '̆', "v": '̌', "H": '̋', "c": '̧'}

// precomposed forms of the most common accented letters; anything else gets a combining mark
var latexComposed = map[string]string{
	"'a": "á", "'e": "é", "'i": "í", "'o": "ó", "'u": "ú", "'y": "ý", "'c": "ć", "'n": "ń", "'s": "ś", "'z": "ź",
	"'A": "Á", "'E": "É", "'I": "Í", "'O": "Ó", "'U": "Ú", "'C": "Ć", "'S": "Ś",
	"`a": "à", "`e": "è", "`i": "ì", "`o": "ò", "`u": "ù", "`A": "À", "`E": "È",
	"^a": "â", "^e": "ê", "^i": "î", "^o": "ô", "^u": "û",
	"\"a": "ä", "\"e": "ë", "\"i": "ï", "\"o": "ö", "\"u": "ü", "\"A": "Ä", "\"O": "Ö", "\"U": "Ü",
	"~a": "ã", "~n": "ñ", "~o": "õ", "~N": "Ñ", "cc": "ç", "cC": "Ç",
	"vc": "č", "vs": "š", "vz": "ž", "vr": "ř", "ve": "ě", "vC": "Č", "vS": "Š", "vZ": "Ž", "Ho": "ő", "Hu": "ű", "ug": "ğ",
}

var latexSymbols = strings.NewReplacer(`\&`, "&", `\%`, "%", `\_`, "_", `\$`, "$", "---", "—", "--", "–", `\ss`, "ß", `\aa`, "å", `\o `, "ø", `\i`, "ı")

// latexToUnicode turns common BibTeX escapes into plain text: {\'a} → á, \& → &, -- → –.
func latexToUnicode(s string) string {
	s = latexAccentRe.ReplaceAllStringFunc(s, func(m string) string {
		p := latexAccentRe.FindStringSubmatch(m)
		if c, ok := latexComposed[p[1]+p[2]]; ok {
			return c
		}
		return p[2] + string(latexMarks[p[1]])
	})
	return latexSymbols.Replace(s)
}
