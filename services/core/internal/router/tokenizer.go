package router

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// NormalizeKeyword normalizes a keyword for storage:
// trimmed, single spaces, Unicode NFC, lowercase.
func NormalizeKeyword(s string) string {
	s = norm.NFC.String(s)
	s = strings.ToLower(s)
	tokens := Tokenize(s)
	return strings.Join(tokens, " ")
}

// Tokenize normalizes with Unicode NFC + lowercase, then splits into tokens
// on characters that are NOT unicode.IsLetter / unicode.IsDigit / unicode.IsMark.
func Tokenize(s string) []string {
	s = norm.NFC.String(s)
	s = strings.ToLower(s)
	return strings.FieldsFunc(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && !unicode.IsMark(r)
	})
}

// MatchContiguous checks if keywordTokens appears as a contiguous subsequence in promptTokens.
func MatchContiguous(promptTokens, keywordTokens []string) bool {
	if len(keywordTokens) == 0 {
		return false
	}
	if len(keywordTokens) > len(promptTokens) {
		return false
	}
	for i := 0; i <= len(promptTokens)-len(keywordTokens); i++ {
		matched := true
		for j := 0; j < len(keywordTokens); j++ {
			if promptTokens[i+j] != keywordTokens[j] {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}
