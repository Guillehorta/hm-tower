
import React, { useState, useEffect } from 'react';
import { Supplier, Company, Project } from '../types';
import { storageService } from '../services/storageService';
import { GoogleGenAI } from "@google/genai";
import { ConfirmModal } from './ConfirmModal';

import { maskPhone, maskPix, generateId } from '../src/lib/utils';

interface SuppliersViewProps {
  companies: Company[];
  projects: Project[];
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ companies, projects, onFeedback }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'PF' | 'PJ'>('PJ');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<'ATIVA' | 'INAPTA' | 'SUSPENSA' | 'BAIXADA' | 'CANCELADA'>('ATIVA');
  const [bank, setBank] = useState('');
  const [agency, setAgency] = useState('');
  const [account, setAccount] = useState('');
  const [pix, setPix] = useState('');
  const [pixType, setPixType] = useState<'CPF' | 'CNPJ' | 'Telefone' | 'Email'>('CPF');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDocument = (value: string, type: 'PF' | 'PJ') => {
    const digits = value.replace(/\D/g, '');
    if (type === 'PF') {
      return digits
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return digits
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits
      .slice(0, 11)
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2');
  };

  const validateCPF = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11 || !!digits.match(/(\d)\1{10}/)) return false;
    const values = digits.split('').map(el => +el);
    const rest = (count: number) => {
      return (((values.slice(0, count - 12).reduce((soma, el, i) => soma + el * (count - i), 0) * 10) % 11) % 10);
    };
    return rest(10) === values[9] && rest(11) === values[10];
  };

  const validateCNPJ = (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14 || !!digits.match(/(\d)\1{13}/)) return false;
    const size = digits.length - 2;
    const numbers = digits.substring(0, size);
    const lastDigits = digits.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(lastDigits.charAt(0))) return false;
    sum = 0;
    pos = size - 6;
    for (let i = size + 1; i >= 1; i--) {
      sum += parseInt(digits.charAt(size + 1 - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(lastDigits.charAt(1));
  };

  useEffect(() => {
    const unsub = storageService.subscribeSuppliers(setSuppliers);
    return () => unsub();
  }, []);

  const handleSaveSupplier = async () => {
    if (!name || !document) {
      onFeedback?.('error', 'Por favor, preencha o nome e o documento.');
      return;
    }

    const digits = document.replace(/\D/g, '');
    if (type === 'PF' && digits.length > 0 && !validateCPF(digits)) {
      onFeedback?.('error', 'CPF inválido.');
      return;
    }
    if (type === 'PJ' && digits.length > 0 && !validateCNPJ(digits)) {
      onFeedback?.('error', 'CNPJ inválido.');
      return;
    }

    const newSupplier: Supplier = {
      id: editingSupplier?.id || generateId(),
      name: name.toUpperCase(),
      type,
      document,
      email,
      phone,
      contractDate,
      openingDate,
      registrationStatus,
      bankInfo: {
        bank,
        agency,
        account,
        pix,
        pixType
      },
      projects: selectedProjects,
      createdAt: editingSupplier?.createdAt || Date.now()
    };

    try {
      await storageService.saveSupplier(newSupplier);
      resetForm();
      setIsAddingSupplier(false);
      onFeedback?.('success', editingSupplier ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
    } catch (error) {
      onFeedback?.('error', 'Erro ao salvar fornecedor.');
    }
  };

  const handleDeleteSupplier = () => {
    if (!editingSupplier) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!editingSupplier) return;
    try {
      await storageService.deleteSupplier(editingSupplier.id);
      resetForm();
      setShowDeleteConfirm(false);
      onFeedback?.('success', 'Fornecedor excluído!');
    } catch (error) {
      onFeedback?.('error', 'Erro ao excluir fornecedor.');
    }
  };

  const resetForm = () => {
    setName('');
    setType('PJ');
    setDocument('');
    setEmail('');
    setPhone('');
    setContractDate('');
    setOpeningDate('');
    setRegistrationStatus('ATIVA');
    setBank('');
    setAgency('');
    setAccount('');
    setPix('');
    setPixType('CPF');
    setSelectedProjects([]);
    setEditingSupplier(null);
    setIsAddingSupplier(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64.split(',')[1],
              },
            },
            {
              text: "Extraia os dados deste comprovante de inscrição de CNPJ. Retorne um JSON com os campos: name (Razão Social), document (CNPJ), email (se houver), phone (se houver), openingDate (Data de Abertura no formato YYYY-MM-DD), registrationStatus (Situação Cadastral: ATIVA, INAPTA, SUSPENSA, BAIXADA ou CANCELADA).",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        if (data.name) setName(data.name);
        if (data.document) setDocument(data.document);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.openingDate) setOpeningDate(data.openingDate);
        if (data.registrationStatus) setRegistrationStatus(data.registrationStatus);
        
        setType('PJ');
      }
    } catch (error) {
      console.error('Error extracting data:', error);
      onFeedback?.('error', 'Erro ao extrair dados do arquivo. Por favor, preencha manualmente.');
    } finally {
      setIsExtracting(false);
      // Reset input
      e.target.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setType(s.type);
    setDocument(s.document);
    setEmail(s.email);
    setPhone(s.phone);
    setContractDate(s.contractDate);
    setOpeningDate(s.openingDate || '');
    setRegistrationStatus(s.registrationStatus || 'ATIVA');
    setBank(s.bankInfo.bank);
    setAgency(s.bankInfo.agency);
    setAccount(s.bankInfo.account);
    setPix(s.bankInfo.pix);
    setPixType(s.bankInfo.pixType || 'CPF');
    setSelectedProjects(s.projects || []);
    setIsAddingSupplier(true);
  };

  const filteredSuppliers = suppliers.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.document.includes(term);
  });

  if (isAddingSupplier) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">
            {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">Preenchimento Automático</h4>
                  <p className="text-xs text-indigo-600">Faça upload do comprovante de inscrição CNPJ para preencher os dados automaticamente.</p>
                </div>
                <label className={`px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-indigo-700 transition flex items-center gap-2 ${isExtracting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isExtracting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Processando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-upload"></i> Upload CNPJ
                    </>
                  )}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*,application/pdf" 
                    onChange={handleFileUpload}
                    disabled={isExtracting}
                  />
                </label>
              </div>
            </div>
            
            <label className="block text-sm font-medium text-slate-600 mb-1">Nome do Fornecedor</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
              placeholder="Nome completo ou Razão Social"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Pessoa</label>
            <select 
              value={type} 
              onChange={(e) => {
                const newType = e.target.value as 'PF' | 'PJ';
                setType(newType);
                setDocument(''); // Clear document when type changes
              }} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="PJ">Pessoa Jurídica (CNPJ)</option>
              <option value="PF">Pessoa Física (CPF)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {type === 'PF' ? 'CPF' : 'CNPJ'}
            </label>
            <input 
              type="text" 
              value={document} 
              onChange={(e) => setDocument(formatDocument(e.target.value, type))} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
              placeholder={type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Telefone</label>
            <input 
              type="text" 
              value={phone} 
              onChange={(e) => setPhone(formatPhone(e.target.value))} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Data do Contrato</label>
            <input 
              type="date" 
              value={contractDate} 
              onChange={(e) => setContractDate(e.target.value)} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Data de Abertura</label>
            <input 
              type="date" 
              value={openingDate} 
              onChange={(e) => setOpeningDate(e.target.value)} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Situação Cadastral</label>
            <select 
              value={registrationStatus} 
              onChange={(e) => setRegistrationStatus(e.target.value as any)} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ATIVA">ATIVA</option>
              <option value="INAPTA">INAPTA</option>
              <option value="SUSPENSA">SUSPENSA</option>
              <option value="BAIXADA">BAIXADA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div className="md:col-span-2 mt-4 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2">Obras Vinculadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {projects.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={selectedProjects.includes(p.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProjects(prev => [...prev, p.name]);
                      } else {
                        setSelectedProjects(prev => prev.filter(name => name !== p.name));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Informações Bancárias</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Banco</label>
                <input 
                  type="text" 
                  value={bank} 
                  onChange={(e) => setBank(e.target.value)} 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Agência</label>
                <input 
                  type="text" 
                  value={agency} 
                  onChange={(e) => setAgency(e.target.value)} 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Conta</label>
                <input 
                  type="text" 
                  value={account} 
                  onChange={(e) => setAccount(e.target.value)} 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Chave PIX</label>
                <select 
                  value={pixType} 
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setPixType(newType);
                    setPix(maskPix(pix, newType));
                  }} 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Email">E-mail</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Chave PIX</label>
                <input 
                  type="text" 
                  value={pix} 
                  onChange={(e) => setPix(maskPix(e.target.value, pixType))} 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder={
                    pixType === 'CPF' ? '000.000.000-00' :
                    pixType === 'CNPJ' ? '00.000.000/0000-00' :
                    pixType === 'Telefone' ? '(00) 00000-0000' :
                    'email@exemplo.com'
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button 
            onClick={handleSaveSupplier} 
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg"
          >
            {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
          </button>
          {editingSupplier && (
            <button 
              onClick={handleDeleteSupplier} 
              className="px-8 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition border border-red-100"
            >
              Excluir
            </button>
          )}
          <button 
            onClick={resetForm} 
            className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Consulta de Fornecedores</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAddingSupplier(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <i className="fas fa-plus"></i> Novo Fornecedor
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar por Nome, CPF ou CNPJ</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome, CPF ou CNPJ..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-xl">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
              <tr>
                <th className="px-6 py-3">Fornecedor</th>
                <th className="px-6 py-3">Documento</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Data Contrato</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => handleEdit(s)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{s.name.toUpperCase()}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{s.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{s.document}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600">{s.email}</div>
                      <div className="text-xs text-slate-400">{s.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {s.contractDate ? new Date(s.contractDate).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition flex items-center justify-center"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal 
        isOpen={showDeleteConfirm}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
        onConfirm={confirmDeleteSupplier}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
