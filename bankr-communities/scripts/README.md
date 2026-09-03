# Scripts — test helpers only

`get-community-link.sh` is for **PR / maintainer smoke tests** only.

**Third-party installers and @bankrbot agents must not require running repo scripts** for normal skill use. Use HTTP:

```http
GET https://www.bankr.space/api/agent/link?q=TMP
```

Or instant links in `known-hosts.json` when tweet intake blocks HTTP.
