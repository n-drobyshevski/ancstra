'use client';

import { Button } from '@/components/ui/button';
import { Menubar } from '@/components/ui/menubar';
import { Separator } from '@/components/ui/separator';
import type { FilterState, NodeStyle } from './tree-utils';
import type { Coloring, EdgeStyle } from '@/lib/tree/view-prefs-storage';
import { TreeViewToggle } from './tree-view-toggle';
import { TreeViewMenu } from './tree-view-menu';
import { TreeExportMenu } from './tree-export-menu';

interface TreeToolbarProps {
  // Palette
  onTogglePalette: () => void;
  paletteOpen: boolean;

  // View toggle
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;

  // Filters (right side)
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;

  // Saved layouts (passes through to TreeViewMenu)
  layouts: { id: string; name: string; isDefault: boolean }[];
  activeLayoutId: string | null;
  activeLayoutName: string | null;
  onLoadLayout: (id: string) => void;
  onSaveAsNew: () => void;
  onUpdateLayout: () => void;
  onSetDefault: () => void;
  onDeleteLayout: () => void;
  onRenameLayout: () => void;
  onAutoLayout: () => void;

  // Node style (existing)
  nodeStyle: NodeStyle;
  onNodeStyleChange: (style: NodeStyle) => void;

  // View prefs
  showDates: boolean;
  onShowDatesChange: (v: boolean) => void;
  showLivingIndicator: boolean;
  onShowLivingIndicatorChange: (v: boolean) => void;
  showMinimap: boolean;
  onShowMinimapChange: (v: boolean) => void;
  showDataQuality: boolean;
  onShowDataQualityChange: (v: boolean) => void;
  showProposals: boolean;
  onShowProposalsChange: (v: boolean) => void;
  showCitations: boolean;
  onShowCitationsChange: (v: boolean) => void;
  coloring: Coloring;
  onColoringChange: (v: Coloring) => void;
  edges: EdgeStyle;
  onEdgesChange: (v: EdgeStyle) => void;

  // Camera
  onFitToScreen: () => void;
  onCenterOnSelected: () => void;
  onResetZoom: () => void;
  hasSelection: boolean;
}

export function TreeToolbar(props: TreeToolbarProps) {
  const {
    onTogglePalette,
    paletteOpen,
    view,
    onSetView,
    filterState,
    onToggleFilter,
  } = props;

  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1.5">
        <TreeViewToggle view={view} onSetView={onSetView} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          size="sm"
          variant={paletteOpen ? 'default' : 'secondary'}
          onClick={onTogglePalette}
        >
          + New Person
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Menubar className="border-0 bg-transparent p-0 h-7">
          <TreeViewMenu
            nodeStyle={props.nodeStyle}
            onNodeStyleChange={props.onNodeStyleChange}
            showDates={props.showDates}
            onShowDatesChange={props.onShowDatesChange}
            showLivingIndicator={props.showLivingIndicator}
            onShowLivingIndicatorChange={props.onShowLivingIndicatorChange}
            showMinimap={props.showMinimap}
            onShowMinimapChange={props.onShowMinimapChange}
            showDataQuality={props.showDataQuality}
            onShowDataQualityChange={props.onShowDataQualityChange}
            showProposals={props.showProposals}
            onShowProposalsChange={props.onShowProposalsChange}
            showCitations={props.showCitations}
            onShowCitationsChange={props.onShowCitationsChange}
            coloring={props.coloring}
            onColoringChange={props.onColoringChange}
            edges={props.edges}
            onEdgesChange={props.onEdgesChange}
            onFitToScreen={props.onFitToScreen}
            onCenterOnSelected={props.onCenterOnSelected}
            onResetZoom={props.onResetZoom}
            hasSelection={props.hasSelection}
            layouts={props.layouts}
            activeLayoutId={props.activeLayoutId}
            activeLayoutName={props.activeLayoutName}
            onLoadLayout={props.onLoadLayout}
            onSaveAsNew={props.onSaveAsNew}
            onUpdateLayout={props.onUpdateLayout}
            onSetDefault={props.onSetDefault}
            onRenameLayout={props.onRenameLayout}
            onDeleteLayout={props.onDeleteLayout}
            onAutoLayout={props.onAutoLayout}
          />
          <TreeExportMenu />
        </Menubar>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled>
          Search
        </Button>

        <Button
          variant={filterState.sex.M ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'M')}
        >
          M
        </Button>
        <Button
          variant={filterState.sex.F ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'F')}
        >
          F
        </Button>
        <Button
          variant={filterState.sex.U ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'U')}
        >
          U
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          variant={filterState.living.living ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('living', 'living')}
        >
          Living
        </Button>
        <Button
          variant={filterState.living.deceased ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('living', 'deceased')}
        >
          Deceased
        </Button>
      </div>
    </div>
  );
}
