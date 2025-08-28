export interface Customer {
  id: number
  name: string
  phone: string
  createdAt: string
}

export interface Transaction {
  id: number
  customerId: number
  date: string
  item: string
  amount: number
  type: "due" | "paid"
  note: string
  createdAt: string
}

export interface KhataData {
  customers: Customer[]
  transactions: Transaction[]
  lastUpdated: string
  storeName?: string
}
