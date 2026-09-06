# darkfarms-gen — Prompt Guide

**Model:** `cryptomfer/darkfarmsv1` (Flux LoRA, fine-tuned by cc0toshi)
**Trigger word (auto-prepended, comma-separated):**
`a darkfarms pepe artwork`

**Style anchor:** crypto-meme pepe character art — small pepe frog
in bold black outline comic style, with banner text or speech callouts,
set against grainy textured colored backgrounds. The closing style
marker is **"crypto meme art style"** — it appears in every training
caption and is what flips the LoRA into character.

---

## Anatomy of a good darkfarms prompt

Every working caption in the training set fits this 4-slot template:

```
smol pepe <ACTION/POSE>, <CONTEXT/SCENE>, <OPTIONAL BANNER TEXT>,
<OPTIONAL BACKGROUND>, crypto meme art style
```

The four slots:

1. **Action/pose** — what the pepe is *doing*. Verbs work better than
   states. "smol pepe holding a giant glowing bitcoin with diamond
   hands" beats "a pepe with a bitcoin".

2. **Context/scene** — the crypto-meme situation. Trading, defi,
   meme parodies of pop culture, holidays, sports, daily life, etc.

3. **Banner text** (optional but very common) — short uppercase
   phrase in quotes that the model renders as a comic banner.
   "TO THE MOON", "WAGMI", "NGMI", "GET STRONK", "GM 2025", etc.

4. **Background hint** (optional) — color/texture cue. "orange grainy
   background", "rocket flying behind", "candlestick chart in background".

5. **Always closes with `crypto meme art style`** (verbatim).

## Theme clusters that work (from training)

The LoRA saw ~80 captions clustered into these themes — your prompts
generate strongest when they fall inside one cluster.

### Market emotions
- Diamond hands · paper hands · gas fee horror · portfolio crash
- Rug pull aftermath · airdrop celebration · liquidation panic
- Diamond hands on red chart · hopium during dip · WAGMI banner

### Fantasy + cosmic
- Pepe wizard · pepe astronaut on moon · pepe samurai · pepe pirate
- Pepe dragon rider · pepe angel · pepe demon · pepe ghost in opensea

### Pop-culture parodies
- Snoop dogg pepe · elon musk pepe · gordon ramsay pepe · mario pepe
- Goku pepe · spongebob pepe · simpson pepe · pokemon trainer pepe
- One piece pepe · power ranger pepe · star wars jedi pepe

### Daily life
- Pepe at gym · pepe brushing teeth · pepe at beach · pepe at airport
- Pepe at dentist · pepe ordering pizza · pepe walking dog
- Pepe at supermarket · pepe at barber · pepe driving race car

### Wholesome + animals
- Pepe family at thanksgiving · pepe with baby pepe · pepe and puppy
- Pepe with bitcoin kitten · pepe feeding pigeons · pepe in hot tub

### Holidays + seasons
- Santa pepe · halloween pepe pumpkin · christmas pepe under tree
- Valentine's pepe · new year fireworks pepe

### Tech + AI absurdity
- Pepe debugging code · pepe meeting chatgpt robot · pepe at server farm
- Pepe with VR headset · pepe robot version · pepe in discord call

## Verbatim training examples (canonical)

```
smol pepe holding a giant glowing bitcoin with diamond hands, rocket
flying in background, "TO THE MOON" banner text, crypto meme art style
```

```
smol pepe paper hands selling at the bottom of a red chart, panicked
expression, tears streaming down face, crypto meme art style
```

```
smol pepe as a wizard casting a magic spell with sparkly green wand,
robe and pointy hat, crypto meme art style
```

```
smol pepe at the gym lifting a barbell shaped like two bitcoins,
sweating profusely, "GET STRONK" banner, crypto meme art style
```

```
smol pepe in santa claus outfit delivering gift-wrapped nft boxes,
snowy chimney, crypto meme art style
```

---

## Things to ALWAYS include

1. **Open with `smol pepe`** — not "pepe", not "a frog". The training
   token is `smol pepe`.
2. **Close with `crypto meme art style`** verbatim — it's the LoRA
   activation tail. Drop it and you get generic doodle output.
3. **Use comma-separated descriptors**, not full sentences. Caption
   register is short visual phrases stitched together.

## Things to NEVER do

- ❌ Don't say "Pepe the Frog" or "a pepe frog" — use `smol pepe`.
- ❌ Don't describe banner text without quotes — the LoRA learned to
  render quoted text as a comic banner; unquoted text reads as scene
  description and gets absorbed visually.
- ❌ Don't use the LLaVA register ("The image features...") that
  works for hokusai/van-gogh/monet. Darkfarms is comma-strung phrases.
- ❌ Don't add atmosphere/lighting prose. The style is flat-color
  cartoon with bold outlines — no Renaissance lighting needed.
- ❌ Don't write the trigger word yourself. The backend prepends it.

## Prompt length

Max 1000 characters after auto-prepend. Darkfarms prompts typically
land at 80-150 chars — short and punchy.
