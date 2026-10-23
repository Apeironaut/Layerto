package billing

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const (
	MicroUSDPerUSD    int64 = 1_000_000
	MaxCreditUSD      int64 = 10_000
	MaxCreditMicroUSD int64 = MaxCreditUSD * MicroUSDPerUSD // 10,000,000,000 micro-USD ($10,000)

	MinModelPriceMicroUSD int64 = 1          // $0.000001
	MaxModelPriceMicroUSD int64 = 10_000_000 // $10.000000
)

var (
	ErrInvalidAmount     = errors.New("invalid money amount format")
	ErrAmountTooSmall    = errors.New("amount must be greater than 0")
	ErrAmountTooLarge    = errors.New("amount cannot exceed $10,000.00")
	ErrTooManyDecimals   = errors.New("amount cannot have more than 6 decimal places")
	ErrNegativeAmount    = errors.New("amount cannot be negative")
	ErrInvalidModelPrice = fmt.Errorf("model price must be between %d and %d micro-USD ($0.000001 to $10.00)", MinModelPriceMicroUSD, MaxModelPriceMicroUSD)
)

// ParseAmountUSD parses a decimal string (e.g. "10.50", "0.1") into exact integer micro-USD.
// Strictly avoids float parsing to prevent rounding and precision errors.
func ParseAmountUSD(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, ErrInvalidAmount
	}

	// Reject negative numbers or explicit plus signs
	if strings.HasPrefix(s, "-") {
		return 0, ErrNegativeAmount
	}
	if strings.HasPrefix(s, "+") {
		return 0, ErrInvalidAmount
	}

	parts := strings.Split(s, ".")
	if len(parts) > 2 {
		return 0, ErrInvalidAmount
	}

	intStr := parts[0]
	if intStr == "" {
		intStr = "0"
	}

	// Validate integer part contains only digits
	for _, c := range intStr {
		if c < '0' || c > '9' {
			return 0, ErrInvalidAmount
		}
	}

	intPart, err := strconv.ParseInt(intStr, 10, 64)
	if err != nil {
		return 0, ErrInvalidAmount
	}

	var decPart int64
	if len(parts) == 2 {
		decStr := parts[1]
		if len(decStr) > 6 {
			return 0, ErrTooManyDecimals
		}
		for _, c := range decStr {
			if c < '0' || c > '9' {
				return 0, ErrInvalidAmount
			}
		}
		// Pad with trailing zeros to exactly 6 digits (micro-USD)
		for len(decStr) < 6 {
			decStr += "0"
		}
		decPart, err = strconv.ParseInt(decStr, 10, 64)
		if err != nil {
			return 0, ErrInvalidAmount
		}
	}

	totalMicro := intPart*MicroUSDPerUSD + decPart
	if totalMicro <= 0 {
		return 0, ErrAmountTooSmall
	}
	if totalMicro > MaxCreditMicroUSD {
		return 0, ErrAmountTooLarge
	}

	return totalMicro, nil
}

// FormatMicroUSD formats an integer micro-USD amount into a standard 6-decimal USD string.
func FormatMicroUSD(micro int64) string {
	if micro < 0 {
		return fmt.Sprintf("-%d.%06d", (-micro)/MicroUSDPerUSD, (-micro)%MicroUSDPerUSD)
	}
	return fmt.Sprintf("%d.%06d", micro/MicroUSDPerUSD, micro%MicroUSDPerUSD)
}

// ValidateModelPrice ensures a price in micro-USD is between 1 and 10,000,000 micro-USD ($10 max).
func ValidateModelPrice(micro int64) error {
	if micro < MinModelPriceMicroUSD || micro > MaxModelPriceMicroUSD {
		return ErrInvalidModelPrice
	}
	return nil
}
