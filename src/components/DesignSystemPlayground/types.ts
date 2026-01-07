/**
 * Type definitions for the Design System Playground
 */

import React from 'react';

export interface ComponentExample {
  id: string;
  name: string;
  category:
    | 'button'
    | 'input'
    | 'toggle'
    | 'modal'
    | 'typography'
    | 'color'
    | 'card'
    | 'toast'
    | 'badge'
    | 'icon'
    | 'landing-patterns'
    | 'performance';
  description: string;
  component: React.ReactNode;
  code: string;
  tags?: string[];
}

export interface ComponentCategory {
  id: string;
  name: string;
  description: string;
}
