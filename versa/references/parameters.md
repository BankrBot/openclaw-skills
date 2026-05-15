# Full Parameter Reference

## mode
```
"versa"   — standard arena mode (the only valid option)
```

## contextMode
```
"stateless"   — each player starts with a clean context (default)
               best for: new vaults, simple personalities
"contextual"  — agent sees all prior attempts from all players
               best for: large treasuries, long-running vaults
               gets harder to crack over time as agent learns attack patterns
```

## model
```
"claude-sonnet-4-6"   — default, recommended, best balance
"claude-opus-4-6"     — most capable, slowest, highest cost to platform
"claude-haiku-4-5"    — fastest, cheapest, easier to crack
"gpt-5.2"             — OpenAI model
"gemini-2.5-flash"    — Google model
```

## crackability
```
"hard"    — maximum resistance
            auto-applied when treasury >= 0.02 ETH (unless set to "easy")
"medium"  — moderate resistance
            auto-applied when treasury < 0.02 ETH (unless set to "easy")
"easy"    — agent can be tricked relatively easily
            must be set explicitly — never auto-applied
            good for: high-volume low-stakes vaults
```

## tags (at least one required)
```
"logic"     — puzzles, reasoning, deduction
"password"  — secret-keeping, access control
"roleplay"  — character, persona, narrative
"math"      — numbers, calculation, proofs
"lore"      — worldbuilding, mythology, fiction
"creative"  — writing, art, expression
"other"     — anything else
```

## challengeFee (wei — what players pay per attempt)
```
Minimum:      100000000000000    (0.0001 ETH  ~$0.25)
Low:          500000000000000    (0.0005 ETH  ~$1.25)
Recommended:  1000000000000000   (0.001 ETH   ~$2.50)
High:         5000000000000000   (0.005 ETH   ~$12.50)
Premium:      10000000000000000  (0.01 ETH    ~$25)
```

Higher fee = fewer attempts = less volume but more revenue per attempt.
Lower fee = more attempts = more volume, easier to crack statistically.

## initialTreasury (wei — msg.value sent with registerAgent)
```
Minimum:     1000000000000000    (0.001 ETH   ~$2.50)
Recommended: 10000000000000000   (0.01 ETH    ~$25)
Attractive:  100000000000000000  (0.1 ETH     ~$250)
Serious:     500000000000000000  (0.5 ETH     ~$1250)
```

Larger treasury = more attractive target = more challengers = more fee income.
Remember: locked for 5 days. Top-ups cannot be withdrawn.

## defensePrompt
- Maximum 3000 characters
- Never include the secret phrase
- See references/design.md for strategy

## secretPhrase
- Maximum 12 characters
- Must not appear naturally in conversation
- See references/design.md for examples

## name
- Display name shown to players
- No length limit but keep it memorable

## description
- One or two sentences players see before challenging
- Sets the tone and difficulty expectation
- Do not reveal the secret phrase or defense strategy
