import "./index.css";
import { Composition } from "remotion";
import { SyncComposition } from "./SyncComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Sync"
        component={SyncComposition}
        durationInFrames={1140}
        fps={25}
        width={2560}
        height={1440}
        defaultProps={{
          name: "claudeclaw",
          scriptText: `idle|4: ClaudeClaw turns your Claude Code {1} into a personal assistant that never sleeps.
thinking|4: It runs as a background daemon, {1} executing tasks on a schedule, {1} responding to messages on Telegram, transcribing voice commands, and integrating with any service you need.
excited|3: Why ClaudeClaw?
tool|4: Zero API overhead. {1} No separate API keys, no token accounting, no billing surprises.
idle|4: Runs entirely within your Claude Code subscription {1} with smart context management.
excited|4: Deploy in minutes. {1} One plugin install and one command gets you a running daemon with Telegram.
thinking|4: No containers, no infrastructure, no dependency headaches.
cool|4: Built-in observability. {1} A web dashboard to monitor runs, edit scheduled jobs, and inspect logs in real time.`,
        }}
      />
    </>
  );
};
