# Bankrmeme Skill

## Description
Generate random funny memes using the Imgflip API. 
This skill allows agents to create and share memes automatically.

## Installation
No additional dependencies required.

## Usage
Ask your agent to generate a meme:
- "Generate a funny meme"
- "Make me a random meme"
- "Create a meme and post it"

## How It Works
1. Fetch popular meme templates from Imgflip API (no API key needed)
2. Pick a random template
3. Add funny or relevant text to top and bottom
4. Return the meme image URL

## API Reference
- GET `https://api.imgflip.com/get_memes` — fetch meme templates (free, no auth)
- POST `https://api.imgflip.com/caption_image` — add text to template (requires free Imgflip account)

## Example Output
Returns a direct image URL that can be shared on social media or Farcaster.
