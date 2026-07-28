import Modal from './Modal';
import LoadingButton from './LoadingButton';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  danger,
  loading,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <LoadingButton
          onClick={onConfirm}
          loading={loading}
          className={danger ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          {confirmText}
        </LoadingButton>
      </div>
    </Modal>
  );
}
