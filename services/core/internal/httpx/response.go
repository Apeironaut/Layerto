package httpx

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
)

// NewUUIDv4 returns a compliant RFC 4122 UUID v4 string.
func NewUUIDv4() string {
	var u [16]byte
	_, _ = rand.Read(u[:])
	u[6] = (u[6] & 0x0f) | 0x40 // version 4
	u[8] = (u[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u[0:4], u[4:6], u[6:8], u[8:10], u[10:16])
}

// ErrorResponse represents the standard API error envelope per SPEC §8.
type ErrorResponse struct {
	Error struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		RequestID string `json:"request_id,omitempty"`
	} `json:"error"`
}

// JSON writes a JSON response with status code and Content-Type header.
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// WriteError writes a standard JSON error envelope with the current request_id.
func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	reqID := GetRequestID(r.Context())
	var resp ErrorResponse
	resp.Error.Code = code
	resp.Error.Message = message
	resp.Error.RequestID = reqID

	JSON(w, status, resp)
}
