"use client";

type InfoDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;
  onClose: () => void;
};

export default function InfoDialog({ open, title, message, okText = "OK", onClose }: InfoDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 shadow-sm"
        >
          {title && (
            <div className="px-5 pt-5 pb-3 border-b border-neutral-200 dark:border-neutral-700">
              <div className="text-base font-semibold">{title}</div>
            </div>
          )}
          <div className="px-5 py-4">
            <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{message}</div>
          </div>
          <div className="px-5 pb-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold"
            >
              {okText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
