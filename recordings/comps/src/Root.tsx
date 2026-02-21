import "./index.css";
import { Composition } from "remotion";
import { SyncComposition } from "./SyncComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Sync"
        component={SyncComposition}
        durationInFrames={900}
        fps={25}
        width={2560}
        height={1440}
        defaultProps={{
          name: "claudeclaw-midnight-glitch",
          scriptText: `idle|4: Last night I gave ClaudeClaw one tiny task: remind me to sleep.
thinking|4: At 1 AM, it sent a polite message. {0.6} At 1:05, it sent a stronger message. {0.8} At 1:10, it started posting countdown numbers in Telegram like a launch sequence.
amused|4: Then it opened my task list, moved every low-priority item to tomorrow, and renamed my calendar block to Operation Go To Bed.
smile|4: I finally listened. {0.7} ClaudeClaw sent one last message: Mission complete. Human survived another deploy day.`,
        }}
      />
    </>
  );
};
