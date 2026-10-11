'use client';

import * as React from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';

export interface FloatingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onSubmit?: (e: React.FormEvent) => void | Promise<void>;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
  A floating card form modal dialog.
 
  When opened, the background blurs and the form pops up as an elevated
  floating card. Submitting or closing returns the user back to their previous screen.
 */
export function FloatingFormModal({
  isOpen,
  onClose,
  title,
  description,
  icon = 'file-up',
  submitLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
  children,
  size = 'md',
}: FloatingFormModalProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(e);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      size={size}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">{children}</div>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-primary px-5 shadow-md hover:shadow-lg transition-all"
          >
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
