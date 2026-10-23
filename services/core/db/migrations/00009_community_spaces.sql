-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_posts') THEN
        ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_space_check;
        ALTER TABLE community_posts ADD CONSTRAINT community_posts_space_check CHECK (char_length(space) BETWEEN 1 AND 64);
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- no-op
