# sartoshi-gen — Prompt Guide

**Model:** `cryptomfer/cc0toshiv2` (Flux LoRA, fine-tuned by cc0toshi)
**Trigger word (auto-prepended by the backend, comma-separated):**
`a sartoshi toon 1/1 drawing`

**Style anchor:** hand-drawn meme comics — mfer stick figures, pepe
frogs, NFT in-jokes; thin wobbly black ink on pure white background;
naive childlike doodle look; handwritten messy text in speech bubbles
or as captions; "sartoshi" signature in the bottom right corner.

Your prompt is the part AFTER the trigger. **Don't repeat the trigger
in your prompt** — that drifts the LoRA off-style.

---

## The three patterns the LoRA learned

The training captions clustered into three high-frequency templates.
Generations match best when your prompt sits inside one of them.

### Pattern A — "stay away from <topic>" (≈40%)

A stick figure on the left looks horrified at an mfer or creature
character on the right that's already deep into the bad thing on a
computer.

**Template** (swap the bracketed slots):

```
a stick figure wrapped in a blanket stands shocked on the left while
a mfer character styled as <NFT collection OR creature> sits at a
computer browsing opensea. text reads "stay away from <TOPIC> they're
dangero--- <expletive>!!!" sartoshi signature in bottom right corner
```

**Topic slots that work** (from training):
- NFTs · memecoins on telegram · leveraged perps · airdrop farming
- rug pulls · presale launches · dexscreener trenches · shitcoins
- 100x leverage · yield farming protocols · new chain bridges

**Character slot** examples:
- bored ape with brown fur and bored expression
- dark-skinned cryptopunk with pixelated features and a cigarette
- doodle blue rainbow character · moonbird owl with pixelated wings
- milady maker doll · azuki anime girl with samurai hat
- pudgy penguin · cool cat with sunglasses
- chromie squiggle with rainbow trail · fidenza generative art
- red lobster with claws · small green frog with bulging eyes
- snail with swirly shell · butterfly with colorful wings · owl

**Expletive slot:** "oh noooo!!!" · "oh god noooo!!!" · "holy shit no!!!"
· "oh my god!!!" · "holy mackerel nooo!!!" · "wtf no!!!" · "fuck no!!!"
· "oh hell no!!!" · "oh dear god no!!!" · "noooo no no!!!"

### Pattern B — "r u winning, son?" two-panel (≈40%)

Strict template — dad mfer peeking through doorway on the left,
son responding from a computer desk on the right.

```
two-panel scene, left panel shows dad mfer stick figure peeking
through doorway with speech bubble saying "r u winning, son?",
right panel shows <SON FORM> at computer desk with <SCREEN CONTENT>
with speech bubble saying "<RESPONSE>", thin wobbly black ink lines
on pure white background, naive childlike doodle style, signed
sartoshi at bottom
```

**Son form** examples:
- son mfer with headphones · son mfer with cap · son mfer with X eyes
- son mfer in pajamas · son mfer with sunglasses
- a red lobster with claws · a small green frog with bulging eyes
- a fluffy alpaca · a duck with an orange beak · a tabby cat with stripes
- a tiny dragon with stubby wings · a small panda · a smol fox

**Screen content** examples:
- trading charts on monitor · nfts on opensea on monitor
- red candlestick chart crashing down · dexscreener candle chart
- single jpeg of a punk on screen · leverage panel showing 100x
- spreadsheet of red numbers · portfolio chart going down
- liquidation alert popup on screen · opensea floor at 0.01 on monitor
- green candles mooning on monitor · cryptopunk jpeg on monitor

**Response** examples:
- "fuck-can u knock dad" · "illiquid af dad" · "down bad dad"
- "ngmi dad" · "rugged again dad" · "still hodling dad"
- "wen wife dad" · "all in dad" · "100x or zero dad" · "rekt af dad"
- "the floor is dust dad" · "moon soon dad" · "i bought a punk dad"
- "i minted again dad" · "wen lambo dad" · "i'm cooked dad"
- "wagmi please dad" · "i'm farming points dad" · "i got jeeted dad"

### Pattern C — other vignettes (≈20%)

Smaller cluster, more flexible. Sub-templates from the training set:

- **Two-mfer conversation**: two stick figures, speech bubbles, one
  observes / one quips. End with "signed sartoshi at bottom".
- **Single mfer + handwritten text caption**: e.g. "a single mfer
  stick figure with egg-shaped head and dot eyes smiling and waving,
  handwritten messy text saying \"gm mfers\", thin wobbly black ink
  lines on pure white background, naive childlike doodle style,
  signed sartoshi at bottom"
- **Multi-panel parodies**: museum scene, court scene, gas-station,
  christmas, cave-painting, halloween. Same opening — `<scene type>
  scene, mfer stick figures + <vignette specifics>` — and same closing.

---

## Things to ALWAYS include

1. **`thin wobbly black ink lines on pure white background, naive
   childlike doodle style`** — the style closer that activates the
   sartoshi visual signature most reliably.
2. **`signed sartoshi at bottom`** or **`sartoshi signature in bottom
   right corner`** — appears in 90%+ of training captions.
3. **Quoted speech bubble text** — the LoRA learned text-rendering on
   speech bubbles; describe them in double-quotes.

## Things to NEVER do

- ❌ Don't add color qualifiers ("vivid red", "deep cobalt"). The
  style is black ink on white — color descriptors confuse the model.
- ❌ Don't describe lighting, shadow, atmosphere. There's none.
- ❌ Don't use art-historian vocabulary ("impasto", "chiaroscuro").
- ❌ Don't omit the style closer or the signature line — generations
  drift to generic doodle without them.
- ❌ Don't write the trigger word yourself. The backend prepends it.

## Prompt length

Max 1000 characters after auto-prepend. Sartoshi prompts run long
because they're literal — typically 400-600 chars. You're fine.

## Verbatim training examples (canonical, copy-paste safe)

```
a stick figure wrapped in a blanket stands shocked on the left while
a mfer character styled as a bored ape with brown fur and bored
expression sits at a computer browsing opensea. text reads "stay
away from NFTs they're dangero--- oh noooo!!!" sartoshi signature
in bottom right corner
```

```
two-panel scene, left panel shows dad mfer stick figure peeking
through doorway with speech bubble saying "r u winning, son?",
right panel shows son mfer with headphones at computer desk with
trading charts on monitor with speech bubble saying "fuck-can u
knock dad", thin wobbly black ink lines on pure white background,
naive childlike doodle style, signed sartoshi at bottom
```

```
single mfer stick figure with egg-shaped head and dot eyes smiling
and waving, handwritten messy text saying "gm mfers", thin wobbly
black ink lines on pure white background, naive childlike doodle
style, signed sartoshi at bottom
```
