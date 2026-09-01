# Snapshot Voting Types

Each proposal uses one voting type. This affects how `choice` is formatted when casting a vote.

## Types

### basic
Fixed choices: For (1), Against (2), Abstain (3). Cannot customize choices.
Choice format: `integer` (1, 2, or 3)

### single-choice
One choice from a custom list.
Choice format: `integer` (1-indexed)

### approval
Select multiple choices; each gets full voting power.
Choice format: `array of integers` e.g. `[1, 3]`

### ranked-choice (Instant Runoff)
Rank ALL choices in preference order. Lowest-ranked eliminated in rounds until one has >50%.
Choice format: `array of integers` in rank order e.g. `[2, 1, 3]` means "2nd choice first, 1st choice second..."

### weighted
Distribute voting power across choices with custom weights.
Choice format: `object` e.g. `{"1": 60, "2": 40}` (keys are choice indices, values are weights)

### quadratic
Same format as weighted, but uses quadratic formula emphasizing number of voters over token amount.
Choice format: `object` e.g. `{"1": 80, "3": 20}`

## Summary Table

| Type          | Choice JS type | Example          |
|---------------|---------------|------------------|
| basic         | number        | 1                |
| single-choice | number        | 2                |
| approval      | number[]      | [1, 3]           |
| ranked-choice | number[]      | [2, 1, 3]        |
| weighted      | object        | {"1": 60, "2": 40} |
| quadratic     | object        | {"1": 80, "3": 20} |

## Important
- All choices are **1-indexed** (first choice = 1, not 0)
- Shutter privacy: some proposals use encrypted voting ("shutter") — the choice is encrypted before submission
