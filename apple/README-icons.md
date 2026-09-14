# Regenerating the app icons

Every icon in this repo comes from one mark, authored in
`public/icons/source.svg` on a 16-unit grid (see the comment in that file for
why). All shipped sizes are integer multiples of 16, so each export lands on
whole device pixels instead of antialiasing to grey.

Two variants exist, because macOS and iOS disagree about what an app icon is:

- **macOS** wants the rounding baked in with transparent corners, so the
  `mac-icon-*` files render `public/icons/source.svg` directly.
- **iOS** applies its own mask and rejects alpha, so
  `universal-icon-1024@1x.png` renders `apple/icon-source-ios.svg` — an opaque
  white square with the rounded mark inset 148/1024 per side.

Rendered with Inkscape (`brew install --cask inkscape`). ImageMagick or
`rsvg-convert` work too, but Inkscape's SVG support is the most faithful.

```sh
cd "$(git rev-parse --show-toplevel)"

SET="apple/Are.na Connections/Shared (App)/Assets.xcassets/AppIcon.appiconset"

# macOS: plain rounded master
while read -r size file; do
  inkscape --export-type=png --export-filename="$SET/$file" \
    --export-width=$size --export-height=$size public/icons/source.svg
done <<'LIST'
16 mac-icon-16@1x.png
32 mac-icon-16@2x.png
32 mac-icon-32@1x.png
64 mac-icon-32@2x.png
128 mac-icon-128@1x.png
256 mac-icon-128@2x.png
256 mac-icon-256@1x.png
512 mac-icon-256@2x.png
512 mac-icon-512@1x.png
1024 mac-icon-512@2x.png
LIST

# iOS: opaque square variant
inkscape --export-type=png --export-filename="$SET/universal-icon-1024@1x.png" \
  --export-width=1024 --export-height=1024 apple/icon-source-ios.svg

# these two are the extension's 128px icon verbatim
cp public/icons/128.png "apple/Are.na Connections/Shared (App)/Assets.xcassets/LargeIcon.imageset/128.png"
cp public/icons/128.png "apple/Are.na Connections/Shared (App)/Resources/Icon.png"
```

The browser-extension icons (`public/icons/{16,32,48,128}.png`) regenerate with
the loop in `public/icons/source.svg`'s own comment.

After regenerating, check that the rules still hold — Xcode will not tell you
if they don't:

```sh
# iOS must be fully opaque (min-alpha 65535) and square
magick "$SET/universal-icon-1024@1x.png" -alpha extract -format "%[min]\n" info:
# macOS must keep transparent corners
magick "$SET/mac-icon-512@2x.png" -format "%[pixel:p{2,2}]\n" info:
```
