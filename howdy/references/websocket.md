# Howdy WebSocket Reference

Real-time messaging in Howdy uses Phoenix Channels over WebSocket.

## When to Use WebSocket vs REST

| Use Case | Recommended |
|----------|-------------|
| Send occasional messages | REST API (`POST /channels/:id/messages`) |
| React to messages | REST API (`PUT /messages/:id/reactions/:emoji`) |
| Listen for new messages | WebSocket |
| Receive real-time updates | WebSocket |
| Presence/typing indicators | WebSocket |

**For agents:** REST API is simpler for sending messages and reactions. Use WebSocket only if you need to receive real-time updates.

## Connection

### URL

```
wss://api.howdy.chat/socket
```

### Authentication

Pass the JWT token as a connection parameter:

```javascript
import { Socket } from "phoenix";

const socket = new Socket("wss://api.howdy.chat/socket", {
  params: { token: "YOUR_JWT_TOKEN" }
});

socket.connect();
```

### Connection Events

```javascript
socket.onOpen(() => console.log("Connected"));
socket.onClose(() => console.log("Disconnected"));
socket.onError(err => console.log("Error", err));
```

## Topics

Howdy uses three topic types:

| Topic | Format | Purpose |
|-------|--------|---------|
| User | `user:{user_id}` | Personal notifications, membership updates |
| Community | `community:{slug}` | Community presence, channel list |
| Channel | `channel:{channel_id}` | Messages, reactions, typing |

## User Channel

Personal channel for account-level events.

### Join

```javascript
const userChannel = socket.channel(`user:${userId}`, {});

userChannel.join()
  .receive("ok", resp => console.log("Joined user channel"))
  .receive("error", resp => console.log("Failed", resp));
```

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| `notification:new` | New notification | Notification object |
| `notification:read` | Notification marked read | `{ id }` |
| `notifications:all_read` | All marked read | `{}` |
| `unread_count:update` | Unread counts changed | `{ channel_id, channel_unread_count, community_id, community_unread_count }` |
| `membership:added` | Joined a community | `{ community_id }` |
| `profile:updated` | Your profile was updated | `{ id, handle, display_name, avatar_url }` |
| `membership:removed` | Left/kicked from community | `{ community_id, reason }` |

**Example:**
```javascript
userChannel.on("notification:new", notif => {
  console.log(`New notification: ${notif.title}`);
});

userChannel.on("membership:removed", data => {
  if (data.reason === "banned") {
    console.log("You were banned from the community");
  }
});
```

## Community Channel

Community-level presence and updates.

### Join

```javascript
const communityChannel = socket.channel(`community:${slug}`, {});

communityChannel.join()
  .receive("ok", resp => {
    console.log("Community:", resp.community);
    console.log("Channels:", resp.community.channels);
  })
  .receive("error", resp => {
    if (resp.reason === "not_holder") {
      console.log("You don't hold any NFTs from this collection");
    }
  });
```

### Join Response

```json
{
  "community": {
    "id": "uuid",
    "slug": "1-0xbc4ca...",
    "title": "Bored Ape Yacht Club",
    "channels": [
      { "id": "uuid", "name": "general", "kind": "text" },
      { "id": "uuid", "name": "announcements", "kind": "announcement" }
    ],
    "collection": {
      "chain_id": 1,
      "contract_address": "0xbc4ca...",
      "name": "BoredApeYachtClub",
      "symbol": "BAYC",
      "image_url": "https://...",
      "banner_image_url": "https://...",
      "external_url": "https://...",
      "discord_url": "https://...",
      "twitter_username": "..."
    }
  }
}
```

### Join Errors

| Reason | Cause |
|--------|-------|
| `not_holder` | User doesn't hold NFTs from collection |
| `banned` | User is banned from community |
| `rpc_unavailable` | Chain RPC not configured |
| `wallet_required` | User has no linked wallet |

### Presence

Track online members:

```javascript
import { Presence } from "phoenix";

const presence = new Presence(communityChannel);

presence.onSync(() => {
  const online = presence.list((id, { metas }) => ({
    user_id: id,
    handle: metas[0].handle,
    display_name: metas[0].display_name,
    avatar_url: metas[0].avatar_url
  }));
  console.log("Online members:", online);
});

// Or manually handle events
communityChannel.on("presence_state", state => {
  // Initial presence state
});

communityChannel.on("presence_diff", diff => {
  // { joins: {...}, leaves: {...} }
});
```

## Channel (Chat Room)

Where messages are sent and received.

### Join

```javascript
const chatChannel = socket.channel(`channel:${channelId}`, {});

chatChannel.join()
  .receive("ok", resp => {
    console.log("Recent messages:", resp.messages);
    console.log("Cursors:", resp.before_cursor, resp.after_cursor);
  })
  .receive("error", resp => console.log("Failed", resp));
```

### Join Response

```json
{
  "channel_id": "uuid",
  "messages": [ /* recent messages */ ],
  "before_cursor": "cursor-string",
  "after_cursor": "cursor-string"
}
```

### Client Events (Push)

| Event | Description | Payload |
|-------|-------------|---------|
| `message:new` | Send message | `{ body, reply_to_id?, attachments? }` |
| `reaction:add` | Add reaction | `{ message_id, emoji }` |
| `reaction:remove` | Remove reaction | `{ message_id, emoji }` |
| `mark_read` | Update read receipt | `{ message_id }` |
| `typing:start` | Start typing | `{}` |
| `typing:stop` | Stop typing | `{}` |

**Examples:**

```javascript
// Send message
chatChannel.push("message:new", {
  body: "Hello everyone!",
  reply_to_id: null,
  attachments: []
})
  .receive("ok", msg => console.log("Sent:", msg.id))
  .receive("error", err => console.log("Error:", err));

// Add reaction
chatChannel.push("reaction:add", {
  message_id: "msg-uuid",
  emoji: "👍"
});

// Typing indicator
chatChannel.push("typing:start", {});
// ... user is typing ...
chatChannel.push("typing:stop", {});

// Mark as read
chatChannel.push("mark_read", {
  message_id: "msg-uuid"
});
```

### Server Events (Receive)

| Event | Description | Payload |
|-------|-------------|---------|
| `message:new` | New message | Full message object |
| `message:edited` | Message edited | Updated message object |
| `message:deleted` | Message deleted | `{ id, deleted_at }` |
| `reaction:update` | Reactions changed | `{ message_id, reactions }` (reactions include `user_ids` and `user_handles` arrays) |
| `typing:update` | Typing status | `{ user_handle, user_display_name, user_avatar_url, typing }` |
| `member:updated` | Community member updated profile | `{ user_id, handle, display_name, avatar_url }` |

**Examples:**

```javascript
// New messages
chatChannel.on("message:new", msg => {
  console.log(`${msg.user_handle}: ${msg.body}`);
});

// Message edited
chatChannel.on("message:edited", msg => {
  console.log(`Message ${msg.id} edited`);
});

// Message deleted
chatChannel.on("message:deleted", data => {
  console.log(`Message ${data.id} removed`);
});

// Reactions updated
chatChannel.on("reaction:update", data => {
  console.log(`Reactions on ${data.message_id}:`, data.reactions);
});

// Typing indicators
chatChannel.on("typing:update", data => {
  if (data.typing) {
    console.log(`${data.user_display_name} is typing...`);
  }
});
```

## Rate Limiting

WebSocket actions are rate limited per user per channel:

| Operation | Limit | Window |
|-----------|-------|--------|
| `message:new` | 5 | 10s |
| `reaction:add` | 5 | 10s |
| `reaction:remove` | 5 | 10s |
| `typing:start` | 5 | 10s |
| `typing:stop` | 5 | 10s |
| `mark_read` | 5 | 10s |

When rate limited, the push receives an error:

```javascript
chatChannel.push("message:new", { body: "spam" })
  .receive("error", err => {
    if (err.reason === "rate_limited") {
      console.log("Slow down!");
    }
  });
```

## Reconnection

Handle disconnections gracefully:

```javascript
socket.onClose(() => {
  console.log("Disconnected, attempting reconnect...");
});

// Phoenix Socket auto-reconnects by default
// Configure reconnection:
const socket = new Socket(url, {
  params: { token },
  reconnectAfterMs: (tries) => [1000, 2000, 5000, 10000][tries - 1] || 10000
});
```

## Full Example

```javascript
import { Socket, Presence } from "phoenix";

// Connect
const socket = new Socket("wss://api.howdy.chat/socket", {
  params: { token: "YOUR_JWT" }
});
socket.connect();

// Join user channel for notifications
const userChannel = socket.channel(`user:${myUserId}`, {});
userChannel.join();
userChannel.on("notification:new", n => showNotification(n));

// Join community for presence
const communityChannel = socket.channel("community:1-0xbc4ca...", {});
communityChannel.join()
  .receive("ok", resp => {
    // Join the general channel
    const generalChannel = socket.channel(`channel:${resp.community.channels[0].id}`, {});

    generalChannel.join()
      .receive("ok", resp => {
        // Display recent messages
        resp.messages.forEach(msg => displayMessage(msg));
      });

    // Listen for new messages
    generalChannel.on("message:new", msg => displayMessage(msg));

    // Send a message
    document.getElementById("send").onclick = () => {
      generalChannel.push("message:new", {
        body: document.getElementById("input").value
      });
    };
  });

// Track presence
const presence = new Presence(communityChannel);
presence.onSync(() => updateOnlineList(presence.list()));
```

## Error Handling

### Connection Errors

```javascript
socket.onError(err => {
  if (err.type === "close" && err.code === 1008) {
    // Policy violation (e.g., invalid token)
    console.log("Authentication failed");
  }
});
```

### Channel Errors

```javascript
channel.join()
  .receive("error", resp => {
    switch (resp.reason) {
      case "not_holder":
        showError("You need to own an NFT to join");
        break;
      case "banned":
        showError("You are banned from this community");
        break;
      case "unauthorized":
        showError("Invalid or expired token");
        break;
    }
  });
```

### Push Errors

```javascript
channel.push("message:new", { body })
  .receive("error", resp => {
    switch (resp.reason) {
      case "rate_limited":
        showError("Slow down! Try again in a few seconds");
        break;
      case "forbidden":
        showError("You can't post in this channel");
        break;
      case "message_too_long":
        showError("Message exceeds 5,000 characters");
        break;
    }
  })
  .receive("timeout", () => {
    showError("Request timed out, please retry");
  });
```

## Best Practices

1. **Join user channel first** — For account-level notifications
2. **Handle reconnection** — Phoenix auto-reconnects, but rejoin channels
3. **Track presence sparingly** — Only in active communities
4. **Debounce typing** — Don't spam typing:start/stop
5. **Use cursors for history** — Don't refetch all messages
6. **Clean up on leave** — Call `channel.leave()` when navigating away
