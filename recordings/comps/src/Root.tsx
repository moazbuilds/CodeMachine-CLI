import "./index.css";
import { Composition } from "remotion";
import { SyncComposition } from "./SyncComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Sync"
        component={SyncComposition}
        durationInFrames={393}
        fps={25}
        width={2560}
        height={1440}
        defaultProps={{
          name: "test-ali",
          scriptText: `idle|4: Hi, {1} I am Ali, {2} your CodeMachine explainer.
thinking|4: So, {2} you spend hours editing videos {1} in After Effects or DaVinci Resolve?
idle|4: Well, {1} you don't need to anymore.
excited|4: All you need {1} is Claude Code {2} and CodeMachine.
cool|4: Pretty cool, {1} right?`,
        }}
      />
    </>
  );
};
