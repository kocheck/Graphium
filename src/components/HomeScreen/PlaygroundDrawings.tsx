import { Line, Group } from 'react-konva';
import { useMemo, memo } from 'react';

/**
 * PlaygroundDrawings - Static tactical markers for the HomeScreen demo
 *
 * Renders a collection of drawing elements (paths, circles, arrows) to make
 * the landing page feel like an active game in progress. These are purely
 * decorative and demonstrate the drawing tools available in the app.
 */

interface Token {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface PlaygroundDrawingsProps {
  tokens: Token[];
}

const markerColors = [
 "#ef4444", // Red
 "#f97316", // Orange
 "#eab308", // Yellow
 "#22c55e", // Green
 "#06b6d4", // Cyan
 "#3b82f6", // Blue
 "#a855f7", // Purple
 "#ec4899"  // Pink
];

const getRandomColor = () => markerColors[Math.floor(Math.random() * markerColors.length)];

const strokeWidth = 5;

// Drawing Primitives helpers - Moved outside component
// Each primitive receives a color prop to avoid re-generating colors on each render
const DrawTree = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
    <Group>
        <Line points={[x+40, y+20, x+40, y-20]} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />
        <Line points={[x+20, y-20, x+60, y-20, x+70, y-40, x+50, y-70, x+30, y-70, x+10, y-40, x+20, y-20]} tension={0.5} closed stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />
    </Group>
  );
};

const DrawRock = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return <Line points={[x-50, y+10, x-70, y-20, x-60, y-40, x-30, y-35, x-20, y+10, x-50, y+10]} tension={0.2} closed stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />;
};

const DrawDoor = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
    <Group>
        <Line points={[x-60, y-30, x-60, y+30, x-60, y-30, x-100, y-30, x-100, y+30]} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />
        <Line points={[x-100, y+30, x-130, y+50]} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />
        <Line points={[x-100, y+30, x-115, y+35, x-130, y+50]} tension={0.5} stroke={color} strokeWidth={2} lineCap="round" opacity={0.6} listening={false} />
    </Group>
  );
};

const DrawCrown = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
  return <Line points={[
      x-40, y-size/2-20, x-40, y-size/2-60, x-20, y-size/2-40, x, y-size/2-70, x+20, y-size/2-40, x+40, y-size/2-60, x+40, y-size/2-20, x-40, y-size/2-20
  ]} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={1} listening={false} />;
};

const DrawSkull = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
  return (
    <Group>
        <Line points={[x-20, y-size/2-40, x-25, y-size/2-60, x-20, y-size/2-80, x+20, y-size/2-80, x+25, y-size/2-60, x+20, y-size/2-40, x-20, y-size/2-40]} tension={0.4} closed stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={1} listening={false} />
        <Line points={[x-10, y-size/2-65, x-10, y-size/2-65]} stroke={color} strokeWidth={strokeWidth+2} lineCap="round" opacity={1} listening={false} />
        <Line points={[x+10, y-size/2-65, x+10, y-size/2-65]} stroke={color} strokeWidth={strokeWidth+2} lineCap="round" opacity={1} listening={false} />
    </Group>
  );
};

const DrawZzz = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
  return (
    <Group>
        <Line points={[x+20, y-size/2-20, x+40, y-size/2-20, x+20, y-size/2, x+40, y-size/2]} stroke={color} strokeWidth={3} lineCap="round" lineJoin="round" opacity={1} listening={false} />
        <Line points={[x+30, y-size/2-40, x+45, y-size/2-40, x+30, y-size/2-25, x+45, y-size/2-25]} stroke={color} strokeWidth={2} lineCap="round" lineJoin="round" opacity={0.8} listening={false} />
    </Group>
  );
};

const DrawChest = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
    <Group>
       {/* Box */}
       <Line points={[x-40, y+10, x-40, y+40, x+40, y+40, x+40, y+10, x-40, y+10]} closed stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.9} listening={false} />
       {/* Lid Arc */}
       <Line points={[x-40, y+10, x, y-10, x+40, y+10]} tension={0.5} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" opacity={0.9} listening={false} />
       {/* Lock */}
       <Line points={[x, y+20, x, y+20]} stroke={color} strokeWidth={6} lineCap="round" opacity={1} listening={false} />
    </Group>
  );
};

const DrawSparkles = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
  return (
    <Group>
        <Line points={[x, y-size/2-40, x, y-size/2-60]} stroke={color} strokeWidth={3} lineCap="round" opacity={0.8} />
        <Line points={[x-10, y-size/2-50, x+10, y-size/2-50]} stroke={color} strokeWidth={3} lineCap="round" opacity={0.8} />
        <Line points={[x+30, y-size/2-30, x+30, y-size/2-40]} stroke={color} strokeWidth={2} lineCap="round" opacity={0.8} />
        <Line points={[x+25, y-size/2-35, x+35, y-size/2-35]} stroke={color} strokeWidth={2} lineCap="round" opacity={0.8} />
    </Group>
  );
};

const DrawQuestion = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
   return (
     <Group>
         <Line points={[x-10, y-size/2-40, x-10, y-size/2-60, x+10, y-size/2-60, x+10, y-size/2-45, x, y-size/2-40, x, y-size/2-30]} tension={0.3} stroke={color} strokeWidth={4} lineCap="round" lineJoin="round" opacity={1} listening={false} />
         <Line points={[x, y-size/2-15, x, y-size/2-15]} stroke={color} strokeWidth={6} lineCap="round" opacity={1} listening={false} />
     </Group>
  );
};

const DrawExclamation = ({ x, y, size, color }: {x: number, y: number, size: number, color: string}) => {
  return (
    <Group>
        <Line points={[x, y-size/2-60, x, y-size/2-30]} stroke={color} strokeWidth={5} lineCap="round" opacity={1} listening={false} />
        <Line points={[x, y-size/2-15, x, y-size/2-15]} stroke={color} strokeWidth={6} lineCap="round" opacity={1} listening={false} />
    </Group>
 );
};

const DrawTracks = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
    <Group>
         <Line points={[x+30, y, x+30, y]} stroke={color} strokeWidth={4} lineCap="round" opacity={0.7} />
         <Line points={[x+25, y-5, x+25, y-5]} stroke={color} strokeWidth={2} lineCap="round" opacity={0.7} />
         <Line points={[x+35, y-5, x+35, y-5]} stroke={color} strokeWidth={2} lineCap="round" opacity={0.7} />
         <Line points={[x+30, y-8, x+30, y-8]} stroke={color} strokeWidth={2} lineCap="round" opacity={0.7} />
         <Line points={[x+50, y+20, x+50, y+20]} stroke={color} strokeWidth={4} lineCap="round" opacity={0.7} />
    </Group>
  );
};

// NEW ILLUSTRATIONS

const DrawSword = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
      <Group>
          {/* Blade */}
          <Line points={[x, y-40, x, y+20]} stroke={color} strokeWidth={4} lineCap="round" opacity={1} />
          {/* Guard */}
          <Line points={[x-15, y, x+15, y]} stroke={color} strokeWidth={4} lineCap="round" opacity={1} />
          {/* Handle */}
          <Line points={[x, y+20, x, y+30]} stroke={color} strokeWidth={4} lineCap="round" opacity={1} />
      </Group>
  );
};

const DrawPotion = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
      <Group>
          {/* Bottle */}
          <Line points={[x-10, y, x+10, y, x+15, y+20, x-15, y+20, x-10, y]} closed stroke={color} strokeWidth={4} lineCap="round" lineJoin="round" opacity={1} />
          {/* Neck */}
          <Line points={[x-5, y, x-5, y-10, x+5, y-10, x+5, y]} stroke={color} strokeWidth={3} lineCap="round" lineJoin="round" opacity={1} />
          {/* Bubble */}
          <Line points={[x, y+10, x, y+10]} stroke={color} strokeWidth={4} lineCap="round" opacity={0.8} />
      </Group>
  );
};

const DrawScroll = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
      <Group>
          <Line points={[x-20, y-10, x+20, y-10, x+20, y+10, x-20, y+10, x-20, y-10]} closed stroke={color} strokeWidth={3} lineCap="round" lineJoin="round" opacity={0.9} />
          <Line points={[x-10, y-10, x-10, y+10]} stroke={color} strokeWidth={2} opacity={0.6} />
          <Line points={[x+10, y-10, x+10, y+10]} stroke={color} strokeWidth={2} opacity={0.6} />
      </Group>
  );
};

const DrawFire = ({ x, y, color }: {x: number, y: number, color: string}) => {
  return (
      <Line points={[x, y+20, x-10, y+10, x-5, y, x-10, y-10, x, y-20, x+5, y-5, x+10, y-15, x+10, y+10, x, y+20]} closed tension={0.5} stroke={color} strokeWidth={3} fill={color} fillOpacity={0.2} lineCap="round" lineJoin="round" />
  );
};


export const PlaygroundDrawings = memo(function PlaygroundDrawings({ tokens = [] }: PlaygroundDrawingsProps) {
  // Find specific key tokens
  const ranger = tokens.find(t => t.id === 'demo-ranger');
  const goblin = tokens.find(t => t.id === 'demo-goblin');
  const wizard = tokens.find(t => t.id === 'demo-wizard');
  const dragon = tokens.find(t => t.id === 'demo-dragon');
  const hero = tokens.find(t => t.id === 'demo-hero');

  // If we don't have enough tokens (e.g. initial load), don't draw
  if (!ranger || !goblin || !wizard || !dragon || !hero) return null;

  // Randomize which props appear and assign colors for this session
  // We use useMemo with empty dependency to only roll once per mount
  const activePropsAndColors = useMemo(() => {
    // Helper to pick a random outcome based on weights
    // format: [item, weight], e.g. ["tree", 40], ["none", 60]
    const pick = (options: {id: string, weight: number}[]) => {
        const total = options.reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * total;
        for (const opt of options) {
            if (random < opt.weight) return opt.id;
            random -= opt.weight;
        }
        return options[0].id;
    };

    return {
        ranger: { prop: pick([{id: 'tree', weight: 40}, {id: 'tracks', weight: 30}, {id: 'potion', weight: 20}, {id: 'none', weight: 10}]), color: getRandomColor() },
        goblin: { prop: pick([{id: 'rock', weight: 30}, {id: 'zzz', weight: 20}, {id: 'skull', weight: 20}, {id: 'trap', weight: 20}, {id: 'none', weight: 10}]), color: getRandomColor() },
        hero:   { prop: pick([{id: 'door', weight: 30}, {id: 'chest', weight: 20}, {id: 'sword', weight: 20}, {id: 'scroll', weight: 20}, {id: 'none', weight: 10}]), color: getRandomColor() },
        wizard: { prop: pick([{id: 'sparkles', weight: 30}, {id: 'question', weight: 20}, {id: 'fire', weight: 30}, {id: 'potion', weight: 20}]), color: getRandomColor() },
        dragon: { prop: pick([{id: 'crown', weight: 40}, {id: 'fire', weight: 30}, {id: 'chest', weight: 20}, {id: 'zzz', weight: 10}]), color: getRandomColor() },
    };
  }, []); // Run once on mount

  return (
    <>
      {activePropsAndColors.ranger.prop === 'tree' && <DrawTree x={ranger.x} y={ranger.y} color={activePropsAndColors.ranger.color} />}
      {activePropsAndColors.ranger.prop === 'tracks' && <DrawTracks x={ranger.x} y={ranger.y} color={activePropsAndColors.ranger.color} />}
      {activePropsAndColors.ranger.prop === 'potion' && <DrawPotion x={ranger.x + 40} y={ranger.y} color={activePropsAndColors.ranger.color} />}

      {activePropsAndColors.goblin.prop === 'rock' && <DrawRock x={goblin.x} y={goblin.y} color={activePropsAndColors.goblin.color} />}
      {activePropsAndColors.goblin.prop === 'zzz' && <DrawZzz x={goblin.x} y={goblin.y} size={goblin.size} color={activePropsAndColors.goblin.color} />}
      {activePropsAndColors.goblin.prop === 'skull' && <DrawSkull x={goblin.x} y={goblin.y} size={goblin.size} color={activePropsAndColors.goblin.color} />}
      {/* Trap reused as skull for now or generic danger? Let's use Skull for trap actually or drawing spikes is easy */}
      {activePropsAndColors.goblin.prop === 'trap' && <DrawSkull x={goblin.x + 30} y={goblin.y + 30} size={goblin.size} color={activePropsAndColors.goblin.color} />}

      {activePropsAndColors.hero.prop === 'door' && <DrawDoor x={hero.x} y={hero.y} color={activePropsAndColors.hero.color} />}
      {activePropsAndColors.hero.prop === 'chest' && <DrawChest x={hero.x + 60} y={hero.y} color={activePropsAndColors.hero.color} />}
      {activePropsAndColors.hero.prop === 'exclamation' && <DrawExclamation x={hero.x} y={hero.y} size={hero.size} color={activePropsAndColors.hero.color} />}
      {activePropsAndColors.hero.prop === 'sword' && <DrawSword x={hero.x - 30} y={hero.y} color={activePropsAndColors.hero.color} />}
      {activePropsAndColors.hero.prop === 'scroll' && <DrawScroll x={hero.x + 30} y={hero.y + 30} color={activePropsAndColors.hero.color} />}

      {activePropsAndColors.wizard.prop === 'sparkles' && <DrawSparkles x={wizard.x} y={wizard.y} size={wizard.size} color={activePropsAndColors.wizard.color} />}
      {activePropsAndColors.wizard.prop === 'question' && <DrawQuestion x={wizard.x} y={wizard.y} size={wizard.size} color={activePropsAndColors.wizard.color} />}
      {activePropsAndColors.wizard.prop === 'skull' && <DrawSkull x={wizard.x} y={wizard.y} size={wizard.size} color={activePropsAndColors.wizard.color} />}
      {activePropsAndColors.wizard.prop === 'fire' && <DrawFire x={wizard.x + 30} y={wizard.y - 30} color={activePropsAndColors.wizard.color} />}
      {activePropsAndColors.wizard.prop === 'potion' && <DrawPotion x={wizard.x - 20} y={wizard.y + 20} color={activePropsAndColors.wizard.color} />}

      {activePropsAndColors.dragon.prop === 'crown' && <DrawCrown x={dragon.x} y={dragon.y} size={dragon.size} color={activePropsAndColors.dragon.color} />}
      {activePropsAndColors.dragon.prop === 'zzz' && <DrawZzz x={dragon.x} y={dragon.y} size={dragon.size} color={activePropsAndColors.dragon.color} />}
      {activePropsAndColors.dragon.prop === 'chest' && <DrawChest x={dragon.x + 80} y={dragon.y + 20} color={activePropsAndColors.dragon.color} />}
      {activePropsAndColors.dragon.prop === 'fire' && <DrawFire x={dragon.x - 50} y={dragon.y + 50} color={activePropsAndColors.dragon.color} />}
    </>
  );
});
