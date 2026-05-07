import { pgTable, text, timestamp, boolean, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['Administrador', 'Gestor', 'Usuário']);
export const projectStatusEnum = pgEnum('project_status', ['Ativa', 'Inativa']);
export const employeeStatusEnum = pgEnum('employee_status', ['Ativo', 'Inativo']);
export const timeLogTypeEnum = pgEnum('time_log_type', ['ENTRADA', 'SAÍDA']);
export const seStatusEnum = pgEnum('se_status', ['Nao Iniciado', 'Iniciado', 'Concluido']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cpf: text('cpf'),
  phone: text('phone'),
  email: text('email').unique().notNull(),
  password: text('password'),
  role: userRoleEnum('role').notNull().default('Usuário'),
  companies: jsonb('companies').default([]),
  projects: jsonb('projects').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cnpj: text('cnpj').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  code: text('code'),
  name: text('name').notNull(),
  status: projectStatusEnum('status').notNull().default('Ativa'),
  constructionUnits: jsonb('construction_units').default([]),
  costStructure: jsonb('cost_structure').default([]),
  fvsMapping: jsonb('fvs_mapping').default({}),
  teams: jsonb('teams').default([]),
  latitude: text('latitude'),
  longitude: text('longitude'),
  city: text('city'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role'),
  jobFunction: text('job_function'),
  department: text('department'),
  company: text('company'),
  projects: jsonb('projects').default([]),
  admissionDate: text('admission_date'),
  cpf: text('cpf').notNull(),
  status: employeeStatusEnum('status').notNull().default('Ativo'),
  photoBase64: text('photo_base64'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  salary: integer('salary'),
  entryTime: text('entry_time'),
  exitTime: text('exit_time'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobFunctions = pgTable('job_functions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const fvs = pgTable('fvs', {
  id: text('id').primaryKey(),
  code: text('code'),
  name: text('name').notNull(),
  isControlled: boolean('is_controlled').default(false),
  revision: text('revision').notNull(),
  items: jsonb('items').default([]),
  instructionFile: jsonb('instruction_file'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const timeLogs = pgTable('time_logs', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name'),
  type: timeLogTypeEnum('type').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  location: jsonb('location'),
  capturedPhoto: text('captured_photo'),
  verified: boolean('verified').default(false),
  confidence: integer('confidence'),
});

export const serviceExecutions = pgTable('service_executions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  servicePath: text('service_path').notNull(),
  componentPath: text('component_path'),
  status: seStatusEnum('status').default('Nao Iniciado'),
  startDatePlanned: text('start_date_planned'),
  endDatePlanned: text('end_date_planned'),
  startDateReal: text('start_date_real'),
  endDateReal: text('end_date_real'),
  fvsResults: jsonb('fvs_results').default({}),
});

export const weatherLogs = pgTable('weather_logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  date: text('date').notNull(),
  morning: jsonb('morning'),
  afternoon: jsonb('afternoon'),
  night: jsonb('night'),
  precipitation: integer('precipitation'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const laborTracking = pgTable('labor_tracking', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  executorType: text('executor_type'),
  projectId: text('project_id').notNull(),
  date: text('date').notNull(),
  presence: text('presence'),
  team: text('team'),
  selections: jsonb('selections').default([]),
  costStructureSelections: jsonb('cost_structure_selections').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type'),
  document: text('document'),
  email: text('email'),
  phone: text('phone'),
  contractDate: text('contract_date'),
  bankInfo: jsonb('bank_info'),
  projects: jsonb('projects').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contracts = pgTable('contracts', {
  id: text('id').primaryKey(),
  number: text('number'),
  companyId: text('company_id').notNull(),
  projectId: text('project_id').notNull(),
  supplierName: text('supplier_name'),
  description: text('description'),
  items: jsonb('items').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contractMeasurements = pgTable('contract_measurements', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull(),
  measurementNumber: integer('measurement_number'),
  date: text('date'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status'),
  items: jsonb('items').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyMeasurements = pgTable('daily_measurements', {
  id: text('id').primaryKey(),
  companyName: text('company_name'),
  projectName: text('project_name'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status'),
  entries: jsonb('entries').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});
