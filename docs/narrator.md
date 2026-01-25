# Ali Narrator

A TUI feature for recording videos with Ali as the narrator.

```
╭─
│  (⌐■_■)    Ali | The CM Guy
│  ↳ Your text appears here with typing animation_
╰─
```

## Commands

### Say (Single Line)

```bash
codemachine say "<text>" [options]
```

**Options:**
- `-f, --face <expr>` - Starting face expression (default: `idle`)
- `-d, --delay <sec>` - Seconds to wait after text completes (default: `2`)
- `-s, --speed <ms>` - Typing speed in milliseconds per character (default: `30`)

**Examples:**
```bash
# Simple message
codemachine say "Hello world"

# With face and delay
codemachine say "Let me think about this..." --face thinking --delay 3

# Faster typing
codemachine say "Speed typing!" --speed 15
```

### Narrate (Script File)

```bash
codemachine narrate <script.txt> [options]
```

**Options:**
- `-s, --speed <ms>` - Typing speed in milliseconds per character (default: `30`)

**Example:**
```bash
codemachine narrate my-demo.txt
codemachine narrate tutorial.txt --speed 50
```

## Script Format

Each line follows this format:
```
face|delay: text content here
```

- `face` - Starting face expression for this line
- `delay` - Seconds to wait after line completes
- `text` - Content to type (supports inline effects)

### Inline Effects

**Pause mid-text:** `{N}` - Pause for N seconds
```
idle|2: Hello {1} world {2} done
         ^types^ ^1s^ ^types^ ^2s^
```

**Change face mid-text:** `[face]` - Switch expression
```
idle|2: I'm calm [excited] now I'm excited!
```

### Available Faces

| Face | Expression |
|------|------------|
| `idle` | `(⌐■_■)` |
| `thinking` | `(╭ರ_•́)` |
| `tool` | `<(•_•<)` |
| `error` | `(╥﹏╥)` |
| `excited` | `(ノ◕ヮ◕)ノ` |
| `cool` | `(⌐■_■)` |

## Example Scripts

### Demo Script
```
idle|2: Hey there! {1} Welcome to CodeMachine
thinking|3: Let me show you {1} [excited] something cool!
excited|2: This is the narrator feature
idle|2: Pretty neat right?
```

### Tutorial Script
```
idle|2: Today we'll learn about agents
thinking|2: First {1} let's understand the basics
idle|3: An agent is an AI that can use tools
tool|2: [excited] Like reading files and running commands!
idle|2: Let's see it in action
```

### Error Handling Demo
```
idle|2: Let's try something
thinking|1: Running the command...
error|3: [error] Oops! {1} Something went wrong
thinking|2: [thinking] Let me try another approach
excited|2: [excited] Got it working!
```

## Controls

During playback:
- `r` - Restart/replay from beginning
- `Ctrl+C` - Exit

## Tips

1. **Timing:** Use `{1}` or `{2}` pauses to let viewers read
2. **Expressions:** Change faces to add personality
3. **Line breaks:** Each script line is a separate "scene"
4. **Speed:** Use `--speed 50` for slower, more readable typing
5. **Practice:** Test your script before recording
