Output recordings/output/frames/
Output recordings/output/video/test-ali.mp4
Set Width 2560
Set Height 1440
Set FontSize 80
Set Padding 0
Set Theme { "background": "#181D27", "foreground": "#ffffff" }
Set Framerate 60

# Hide command typing, show when Ali frame appears
Hide
Type "bun run dev -- narrate recordings/assets/scripts/test-ali.txt --speed 180"
Enter
Wait+Screen /The CM Guy/
Show

# ── S1: "Hi, I am Ali, your CodeMachine explainer." ──
Wait+Screen /Hi,/
Screenshot recordings/output/screenshots/s1-w1-hi.png
Wait+Screen /am/
Screenshot recordings/output/screenshots/s1-w2-am.png
Wait+Screen /CodeMachine/
Screenshot recordings/output/screenshots/s1-w3-codemachine.png
Wait+Screen /explainer/
Screenshot recordings/output/screenshots/s1-w4-explainer.png

# ── S2: "So, you spend hours editing videos in After Effects or DaVinci Resolve?" ──
Wait+Screen /So,/
Screenshot recordings/output/screenshots/s2-w1-so.png
Wait+Screen /spend/
Screenshot recordings/output/screenshots/s2-w2-spend.png
Wait+Screen /hours/
Screenshot recordings/output/screenshots/s2-w3-hours.png
Wait+Screen /editing/
Screenshot recordings/output/screenshots/s2-w4-editing.png
Wait+Screen /videos/
Screenshot recordings/output/screenshots/s2-w5-videos.png
Wait+Screen /After/
Screenshot recordings/output/screenshots/s2-w6-after.png
Wait+Screen /Effects/
Screenshot recordings/output/screenshots/s2-w7-effects.png
Wait+Screen /DaVinci/
Screenshot recordings/output/screenshots/s2-w8-davinci.png
Wait+Screen /Resolve/
Screenshot recordings/output/screenshots/s2-w9-resolve.png

# ── S3: "Well, you don't need to anymore." ──
Wait+Screen /Well,/
Screenshot recordings/output/screenshots/s3-w1-well.png
Wait+Screen /don't/
Screenshot recordings/output/screenshots/s3-w2-dont.png
Wait+Screen /need/
Screenshot recordings/output/screenshots/s3-w3-need.png
Wait+Screen /anymore/
Screenshot recordings/output/screenshots/s3-w4-anymore.png

# ── S4: "All you need is Claude Code and CodeMachine." ──
Wait+Screen /need/
Screenshot recordings/output/screenshots/s4-w1-need.png
Wait+Screen /Claude/
Screenshot recordings/output/screenshots/s4-w2-claude.png
Wait+Screen /Code/
Screenshot recordings/output/screenshots/s4-w3-code.png
Wait+Screen /CodeMachine/
Screenshot recordings/output/screenshots/s4-w4-codemachine.png

# ── S5: "Pretty cool, right?" ──
Wait+Screen /Pretty/
Screenshot recordings/output/screenshots/s5-w1-pretty.png
Wait+Screen /cool,/
Screenshot recordings/output/screenshots/s5-w2-cool.png
Wait+Screen /right/
Screenshot recordings/output/screenshots/s5-w3-right.png

Sleep 2
