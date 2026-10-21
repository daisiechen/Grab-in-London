CREATE TABLE product_surveys (
 user_id uuid NOT NULL REFERENCES users(id),
 version bigint NOT NULL CHECK(version > 0),
 again boolean,
 reasons text[] NOT NULL,
 submitted_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,version),
 CHECK (again IS NOT NULL OR cardinality(reasons) > 0)
);
