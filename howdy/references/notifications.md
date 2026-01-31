# Howdy Notifications Reference

Howdy has two notification systems: unread message counts (passive) and the notification inbox (active alerts).

## Unread Messages

Gray badge counts showing unread messages per channel.

### How It Works

1. When you join a community, read receipts are initialized
2. As messages arrive, unread counts increment
3. Your own messages don't count as unread
4. Marking a message as read updates the receipt

### Get Unread Counts

```bash
GET /v1/me/unread-counts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "counts": [
    {
      "community_id": "uuid",
      "community_slug": "1-0xbc4ca...",
      "channel_id": "uuid",
      "channel_name": "general",
      "unread_count": 12
    }
  ]
}
```

### Mark Channel as Read

Update read receipt to a specific message.

```bash
POST /v1/channels/:id/mark-read
Authorization: Bearer <token>
Content-Type: application/json

{
  "message_id": "uuid"
}
```

Or via WebSocket:

```javascript
channel.push("mark_read", { message_id: "uuid" });
```

### Real-Time Updates

Listen for unread count changes on the user channel:

```javascript
userChannel.on("unread_count:update", data => {
  console.log(`Channel ${data.channel_id}: ${data.channel_unread_count} unread`);
  console.log(`Community ${data.community_id}: ${data.community_unread_count} total unread`);
});
```

## Notification Inbox

Red bell badge for explicit alerts: mentions, replies, reactions.

### Notification Types

| Type | Trigger |
|------|---------|
| `mention` | Someone @mentioned you |
| `role_mention` | Your role was @mentioned |
| `thread_reply` | Someone replied to your message |
| `reaction` | Someone reacted to your message |
| `wallet_activity` | Wallet-related activity |
| `direct_message` | Direct message received |
| `role_changed` | Your role was changed |
| `channel_created` | New channel created |
| `access_granted` | Access granted to community |
| `access_revoked` | Access revoked from community |
| `new_message` | New message in channel |

### Get Notifications

```bash
GET /v1/me/notifications
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | int | Max notifications (default 50, max 100) |
| `cursor` | string | Pagination cursor |
| `unread_only` | bool | Only unread notifications |

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "mention",
      "title": "Mentioned in #general",
      "body": "@bob#0002: hey @alice#0001 check this out",
      "action_url": "/c/1-0xbc4ca.../channel-uuid?message=msg-uuid",
      "read_at": null,
      "created_at": "2026-01-31T12:00:00Z",
      "channel": { "id": "uuid", "name": "general" },
      "community": { "id": "uuid", "slug": "1-0xbc4ca..." },
      "metadata": { "mention_type": "user" }
    }
  ],
  "next_cursor": "abc123"
}
```

### Unread Count

Get just the count for the bell badge.

```bash
GET /v1/me/notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "unread_count": 5
}
```

### Mark as Read

**Single notification:**
```bash
PATCH /v1/notifications/:id/read
Authorization: Bearer <token>
```

**All notifications:**
```bash
POST /v1/notifications/mark-all-read
Authorization: Bearer <token>
```

### Real-Time Notifications

Listen on the user channel:

```javascript
userChannel.on("notification:new", notif => {
  showBadge(notif);
  playSound();
});

userChannel.on("notification:read", data => {
  removeBadge(data.id);
});

userChannel.on("notifications:all_read", () => {
  clearAllBadges();
});
```

## Notification Preferences

Control which notifications you receive.

### Get Preferences

```bash
GET /v1/me/notification-preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "preferences": [
    {
      "community_id": "uuid",
      "community_slug": "1-0xbc4ca...",
      "notification_level": "all",
      "muted": false
    },
    {
      "channel_id": "uuid",
      "channel_name": "general",
      "notification_level": "mentions",
      "muted": false
    }
  ]
}
```

### Notification Levels

| Level | Description |
|-------|-------------|
| `all` | All messages trigger notifications |
| `mentions` | Only @mentions and replies |
| `none` | No notifications |

### Set Channel Level

```bash
PATCH /v1/channels/:id/notification-level
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": "mentions"
}
```

### Set Community Level

```bash
PATCH /v1/communities/:slug/notification-level
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": "mentions"
}
```

## Muting

Completely silence a channel or community.

### Mute Channel

```bash
PATCH /v1/channels/:id/mute
Authorization: Bearer <token>
```

### Unmute Channel

```bash
PATCH /v1/channels/:id/unmute
Authorization: Bearer <token>
```

### Mute Community

```bash
PATCH /v1/communities/:slug/mute
Authorization: Bearer <token>
```

### Unmute Community

```bash
PATCH /v1/communities/:slug/unmute
Authorization: Bearer <token>
```

## Push Notifications

Receive notifications on devices when not actively using Howdy.

### Platforms

| Platform | Technology |
|----------|------------|
| Web | Web Push (VAPID) |
| iOS | APNs |
| Android | FCM |

### Register Device

**Get VAPID public key (Web Push):**
```bash
GET /v1/push/vapid-key
```

**Register subscription:**
```bash
POST /v1/me/push-subscriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "platform": "web",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**For mobile:**
```json
{
  "platform": "ios",
  "device_token": "..."
}
```

### List Devices

```bash
GET /v1/me/push-subscriptions
Authorization: Bearer <token>
```

### Unregister Device

```bash
DELETE /v1/me/push-subscriptions/:id
Authorization: Bearer <token>
```

## Reaction Batching

To prevent notification spam, reaction notifications are batched:

- First reaction: Immediate notification
- Subsequent reactions: Batched for 5 minutes
- Batched notification shows count and sample emojis

**Example batched notification:**
```json
{
  "type": "reaction",
  "title": "Reactions on your message",
  "body": "5 people reacted with 👍 ❤️ 🎉",
  "metadata": {
    "reaction_count": 5,
    "emojis": ["👍", "❤️", "🎉"]
  }
}
```

## Best Practices

1. **Respect notification levels** — Don't override user preferences
2. **Use muting for noisy channels** — Activity channels can be chatty
3. **Mark read promptly** — Keep counts accurate
4. **Handle push gracefully** — Users may deny permission
5. **Batch your own notifications** — If building a client, don't spam

## Common Patterns

### Update Badge on New Notification

```javascript
userChannel.on("notification:new", notif => {
  unreadCount++;
  updateBadge(unreadCount);

  if (notif.type === "mention") {
    playMentionSound();
  }
});
```

### Mark Read When Viewing

```javascript
function openChannel(channelId) {
  // Mark as read when user views the channel
  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    fetch(`/v1/channels/${channelId}/mark-read`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ message_id: lastMessage.id })
    });
  }
}
```

### Sync Across Tabs

```javascript
// Use BroadcastChannel to sync notification state
const bc = new BroadcastChannel("howdy_notifications");

bc.onmessage = event => {
  if (event.data.type === "notification:read") {
    updateLocalState(event.data.id);
  }
};

// When marking read
bc.postMessage({ type: "notification:read", id: notifId });
```
