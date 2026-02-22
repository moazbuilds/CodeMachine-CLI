import "./index.css";
import { Composition } from "remotion";
import { SyncComposition } from "./compositions/sync/SyncComposition";
import { FinalSceneComposition } from "./compositions/final/FinalSceneComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClaudeclawSadFinalScene"
        component={FinalSceneComposition}
        durationInFrames={900}
        fps={25}
        width={2560}
        height={1440}
        defaultProps={{
          name: "claudeclaw-sad-test",
          baseVideoName: "claudeclaw-sad-test-final",
        }}
      />
      <Composition
        id="Sync"
        component={SyncComposition}
        durationInFrames={900}
        fps={25}
        width={2560}
        height={1440}
        defaultProps={{
          name: "claudeclaw-sad-test",
          baseVideoName: "claudeclaw-sad-test-final",
          scriptText: `idle|4: Tonight felt heavier than usual. I opened ClaudeClaw, hoping it could clear my mind.
thinking|4: It reminded me about unfinished tasks, and somehow each one felt louder than my own thoughts.
idle|4: I asked it to organize tomorrow, but I kept staring at the screen, too tired to move.
cool|4: Then a quiet message appeared: You have done enough for today. Please rest.
smile|4: I closed the laptop, sat in silence, and let the room finally breathe again.`,
        }}
      />
    </>
  );
};
