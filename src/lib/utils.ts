
export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if randomUUID is missing or throws due to insecure context
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d)(\d{4})$/, '$1-$2');
};

export const maskCPF = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const maskCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

export const maskRG = (value: string) => {
  return value.toUpperCase().replace(/[^0-9X]/g, '').slice(0, 12);
};

export const maskCEP = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const maskPix = (value: string, type: 'CPF' | 'CNPJ' | 'Telefone' | 'Email') => {
  if (type === 'Email') return value;
  
  if (type === 'CPF') return maskCPF(value);
  if (type === 'CNPJ') return maskCNPJ(value);
  if (type === 'Telefone') return maskPhone(value);
  
  return value;
};
