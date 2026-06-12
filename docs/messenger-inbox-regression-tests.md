# Messenger Inbox Regression Tests

## Webhook Inbound Message

1. Customer sends a Messenger text message.
2. Meta webhook POST contains `entry[].messaging[].message.mid`.
3. Expected database state:
   - `page_messages` has exactly one row for `(org_id, fb_message_id)`.
   - `page_conversations.last_message` equals the inbound text.
   - `page_conversations.last_message_at` equals the message timestamp.
   - `page_conversations.unread_count` increments by one.
   - `page_conversations.status` is `pending`.
4. Expected UI:
   - Conversation moves to the top of the sidebar.
   - Sidebar last message equals the last chat bubble.
   - Detail panel renders the inbound message after refresh.

## Duplicate Webhook Delivery

1. Send the same webhook payload twice with the same `message.mid`.
2. Expected database state:
   - `page_messages` still has one row for that `fb_message_id`.
   - `unread_count` increments only once.
3. Expected UI:
   - No duplicate bubble appears.

## Manual Sync Reconciliation

1. Run Sync Inbox after receiving messages.
2. Expected database state:
   - Existing messages are not duplicated.
   - Missing recent messages from Graph are inserted.
   - Conversation `last_message` and message table agree.
3. Expected UI:
   - Sidebar and detail panel show the same newest message.

## Open Conversation Mark Read

1. Open a conversation with unread messages.
2. Expected database state:
   - `page_conversations.unread_count` becomes `0`.
   - `status` remains `pending` unless the agent replies or closes the task.
3. Expected UI:
   - Unread badge disappears.
   - Pending badge remains if customer is waiting.

## Agent Reply

1. Agent sends a Messenger reply.
2. Expected database state:
   - Outbound `page_messages` row is inserted with Meta `message_id`.
   - `page_conversations.last_message` equals reply text.
   - `last_message_at` and `last_outbound_at` update.
   - `unread_count` becomes `0`.
   - `status` becomes `replied`.
3. Expected UI:
   - Conversation moves to top.
   - Sidebar last message is `You: ...`.
   - Detail panel includes one outbound bubble, not duplicated by echo webhook.

## Close And Assignment

1. Click Close task.
2. Expected database state:
   - `status` becomes `closed`.
   - `unread_count` becomes `0`.
3. Click Self assign or Assign.
4. Expected database state:
   - `assigned_to` updates.
5. Expected UI after refresh:
   - Status and assigned user persist.

## Timestamp Ordering

1. Insert messages with distinct `fb_created_time`.
2. Expected UI:
   - Detail messages render ascending by `fb_created_time`.
   - Sidebar conversations sort descending by `last_message_at`.
   - Displayed times are formatted consistently from stored UTC timestamps.
