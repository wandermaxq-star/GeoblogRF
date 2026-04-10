import React from 'react';
import CentreBackground from './Centre/CentreBackground';
import { MirrorGradientContainer } from './MirrorGradientProvider';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function DeleteAccountModal({ isOpen, onClose, onConfirm, isLoading }: DeleteAccountModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        <CentreBackground />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <MirrorGradientContainer className="centre-mode max-w-sm w-full mx-auto p-6">
            <h2 className="text-xl font-bold cg-text mb-4">Удаление аккаунта</h2>
            <p className="text-sm cg-text-muted mb-4">
              Вы собираетесь удалить ваш аккаунт. Все персональные данные будут удалены, но ваш
              ранее созданный контент останется анонимизированным и может продолжать служить
              другим пользователям. Это действие необратимо.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </MirrorGradientContainer>
        </div>
      </div>
    </>
  );
}
