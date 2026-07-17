import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LaborDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAllDays: () => void;
  onConfirmFromToday: () => void;
  selectedDate: string;
}

export const LaborDeleteConfirmModal: React.FC<LaborDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmAllDays,
  onConfirmFromToday,
  selectedDate
}) => {
  // Format selectedDate to BR format for display
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="labor-delete-modal-overlay"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <motion.div
            id="labor-delete-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
                <i className="fas fa-trash-alt text-xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Apontamento</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Este apontamento pode estar presente em múltiplos dias. Selecione como deseja realizar a exclusão:
              </p>

              {/* Options */}
              <div className="space-y-3">
                {/* Option 1: All days */}
                <button
                  id="delete-all-days-btn"
                  onClick={() => {
                    onConfirmAllDays();
                    onClose();
                  }}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50/30 transition-all flex items-start gap-4 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <i className="fas fa-calendar-times text-sm"></i>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm group-hover:text-rose-700 transition-colors">
                      Excluir de todos os dias
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Apaga este apontamento em todos os dias em que ele aparecer no histórico.
                    </div>
                  </div>
                </button>

                {/* Option 2: This day and subsequents */}
                <button
                  id="delete-from-today-btn"
                  onClick={() => {
                    onConfirmFromToday();
                    onClose();
                  }}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-start gap-4 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <i className="fas fa-calendar-day text-sm"></i>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">
                      Somente deste dia e subsequentes
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Exclui para o dia <span className="font-semibold text-slate-700">{formatDateBR(selectedDate)}</span> e datas futuras, mantendo os registros anteriores.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 flex justify-end">
              <button
                id="cancel-delete-btn"
                onClick={onClose}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all text-sm"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
