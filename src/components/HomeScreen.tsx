import { useState, useEffect, useMemo } from 'react';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import { getRecentCampaigns, addRecentCampaignWithPlatform, removeRecentCampaign, type RecentCampaign } from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';
import {
  RiDownloadCloudLine,
  RiAddLine,
  RiFolderOpenLine,
  RiFileTextLine,
  RiCloseLine,
  RiInformationLine,
} from '@remixicon/react';
import { BackgroundCanvas } from './HomeScreen/BackgroundCanvas';
import { LogoLockup } from './LogoLockup';
import { PlaygroundToken } from './HomeScreen/PlaygroundToken';
import { PlaygroundDrawings } from './HomeScreen/PlaygroundDrawings';
import { VignetteOverlay } from './HomeScreen/VignetteOverlay';
import { AboutModal, type AboutModalTab } from './AboutModal';

interface HomeScreenProps {
  onStartEditor: () => void;
}

/**
 * HomeScreen - Landing page for the application
 *
 * Displays branding, primary actions (New/Load Campaign),
 * recent campaigns list, and platform-specific download banner.
 *
 * This component serves as the entry point before loading the editor.
 */
export function HomeScreen({ onStartEditor }: HomeScreenProps) {
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutInitialTab, setAboutInitialTab] = useState<AboutModalTab>('about');
  const [triggerEasterEgg] = useState(0); // Easter egg disabled for now
  const [hideMacBanner, setHideMacBanner] = useState(() =>
    localStorage.getItem('hideMacBanner') === 'true'
  );
  const [tokenPositions, setTokenPositions] = useState<Record<string, { x: number; y: number; size: number }>>({});
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

  // Random inclusive subtitle (stable for session)
  const [subtitle] = useState(() => {
    const titles = [
      "Storytellers", "World Builders", "Game Guides", "Adventure Architects",
      "Keepers of Lore", "Dice Rollers", "Party Leaders", "Campaign Curators",
      "Narrative Weavers", "Fantasy Facilitators", "Myth Makers", "Legend Spinners",
      "Plot Twisters", "Tabletop Tacticians", "Grid Guardians", "Scene Setters",
      "Roleplay Referees", "Quest Givers", "Map Makers", "Saga Shapers",
      "Chroniclers", "Chaos Coordinators", "Rules Lawyers (The Good Kind)"
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  });

  const loadCampaign = useGameStore((state) => state.loadCampaign);
  const showToast = useGameStore((state) => state.showToast);

  // Load recent campaigns and detect platform on mount
  useEffect(() => {
    setRecentCampaigns(getRecentCampaigns());

    // Detect platform
    const storage = getStorage();
    const platform = storage.getPlatform();
    setIsElectron(platform === 'electron');

    // Detect macOS for download banner (avoid deprecated navigator.platform)
    let isMacOS = false;
    if (typeof navigator !== 'undefined') {
      const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
      const platformHint = uaData?.platform ?? '';
      const userAgent = navigator.userAgent ?? '';

      isMacOS =
        platformHint.toLowerCase().includes('mac') ||
        /mac/i.test(userAgent);
    }
    setIsMac(isMacOS);

    // Initialize window dimensions
    if (typeof window !== 'undefined') {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Keyboard shortcut: Press '?' to open About modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if '?' was pressed (shift + / on most keyboards)
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
        e.preventDefault();
        setAboutInitialTab('shortcuts');
        setIsAboutOpen(true);
      }
      // Also support Escape to close
      if (e.key === 'Escape' && isAboutOpen) {
        setIsAboutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAboutOpen]);

  /**
   * Create a new campaign and enter the editor
   */
  const handleNewCampaign = () => {
    // The default campaign is already loaded in the store
    // Just transition to editor view
    onStartEditor();
  };

  /**
   * Load an existing campaign from file
   */
  const handleLoadCampaign = async () => {
    try {
      const storage = getStorage();
      const campaign = await storage.loadCampaign();

      if (campaign) {
        // Load campaign into store
        loadCampaign(campaign);

        // Add to recent campaigns
        addRecentCampaignWithPlatform(
          campaign.id,
          campaign.name
        );

        // Update recent list
        setRecentCampaigns(getRecentCampaigns());

        // Transition to editor
        onStartEditor();

        showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to load campaign:', error);
      showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(error) }), 'error');
    }
  };

  /**
   * Handle click on a recent campaign entry.
   *
   * Current limitation:
   * - We cannot reliably reload a specific campaign from this list,
   *   because campaigns are stored as user-selected files and we do
   *   not currently persist file handles/paths.
   * - To avoid a confusing UX where clicking a recent item just opens
   *   a generic file picker, we treat this list as a reference only
   *   and show guidance to the user instead of re-opening the dialog.
   *
   * Future enhancement:
   * - Persist file handles (File System Access API) or file paths
   *   (Electron) so we can directly load the selected recent campaign.
   */
  const handleLoadRecent = async (_recent: RecentCampaign) => {
    showToast(
      'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .graphium file.',
      'info'
    );
  };

  /**
   * Remove a campaign from recent list
   */
  const handleRemoveRecent = (campaignId: string) => {
    removeRecentCampaign(campaignId);
    setRecentCampaigns(getRecentCampaigns());
  };

  /**
   * Dismiss Mac download banner permanently
   */
  const handleDismissMacBanner = () => {
    localStorage.setItem('hideMacBanner', 'true');
    setHideMacBanner(true);
  };

  // Generate random playground tokens with flavor text (memoized with window dimensions dependency)
  const playgroundTokens = useMemo(() => {
    // Don't generate tokens until window dimensions are available
    if (windowDimensions.width === 0 || windowDimensions.height === 0) {
      return [];
    }

    const tokenSize = 60;

    // Cliché names lists
    const heroNames = [
      "Sir Loin", "Ara-gone", "Generic Protagonist", "Main Character Energy", "Plot Armor",
      "Sir Dies-a-Lot", "The Chosen One", "Edgy Loner", "Paladin Dan", "Smite Master",
      "Hero McHeroFace", "Inventory Manager", "Quest Acceptor", "Moral Compass", "Lawful Goody",
      "Sword Guy", "Shield Carrier", "Destiny's Child", "Prophecy Fulfiller", "Village Savior",
      "Dragon Slayer (Self-Proclaimed)", "Shiny Armor", "Leader of Men", "Speech Giver", "Backstory Tragedy"
    ];
    const wizardNames = [
      "Merlin's Beard", "Fireball McGee", "Gandalf the Grey-ish", "Squishy", "Glass Cannon",
      "Spell Slot Machine", "Cantrip Spammer", "Bookworm", "Walking Library", "Beard Enthusiast",
      "Mana Addict", "Scroll Hoarder", "Robes & Slippers", "Staff Infection", "Magic Missile Man",
      "Arcane Dave", "Mystic Mike", "Potion Seller", "Wisdom Dump Stat", "Intelligence Overload",
      "Fireworks Technician", "Shadow Wizard", "Orb Ponderer", "Hex Master", "Rune Reader"
    ];
    const rangerNames = [
      "Leg-o-less", "Bush Camper", "Sneaky Pete", "Hoodie", "Dart Master",
      "Nature Boy", "Tree Hugger", "Bear Grylls", "Bow Stringer", "Dual Wielder",
      "Pet Collector", "Tracker Jacker", "Forest Gump", "Path Finder", "Leaf Lover",
      "Arrow Smith", "Quiver Full", "Stealth Archer (Skyrim Build)", "Wolf Friend", "Eagle Eye",
      "Scout Master", "Wilderness Guide", "Dark Corner Sitter", "Rogue Lite", "Crit Fisher"
    ];
    const goblinNames = [
      "Boblin", "Snargle", "Toe-Biter", "Clogg", "Ratbag", "Stabby",
      "XP Piñata", "Loot Bag", "Minion #42", "Cannon Fodder", "Ankle Biter",
      "Shiny Finder", "Trash goblin", "Bucket Head", "Stick Wielder", "Green Guy",
      "Muck Dweller", "Cave Creeper", "Noise Maker", "Trap Springer", "Arrow Catcher",
      "Meat Shield", "Gold Pincher", "Scrap Collector", "Boss's Favorite", "Expendable"
    ];
    const dragonNames = [
      "Trogdor", "Smaug's Cousin", "Spicy Lizard", "Hoarder", "Party Wiper",
      "TPK Machine", "Breath Mint Needed", "Scale Scale", "Gold Sitter", "Fire Breather",
      "Ancient One", "Wyrm Deal", "Big Lizard", "Flying Toaster", "Dungeon Boss",
      "End Game Content", "Stat Block of Doom", "Winged Terror", "Sulfur Breath", "Cave Landlord",
      "Treasure Guard", "Princess Keeper", "Mountain Top", "Sky Shadow", "Heat Source"
    ];

    const getRandomName = (list: string[]) => list[Math.floor(Math.random() * list.length)];

    const rawTokens = [
      {
        id: 'demo-hero',
        color: '#3b82f6',
        label: getRandomName(heroNames),
        flavorText: 'Definitely has protagonist energy.',
        size: tokenSize,
        imageSrc: './tokens/hero.png',
      },
      {
        id: 'demo-wizard',
        color: '#8b5cf6',
        label: getRandomName(wizardNames),
        flavorText: 'Contemplating the nature of reality... or maybe just lunch.',
        size: tokenSize,
        imageSrc: './tokens/wizard.png',
      },
      {
        id: 'demo-ranger',
        color: '#10b981',
        label: getRandomName(rangerNames),
        flavorText: 'Survival check: 18. They know exactly where the nearest tavern is.',
        size: tokenSize,
        imageSrc: './tokens/ranger.png',
      },
      {
        id: 'demo-goblin',
        color: '#f59e0b',
        label: getRandomName(goblinNames),
        flavorText: 'Rolled a 3 on Stealth. You can smell them from here.',
        size: tokenSize,
        imageSrc: './tokens/goblin.png',
      },
      {
        id: 'demo-dragon',
        color: '#ef4444',
        label: getRandomName(dragonNames),
        flavorText: "This ancient wyrm hasn't had breakfast yet. You look crunchy.",
        size: tokenSize * 4,
        imageSrc: './tokens/dragon.png',
      },
    ];

    // Distribute tokens using "dart throwing" for collision-free random placement
    // restricted to the top 60% of the screen
    const width = windowDimensions.width;
    const height = windowDimensions.height;

    type TokenWithPos = typeof rawTokens[0] & { x: number; y: number };
    const placedTokens: TokenWithPos[] = [];

    const padding = 60; // Keep away from edges
    const playAreaHeight = height * 0.55;

    rawTokens.forEach(token => {
      let bestPosition = { x: width / 2, y: playAreaHeight / 2 };
      let maxDistance = -1;

      // Try 50 times to find a good spot specifically for this token
      for (let i = 0; i < 50; i++) {
        const x = padding + Math.random() * (width - padding * 2);
        const y = padding + Math.random() * (playAreaHeight - padding);

        // EXCLUSION ZONE: Keep clear of the Logo/Title area
        // Assuming logo is roughly centered horizontally and in the upper-middle of the play area
        const logoZoneWidth = 600;
        const logoZoneHeight = 250;
        const logoZoneY = height * 0.15; // Start a bit down from top

        const inLogoZone =
          x > (width / 2 - logoZoneWidth / 2) &&
          x < (width / 2 + logoZoneWidth / 2) &&
          y > logoZoneY &&
          y < (logoZoneY + logoZoneHeight);

        if (inLogoZone) {
          continue; // Skip this spot, it's behind the text
        }

        // Calculate distance to nearest existing token
        let minDistanceToOthers = Infinity;
        if (placedTokens.length === 0) {
           minDistanceToOthers = Infinity; // First token is always fine
        } else {
          for (const other of placedTokens) {
            const dx = x - other.x;
            const dy = y - other.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDistanceToOthers) {
              minDistanceToOthers = dist;
            }
          }
        }

        // If this spot is better (further from others), keep it
        // Or if it's the first attempt, keep it
        if (minDistanceToOthers > maxDistance) {
          maxDistance = minDistanceToOthers;
          bestPosition = { x, y };
        }

        // If we found a spot that is "good enough" (e.g. > 150px away), take it immediately
        if (minDistanceToOthers > 150) {
          break;
        }
      }

      placedTokens.push({
        ...token,
        x: bestPosition.x,
        y: bestPosition.y
      });
    });

    // Initialize token positions for collision detection
    const positions: Record<string, { x: number; y: number; size: number }> = {};
    placedTokens.forEach(token => {
      positions[token.id] = { x: token.x, y: token.y, size: token.size };
    });
    setTokenPositions(positions);

    return placedTokens;
  }, [windowDimensions.width, windowDimensions.height]);

  /**
   * Handle token position change (for collision detection)
   */
  const handleTokenPositionChange = (id: string, x: number, y: number) => {
    setTokenPositions(prev => ({
      ...prev,
      [id]: { ...prev[id], x, y },
    }));
  };

  // AI Movement Effect: Randomly nudge tokens to encourage interaction
  useEffect(() => {
    // Wait for everything to settle
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        // 1. Pick a random token
        const ids = Object.keys(tokenPositions);
        if (ids.length === 0) return;

        const randomId = ids[Math.floor(Math.random() * ids.length)];
        const currentPos = tokenPositions[randomId];

        if (!currentPos) return;

        // 2. Calculate nudge
        // Move towards center if too close to edge, otherwise random
        const width = windowDimensions.width;
        const height = windowDimensions.height;
        const playAreaHeight = height * 0.55;

        // Random move +/- 40px
        const dx = (Math.random() - 0.5) * 80;
        const dy = (Math.random() - 0.5) * 80;

        let newX = currentPos.x + dx;
        let newY = currentPos.y + dy;

        // 3. Boundary checks
        const padding = 60;

        // Clamp to screen
        newX = Math.max(padding, Math.min(newX, width - padding));
        newY = Math.max(padding, Math.min(newY, playAreaHeight - padding));

        // Check Logo Zone
        const logoZoneWidth = 600;
        const logoZoneHeight = 250;
        const logoZoneY = height * 0.15;

        const inLogoZone =
          newX > (width / 2 - logoZoneWidth / 2) &&
          newX < (width / 2 + logoZoneWidth / 2) &&
          newY > logoZoneY &&
          newY < (logoZoneY + logoZoneHeight);

        if (inLogoZone) {
          return; // Abort move if it hits logo
        }

        // Apply move
        setTokenPositions(prev => ({
          ...prev,
          [randomId]: { ...prev[randomId], x: newX, y: newY }
        }));

      }, 3500); // Move one token every 3.5s

      return () => clearInterval(interval);
    }, 2000); // Startup delay

    return () => clearTimeout(timeout);
  }, [tokenPositions, windowDimensions]);

  // Convert tokenPositions to array for passing to tokens
  const allTokensArray = Object.entries(tokenPositions).map(([id, pos]) => ({
    id,
    ...pos,
  }));

  return (
    <div className="home-screen w-full h-screen flex flex-col items-center justify-center" style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--app-bg-base)',
      color: 'var(--app-text-primary)',
    }}>
      {/* Vignette overlay - creates fade to infinity effect */}
      {/* Placed BEFORE tokens so they float on top */}
      <VignetteOverlay />

      <BackgroundCanvas width={windowDimensions.width} height={windowDimensions.height}>
        {/* Decorative tactical drawings - CONNECTED to token positions */}
        <PlaygroundDrawings tokens={playgroundTokens} />

        {/* Playground tokens - draggable demo elements with collision and trail effects */}
        {playgroundTokens.map((token, index) => (
          <PlaygroundToken
            key={token.id}
            id={token.id}
            x={tokenPositions[token.id]?.x ?? token.x}
            y={tokenPositions[token.id]?.y ?? token.y}
            color={token.color}
            label={token.label}
            size={token.size}
            imageSrc={token.imageSrc}
            flavorText={token.flavorText}
            easterEggTrigger={triggerEasterEgg}
            showHint={index === 0} // Show hint on first token (Hero)
            onPositionChange={handleTokenPositionChange}
            allTokens={allTokensArray}
          />
        ))}
      </BackgroundCanvas>



      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .home-screen {
          animation: fadeIn 0.6s ease-out;
        }

        .home-action-button {
          --border-color: var(--app-border-default);
        }
        .home-action-button:hover {
          --border-color: var(--app-accent-solid);
        }
        .home-recent-item {
          --item-bg: var(--app-bg-surface);
          --item-border: var(--app-border-subtle);
        }
        .home-recent-item:hover {
          --item-bg: var(--app-bg-hover);
          --item-border: var(--app-border-default);
        }
        .home-remove-btn {
          --remove-bg: transparent;
        }
        .home-remove-btn:hover {
          --remove-bg: var(--app-bg-active);
        }
        .logo-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 1rem;
          border-radius: 12px;
          transition: all 0.3s ease;
          display: inline-block;
        }
        .logo-button:hover {
          transform: scale(1.05);
          background: rgba(59, 130, 246, 0.1);
        }
        .dismiss-banner-btn {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: transparent;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: var(--app-accent-text);
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          opacity: 0.6;
          transition: all 0.2s;
        }
        .dismiss-banner-btn:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.1);
        }
        .learn-basics-btn {
          background: var(--app-bg-hover);
          border-width: 1px;
          border-style: solid;
          border-color: var(--app-border-subtle);
          color: var(--app-text-secondary);
          transition: all 0.2s;
        }
        .learn-basics-btn:hover {
          border-color: var(--app-accent-solid);
          color: var(--app-accent-text);
        }
        .footer-link {
          color: var(--app-text-muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: var(--app-accent-text);
        }
        .footer-button {
          background: none;
          border: none;
          padding: 0;
          color: var(--app-text-muted);
          cursor: pointer;
          font-size: inherit;
          font-family: inherit;
          transition: color 0.2s;
        }
        .footer-button:hover {
          color: var(--app-accent-text);
        }
      `}</style>

      {/* Main Content Container - Above background and vignette */}
      <div className="max-w-2xl w-full px-8 flex flex-col justify-end pb-12" style={{
        position: 'relative',
        zIndex: 10,
        height: '100%',
        pointerEvents: 'none', // Allow clicks to pass through empty space to the canvas
      }}>
        {/* Branding */}
        <div className="text-center mb-16">
          <div className="flex flex-col items-center">
            <LogoLockup
              width={400}
              className="mb-6"
              style={{
                filter: 'drop-shadow(0 0 30px var(--app-bg-base)) drop-shadow(0 0 30px var(--app-bg-base))'
              }}
            />
            <p className="text-xl font-medium" style={{
              color: 'var(--app-text-primary)', // HIGHER contrast (was secondary)
            }}>
              Virtual Tabletop for {subtitle}
            </p>
          </div>
        </div>

        {/* Mac App Download Banner (Web only, Mac only) */}
        {!isElectron && isMac && !hideMacBanner && (
          <div className="mb-8 p-4 rounded-lg" style={{
            background: 'var(--app-accent-bg)',
            border: '1px solid var(--app-accent-solid)',
            position: 'relative',
            pointerEvents: 'auto',
          }}>
            {/* Dismiss button */}
            <button
              onClick={handleDismissMacBanner}
              className="dismiss-banner-btn"
              title="Don't show again"
              aria-label="Dismiss Mac download banner permanently"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <RiDownloadCloudLine className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--app-accent-text)' }} />
              <div className="flex-1" style={{ paddingRight: '1rem' }}>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--app-accent-text-contrast)' }}>
                  Download the Mac App
                </h3>
                <p className="text-sm" style={{ color: 'var(--app-accent-text)' }}>
                  Get greater portability, offline support, and privacy with the native Mac application.
                </p>
              </div>
              <a
                href="https://github.com/kocheck/Graphium/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary px-4 py-2 rounded font-medium whitespace-nowrap"
                style={{
                  background: 'var(--app-accent-solid)',
                  color: 'var(--app-accent-solid-text)',
                }}
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Primary Actions */}
        <div className="mb-8" style={{ pointerEvents: 'auto' }}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={handleNewCampaign}
              className="home-action-button p-4 rounded-lg text-left transition-all hover:scale-105"
              style={{
                background: 'var(--app-bg-surface)',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: 'var(--border-color)',
              }}
              aria-label="Create a new campaign and start the editor"
              data-testid="new-campaign-button"
            >
              <div className="flex items-center gap-3 mb-2">
                <RiAddLine className="w-6 h-6" style={{ color: 'var(--app-accent-solid)' }} />
                <h2 className="text-xl font-bold">New Campaign</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                Start a fresh adventure with a blank canvas
              </p>
            </button>

            <button
              onClick={handleLoadCampaign}
              className="home-action-button p-4 rounded-lg text-left transition-all hover:scale-105"
              style={{
                background: 'var(--app-bg-surface)',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: 'var(--border-color)',
              }}
              aria-label="Load an existing campaign from a .graphium file"
            >
              <div className="flex items-center gap-3 mb-2">
                <RiFolderOpenLine className="w-6 h-6" style={{ color: 'var(--app-accent-solid)' }} />
                <h2 className="text-xl font-bold">Load Campaign</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                Continue an existing campaign from a .graphium file
              </p>
            </button>
          </div>

          {/* Take a Tour button */}
          <button
            onClick={() => {
              setAboutInitialTab('tutorial');
              setIsAboutOpen(true);
            }}
            className="learn-basics-btn w-full p-4 rounded-lg text-center transition-all hover:scale-102"
            aria-label="Learn about Graphium features"
          >
            <div className="flex items-center justify-center gap-2">
              <RiInformationLine className="w-5 h-5" />
              <span className="font-medium">✨ New to Graphium? Learn the basics</span>
            </div>
          </button>
        </div>

      {recentCampaigns.length > 0 && (
          <div style={{ pointerEvents: 'auto' }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--app-text-secondary)' }}>
              Recent Campaigns
            </h3>
            <div className="space-y-2">
              {recentCampaigns.map((recent) => (
                <div
                  key={recent.id}
                  className="home-recent-item w-full p-4 rounded flex items-center justify-between group transition-all"
                  style={{
                    background: 'var(--item-bg)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--item-border)',
                  }}
                >
                  <button
                    onClick={() => handleLoadRecent(recent)}
                    className="flex items-center gap-3 flex-1 text-left"
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                    aria-label={`Recent campaign: ${recent.name}. Click for more information about loading this campaign.`}
                  >
                    <RiFileTextLine className="w-5 h-5" style={{ color: 'var(--app-text-secondary)' }} />
                    <div className="flex-1">
                      <div className="font-medium">{recent.name}</div>
                      <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                        {new Date(recent.lastOpened).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemoveRecent(recent.id)}
                    className="home-remove-btn p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: 'var(--remove-bg)',
                    }}
                    title="Remove from recent"
                    aria-label={`Remove ${recent.name} from recent campaigns`}
                  >
                    <RiCloseLine className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with links */}
      <div className="absolute bottom-4 left-0 right-0" style={{
        position: 'relative',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div className="flex flex-col items-center gap-3">
          {/* Links */}
          <div className="flex items-center gap-4 text-sm" style={{ pointerEvents: 'auto' }}>
            <a
              href="https://github.com/kocheck/Graphium"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <button
              onClick={() => {
                setAboutInitialTab('about');
                setIsAboutOpen(true);
              }}
              className="footer-button"
            >
              About
            </button>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <a
              href="https://github.com/kocheck/Graphium/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Report Bug
            </a>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <button
              onClick={() => {
                setAboutInitialTab('shortcuts');
                setIsAboutOpen(true);
              }}
              className="footer-button"
              title="Press ? to open"
            >
              Help (?)
            </button>
          </div>
          {/* Version */}
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            Version {__APP_VERSION__} · {isElectron ? 'Desktop' : 'Web'} Edition
          </p>
        </div>
      </div>

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        initialTab={aboutInitialTab}
      />
    </div>
  );
}
