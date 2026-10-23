-- +goose Up
-- Requirement 2: Keywords are globally unique (UNIQUE(keyword))
ALTER TABLE routes ADD CONSTRAINT routes_keyword_unique UNIQUE (keyword);

-- Seed routes: "turtle", "sea turtle" → turtle-id
INSERT INTO routes (keyword, model_id, priority)
SELECT 'turtle', id, 100 FROM models WHERE slug = 'turtle-id'
ON CONFLICT (keyword) DO NOTHING;

INSERT INTO routes (keyword, model_id, priority)
SELECT 'sea turtle', id, 100 FROM models WHERE slug = 'turtle-id'
ON CONFLICT (keyword) DO NOTHING;

-- +goose Down
DELETE FROM routes WHERE keyword IN ('turtle', 'sea turtle');
ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_keyword_unique;
