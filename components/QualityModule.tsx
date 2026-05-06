
import React, { useState, useEffect } from 'react';
import { FVS, FVSItem, FVSSubItem } from '../types';
import { generateId } from '../src/lib/utils';
import { storageService } from '../services/storageService';
import mammoth from 'mammoth';
import { renderAsync } from 'docx-preview';
import html2pdf from 'html2pdf.js';

interface QualityModuleProps {
  onFeedback: (type: 'success' | 'error', msg: string) => void;
  onConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

export const QualityModule: React.FC<QualityModuleProps> = ({ onFeedback, onConfirm }) => {
  const [fvsList, setFvsList] = useState<FVS[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingFvs, setIsAddingFvs] = useState(false);
  const [isViewingIs, setIsViewingIs] = useState(false);
  const [viewingFvs, setViewingFvs] = useState<FVS | null>(null);
  const [editingFvsId, setEditingFvsId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'is' | 'fvs'>('is');
  
  // Form states
  const [fvsCode, setFvsCode] = useState('');
  const [fvsName, setFvsName] = useState('');
  const [isControlled, setIsControlled] = useState(false);
  const [revision, setRevision] = useState('');
  const [instructionFile, setInstructionFile] = useState<{ name: string; base64: string } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [fvsItems, setFvsItems] = useState<FVSItem[]>([]);
  const docxContainerRef = React.useRef<HTMLDivElement>(null);
  const viewDocxRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = storageService.subscribeFVS(setFvsList);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (instructionFile && activeTab === 'is') {
      renderDocx(instructionFile.base64, docxContainerRef);
    }
  }, [instructionFile, activeTab]);

  useEffect(() => {
    if (isViewingIs && viewingFvs?.instructionFile) {
      renderDocx(viewingFvs.instructionFile.base64, viewDocxRef);
    }
  }, [isViewingIs, viewingFvs]);

  const renderDocx = async (base64: string, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    setIsRendering(true);
    try {
      const arrayBuffer = base64ToArrayBuffer(base64.split(',')[1]);
      ref.current.innerHTML = '';
      await renderAsync(arrayBuffer, ref.current, undefined, {
        className: "docx", 
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
      });
    } catch (error) {
      console.error('Error rendering DOCX:', error);
      onFeedback('error', 'Erro ao renderizar visualização do documento');
    } finally {
      setIsRendering(false);
    }
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setInstructionFile({ name: file.name, base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleAddFvs = () => {
    setEditingFvsId(null);
    setFvsCode('');
    setFvsName('');
    setIsControlled(false);
    setRevision('');
    setInstructionFile(null);
    setFvsItems([]);
    setIsAddingFvs(true);
    setActiveTab('is');
  };

  const handleEditFvs = (fvs: FVS) => {
    setEditingFvsId(fvs.id);
    setFvsCode(fvs.code);
    setFvsName(fvs.name);
    setIsControlled(fvs.isControlled || false);
    setRevision(fvs.revision || '');
    setInstructionFile(fvs.instructionFile || null);
    setFvsItems(fvs.items);
    setIsAddingFvs(true);
    setActiveTab('is');
  };

  const handleSaveFvs = async () => {
    if (!fvsCode || !fvsName) {
      onFeedback('error', 'Preencha o código e o nome da FVS');
      return;
    }

    const newFvs: FVS = {
      id: editingFvsId || generateId(),
      code: fvsCode,
      name: fvsName,
      isControlled,
      revision,
      instructionFile: instructionFile || undefined,
      items: fvsItems,
      createdAt: Date.now()
    };

    try {
      await storageService.saveFVS(newFvs);
      setIsAddingFvs(false);
      onFeedback('success', editingFvsId ? 'FVS atualizada com sucesso' : 'FVS cadastrada com sucesso');
    } catch (error) {
      onFeedback('error', 'Erro ao salvar FVS');
    }
  };

  const handleDeleteFvs = (id: string) => {
    if (onConfirm) {
      onConfirm(
        'Confirmar Exclusão',
        'Tem certeza que deseja excluir esta FVS?',
        async () => {
          try {
            await storageService.deleteFVS(id);
            onFeedback('success', 'FVS excluída com sucesso');
          } catch (error) {
            onFeedback('error', 'Erro ao excluir FVS');
          }
        }
      );
    }
  };

  // Items Management
  const addItem = () => {
    const newItem: FVSItem = {
      id: generateId(),
      code: `${fvsItems.length + 1}.0`,
      name: '',
      subItems: []
    };
    setFvsItems([...fvsItems, newItem]);
  };

  const updateItem = (id: string, updates: Partial<FVSItem>) => {
    setFvsItems(fvsItems.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setFvsItems(fvsItems.filter(item => item.id !== id));
  };

  const addSubItem = (itemId: string) => {
    setFvsItems(fvsItems.map(item => {
      if (item.id === itemId) {
        const newSub: FVSSubItem = {
          id: generateId(),
          code: `${item.code.split('.')[0]}.${item.subItems.length + 1}`,
          inspectionItem: '',
          tolerance: '',
          equipment: '',
          inspectionMethod: '',
          sampling: ''
        };
        return { ...item, subItems: [...item.subItems, newSub] };
      }
      return item;
    }));
  };

  const updateSubItem = (itemId: string, subId: string, updates: Partial<FVSSubItem>) => {
    setFvsItems(fvsItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          subItems: item.subItems.map(sub => sub.id === subId ? { ...sub, ...updates } : sub)
        };
      }
      return item;
    }));
  };

  const removeSubItem = (itemId: string, subId: string) => {
    setFvsItems(fvsItems.map(item => {
      if (item.id === itemId) {
        return { ...item, subItems: item.subItems.filter(sub => sub.id !== subId) };
      }
      return item;
    }));
  };

  const handleIllustrationUpload = (itemId: string, subId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateSubItem(itemId, subId, { illustration: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadWord = () => {
    if (!instructionFile) return;
    const link = document.createElement('a');
    link.href = instructionFile.base64;
    link.download = instructionFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFvsList = fvsList.filter(fvs => 
    fvs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fvs.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewIs = (fvs: FVS) => {
    if (!fvs.instructionFile) {
      onFeedback('error', 'Esta FVS não possui instrução de trabalho cadastrada.');
      return;
    }
    setViewingFvs(fvs);
    setIsViewingIs(true);
  };

  return (
    <div className="space-y-6">
      {!isAddingFvs ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Módulo de Qualidade</h2>
              <p className="text-slate-500 text-sm">Gerencie as Fichas de Verificação de Serviço (FVS)</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input 
                  type="text"
                  placeholder="Pesquisar por nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={handleAddFvs}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2 shrink-0"
              >
                <i className="fas fa-plus"></i> Nova FVS
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Código</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome do Serviço</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Controlado</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Data de Cadastro</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFvsList.map(fvs => (
                    <tr key={fvs.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{fvs.code}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{fvs.name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${fvs.isControlled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {fvs.isControlled ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(fvs.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button 
                          onClick={() => handleViewIs(fvs)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Visualizar Instrução"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button 
                          onClick={() => handleEditFvs(fvs)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar FVS"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          onClick={() => handleDeleteFvs(fvs.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir FVS"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredFvsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        {searchTerm ? 'Nenhum resultado encontrado para sua pesquisa.' : 'Nenhuma FVS cadastrada.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsAddingFvs(false)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingFvsId ? 'Editar FVS' : 'Nova FVS'}
                </h3>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cadastro de Qualidade</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAddingFvs(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveFvs}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
              >
                Salvar FVS
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Código da FVS</label>
                <input 
                  type="text" 
                  value={fvsCode}
                  onChange={(e) => setFvsCode(e.target.value)}
                  placeholder="Ex: FVS-ALV-001"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome do Serviço</label>
                <input 
                  type="text" 
                  value={fvsName}
                  onChange={(e) => setFvsName(e.target.value)}
                  placeholder="Ex: Alvenaria de Vedação"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Serviço Controlado</label>
                <select 
                  value={isControlled ? 'sim' : 'nao'}
                  onChange={(e) => setIsControlled(e.target.value === 'sim')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Revisão</label>
                <input 
                  type="text" 
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder="Ex: 01"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('is')}
                className={`px-6 py-3 text-sm font-bold transition-all relative ${activeTab === 'is' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Instrução de Trabalho (IS)
                {activeTab === 'is' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
              </button>
              <button
                onClick={() => setActiveTab('fvs')}
                className={`px-6 py-3 text-sm font-bold transition-all relative ${activeTab === 'fvs' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Ficha de Verificação (FVS)
                {activeTab === 'fvs' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
              </button>
            </div>

            <div className="min-h-[400px]">
              {activeTab === 'is' ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                        <i className="fas fa-file-word text-2xl"></i>
                      </div>
                      <div className="max-w-xs">
                        <h4 className="font-bold text-slate-800">Instrução de Trabalho</h4>
                        <p className="text-xs text-slate-500">Arquivo .docx com as instruções para este serviço.</p>
                      </div>
                      <div className="flex gap-2">
                        <label className="bg-white text-indigo-600 border border-indigo-200 px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-50 transition cursor-pointer shadow-sm">
                          {instructionFile ? 'Alterar Arquivo' : 'Selecionar Arquivo'}
                          <input type="file" accept=".docx" onChange={handleFileUpload} className="hidden" />
                        </label>
                        {instructionFile && (
                          <button 
                            onClick={handleDownloadWord}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
                            title="Baixar para abrir no Word"
                          >
                            <i className="fas fa-download"></i> Baixar Word
                          </button>
                        )}
                      </div>
                      {instructionFile && (
                        <p className="text-xs font-bold text-indigo-600">
                          <i className="fas fa-check-circle mr-1"></i> {instructionFile.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {isRendering && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-bold text-slate-600">Renderizando documento...</p>
                    </div>
                  )}

                  <div 
                    className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-y-auto max-h-[800px] p-4 md:p-8 ${!instructionFile || isRendering ? 'hidden' : 'block'}`}
                    style={{ minHeight: '400px' }}
                  >
                    <div ref={docxContainerRef} className="docx-container" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Itens de Inspeção</h4>
                    <button 
                      onClick={addItem}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition"
                    >
                      <i className="fas fa-plus mr-1"></i> Adicionar Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {fvsItems.map(item => (
                      <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex gap-2 items-center">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-500 border border-slate-200 shadow-sm font-bold text-xs">
                            {item.code}
                          </div>
                          <input 
                            type="text" 
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder="Nome do Item (Ex: Preparação)"
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          />
                          <button onClick={() => addSubItem(item.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Subitem">
                            <i className="fas fa-plus-circle"></i>
                          </button>
                          <button onClick={() => removeItem(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>

                        <div className="pl-8 space-y-4 border-l-2 border-slate-200 ml-4">
                          {item.subItems.map(sub => (
                            <div key={sub.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                              <div className="flex gap-3 items-start">
                                <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-500 font-bold text-[10px] shrink-0 mt-1">
                                  {sub.code}
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Item de Inspeção</label>
                                    <input 
                                      type="text" 
                                      value={sub.inspectionItem}
                                      onChange={(e) => updateSubItem(item.id, sub.id, { inspectionItem: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tolerância Admissível</label>
                                    <input 
                                      type="text" 
                                      value={sub.tolerance}
                                      onChange={(e) => updateSubItem(item.id, sub.id, { tolerance: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Eqto Utilizado</label>
                                    <input 
                                      type="text" 
                                      value={sub.equipment}
                                      onChange={(e) => updateSubItem(item.id, sub.id, { equipment: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Execução da Inspeção</label>
                                    <input 
                                      type="text" 
                                      value={sub.inspectionMethod}
                                      onChange={(e) => updateSubItem(item.id, sub.id, { inspectionMethod: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Amostragem</label>
                                    <input 
                                      type="text" 
                                      value={sub.sampling}
                                      onChange={(e) => updateSubItem(item.id, sub.id, { sampling: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ilustração</label>
                                    <div className="flex gap-2 items-center">
                                      <label className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs cursor-pointer hover:bg-slate-100 transition truncate">
                                        {sub.illustration ? 'Imagem Carregada' : 'Carregar Imagem'}
                                        <input type="file" accept="image/*" onChange={(e) => handleIllustrationUpload(item.id, sub.id, e)} className="hidden" />
                                      </label>
                                      {sub.illustration ? (
                                        <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden shrink-0">
                                          <img src={sub.illustration} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <button onClick={() => removeSubItem(item.id, sub.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mt-6">
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {fvsItems.length === 0 && (
                      <div className="text-center py-8 text-slate-400 italic text-sm">
                        Nenhum item cadastrado. Clique em "Adicionar Item" para começar.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* View IS Modal */}
      {isViewingIs && viewingFvs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Visualizar Instrução de Trabalho</h3>
                <p className="text-sm text-slate-500">{viewingFvs.code} - {viewingFvs.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = viewingFvs.instructionFile!.base64;
                    link.download = viewingFvs.instructionFile!.name;
                    link.click();
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <i className="fas fa-download"></i> Baixar Word
                </button>
                <button 
                  onClick={() => setIsViewingIs(false)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/30">
              {isRendering && (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-600">Carregando documento...</p>
                </div>
              )}
              <div 
                className={`bg-white shadow-lg mx-auto max-w-[800px] p-8 md:p-12 min-h-full ${isRendering ? 'hidden' : 'block'}`}
              >
                <div ref={viewDocxRef} className="docx-container" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
