# ASCII Projects

Store ASCII animation projects under:

`recordings/inputs/ascii/<project-name>/*.txt`

Each `.txt` can be:

- single-frame ASCII (plain text), or
- multi-frame using `frame N:` blocks.

Multi-frame syntax:

```txt
frame 1|0.30:
(^_^)

frame 2|0.30:
(-_-)
```

`|0.30` is optional hold duration in seconds for GIF output.

Render:

```bash
bun ascii <project-name>
```

Output path:

`recordings/outputs/ascii/<project-name>/`

Notes:

- ASCII is centered by default.
- Font size auto-fits to avoid clipping/cropping.
- Rendering uses a fixed character grid, so spacing/alignment matches source columns.
- PNG background is transparent by default (`--bg none`).

Optional:

```bash
bun ascii <project-name> --name face --format png
bun ascii <project-name> --name face --format gif --fps 8
bun ascii <project-name> --name logo --point-size 72 --x 0 --y -40
bun ascii <project-name> --name logo --char-width-factor 0.6 --line-height-factor 1.28
```
