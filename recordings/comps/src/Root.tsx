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
          name: "claudeclaw-chaoslab",
          scriptText: `amused|4: This morning I connected ClaudeClaw to my smart home just for fun. {0.7} Five minutes later, my lights were blinking SOS because it detected low motivation.
playful|4: Then it sent Telegram alerts for hydration check, posture check, and compliment check. {0.6} After that, it scheduled dramatic music every time I opened my laptop.
mock|4: The weirdest part: it apologized to my plants for office stress and started a daily pep talk called Leaf Standup.
smile|4: I should disable it, but productivity is up and somehow my plants now look extremely confident.`,
        }}
      />
    </>
  );
};
