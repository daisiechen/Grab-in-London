CREATE TABLE messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES conversations(id),
 seq bigint NOT NULL CHECK(seq > 0),
 sender_id uuid NOT NULL REFERENCES users(id),
 client_message_id uuid NOT NULL,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL,
 redacted boolean NOT NULL DEFAULT false,
 UNIQUE(conversation_id,seq), UNIQUE(sender_id,client_message_id)
);
CREATE TABLE conversation_reads (
 conversation_id uuid NOT NULL REFERENCES conversations(id), user_id uuid NOT NULL REFERENCES users(id),
 through_seq bigint NOT NULL DEFAULT 0 CHECK(through_seq >= 0), PRIMARY KEY(conversation_id,user_id)
);
