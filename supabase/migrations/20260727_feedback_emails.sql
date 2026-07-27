-- Per-org feedback loop recipients: product owner (PO) notified on new ticket,
-- BOM group CC'd. Nullable; app falls back to FEEDBACK_PO_EMAIL / FEEDBACK_BOM_EMAIL env.
set search_path = ads_launcher, public;

alter table organizations
  add column if not exists feedback_po_email  text,
  add column if not exists feedback_bom_email text;

update organizations
set
  feedback_po_email = coalesce(feedback_po_email, 'thanhtin@patigroup.com'),
  feedback_bom_email = coalesce(feedback_bom_email, 'wpjpwk7o7pbxz@patigroup.com');
