-- Inspo Boards: user-created collections to save Discovery ads

CREATE TABLE IF NOT EXISTS inspo_boards (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspo_boards_org ON inspo_boards(org_id);

-- Saves: each row = one ad saved to a board (ad data stored as JSON)
CREATE TABLE IF NOT EXISTS inspo_board_saves (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id   UUID NOT NULL REFERENCES inspo_boards(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL,
  ad_id      TEXT NOT NULL,
  ad_data    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (board_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_inspo_board_saves_board ON inspo_board_saves(board_id);

ALTER TABLE inspo_boards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspo_board_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view boards"
  ON inspo_boards FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Members can create boards"
  ON inspo_boards FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "Owner can update board"
  ON inspo_boards FOR UPDATE USING (user_id = current_account_id());

CREATE POLICY "Owner can delete board"
  ON inspo_boards FOR DELETE USING (user_id = current_account_id());

CREATE POLICY "Members can view saves"
  ON inspo_board_saves FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Members can save ads"
  ON inspo_board_saves FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "Members can unsave ads"
  ON inspo_board_saves FOR DELETE USING (is_org_member(org_id));
