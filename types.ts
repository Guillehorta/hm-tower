
export enum LogType {
  IN = 'ENTRADA',
  OUT = 'SAÍDA'
}

export enum UserRole {
  ADMIN = 'Administrador',
  MANAGER = 'Gestor',
  USER = 'Usuário'
}

export interface User {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password?: string;
  companies: string[];
  projects: string[];
  role: UserRole;
  createdAt: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  createdAt: number;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Floor {
  id: string;
  name: string;
  units: Unit[];
}

export interface Block {
  id: string;
  name: string;
  floors: Floor[];
}

export interface ConstructionUnit {
  id: string;
  name: string;
  blocks: Block[];
}

export interface CostService {
  id: string;
  name: string;
  linkedLevel?: 'constructionUnit' | 'block' | 'floor' | 'unit';
  linkedComponentIds?: string[];
}

export interface CostSubStage {
  id: string;
  name: string;
  services: CostService[];
}

export interface CostStage {
  id: string;
  name: string;
  subStages: CostSubStage[];
}

export interface CostCenter {
  id: string;
  name: string;
  stages: CostStage[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  status: 'Ativa' | 'Inativa';
  constructionUnits: ConstructionUnit[];
  costStructure?: CostCenter[];
  fvsMapping?: { [servicePath: string]: string }; // servicePath -> fvsId
  teams?: string[];
  latitude?: number;
  longitude?: number;
  city?: string;
  managerId?: string;
  createdAt: number;
}

export interface WeatherLog {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  morning: {
    temp: number;
    condition: string;
    conditionCode: number;
  };
  afternoon: {
    temp: number;
    condition: string;
    conditionCode: number;
  };
  night: {
    temp: number;
    condition: string;
    conditionCode: number;
  };
  precipitation: number;
  createdAt: number;
}

export interface JobFunction {
  id: string;
  name: string;
  createdAt: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  jobFunction: string;
  department: string;
  company: string;
  projects: string[];
  admissionDate: string;
  cpf: string;
  birthDate: string;
  regime: 'CLT' | 'Diarista' | 'Empreiteiro';
  status: 'Ativo' | 'Inativo';
  photoBase64: string;
  pixKey?: string;
  pixType?: 'CPF' | 'CNPJ' | 'Telefone' | 'Email';
  dailyRate?: number;
  createdAt: number;

  // New fields for Personal Info
  phone?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  cbo?: string;
  salary?: number;
  entryTime?: string;
  exitTime?: string;
  weeklyHours?: number;
  education?: string;
  unionContribution?: boolean;
  clockIn?: boolean;
  advancePayment?: boolean;
  needsVT?: boolean;
  vtTermFilled?: boolean;
  experiencePeriod?: '30+60' | '45+45';
  benefits?: {
    va?: { active: boolean; value: number };
    vm?: { active: boolean; value: number };
  };

  // Documents
  documents?: {
    [key: string]: {
      number?: string;
      fileBase64?: string;
      fileName?: string;
    }
  };

  // Uniforms/EPI
  uniforms?: {
    shoeSize?: string;
    pantsSize?: 'P' | 'M' | 'G' | 'GG';
    shirtSize?: 'P' | 'M' | 'G' | 'GG';
  };
}

export interface MeasurementEntry {
  employeeId: string;
  dailyRate: number;
  daysWorked: number;
  extraValue: number;
  discountValue: number;
}

export interface ContractItem {
  id: string;
  itemNumber: string;
  description: string;
  servicePath: string; // Path like "ccId|sId|ssId|svId"
  unit: string;
  quantity: number;
  unitValue: number;
}

export interface Contract {
  id: string;
  number: string;
  companyId: string;
  projectId: string;
  supplierName: string;
  description: string;
  items: ContractItem[];
  createdAt: number;
}

export interface MeasurementItem {
  contractItemId: string;
  measuredQuantity: number;
  servicePath?: string;
  productivity?: number;
  totalServices?: number;
  extraValue?: number;
}

export interface ExtraMeasurementItem {
  id: string;
  description: string;
  type: 'acréscimo' | 'desconto';
  category: 'Ajuda de custo' | 'Ajuda de transporte' | 'Aluguel' | 'Alimentação' | 'Salário' | 'VA' | 'VT' | 'Desconto' | 'Reembolso';
  stagePath?: string;
  prevAccumulated: number;
  measuredValue: number;
  currentAccumulated: number;
}

export interface ContractMeasurement {
  id: string;
  contractId: string;
  measurementNumber: number;
  date: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  items: MeasurementItem[];
  extraItems?: ExtraMeasurementItem[];
  observations?: string;
  status: 'draft' | 'completed';
  finalizedBy?: string;
  createdAt: number;
}

export interface DailyMeasurement {
  id: string;
  companyName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  dueDate?: string;
  entries: MeasurementEntry[];
  observations?: string;
  status: 'draft' | 'completed';
  createdAt: number;
}

export interface TimeLog {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LogType;
  timestamp: number;
  location: Location;
  capturedPhoto: string;
  verified: boolean;
  confidence: number;
}

export interface LaborTracking {
  id: string;
  employeeId: string; // This will now store either employeeId or supplierId
  executorType: 'Colaborador' | 'Prestador de Serviço';
  projectId: string;
  date: string; // YYYY-MM-DD
  presence?: 'Presente' | 'Ausente';
  team?: string;
  selections: string[]; // Array of paths like "cuId|bId|fId|uId"
  costStructureSelections?: string[]; // Array of paths like "ccId|sId|ssId|svId"
  createdAt: number;
}

export interface RecognitionResult {
  match: boolean;
  employeeId?: string;
  confidence: number;
  message: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  document: string; // CPF or CNPJ
  email: string;
  phone: string;
  contractDate: string;
  openingDate?: string;
  registrationStatus?: 'ATIVA' | 'INAPTA' | 'SUSPENSA' | 'BAIXADA' | 'CANCELADA';
  bankInfo: {
    bank: string;
    agency: string;
    account: string;
    pix: string;
    pixType?: 'CPF' | 'CNPJ' | 'Telefone' | 'Email';
  };
  projects?: string[]; // Added for multi-project consistency
  createdAt: number;
}

export interface FVSSubItem {
  id: string;
  code: string;
  inspectionItem: string;
  tolerance: string;
  equipment: string;
  inspectionMethod: string;
  sampling: string;
  illustration?: string; // Base64 image
}

export interface FVSItem {
  id: string;
  code: string;
  name: string;
  subItems: FVSSubItem[];
}

export interface FVS {
  id: string;
  code: string;
  name: string;
  isControlled: boolean;
  revision: string;
  instructionFile?: {
    name: string;
    base64: string;
  };
  items: FVSItem[];
  createdAt: number;
}

export interface ServiceExecution {
  id: string;
  projectId: string;
  servicePath: string; // ccId|sId|ssId|svId
  componentPath: string; // cuId, cuId|bId, cuId|bId|fId, or cuId|bId|fId|uId
  startDatePlanned?: string;
  endDatePlanned?: string;
  startDateReal?: string;
  endDateReal?: string;
  status?: 'Nao Iniciado' | 'Iniciado' | 'Concluido';
  fvsResults?: {
    [itemId: string]: {
      [subItemId: string]: 'NC' | 'C' | 'NA' | 'CR'; // NC: Não Conforme, C: Conforme, NA: Não Aplicável, CR: Conforme após reinspeção
    }
  };
}

export interface SecullumEmployee {
  id: string; // The Secullum remote ID
  data: any; // Raw JSON from API
  lastImportedAt: number;
  linkedEmployeeId?: string; // ID of the local Employee record if linked
}
