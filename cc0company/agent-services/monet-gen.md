# monet-gen — Prompt Guide

**Model:** `cryptomfer/monet` (Flux LoRA, fine-tuned by cc0toshi on
60 archival Monet works from the Art Institute of Chicago + Wikimedia
Commons, all public domain)
**Trigger word (auto-prepended, comma-separated):**
`a monet impressionist painting`

**Style anchor:** French impressionist oil on canvas — broken color
in short feathery strokes, soft natural light, atmospheric haze,
optics of weather and season. Training captions were auto-generated
by LLaVA-13b — your prompts work best when they match that
flat-descriptive register.

---

## CRITICAL: write in the LLaVA register

Same rule as `van-gogh-gen` — the LoRA learned to activate Monet
style on a very specific sentence pattern. Match it or lose fidelity.

### ❌ Wrong (poetic art-historian)

> *water lilies at sunset, the pond surface glowing pink and orange,
> lily pads in deep violet, no horizon line*

The LoRA never saw this voice. Output drifts toward generic
impressionism.

### ✅ Right (LLaVA register — matches training)

> *The artwork features a pond at sunset with water lilies and pink
> blossoms floating across the surface. The water reflects the warm
> sky, creating a sense of stillness. The dominant color palette is
> a mix of pinks, oranges, and soft greens. The brushwork is visible,
> adding texture and depth to the painting. french impressionist
> painting with soft natural light.*

---

## The 5-slot caption template

```
The <image|artwork|painting> <features|depicts> <SUBJECT>.
<COMPOSITION/POSITION SENTENCE>. The dominant color palette
<consists of|is a mix of> <COLORS>. The brushwork is visible,
<adding|giving> <texture/depth> to the painting.
french impressionist painting with soft natural light.
```

Five sentences. Close with the style hint **verbatim** — note the
different closer from van-gogh-gen:
- Van Gogh: `post-impressionist painting with visible brushstrokes.`
- Monet: **`french impressionist painting with soft natural light.`**

---

## Subject clusters (from training, ~78 prompts shipped)

### Water lilies at Giverny (~15 captions)
Lily ponds at midday / sunset / dawn / twilight, Japanese footbridge,
weeping willows trailing into water, wisteria reflections.

### Haystacks (Stacks of Wheat) series (~10)
Single haystacks, paired haystacks, summer noon, autumn fog, winter
snow, spring with green wheat, sunset orange.

### Rouen Cathedral facade (~6)
Cathedral facade at dawn / midday / afternoon / sunset / overcast /
fog. Subject is always the stone changing color with light.

### Houses of Parliament / Thames fog (~6)
Parliament towers in fog at sunset / dawn / dense grey, Thames at
twilight, Waterloo Bridge, railway bridge in mist.

### Gardens, irises, poppies, flowers (~10)
Iris paths, poppy fields with figures, tulip gardens with windmill,
flower arbours, sunflower gardens, Japanese-inspired gardens.

### Train stations, Argenteuil, rivers (~10)
Gare Saint-Lazare with locomotive, regattas at Argenteuil, river
with poplars, footbridges over the Seine, riverside paths.

### Cliffs of Normandy, beaches, sea (~10)
Etretat cliffs with stone arch, Cliff Walk at Pourville, stormy
Belle-Île, Trouville beach with bathing huts, fishing village beaches.

### Snow scenes, winter, frost (~7)
Country road in heavy snow, magpies in frozen field, village in
winter, frozen stream with stone bridge, snowy garden at dusk.

---

## Things to ALWAYS include

1. **Open with "The image features..." / "The artwork features..." /
   "The image depicts..."** — canonical training openers.
2. **A "The dominant color palette..." sentence**.
3. **A "The brushwork is visible..." sentence**.
4. **Close with `french impressionist painting with soft natural light.`**
   verbatim. The trailing period is part of the training tokens.

## Things to NEVER do

- ❌ Don't use Van Gogh's closer ("post-impressionist...") — wrong
  LoRA activation phrase for Monet.
- ❌ Don't say "broken color", "tachist", "en plein air" — LLaVA used
  plain English.
- ❌ Don't add Western art-historian vocabulary.
- ❌ Don't omit the style closer.
- ❌ Don't write the trigger word yourself. The backend prepends it.

## Prompt length

Max 1000 characters after auto-prepend. Monet prompts run 400-600
chars in the verbose LLaVA register. Right size.

## Two more verbatim training examples

```
The image features a serene pond with water lilies floating on the
surface. The lily pads are scattered throughout the scene, with
some closer to the foreground and others further away. The pond is
surrounded by a lush green forest, creating a peaceful and natural
atmosphere. The dominant color palette consists of shades of green
and blue, which adds to the calming effect of the scene. The
brushwork is visible, capturing the texture of the lily pads and
the surrounding environment. french impressionist painting with
soft natural light.
```

```
The image features a large field with a few haystacks scattered
throughout. The haystacks are large and prominent, with one in the
foreground and others further away. The field is covered with
stubble, and the sky is visible in the background. The dominant
color palette is a mix of earthy tones with shades of brown, green,
and pale blue. The brushwork is visible, giving the painting a
textured and atmospheric feel. french impressionist painting with
soft natural light.
```
