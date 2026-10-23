// Package catalog answers "who may call this model" for user-trained (custom) models and
// reads admin-editable platform settings. It is used by the gateway (every billed call goes
// through it) and by the studio package.
package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Querier is satisfied by *pgxpool.Pool and pgx.Tx.
type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Custom describes a user-trained model. Platform models have no Custom record.
type Custom struct {
	ModelID    string
	OwnerID    string
	Visibility string // private | pending | public | rejected
	WeightsKey string
	Classes    []string
}

// Lookup returns the custom-model record for a slug, or nil for a platform model.
func Lookup(ctx context.Context, q Querier, slug string) (*Custom, error) {
	var c Custom
	var classes []byte
	err := q.QueryRow(ctx, `
		SELECT m.id::text, o.owner_id::text, o.visibility, o.weights_key, o.classes
		FROM models m JOIN model_ownership o ON o.model_id = m.id
		WHERE m.slug = $1`, slug).Scan(&c.ModelID, &c.OwnerID, &c.Visibility, &c.WeightsKey, &classes)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("catalog lookup: %w", err)
	}
	_ = json.Unmarshal(classes, &c.Classes)
	return &c, nil
}

// CanUse: platform models and public custom models are open to everyone; private ones only
// to their owner.
func CanUse(c *Custom, userID string) bool {
	return c == nil || c.Visibility == "public" || c.OwnerID == userID
}

// Setting reads a platform setting into dst.
func Setting(ctx context.Context, q Querier, key string, dst any) error {
	var raw []byte
	if err := q.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = $1`, key).Scan(&raw); err != nil {
		return fmt.Errorf("setting %s: %w", key, err)
	}
	return json.Unmarshal(raw, dst)
}

// IntSetting returns an integer setting, or def when missing.
func IntSetting(ctx context.Context, q Querier, key string, def int64) int64 {
	var v int64
	if err := Setting(ctx, q, key, &v); err != nil {
		return def
	}
	return v
}
