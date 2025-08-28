interface Customer {
  id: number
  name: string
  phone: string
  createdAt: string
  deletedAt?: string // Optional for soft delete
  nameHindi?: string // Hindi display name
  nameEnglish?: string // English name for Google Drive
}

interface Transaction {
  id: number
  customerId: number
  date: string
  item: string
  amount: number
  type: "due" | "paid"
  note: string
  createdAt: string
  deletedAt?: string // Optional for soft delete
}

interface KhataData {
  customers: Customer[]
  transactions: Transaction[]
  deletedCustomers: Customer[]
  deletedTransactions: Transaction[]
  lastUpdated: string
  storeName?: string
}

export type { Customer, Transaction, KhataData }
