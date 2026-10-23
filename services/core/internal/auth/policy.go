package auth

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Account field rules shared by sign-up, profile updates and password changes.

const (
	MaxNameRunes     = 50
	MinUsernameRunes = 3
	MaxUsernameRunes = 30
)

var (
	ErrPasswordNoLetter    = errors.New("password must contain a letter")
	ErrPasswordNoDigit     = errors.New("password must contain a number")
	ErrPasswordNoSymbol    = errors.New("password must contain a symbol")
	ErrPasswordHasIdentity = errors.New("password must not contain your username or email name")

	ErrUsernameInvalid  = errors.New("username must be 3-30 characters: lowercase letters, numbers, dots or underscores, starting and ending with a letter or number")
	ErrUsernameReserved = errors.New("this username is reserved")

	ErrNameInvalid = errors.New("name must be 1-50 letters; spaces, hyphens, apostrophes and dots are allowed")
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$`)

var reservedUsernames = map[string]bool{
	"admin": true, "administrator": true, "root": true, "system": true, "support": true,
	"help": true, "layerto": true, "apeironaut": true, "api": true, "www": true, "mail": true,
	"security": true, "billing": true, "null": true, "undefined": true, "me": true,
	"settings": true, "login": true, "signup": true, "owner": true, "staff": true,
	"moderator": true, "charon": true, "status": true, "docs": true,
}

// NormalizeUsername trims and lowercases a username for storage and lookup.
func NormalizeUsername(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ValidateUsername checks an already-normalized username.
func ValidateUsername(u string) error {
	if !usernamePattern.MatchString(u) || strings.Contains(u, "..") {
		return ErrUsernameInvalid
	}
	if reservedUsernames[u] {
		return ErrUsernameReserved
	}
	return nil
}

// NormalizeName trims and collapses inner whitespace.
func NormalizeName(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// ValidateName accepts letters from any script (including combining marks such as
// Sinhala vowel signs), spaces, hyphens, apostrophes and dots.
func ValidateName(n string) error {
	count := utf8.RuneCountInString(n)
	if count < 1 || count > MaxNameRunes {
		return ErrNameInvalid
	}
	hasLetter := false
	for _, r := range n {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsMark(r), r == ' ', r == '-', r == '\'', r == '.', r == '’':
		default:
			return ErrNameInvalid
		}
	}
	if !hasLetter {
		return ErrNameInvalid
	}
	return nil
}

// ValidatePasswordPolicy enforces: 8-128 characters, at least one letter, one number and
// one symbol, and not containing the username or the part of the email before "@".
// identity values may be empty.
func ValidatePasswordPolicy(password, username, email string) error {
	if utf8.RuneCountInString(password) < MinPasswordLen {
		return ErrPasswordTooShort
	}
	if len(password) > MaxPasswordLen {
		return ErrPasswordTooLong
	}
	var letter, digit, symbol bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			letter = true
		case unicode.IsDigit(r):
			digit = true
		case unicode.IsSpace(r):
		default:
			symbol = true
		}
	}
	if !letter {
		return ErrPasswordNoLetter
	}
	if !digit {
		return ErrPasswordNoDigit
	}
	if !symbol {
		return ErrPasswordNoSymbol
	}
	lower := strings.ToLower(password)
	if u := strings.ToLower(username); len(u) >= 3 && strings.Contains(lower, u) {
		return ErrPasswordHasIdentity
	}
	if at := strings.IndexByte(email, '@'); at >= 3 && strings.Contains(lower, strings.ToLower(email[:at])) {
		return ErrPasswordHasIdentity
	}
	return nil
}

// PasswordPolicyMessage turns a policy error into a message safe to show users.
func PasswordPolicyMessage(err error) string {
	switch {
	case errors.Is(err, ErrPasswordTooShort):
		return "Password must be at least 8 characters."
	case errors.Is(err, ErrPasswordTooLong):
		return "Password must be at most 128 characters."
	case errors.Is(err, ErrPasswordNoLetter):
		return "Password must contain at least one letter."
	case errors.Is(err, ErrPasswordNoDigit):
		return "Password must contain at least one number."
	case errors.Is(err, ErrPasswordNoSymbol):
		return "Password must contain at least one symbol, like ! @ # or ?."
	case errors.Is(err, ErrPasswordHasIdentity):
		return "Password must not contain your username or email name."
	default:
		return "Password doesn't meet the requirements."
	}
}

var emailPattern = regexp.MustCompile(`^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$`)

// NormalizeEmail trims and lowercases. ValidateEmail does a pragmatic shape check.
func NormalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func ValidateEmail(e string) bool { return len(e) <= 254 && emailPattern.MatchString(e) }
