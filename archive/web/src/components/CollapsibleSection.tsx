/**
 * CollapsibleSection adapter — same props API, rendered on the `collapsible` primitive.
 */

import type { JSX, ReactNode } from 'react';
import { useState } from 'react';

import { RiArrowRightSLine } from '@remixicon/react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition">
        <h3 className="text-sm uppercase font-bold tracking-wider text-[var(--app-text-secondary)]">
          {title}
        </h3>
        <RiArrowRightSLine
          className={`w-4 h-4 transition-transform text-[var(--app-text-secondary)] ${isOpen ? 'rotate-90' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleSection;
