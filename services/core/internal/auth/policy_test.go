package auth

import (
	"errors"
	"testing"
)

func TestValidatePasswordPolicy(t *testing.T) {
	cases := []struct {
		pw, user, email string
		want            error
	}{
		{"Abcdef1!", "", "", nil},
		{"lo0ng-enough", "", "", nil},
		{"Ab1!", "", "", ErrPasswordTooShort},
		{"abcdefgh!", "", "", ErrPasswordNoDigit},
		{"12345678!", "", "", ErrPasswordNoLetter},
		{"abcdefg12", "", "", ErrPasswordNoSymbol},
		{"naveen#2026", "naveen", "", ErrPasswordHasIdentity},
		{"x!Kasun99", "", "kasun@shop.lk", ErrPasswordHasIdentity},
		{"ok#Pass99", "ab", "ab@x.io", nil}, // identities shorter than 3 are ignored
	}
	for _, c := range cases {
		got := ValidatePasswordPolicy(c.pw, c.user, c.email)
		if !errors.Is(got, c.want) && !(got == nil && c.want == nil) {
			t.Errorf("ValidatePasswordPolicy(%q) = %v, want %v", c.pw, got, c.want)
		}
	}
}

func TestValidateUsername(t *testing.T) {
	ok := []string{"naveen", "nav_c", "n.chethiya", "abc", "user123", "a1b"}
	bad := []string{"ab", "_abc", "abc_", "a..b", "Naveen", "na veen", "naveen!", "", "abcdefghijabcdefghijabcdefghijx"}
	for _, u := range ok {
		if err := ValidateUsername(u); err != nil {
			t.Errorf("ValidateUsername(%q) = %v, want nil", u, err)
		}
	}
	for _, u := range bad {
		if ValidateUsername(u) == nil {
			t.Errorf("ValidateUsername(%q) = nil, want error", u)
		}
	}
	if !errors.Is(ValidateUsername("admin"), ErrUsernameReserved) {
		t.Error("admin should be reserved")
	}
	if NormalizeUsername("  NaVeen ") != "naveen" {
		t.Error("NormalizeUsername should trim and lowercase")
	}
}

func TestValidateName(t *testing.T) {
	ok := []string{"Naveen", "O'Brien", "Anne-Marie", "J. R.", "නවීන්", "Chethiya"}
	bad := []string{"", "N4veen", "<script>", "a@b", "   ", "--"}
	for _, n := range ok {
		if err := ValidateName(NormalizeName(n)); err != nil {
			t.Errorf("ValidateName(%q) = %v, want nil", n, err)
		}
	}
	for _, n := range bad {
		if ValidateName(NormalizeName(n)) == nil {
			t.Errorf("ValidateName(%q) = nil, want error", n)
		}
	}
	if NormalizeName("  Naveen   Chethiya ") != "Naveen Chethiya" {
		t.Error("NormalizeName should collapse spaces")
	}
}

func TestValidateEmail(t *testing.T) {
	if !ValidateEmail("naveen@example.com") || ValidateEmail("no-at.example.com") || ValidateEmail("a@b") {
		t.Error("email validation mismatch")
	}
}
