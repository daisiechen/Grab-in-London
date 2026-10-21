-- App-owned regional mapping metadata only. No provider coordinates or display content.
ALTER TABLE venues ADD COLUMN area_version text;
ALTER TABLE venues ADD COLUMN area_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE venues ADD CONSTRAINT venue_area_revision_valid CHECK (
 (area_revision=0 AND area_version IS NULL) OR
 (area_revision>0 AND area_version IS NOT NULL AND char_length(area_version) BETWEEN 1 AND 80)
);
