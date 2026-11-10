import { useId } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  headerAction?: React.ReactNode;
  zIndex?: number;
  maxWidth?: string;
  children: React.ReactNode;
}

function Modal({
  isOpen,
  onClose,
  title,
  headerAction,
  zIndex = 50,
  maxWidth = "max-w-lg",
  children,
}: ModalProps) {
  const titleId = useId();
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Contenido */}
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative z-10 w-full ${maxWidth} rounded-xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col`}>
        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <h2 id={titleId} className="truncate text-xl font-semibold text-gray-900">{title}</h2>
            {headerAction}
          </div>

          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;