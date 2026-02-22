# ASCII Projects

Store ASCII animation projects under:

`recordings/asciis/<project-name>/*.txt`

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

Optional:

```bash
bun ascii <project-name> --name face --format png
bun ascii <project-name> --name face --format gif --fps 8
```
