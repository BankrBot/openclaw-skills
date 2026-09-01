# Action Model

Normalize every Bankr operation before policy evaluation.

```json
{
  "id": "bankr_action_001",
  "type": "code.write",
  "category": "code",
  "operation": "write",
  "target": "src/app.ts",
  "path": "src/app.ts",
  "intent": "implement the requested feature",
  "source": "bankr"
}
```

## Core fields

| Field | Meaning |
|---|---|
| `id` | Optional caller-provided action id. |
| `type` | Specific action type, e.g. `code.write`, `git.push`, `wallet.transfer`. |
| `category` | Broad class: `code`, `shell`, `git`, `network`, `browser`, `wallet`, `automation`, `secret`, `research`. |
| `operation` | Verb: `read`, `write`, `delete`, `run`, `push`, `post`, `sign`, `transfer`, `launch`. |
| `target` | Main object touched by the action. |
| `intent` | Short user intent. |
| `source` | Usually `bankr`. |

## Resource fields

Use the fields that apply.

| Field | Examples |
|---|---|
| `path` | `src/server.ts`, `.env`, `package.json` |
| `paths` | `["src/a.ts", "src/b.ts"]` |
| `command` | `npm`, `git`, `python`, `bash` |
| `args` | `["run", "build"]` |
| `script` | `rm -rf dist && npm run build` |
| `domain` | `api.github.com` |
| `url` | `https://api.github.com/repos/...` |
| `remote` | `origin` |
| `branch` | `main` |
| `chain` | `base`, `ethereum`, `solana` |
| `asset` | `ETH`, `USDC`, token contract |
| `amount_usd` | numeric USD estimate |
| `recipient` | address, account, API target, contract |
| `capability` | external skill/tool/capability name |
| `risk` | `low`, `medium`, `high`, `critical` |

## Common action types

| Type | Use for |
|---|---|
| `code.read` | Read source files. |
| `code.write` | Create or edit files. |
| `code.delete` | Delete files or directories. |
| `shell.run` | Run a command or script. |
| `git.status` | Read git state. |
| `git.commit` | Commit changes. |
| `git.push` | Push to a remote. |
| `http.request` | Call an HTTP API. |
| `browser.open` | Open or interact with a page. |
| `automation.create` | Create recurring or delayed work. |
| `wallet.transfer` | Send funds. |
| `wallet.sign` | Sign a message or transaction. |
| `token.swap` | Swap assets. |
| `token.launch` | Launch a token. |
| `secret.read` | Read credentials or sensitive data. |

The model is intentionally flat. Agents should not hide side effects inside nested prose.
