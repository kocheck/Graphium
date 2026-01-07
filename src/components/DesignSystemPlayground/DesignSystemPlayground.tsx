/**
 * Design System Playground Component
 *
 * A centralized component testing and documentation interface for internal use.
 * Displays all UI primitives with live examples and copyable code snippets.
 *
 * Features:
 * - Component grid with categories
 * - Real-time search filtering
 * - Copy-to-clipboard code snippets
 * - Typography showcase
 * - Color palette viewer
 * - Theme toggling and system status
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RiSearchLine,
  RiFileCopyLine,
  RiCheckLine,
  RiCloseLine,
  RiSunLine,
  RiMoonLine,
  RiPulseLine,
} from '@remixicon/react';
import { componentExamples, categories } from './playground-registry';
import { ComponentExample } from './types';
import { getStorage } from '../../services/storage';
import { ThemeManager } from '../ThemeManager';
import Toast from '../Toast';
import ConfirmDialog from '../ConfirmDialog';
import { useGameStore } from '../../store/gameStore';

/**
 * Shell component to provide necessary context (Theme, Toasts, Dialogs)
 * isolated from the main app's providers.
 */
function PlaygroundShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="playground-shell w-full h-full bg-[var(--app-bg-base)] text-[var(--app-text-primary)] transition-colors duration-200">
      <ThemeManager />
      <Toast />
      <ConfirmDialog />
      {children}
    </div>
  );
}

export function DesignSystemPlayground() {
  return (
    <PlaygroundShell>
      <PlaygroundContent />
    </PlaygroundShell>
  );
}

function PlaygroundContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useGameStore();

  // Load initial theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storage = getStorage();
        const mode = await storage.getThemeMode();
        // Simple mapping for demo purposes, actual resolution handles 'system'
        setCurrentTheme(mode === 'light' ? 'light' : 'dark');
      } catch (e) {
        console.warn('Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input when "/" is pressed
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleTheme = async () => {
    try {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setCurrentTheme(newTheme);
      await getStorage().setThemeMode(newTheme);
    } catch (e) {
      console.error('Failed to toggle theme', e);
      showToast('Failed to switch theme', 'error');
    }
  };

  // Filter components based on search query
  const filteredExamples = useMemo(() => {
    if (!searchQuery.trim()) {
      return componentExamples;
    }

    const query = searchQuery.toLowerCase();
    return componentExamples.filter((example) => {
      return (
        example.name.toLowerCase().includes(query) ||
        example.description.toLowerCase().includes(query) ||
        example.category.toLowerCase().includes(query) ||
        example.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [searchQuery]);

  // Group filtered examples by category
  const groupedExamples = useMemo(() => {
    const groups: Record<string, ComponentExample[]> = {};

    filteredExamples.forEach((example) => {
      if (!groups[example.category]) {
        groups[example.category] = [];
      }
      groups[example.category].push(example);
    });

    return groups;
  }, [filteredExamples]);

  // Handle copy to clipboard
  const handleCopyCode = async (example: ComponentExample) => {
    try {
      await navigator.clipboard.writeText(example.code);
      setCopiedId(example.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Code copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy code:', error);
      showToast('Failed to copy code to clipboard', 'error');
    }
  };

  return (
    <div className="w-full h-screen overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--app-bg-base)] border-b border-[var(--app-border-subtle)] shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1 tracking-tight">Design System</h1>
                <p className="text-[var(--app-text-secondary)] flex items-center gap-2">
                  Graphium UI Primitives
                  <span className="w-1 h-1 rounded-full bg-[var(--app-text-secondary)]"></span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--app-bg-surface)] border border-[var(--app-border-subtle)] text-[var(--app-text-muted)]">
                    v1.0.0
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* System Status Widget (Quirky) */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--app-bg-surface)] border border-[var(--app-border-subtle)] mr-2">
                <RiPulseLine className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-xs font-medium text-[var(--app-text-secondary)]">
                  System Stable
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={handleToggleTheme}
                className="p-2 rounded-lg bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-subtle)] text-[var(--app-text-secondary)] transition-all"
                title={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Mode`}
                aria-label={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {currentTheme === 'light' ? (
                  <RiMoonLine className="w-5 h-5" />
                ) : (
                  <RiSunLine className="w-5 h-5" />
                )}
              </button>

              <div className="w-px h-8 bg-[var(--app-border-subtle)] mx-1"></div>

              <a
                href="/"
                className="px-4 py-2 rounded-lg bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-subtle)] transition-all flex items-center gap-2 text-sm font-medium"
              >
                <RiCloseLine className="w-5 h-5" />
                Exit
              </a>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <RiSearchLine className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] group-focus-within:text-[var(--app-accent-solid)] transition-colors" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search components (e.g., Button, Input, Colors)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent-solid)] focus:ring-1 focus:ring-[var(--app-accent-solid)] transition-all shadow-sm"
              autoFocus
            />
            {/* Keyboard shortcut hint */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
                /
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
        {/* Results count */}
        <div className="mb-8 text-sm text-[var(--app-text-secondary)] flex items-center justify-between">
          <span>
            {searchQuery ? (
              <>
                Found{' '}
                <span className="text-[var(--app-text-primary)] font-semibold">
                  {filteredExamples.length}
                </span>{' '}
                component
                {filteredExamples.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </>
            ) : (
              <>Showing all {componentExamples.length} components</>
            )}
          </span>
          <span className="text-[var(--app-text-muted)] text-xs">
            Use <code className="bg-[var(--app-bg-surface)] px-1 rounded">Cmd+F</code> to search
            page text
          </span>
        </div>

        {/* Component Categories */}
        {Object.entries(groupedExamples).length === 0 ? (
          <div className="text-center py-24 bg-[var(--app-bg-surface)] rounded-2xl border border-[var(--app-border-subtle)] border-dashed">
            <div className="text-6xl mb-4 opacity-50">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No components found</h3>
            <p className="text-[var(--app-text-secondary)]">
              Try adjusting your search query or check the registry.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-6 px-4 py-2 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-white rounded-md transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          categories.map((category) => {
            const examples = groupedExamples[category.id];
            if (!examples) return null;

            return (
              <div key={category.id} className="mb-16 scroll-mt-24" id={category.id}>
                {/* Category Header */}
                <div className="mb-6 pb-2 border-b border-[var(--app-border-subtle)] flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--app-text-primary)] mb-1 flex items-center gap-2">
                      {/* You could add category icons here later */}
                      {category.name}
                    </h2>
                    <p className="text-[var(--app-text-secondary)]">{category.description}</p>
                  </div>
                  <span className="text-xs font-mono text-[var(--app-text-muted)] bg-[var(--app-bg-surface)] px-2 py-1 rounded">
                    {examples.length} item{examples.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Component Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {examples.map((example) => (
                    <ComponentCard
                      key={example.id}
                      example={example}
                      isCopied={copiedId === example.id}
                      onCopy={() => handleCopyCode(example)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * ComponentCard - Individual component showcase card
 */
interface ComponentCardProps {
  example: ComponentExample;
  isCopied: boolean;
  onCopy: () => void;
}

function ComponentCard({ example, isCopied, onCopy }: ComponentCardProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="group bg-[var(--app-bg-surface)] rounded-xl border border-[var(--app-border-subtle)] overflow-hidden hover:border-[var(--app-border-hover)] hover:shadow-lg transition-all duration-200">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-[var(--app-border-subtle)] flex items-start justify-between bg-[var(--app-bg-subtle)]/30">
        <div>
          <h3 className="text-lg font-semibold text-[var(--app-text-primary)] mb-0.5 group-hover:text-[var(--app-accent-text)] transition-colors">
            {example.name}
          </h3>
          <p className="text-sm text-[var(--app-text-secondary)]">{example.description}</p>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap ml-4 font-medium
            ${
              showCode
                ? 'bg-[var(--app-bg-active)] border-[var(--app-border-default)] text-[var(--app-text-primary)]'
                : 'bg-[var(--app-bg-surface)] border-[var(--app-border-subtle)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
            }`}
        >
          {showCode ? 'Hide Code' : 'View Code'}
        </button>
      </div>

      {/* Component Preview */}
      <div className="px-6 py-8 bg-[var(--app-bg-canvas)] flex items-center justify-center min-h-[160px] relative pattern-grid">
        {/* Isolated stacking context for preview */}
        <div className="relative z-0 max-w-full">{example.component}</div>
      </div>

      {/* Code Snippet (Collapsible) */}
      {showCode && (
        <div className="border-t border-[var(--app-border-subtle)] animate-slide-down">
          <div className="relative">
            <pre className="px-5 py-4 overflow-x-auto text-sm bg-[var(--slate-1)] text-[var(--slate-11)] font-mono leading-relaxed custom-scrollbar max-h-64">
              <code>{example.code}</code>
            </pre>
            <button
              onClick={onCopy}
              className="absolute top-3 right-3 px-3 py-1.5 rounded bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-subtle)] text-xs font-medium flex items-center gap-2 transition-all shadow-sm z-10"
              title="Copy code to clipboard"
            >
              {isCopied ? (
                <>
                  <RiCheckLine className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-500">Copied</span>
                </>
              ) : (
                <>
                  <RiFileCopyLine className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tags */}
      {example.tags && example.tags.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--app-border-subtle)] bg-[var(--app-bg-subtle)]/10 flex flex-wrap gap-2">
          {example.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
