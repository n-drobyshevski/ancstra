'use client';

import type { Event } from '@ancstra/shared';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { EventForm } from './event-form';

interface EventCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  /** When provided, the dialog opens in edit mode pre-filled with this event. */
  event?: Event;
  /** Called after the event has been saved successfully. */
  onSaved?: () => void;
}

export function EventCreateDialog({
  open,
  onOpenChange,
  personId,
  personName,
  event,
  onSaved,
}: EventCreateDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!event;

  const handleSaved = () => {
    onOpenChange(false);
    onSaved?.();
  };

  const body = (
    <div className="p-4">
      <EventForm
        personId={personId}
        event={event}
        onSave={handleSaved}
        onCancel={() => onOpenChange(false)}
      />
    </div>
  );

  const title = isEdit ? 'Edit Life Event' : 'Add Life Event';
  const description = isEdit
    ? <>Update event for <strong>{personName}</strong></>
    : <>Record an event for <strong>{personName}</strong></>;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
