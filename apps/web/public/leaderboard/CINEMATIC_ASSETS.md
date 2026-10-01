# Leaderboard Cinematic Assets

The leaderboard supports real animated cinematic backgrounds for Top 1-3. These assets are required for the final production visual. Do not bake UI text into any video or poster.

## Final Required Files

Rank 1:

- `cinematics/rank1-golden-dragon.webm`
- `cinematics/rank1-golden-dragon.mp4`
- `posters/rank1-golden-dragon-poster.webp`

Rank 2:

- `cinematics/rank2-ice-moon-dragon.webm`
- `cinematics/rank2-ice-moon-dragon.mp4`
- `posters/rank2-ice-moon-dragon-poster.webp`

Rank 3:

- `cinematics/rank3-fire-phoenix.webm`
- `cinematics/rank3-fire-phoenix.mp4`
- `posters/rank3-fire-phoenix-poster.webp`

## Exact Destination Paths

- `apps/web/public/leaderboard/cinematics/rank1-golden-dragon.webm`
- `apps/web/public/leaderboard/cinematics/rank1-golden-dragon.mp4`
- `apps/web/public/leaderboard/posters/rank1-golden-dragon-poster.webp`
- `apps/web/public/leaderboard/cinematics/rank2-ice-moon-dragon.webm`
- `apps/web/public/leaderboard/cinematics/rank2-ice-moon-dragon.mp4`
- `apps/web/public/leaderboard/posters/rank2-ice-moon-dragon-poster.webp`
- `apps/web/public/leaderboard/cinematics/rank3-fire-phoenix.webm`
- `apps/web/public/leaderboard/cinematics/rank3-fire-phoenix.mp4`
- `apps/web/public/leaderboard/posters/rank3-fire-phoenix-poster.webp`

## Generation Settings

- Master resolution: `1920x480` preferred, `1600x400` acceptable.
- Aspect ratio: 4:1 to 5:1.
- Duration: 8 seconds preferred; 6-10 seconds acceptable.
- FPS: 24 preferred; 30 acceptable.
- Audio: none.
- Loop: seamless; first and last frames should be visually compatible.
- WebM primary: VP9, or AV1 if the pipeline and target browsers support it well.
- MP4 fallback: H.264.
- Poster: WebP extracted from a clean representative frame.
- Do not use 60 fps.
- Keep clips compressed; avoid oversized files for a leaderboard screen.

## Safe Areas

The video is a background scene. HTML renders all UI on top.

Never include these in the video:

- rank
- character name
- title
- realm
- cultivation
- sect
- fame

Composition guide:

- Left 0-30%: rank, portrait, name. Keep this area darker, calmer, and less detailed.
- Center 30-75%: main creature motion. Put dragon body/head, phoenix wings, clouds, mist, fire, and aura here.
- Right 75-100%: cultivation and sect. Avoid bright creature heads or intense light directly under this text.
- Creature face/head must not enter the left 0-30% or right 75-100% UI safe areas.
- The creature must have internal body motion; do not rely only on camera, cloud, mist, or particle movement.

## Rank 1 Prompt: Golden Dragon

Subject:

Golden celestial Chinese dragon flying slowly through heavenly golden clouds. Premium xianxia MMORPG cinematic artwork. Long serpentine body with elegant scales. The dragon is majestic, divine, regal, and calm.

Composition:

Wide cinematic banner composition, 4:1 to 5:1 aspect ratio. The dragon occupies mainly the center 30-75% of the frame. Left 0-30% must stay relatively dark, quiet, and low detail for character portrait, rank, and name UI. Right 75-100% must remain readable for cultivation and sect UI. The dragon body can pass behind the center, with cloud layers partially hiding and revealing parts of the body. The dragon face/head must not enter the left 0-30% or right 75-100% UI safe areas.

Motion:

The dragon itself must animate internally. The long body visibly deforms and moves across frames. Head, whiskers, mane, claws, and tail move independently with slow majestic motion. Golden clouds drift around and partially occlude the dragon. Soft divine rays shift subtly. Floating gold dust moves gently. No aggressive action, no combat pose, no fast movement.

Camera:

Mostly locked camera. Very subtle cinematic drift only. No large pan. No zoom in/out. No camera shake.

Lighting:

Warm gold divine light, soft celestial rays, premium high-fantasy glow. Light should move across scales subtly. Keep text safe areas readable and not overexposed.

Background:

Heavenly golden cloudscape, xianxia immortal realm atmosphere, layered mist, aura, and depth. No modern objects.

Loop behavior:

8 seconds preferred; 6-10 seconds acceptable. Seamless loop. First and last frames visually compatible. No hard transition or scene cut.

Things to avoid:

No text, no letters, no numbers, no UI, no logo, no watermark. Do not generate a static dragon while only moving the camera or clouds. No western armored dragon style. No excessive flashing. No subtitles.

## Rank 2 Prompt: Ice / Moon Dragon

Subject:

Ice and moon celestial Chinese dragon moving slowly through a dark blue celestial environment. Premium xianxia MMORPG cinematic artwork. Elegant serpentine dragon with icy scales, moonlit glow, and refined divine presence.

Composition:

Wide cinematic banner composition, 4:1 to 5:1 aspect ratio. The dragon occupies mainly the center 30-75% of the frame. Left 0-30% stays darker and visually quiet for portrait, rank, and name UI. Right 75-100% stays readable for cultivation and sect UI. The dragon body may curve through cold mist in the center. The dragon face/head must not enter the left 0-30% or right 75-100% UI safe areas.

Motion:

The dragon itself must animate internally. The body visibly moves and breathes across frames. Head, whiskers, mane, and tail move subtly and independently. Cold mist runs horizontally through the scene and partially hides/reveals parts of the dragon. Small ice crystals and frost particles drift slowly. Blue aura breathes gently. No battle scene, no aggressive strike.

Camera:

Mostly locked camera. Very subtle drift only. No fast pan. No zoom. No camera shake.

Lighting:

Cool moonlight, deep navy shadows, soft icy rim light, subtle blue glow changes. Avoid bright blue flares under text safe areas.

Background:

Dark blue celestial sky, moon mist, frost haze, icy spiritual aura, floating crystal specks. No modern objects.

Loop behavior:

8 seconds preferred; 6-10 seconds acceptable. Seamless loop. First and last frames visually compatible. No hard transition or scene cut.

Things to avoid:

No text, no letters, no numbers, no UI, no logo, no watermark. No static creature. No frozen pose. No excessive frost particles covering UI. No camera shake. No subtitles.

## Rank 3 Prompt: Fire Phoenix

Subject:

Regal fire phoenix moving slowly in a dark ember environment. Premium xianxia MMORPG cinematic artwork. The phoenix is elegant, noble, divine, and not explosive or chaotic.

Composition:

Wide cinematic banner composition, 4:1 to 5:1 aspect ratio. The phoenix occupies mainly the center 30-75% of the frame. Left 0-30% stays darker and quieter for portrait, rank, and name UI. Right 75-100% stays readable for cultivation and sect UI. Wings, tail, and flame trails can pass through the center with smoke and fire layers. The phoenix face/head must not enter the left 0-30% or right 75-100% UI safe areas.

Motion:

The phoenix itself must animate internally. Wings, feathers, crest, tail, and body visibly move across frames. Living flames move across feathers. Ember particles drift upward. Smoke flows slowly through the scene. Warm aura pulses subtly. Elegant slow cinematic loop, no explosion, no attack animation.

Camera:

Mostly locked camera. Very subtle cinematic drift only. No fast camera. No zoom. No camera shake.

Lighting:

Dark red and amber lighting, warm rim light, glowing sparks, soft fire illumination. Avoid excessive flashing and avoid bright flame directly under UI text.

Background:

Dark ember sky, smoke, slow fire aura, xianxia divine beast atmosphere. No modern objects.

Loop behavior:

8 seconds preferred; 6-10 seconds acceptable. Seamless loop. First and last frames visually compatible. No hard transition or scene cut.

Things to avoid:

No text, no letters, no numbers, no UI, no logo, no watermark. No static creature. No frozen pose. No excessive particles covering UI. No scene cuts. No subtitles.

## Negative Prompt Recommendations

Use this negative prompt for all three assets:

No text, no letters, no numbers, no UI, no watermark, no logo, no static creature, no frozen pose, no fast camera, no camera shake, no scene cuts, no hard transition, no excessive flashing, no excessive particles covering UI, no creature face or head entering the left 0-30% UI area, no creature face or head entering the right 75-100% UI area, no modern objects, no western dragon armor style unless explicitly requested, no photoreal human, no subtitles.

## Production Notes

- Video contains only creature, environment, cloud/mist/fire, light, particles, and background motion.
- HTML keeps rank, avatar, name, title, realm, cultivation, sect, and fame.
- In development, missing videos display an explicit `MISSING: ...webm` warning in the card and log a console warning.
- In production, missing videos fall back to the poster without a visible missing label.
- After real assets are dropped into the repo, the next step is QA integration only, not layout redesign.
- QA checklist: crop/object-fit, text readability, autoplay, loop seam, mobile behavior, and file size/performance.
