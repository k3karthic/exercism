BEGIN;

ALTER TABLE pet
    ADD COLUMN tags_json jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE pet
SET tags_json = COALESCE(
    (
        SELECT jsonb_agg(jsonb_build_object('name', tag_name) ORDER BY ordinal)
        FROM unnest(tags) WITH ORDINALITY AS legacy_tags(tag_name, ordinal)
    ),
    '[]'::jsonb
);

ALTER TABLE pet DROP COLUMN tags;
ALTER TABLE pet RENAME COLUMN tags_json TO tags;

COMMIT;
