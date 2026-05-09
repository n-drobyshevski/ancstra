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
import { useTranslations } from 'next-intl';
import type { NodeStyle } from './tree-utils';
import type { Coloring, ColoringStyle, EdgeStyle } from '@/lib/tree/view-prefs-storage';
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
  coloringStyle: ColoringStyle;
  onColoringStyleChange: (v: ColoringStyle) => void;

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
    coloringStyle,
    onColoringStyleChange,
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
  const t = useTranslations('tree.viewMenu');
  const tGroups = useTranslations('tree.viewMenu.groups');
  const tNodeStyle = useTranslations('tree.viewMenu.nodeStyle');
  const tShowOnNodes = useTranslations('tree.viewMenu.showOnNodes');
  const tOverlays = useTranslations('tree.viewMenu.overlays');
  const tColoring = useTranslations('tree.viewMenu.coloring');
  const tApplyAs = useTranslations('tree.viewMenu.applyAs');
  const tEdges = useTranslations('tree.viewMenu.edges');
  const tCamera = useTranslations('tree.viewMenu.camera');
  const tLayouts = useTranslations('tree.viewMenu.savedLayouts');

  return (
    <MenubarMenu>
      <MenubarTrigger className="text-xs">{t('trigger')}</MenubarTrigger>
      <MenubarContent align="start">
        <MenubarLabel>{tGroups('nodeStyle')}</MenubarLabel>
        <MenubarRadioGroup
          value={nodeStyle}
          onValueChange={(v) => onNodeStyleChange(v as NodeStyle)}
        >
          <MenubarRadioItem value="wide">
            {tNodeStyle('wide')}
            <MenubarShortcut>{formatShortcut('Mod Alt 1')}</MenubarShortcut>
          </MenubarRadioItem>
          <MenubarRadioItem value="compact">
            {tNodeStyle('compact')}
            <MenubarShortcut>{formatShortcut('Mod Alt 2')}</MenubarShortcut>
          </MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>{tGroups('showOnNodes')}</MenubarLabel>
        <MenubarCheckboxItem
          checked={showDates}
          onCheckedChange={onShowDatesChange}
        >
          {tShowOnNodes('lifespanDates')}
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showLivingIndicator}
          onCheckedChange={onShowLivingIndicatorChange}
        >
          {tShowOnNodes('livingIndicator')}
        </MenubarCheckboxItem>

        <MenubarSeparator />

        <MenubarLabel>{tGroups('overlays')}</MenubarLabel>
        <MenubarCheckboxItem
          checked={showMinimap}
          onCheckedChange={onShowMinimapChange}
        >
          {tOverlays('minimap')}
          <MenubarShortcut>{formatShortcut('Mod M')}</MenubarShortcut>
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showDataQuality}
          onCheckedChange={onShowDataQualityChange}
        >
          {tOverlays('dataQuality')}
          <MenubarShortcut>{formatShortcut('Mod G')}</MenubarShortcut>
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showProposals}
          onCheckedChange={onShowProposalsChange}
        >
          {tOverlays('proposals')}
        </MenubarCheckboxItem>
        <MenubarCheckboxItem
          checked={showCitations}
          onCheckedChange={onShowCitationsChange}
        >
          {tOverlays('citations')}
        </MenubarCheckboxItem>

        <MenubarSeparator />

        <MenubarLabel>{tGroups('coloring')}</MenubarLabel>
        <MenubarRadioGroup
          value={coloring}
          onValueChange={(v) => onColoringChange(v as Coloring)}
        >
          <MenubarRadioItem value="off">{tColoring('off')}</MenubarRadioItem>
          <MenubarRadioItem value="generation">{tColoring('generation')}</MenubarRadioItem>
          <MenubarRadioItem value="branch">
            {tColoring('branch')}
          </MenubarRadioItem>
          <MenubarRadioItem value="living">{tColoring('living')}</MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarLabel>{tGroups('applyAs')}</MenubarLabel>
        <MenubarRadioGroup
          value={coloringStyle}
          onValueChange={(v) => onColoringStyleChange(v as ColoringStyle)}
        >
          <MenubarRadioItem value="fill">{tApplyAs('fill')}</MenubarRadioItem>
          <MenubarRadioItem value="border">{tApplyAs('border')}</MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>{tGroups('edges')}</MenubarLabel>
        <MenubarRadioGroup
          value={edges}
          onValueChange={(v) => onEdgesChange(v as EdgeStyle)}
        >
          <MenubarRadioItem value="curved">{tEdges('curved')}</MenubarRadioItem>
          <MenubarRadioItem value="stepped">{tEdges('stepped')}</MenubarRadioItem>
          <MenubarRadioItem value="straight">{tEdges('straight')}</MenubarRadioItem>
        </MenubarRadioGroup>

        <MenubarSeparator />

        <MenubarLabel>{tGroups('camera')}</MenubarLabel>
        <MenubarItem onSelect={onFitToScreen}>
          {tCamera('fitToScreen')}
          <MenubarShortcut>F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onSelect={onCenterOnSelected} disabled={!hasSelection}>
          {tCamera('centerOnSelected')}
          <MenubarShortcut>C</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onSelect={onResetZoom}>
          {tCamera('resetZoom')}
          <MenubarShortcut>0</MenubarShortcut>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger>{tLayouts('label')}</MenubarSubTrigger>
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
            <MenubarItem onSelect={onSaveAsNew}>{tLayouts('saveAsNew')}</MenubarItem>
            {activeLayoutId && (
              <>
                <MenubarItem onSelect={onUpdateLayout}>
                  {tLayouts('updateNamed', { name: activeLayoutName ?? '' })}
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onSelect={onSetDefault}>{tLayouts('setDefault')}</MenubarItem>
                <MenubarItem onSelect={onRenameLayout}>{tLayouts('rename')}</MenubarItem>
                <MenubarItem variant="destructive" onSelect={onDeleteLayout}>
                  {tLayouts('delete')}
                </MenubarItem>
              </>
            )}
          </MenubarSubContent>
        </MenubarSub>

        <MenubarItem onSelect={onAutoLayout}>
          {t('autoLayout')}
          <MenubarShortcut>{formatShortcut('Mod Shift L')}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
