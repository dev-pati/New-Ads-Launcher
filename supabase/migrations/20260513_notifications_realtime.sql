-- Enable realtime for notifications table.
-- Required for Supabase Realtime postgres_changes to deliver INSERT/UPDATE events.
alter publication supabase_realtime add table notifications;

-- REPLICA IDENTITY FULL ensures UPDATE events include both old and new row values,
-- needed for the realtime payload to contain full row data.
alter table notifications replica identity full;
