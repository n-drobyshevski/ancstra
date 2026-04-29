'use client';

import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarLabel,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/components/ui/menubar';
import { Star } from 'lucide-react';
import type { NodeStyle } from './tree-utils';
import type { Coloring, EdgeStyle } from '@/lib/tree/view-prefs-storage';
import { formatShortcut } from '@/lib/tree/format-shortcut';

export interface TreeViewMenuProps {
  // Node style (existing localStorage)
  nodeStyle: NodeStyle;
  onNodeStyleChange: (style: NodeStyle) => void;

  // Show on nodes
  showDates: boolean;
  onShowDatesChange: (v: boolean) => void;
  showLivingIndicator: boolean;
  onShowLivingIndicatorChange: (v: boolean) => void;

  // Overlays
  showMinimap: boolean;
  onShowMinimapChange: (v: boolean) => void;
  showDataQuality: boolean;
  onShowDataQualityChange: (v: boolean) => void;
  showProposals: boolean;
  onShowProposalsChange: (v: boolean) => void;
  showCitations: boolean;
  onShowCitationsChange: (v: boolean) => void;

  // Coloring
  coloring: Coloring;
  onColoringChange: (v: Coloring) => void;

  // Edges
  edges: EdgeStyle;
  onEdgesChange: (v: EdgeStyle) => void;

  // Camera
  onFitToScreen: () => void;
  onCenterOnSelected: () => void;
  onResetZoom: () => void;
  hasSelection: boolean; // disables "Center on selected" when false

  // Saved layouts (existing wiring)
  layouts: { id: string; name: string; isDefault: boolean }[];
  activeLayoutId: string | null;
  activeLayoutName: string | null;
  onLoadLayout: (id: string) => void;
  onSaveAsNew: () => void;
  onUpdateLayout: () => void;
  onSetDefault: () => void;
  onRenameLayout: () => void;
  onDeleteLayout: () => void;

  // Auto Layout
  onAutoLayout: () => void;
}

export function TreeViewMenu(props: TreeViewMenuProps) {
  const {
    nodeStyle,
    onNodeStyleChange,
    showDates,
    onShowDatesChange,
    showLivingIndicator,
    onShowLivingIndicatorChange,
    showMinimap,
    onShowMinimapChange,
    showDataQuality,
    onShowDataQualityChange,
    showProposals,
    onShowProposalsChange,
    showCitations,
    onShowCitationsChange,
    coloring,
    onColoringChange,
    edges,
    onEdgesChange,
    onFitToScreen,
    onCenterOnSelected,
    onResetZoom,
    hasSelection,
    layouts,
    activeLayoutId,
    activeLayoutName,
    onLoadLayout,
    onSaveAsNew,
    onUpdateLayout,
    onSetDefault,
    onRenameLayout,
    onDeleteLayout,
    onAutoLayout,
  } = props;

  return (
    <MenubarMenu>
      <MenubarTrigger className="text-xs">View</MenubarTrigger>
      <MenubarContent align="start">
        <MenubarLabel>Node style</MenubarLabel>
        <MenubarRadioGroup
          value={nodeStyle}
          onValueChange={(v) => onNodeStyleChange(v as NodeStyle)}
        >
          <MenubarRadioItem value="wide">
            Wide
            <MenubarShortcut>{formatShortcut('Mod Alt 1')}</MenubarShortcut>
          </MenubarRadioItem>
          <MenubarRadioItem value="compact">
            Compact
            <MenubarShortcut>{formatShortcut('Mod Alt 2')}</MenubarShortcut>
          </MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>Show on nodes</MenubarLabel>
        <MenubarCheckboxItem
          checked={showDates}
          onCheckedChange={onShowDatesChange}
        >
          Lifespan dates
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showLivingIndicator}
          onCheckedChange={onShowLivingIndicatorChange}
        >
          Living indicator
        </MenubarCheckboxItem>

        <MenubarSeparator />

        <MenubarLabel>Overlays</MenubarLabel>
        <MenubarCheckboxItem
          checked={showMinimap}
          onCheckedChange={onShowMinimapChange}
        >
          Minimap
          <MenubarShortcut>{formatShortcut('Mod M')}</MenubarShortcut>
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showDataQuality}
          onCheckedChange={onShowDataQualityChange}
        >
          Data Quality heatmap
          <MenubarShortcut>{formatShortcut('Mod G')}</MenubarShortcut>
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showProposals}
          onCheckedChange={onShowProposalsChange}
        >
          Pending proposals
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showCitations}
          onCheckedChange={onShowCitationsChange}
        >
          Citation indicators
        </MenubarCheckboxItem>

        <MenubarSeparator />

        <MenubarLabel>Coloring</MenubarLabel>
        <MenubarRadioGroup
          value={coloring}
          onValueChange={(v) => onColoringChange(v as Coloring)}
        >
          <MenubarRadioItem value="off">Off</MenubarRadioItem>
          <MenubarRadioItem value="generation">Generation</MenubarRadioItem>
          <MenubarRadioItem value="branch">
            Paternal / maternal branch
          </MenubarRadioItem>
          <MenubarRadioItem value="living">Living status</MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>Edges</MenubarLabel>
        <MenubarRadioGroup
          value={edges}
          onValueChange={(v) => onEdgesChange(v as EdgeStyle)}
        >
          <MenubarRadioItem value="curved">Curved</MenubarRadioItem>
          <MenubarRadioItem value="stepped">Stepped</MenubarRadioItem>
          <MenubarRadioItem value="straight">Straight</MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>Camera</MenubarLabel>
        <MenubarItem onSelect={onFitToScreen}>
          Fit to screen
          <MenubarShortcut>F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onSelect={onCenterOnSelected} disabled={!hasSelection}>
          Center on selected
          <MenubarShortcut>C</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onSelect={onResetZoom}>
          Reset zoom
          <MenubarShortcut>0</MenubarShortcut>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger>Saved layouts</MenubarSubTrigger>
          <MenubarSubContent>
            {layouts.map((layout) => (
              <MenubarItem
                key={layout.id}
                onSelect={() => onLoadLayout(layout.id)}
                className={activeLayoutId === layout.id ? 'font-bold' : ''}
              >
                {layout.isDefault ? (
                  <Star className="size-3.5 fill-current" aria-hidden />
                ) : (
                  <span className="size-3.5" aria-hidden />
                )}
                {layout.name}
              </MenubarItem>
            ))}
            {layouts.length > 0 && <MenubarSeparator />}
            <MenubarItem onSelect={onSaveAsNew}>Save current as…</MenubarItem>
            {activeLayoutId && (
              <>
                <MenubarItem onSelect={onUpdateLayout}>
                  Update &ldquo;{activeLayoutName}&rdquo;
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onSelect={onSetDefault}>Set as default</MenubarItem>
                <MenubarItem onSelect={onRenameLayout}>Rename</MenubarItem>
                <MenubarItem variant="destructive" onSelect={onDeleteLayout}>
                  Delete
                </MenubarItem>
              </>
            )}
          </MenubarSubContent>
        </MenubarSub>

        <MenubarItem onSelect={onAutoLayout}>
          Auto Layout
          <MenubarShortcut>{formatShortcut('Mod Shift L')}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
