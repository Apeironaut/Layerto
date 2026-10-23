package billing_test

import (
	"testing"

	"layerto/services/core/internal/billing"
)

// Requirement 2:
// Money input: amount_usd is a decimal STRING ("10.50"), parsed exactly
// into integer micro-USD with at most 6 decimals. No float parsing
// anywhere. Test "0.1", "10.50", "0.0000001" (rejected), "-1" (rejected).
func TestMoneyParsing(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  int64
		expectErr bool
	}{
		{
			name:      "0.1 to 100000 micro-USD",
			input:     "0.1",
			expected:  100_000,
			expectErr: false,
		},
		{
			name:      "10.50 to 10500000 micro-USD",
			input:     "10.50",
			expected:  10_500_000,
			expectErr: false,
		},
		{
			name:      "1 to 1000000 micro-USD",
			input:     "1",
			expected:  1_000_000,
			expectErr: false,
		},
		{
			name:      "0.000001 minimum micro-USD",
			input:     "0.000001",
			expected:  1,
			expectErr: false,
		},
		{
			name:      "0.0000001 rejected (more than 6 decimals)",
			input:     "0.0000001",
			expectErr: true,
		},
		{
			name:      "-1 rejected (negative)",
			input:     "-1",
			expectErr: true,
		},
		{
			name:      "0 rejected (zero amount)",
			input:     "0",
			expectErr: true,
		},
		{
			name:      "empty string rejected",
			input:     "",
			expectErr: true,
		},
		{
			name:      "invalid chars rejected",
			input:     "abc",
			expectErr: true,
		},
		{
			name:      "exceeds max $10,000",
			input:     "10000.01",
			expectErr: true,
		},
		{
			name:      "valid max $10,000",
			input:     "10000.00",
			expected:  10_000_000_000,
			expectErr: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := billing.ParseAmountUSD(tc.input)
			if tc.expectErr {
				if err == nil {
					t.Fatalf("expected error for input %q, got nil (micro: %d)", tc.input, got)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error for input %q: %v", tc.input, err)
				}
				if got != tc.expected {
					t.Fatalf("expected %d micro-USD for %q, got %d", tc.expected, tc.input, got)
				}
			}
		})
	}
}

// Requirement 5: Model price limit: 1 to 10,000,000 micro-USD ($10 max per call).
func TestModelPriceValidation(t *testing.T) {
	if err := billing.ValidateModelPrice(1); err != nil {
		t.Fatalf("1 micro-USD should be valid: %v", err)
	}
	if err := billing.ValidateModelPrice(10_000_000); err != nil {
		t.Fatalf("10,000,000 micro-USD ($10) should be valid: %v", err)
	}
	if err := billing.ValidateModelPrice(0); err == nil {
		t.Fatalf("0 micro-USD should be rejected")
	}
	if err := billing.ValidateModelPrice(-100); err == nil {
		t.Fatalf("negative price should be rejected")
	}
	if err := billing.ValidateModelPrice(10_000_001); err == nil {
		t.Fatalf("price over $10 should be rejected")
	}
}
