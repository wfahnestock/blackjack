import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Near-black card with a brass hairline rather than a grey panel, so a
          dialog reads as part of the room and not as a browser artifact. */}
      <div className="no-scrollbar w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--brass)]/25 bg-[#0b0906] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        {title && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[var(--parchment)]">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-[#7d6f4d] hover:text-[var(--parchment)] transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <hr className="brass-rule mt-3 mb-4" />
          </>
        )}
        {children}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
