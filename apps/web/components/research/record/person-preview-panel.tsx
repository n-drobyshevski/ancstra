'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { PersonPreviewContent } from './person-preview-content';

interface PersonPreviewPanelProps {
  personId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonPreviewPanel({
  personId,
  open,
  onOpenChange,
}: PersonPreviewPanelProps) {
  const isMobile = useIsMobile();

  if (!personId) return null;

  const handleClose = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={[0.4, 0.85]}
        modal={false}
        shouldScaleBackground={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Person Preview</DrawerTitle>
            <DrawerDescription className="sr-only">
              Preview of person details
            </DrawerDescription>
          </DrawerHeader>
          <PersonPreviewContent personId={personId} onNavigate={handleClose} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Person Preview</SheetTitle>
          <SheetDescription>Preview of person details</SheetDescription>
        </SheetHeader>
        <PersonPreviewContent personId={personId} onNavigate={handleClose} />
      </SheetContent>
    </Sheet>
  );
}
