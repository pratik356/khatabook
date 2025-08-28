"use client"
import { useState, useEffect } from "react"
import {
  Search,
  Plus,
  User,
  Calendar,
  FileText,
  IndianRupee,
  ArrowLeft,
  UserPlus,
  RefreshCw,
  Trash2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { googleDriveService } from "./google-drive-service"
import type { Customer, Transaction, KhataData } from "./types"
import AddCustomerForm from "./add-customer-form"
import AddEntryForm from "./add-entry-form"

interface KhataAppProps {
  onLogout: () => void
}

export default function KhataApp({ onLogout }: KhataAppProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deletedCustomers, setDeletedCustomers] = useState<any[]>([])
  const [deletedTransactions, setDeletedTransactions] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [homeTab, setHomeTab] = useState("customers") // State for home screen tabs
  const [isAddDueOpen, setIsAddDueOpen] = useState(false)
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isCloudConnected, setIsCloudConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string>("")

  const LOCAL_STORAGE_KEY = "khata-app-offline-data";
  const [isOnline, setIsOnline] = useState(true);
  const [hasUnsyncedData, setHasUnsyncedData] = useState(false);

  // Initialize Google Drive and load data
  useEffect(() => {
    initializeApp()
  }, [])

  // Connectivity state
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // On regaining connectivity, sync unsynced data
  useEffect(() => {
    if (isOnline) {
      const offlineData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        // Merge offline data with current state
        // (You may want to handle merge conflicts more robustly)
        setCustomers(parsed.customers || []);
        setTransactions(parsed.transactions || []);
        // Save to Drive
        saveData();
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setHasUnsyncedData(false);
      }
    }
  }, [isOnline]);

  const initializeApp = async () => {
    setIsLoading(true)
    try {
      const initialized = await googleDriveService.initialize()
      if (initialized) {
        setIsCloudConnected(true)
        await loadData()
      } else {
        // Try to authenticate
        const authenticated = await googleDriveService.authenticate()
        if (authenticated) {
          setIsCloudConnected(true)
          await loadData()
        } else {
          // Load from local storage as fallback
          await loadData()
        }
      }
    } catch (error) {
      console.error("Google Drive सेवा को आरंभ करने में विफल: (Failed to initialize Google Drive service)", error)
      await loadData() // Fallback to local data
    }
    setIsLoading(false)
  }

  const loadData = async () => {
    try {
      const data = await googleDriveService.loadData()
      if (data) {
        setCustomers(data.customers)
        setTransactions(data.transactions)
        setLastSaved(data.lastUpdated)
      }
    } catch (error) {
      console.error("डेटा लोड करने में विफल: (Failed to load data)", error)
    }
  }

  // Modified saveData to handle offline
  const saveData = async () => {
    setIsSaving(true)
    try {
      const data: KhataData = {
        customers,
        transactions,
        deletedCustomers,
        deletedTransactions,
        lastUpdated: new Date().toISOString(),
      }
      if (isOnline) {
        const success = await googleDriveService.saveData(data)
        if (success) {
          setLastSaved(new Date().toISOString())
          setHasUnsyncedData(false)
        } else {
          // If failed to save online, fallback to local
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
          setHasUnsyncedData(true)
        }
      } else {
        // Offline: Save to localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
        setHasUnsyncedData(true)
      }
    } catch (error) {
      console.error("डेटा सहेजने में विफल: (Failed to save data)", error)
      // Always fallback to local
      const data: KhataData = {
        customers,
        transactions,
        deletedCustomers,
        deletedTransactions,
        lastUpdated: new Date().toISOString(),
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
      setHasUnsyncedData(true)
    }
    setIsSaving(false)
  }

  // Auto-save when data changes (debounced)
  useEffect(() => {
    if (customers.length > 0 || transactions.length > 0) {
      const timeoutId = setTimeout(() => {
        saveData()
      }, 2000) // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId)
    }
  }, [customers, transactions])

  // Schedule daily backup
  useEffect(() => {
    const scheduleDailyBackup = () => {
      const now = new Date()
      const lastSavedDate = lastSaved ? new Date(lastSaved) : null

      // Check if last save was on a different day
      if (!lastSavedDate || lastSavedDate.toDateString() !== now.toDateString()) {
        console.log("दैनिक बैकअप किया जा रहा है... (Performing daily backup...)")
        saveData()
      }

      // Calculate time until next midnight
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const timeUntilMidnight = tomorrow.getTime() - now.getTime()

      const timeoutId = setTimeout(() => {
        scheduleDailyBackup() // Re-run the check and schedule for the next day
      }, timeUntilMidnight + 5000) // Add a small buffer (5 seconds) after midnight

      return () => clearTimeout(timeoutId)
    }

    // Run immediately on mount to check for initial daily backup
    const initialTimeout = setTimeout(scheduleDailyBackup, 1000) // Small delay to ensure initial data load

    return () => clearTimeout(initialTimeout)
  }, [lastSaved]) // Depend on lastSaved to re-evaluate schedule

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Get transactions for selected customer
  const customerTransactions = selectedCustomer ? transactions.filter((t) => t.customerId === selectedCustomer.id) : []

  // Calculate totals for selected customer in real-time
  const totalDue = customerTransactions.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
  const totalPaid = customerTransactions.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
  const currentBalance = totalDue - totalPaid

  // Calculate analytics data
  const analyticsData = {
    totalCustomers: customers.length,
    totalDueAmount: customers.reduce((total, customer) => {
      const customerTxns = transactions.filter((t) => t.customerId === customer.id)
      const due = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
      const paid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
      const balance = due - paid
      return total + (balance > 0 ? balance : 0)
    }, 0),
    totalPaidAmount: transactions.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0),
    totalAdvanceAmount: customers.reduce((total, customer) => {
      const customerTxns = transactions.filter((t) => t.customerId === customer.id)
      const due = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
      const paid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
      const balance = due - paid
      return total + (balance < 0 ? Math.abs(balance) : 0)
    }, 0),
    customersWithDue: customers.filter((customer) => {
      const customerTxns = transactions.filter((t) => t.customerId === customer.id)
      const due = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
      const paid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
      return due - paid > 0
    }).length,
    customersWithAdvance: customers.filter((customer) => {
      const customerTxns = transactions.filter((t) => t.customerId === customer.id)
      const due = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
      const paid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
      return due - paid < 0
    }).length,
    totalTransactions: transactions.length,
    thisMonthTransactions: transactions.filter((t) => {
      const transactionDate = new Date(t.date)
      const currentDate = new Date()
      return (
        transactionDate.getMonth() === currentDate.getMonth() &&
        transactionDate.getFullYear() === currentDate.getFullYear()
      )
    }).length,
  }

  // Calculate danger customers (no transactions in 14 days)
  const dangerCustomers = customers.filter((customer) => {
    const customerTxns = transactions.filter((t) => t.customerId === customer.id)

    if (customerTxns.length === 0) {
      // If no transactions at all, consider them dangerous
      return true
    }

    // Get the most recent transaction date
    const mostRecentTransaction = customerTxns.reduce((latest, txn) => {
      return new Date(txn.date) > new Date(latest.date) ? txn : latest
    })

    const daysSinceLastTransaction = Math.floor(
      (new Date().getTime() - new Date(mostRecentTransaction.date).getTime()) / (1000 * 60 * 60 * 24),
    )

    return daysSinceLastTransaction >= 14
  })

  const handleSendMessage = (customer: Customer, balance: number) => {
    const message =
      balance > 0
        ? `नमस्ते ${customer.name}, आपका बकाया ₹${Math.abs(balance).toLocaleString("en-IN")} है। कृपया जल्दी भुगतान करें। धन्यवाद - शर्मा जनरल स्टोर`
        : `नमस्ते ${customer.name}, आपका खाता ₹${Math.abs(balance).toLocaleString("en-IN")} एडवांस में है। धन्यवाद - शर्मा जनरल स्टोर`

    const encodedMessage = encodeURIComponent(message)
    const smsUrl = `sms:${customer.phone}?body=${encodedMessage}`

    // Open the default messaging app
    window.open(smsUrl, "_blank")
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery("")
  }

  const handleBackToCustomers = () => {
    setSelectedCustomer(null)
    setSearchQuery("")
  }

  const handleAddCustomer = (newCustomer: { name: string; phone: string }) => {
    const customer: Customer = {
      id: Date.now(),
      name: newCustomer.name,
      phone: newCustomer.phone,
      createdAt: new Date().toISOString(),
    }
    setCustomers([...customers, customer])
    setSelectedCustomer(customer)
    setIsAddCustomerOpen(false)
  }

  const handleDeleteCustomer = (customerId: number) => {
    const customerToDelete = customers.find((c) => c.id === customerId)
    const customerTransactionsToDelete = transactions.filter((t) => t.customerId === customerId)

    if (customerToDelete) {
      // Add to deleted customers with deletion timestamp
      const deletedCustomer = {
        ...customerToDelete,
        deletedAt: new Date().toISOString(),
      }
      setDeletedCustomers([...deletedCustomers, deletedCustomer])

      // Add customer's transactions to deleted transactions
      const deletedTxns = customerTransactionsToDelete.map((txn) => ({
        ...txn,
        deletedAt: new Date().toISOString(),
      }))
      setDeletedTransactions([...deletedTransactions, ...deletedTxns])

      // Remove from active customers and transactions
      setCustomers(customers.filter((c) => c.id !== customerId))
      setTransactions(transactions.filter((t) => t.customerId !== customerId))

      // If this was the selected customer, go back to home
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(null)
      }
    }
  }

  const handleDeleteTransaction = (transactionId: number) => {
    const transactionToDelete = transactions.find((t) => t.id === transactionId)

    if (transactionToDelete) {
      // Add to deleted transactions with deletion timestamp
      const deletedTransaction = {
        ...transactionToDelete,
        deletedAt: new Date().toISOString(),
      }
      setDeletedTransactions([...deletedTransactions, deletedTransaction])

      // Remove from active transactions
      setTransactions(transactions.filter((t) => t.id !== transactionId))
    }
  }

  const handleRestoreCustomer = (customerId: number) => {
    const customerToRestore = deletedCustomers.find((c) => c.id === customerId)
    const customerTransactionsToRestore = deletedTransactions.filter((t) => t.customerId === customerId)

    if (customerToRestore) {
      // Remove deletedAt property and restore
      const { deletedAt, ...restoredCustomer } = customerToRestore
      setCustomers([...customers, restoredCustomer])

      // Restore customer's transactions
      const restoredTxns = customerTransactionsToRestore.map(({ deletedAt, ...txn }) => txn)
      setTransactions([...transactions, ...restoredTxns])

      // Remove from deleted items
      setDeletedCustomers(deletedCustomers.filter((c) => c.id !== customerId))
      setDeletedTransactions(deletedTransactions.filter((t) => t.id !== customerId))
    }
  }

  const handleRestoreTransaction = (transactionId: number) => {
    const transactionToRestore = deletedTransactions.find((t) => t.id === transactionId)

    if (transactionToRestore) {
      // Remove deletedAt property and restore
      const { deletedAt, ...restoredTransaction } = transactionToRestore
      setTransactions([...transactions, restoredTransaction])

      // Remove from deleted transactions
      setDeletedTransactions(deletedTransactions.filter((t) => t.id !== transactionId))
    }
  }

  const handleAddTransaction = (transactionData: {
    item: string
    amount: number
    date: string
    note: string
    type: "due" | "paid"
  }) => {
    if (!selectedCustomer) return

    const newTransaction = {
      id: Date.now(),
      customerId: selectedCustomer.id,
      date: transactionData.date,
      item: transactionData.item,
      amount: transactionData.amount,
      type: transactionData.type,
      note: transactionData.note,
      createdAt: new Date().toISOString(),
    }

    setTransactions((prevTransactions) => [newTransaction, ...prevTransactions])
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-xl">आपका डेटा लोड हो रहा है...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex flex-col items-center gap-2 mb-6">
          {selectedCustomer && (
            <div className="self-start mb-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleBackToCustomers}
                className="text-white hover:bg-blue-700 p-3 min-w-[48px] min-h-[48px]"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-white font-extrabold text-2xl sm:text-3xl tracking-wide drop-shadow">खाता बुक</span>
          </div>
          {!selectedCustomer && (
            <Button
              variant="ghost"
              size="lg"
              onClick={onLogout}
              className="text-white hover:bg-blue-700 p-3 min-w-[48px] min-h-[48px] mt-2"
            >
              लॉगआउट
            </Button>
          )}
        </div>
        <style>{`
          .animate-fade-in { animation: fadeIn 1.2s cubic-bezier(.28,.84,.42,1) both; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        `}</style>
        {/* Search Bar - Only show when no customer is selected */}
        {!selectedCustomer && homeTab === "customers" && (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
              <Input
                placeholder="ग्राहक का नाम खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 text-xl h-16 bg-white text-black rounded-lg w-full"
              />
            </div>

            {/* Customer Search Results */}
            {searchQuery && (
              <div className="mt-4 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full p-4 text-left hover:bg-gray-100 border-b last:border-b-0 text-black"
                  >
                    <div className="font-semibold text-lg">{customer.name}</div>
                    <div className="text-base text-gray-600">{customer.phone}</div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="p-4 text-center text-gray-500">कोई ग्राहक नहीं मिला</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Home Screen with Tabs */}
      {!selectedCustomer && (
        <div className="p-6">
          <Tabs value={homeTab} onValueChange={setHomeTab} className="w-full">
            <TabsList className="flex overflow-x-auto whitespace-nowrap h-16 mb-6 bg-blue-100 rounded-lg p-2">
              <TabsTrigger
                value="customers"
                className="flex-shrink-0 px-4 py-2 text-base font-bold rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                👥
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="flex-shrink-0 px-4 py-2 text-base font-bold rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                📊
              </TabsTrigger>
              <TabsTrigger
                value="danger"
                className="flex-shrink-0 px-4 py-2 text-base font-bold rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                ⚠️
              </TabsTrigger>
              <TabsTrigger
                value="recycle"
                className="flex-shrink-0 px-4 py-2 text-base font-bold rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                🗑️
              </TabsTrigger>
            </TabsList>

            {/* Customers Tab */}
            <TabsContent value="customers" className="space-y-4">
              {/* Customers List */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-gray-800 mb-4">ग्राहक सूची ({customers.length})</h2>
                {customers.length === 0 ? (
                  <Alert>
                    <AlertDescription>कोई ग्राहक नहीं मिला। कृपया पहले एक ग्राहक जोड़ें।</AlertDescription>
                  </Alert>
                ) : (
                  customers.map((customer) => {
                    const customerTxns = transactions.filter((t) => t.customerId === customer.id)
                    const customerDue = customerTxns
                      .filter((t) => t.type === "due")
                      .reduce((sum, t) => sum + t.amount, 0)
                    const customerPaid = customerTxns
                      .filter((t) => t.type === "paid")
                      .reduce((sum, t) => sum + t.amount, 0)
                    const customerBalance = customerDue - customerPaid

                    return (
                      <Card key={customer.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div
                              className="bg-blue-100 p-3 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center"
                              onClick={() => handleCustomerSelect(customer)}
                            >
                              <User className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0" onClick={() => handleCustomerSelect(customer)}>
                              <div className="font-semibold text-gray-800 text-lg truncate">{customer.name}</div>
                              <div className="text-base text-gray-600">{customer.phone}</div>
                              {customerBalance !== 0 && (
                                <div
                                  className={`text-base font-semibold flex items-center mt-1 ${
                                    customerBalance > 0 ? "text-red-600" : "text-green-600"
                                  }`}
                                >
                                  <IndianRupee className="h-4 w-4 mr-1" />
                                  {Math.abs(customerBalance).toLocaleString("en-IN")}
                                  {customerBalance > 0 ? " (बकाया)" : " (एडवांस)"}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="lg"
                                    className="text-red-600 hover:bg-red-50 min-w-[48px] min-h-[48px] p-3"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>ग्राहक को हटाएं</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      क्या आप वाकई "{customer.name}" को हटाना चाहते हैं? यह ग्राहक और इसके सभी लेन-देन को
                                      रीसाइकल बिन में भेज देगा। आप इसे 30 दिनों के भीतर पुनर्स्थापित कर सकते हैं।
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCustomer(customer.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      हटाएं
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <div
                                className="text-gray-400 text-2xl min-w-[48px] min-h-[48px] flex items-center justify-center"
                                onClick={() => handleCustomerSelect(customer)}
                              >
                                ›
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
              {/* Floating Add Customer FAB */}
              {activeTab === "customers" && (
                <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                  <DialogTrigger asChild>
                    <button
                      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 shadow-lg text-white text-3xl focus:outline-none focus:ring-2 focus:ring-green-400"
                      aria-label="नया ग्राहक जोड़ें"
                    >
                      <UserPlus className="h-8 w-8" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold">नया ग्राहक जोड़ें</DialogTitle>
                    </DialogHeader>
                    <AddCustomerForm onAdd={handleAddCustomer} onClose={() => setIsAddCustomerOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 व्यापार विश्लेषण</h2>

              {/* Overview Cards */}
              <div className="grid grid-cols-1 gap-6">
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-blue-700 text-base font-medium">कुल ग्राहक</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-700">{analyticsData.totalCustomers}</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-purple-700 text-base font-medium">कुल लेन-देन</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-700">{analyticsData.totalTransactions}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Overview */}
              <div className="grid grid-cols-1 gap-6">
                <Card className="border-2 border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-red-700 text-base font-medium">कुल बकाया राशि</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-700 flex items-center">
                      <IndianRupee className="h-7 w-7 mr-2" />
                      {analyticsData.totalDueAmount.toLocaleString("en-IN")}
                    </div>
                    <div className="text-base text-red-600 mt-2">
                      {analyticsData.customersWithDue} ग्राहकों का बकाया है
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-green-700 text-base font-medium">कुल भुगतान राशि</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700 flex items-center">
                      <IndianRupee className="h-7 w-7 mr-2" />
                      {analyticsData.totalPaidAmount.toLocaleString("en-IN")}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-orange-700 text-base font-medium">कुल एडवांस राशि</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-700 flex items-center">
                      <IndianRupee className="h-7 w-7 mr-2" />
                      {analyticsData.totalAdvanceAmount.toLocaleString("en-IN")}
                    </div>
                    <div className="text-base text-orange-600 mt-2">
                      {analyticsData.customersWithAdvance} ग्राहकों ने एडवांस भुगतान किया है
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Stats */}
              <Card className="border-2 border-indigo-200 bg-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-indigo-700 text-base font-medium">इस महीने के लेन-देन</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-700">{analyticsData.thisMonthTransactions}</div>
                  <div className="text-base text-indigo-600 mt-2">
                    {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} में दर्ज किए गए लेन-देन
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Danger Tab */}
            <TabsContent value="danger" className="space-y-6">
              <h2 className="text-xl font-bold text-red-600 mb-4">⚠️ खतरे में ग्राहक</h2>

              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  ये ग्राहक पिछले 14 दिनों से निष्क्रिय हैं। इन्हें संदेश भेजकर संपर्क करें।
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {dangerCustomers.length === 0 ? (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">🎉 बहुत बढ़िया! कोई खतरे में ग्राहक नहीं है।</AlertDescription>
                  </Alert>
                ) : (
                  dangerCustomers.map((customer) => {
                    const customerTxns = transactions.filter((t) => t.customerId === customer.id)
                    const customerDue = customerTxns
                      .filter((t) => t.type === "due")
                      .reduce((sum, t) => sum + t.amount, 0)
                    const customerPaid = customerTxns
                      .filter((t) => t.type === "paid")
                      .reduce((sum, t) => sum + t.amount, 0)
                    const customerBalance = customerDue - customerPaid

                    const lastTransactionDate =
                      customerTxns.length > 0
                        ? customerTxns.reduce((latest, txn) =>
                            new Date(txn.date) > new Date(latest.date) ? txn : latest,
                          ).date
                        : null

                    const daysSinceLastTransaction = lastTransactionDate
                      ? Math.floor(
                          (new Date().getTime() - new Date(lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24),
                        )
                      : "कभी नहीं"

                    return (
                      <Card key={customer.id} className="border-l-4 border-l-red-500 bg-red-50">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="bg-red-100 p-2 rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center">
                                <User className="h-5 w-5 text-red-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-800 text-lg truncate">{customer.name}</div>
                                <div className="text-base text-gray-600">{customer.phone}</div>

                                {customerBalance !== 0 && (
                                  <div
                                    className={`text-base font-semibold flex items-center mt-2 ${
                                      customerBalance > 0 ? "text-red-600" : "text-green-600"
                                    }`}
                                  >
                                    <IndianRupee className="h-4 w-4 mr-1" />
                                    {Math.abs(customerBalance).toLocaleString("en-IN")}
                                    {customerBalance > 0 ? " (बकाया)" : " (एडवांस)"}
                                  </div>
                                )}

                                <div className="text-sm text-red-600 mt-2 bg-red-100 p-2 rounded">
                                  अंतिम लेन-देन:{" "}
                                  {lastTransactionDate ? `${daysSinceLastTransaction} दिन पहले` : "अभी तक कोई लेन-देन नहीं"}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 w-full">
                              <Button
                                onClick={() => handleSendMessage(customer, customerBalance)}
                                size="lg"
                                className="bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold w-full"
                              >
                                📱 संदेश भेजें
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="lg"
                                    className="text-red-600 border-red-300 hover:bg-red-50 bg-transparent h-12 text-base font-semibold w-full"
                                  >
                                    <Trash2 className="h-5 w-5 mr-2" />
                                    ग्राहक हटाएं
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>ग्राहक को हटाएं</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      क्या आप वाकई "{customer.name}" को हटाना चाहते हैं? यह ग्राहक और इसके सभी लेन-देन को
                                      रीसाइकल बिन में भेज देगा। आप इसे 30 दिनों के भीतर पुनर्स्थापित कर सकते हैं।
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCustomer(customer.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      हटाएं
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </TabsContent>

            {/* Recycle Bin Tab */}
            <TabsContent value="recycle" className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🗑️ रीसाइकल बिन</h2>

              {/* Deleted Customers */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">हटाए गए ग्राहक</h3>
                {deletedCustomers.length === 0 ? (
                  <Alert>
                    <AlertDescription>कोई हटाए गए ग्राहक नहीं मिले।</AlertDescription>
                  </Alert>
                ) : (
                  deletedCustomers.map((customer) => {
                    const daysLeft =
                      30 -
                      Math.floor(
                        (new Date().getTime() - new Date(customer.deletedAt).getTime()) / (1000 * 60 * 60 * 24),
                      )

                    return (
                      <Card key={customer.id} className="border-l-4 border-l-red-400">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{customer.name}</div>
                              <div className="text-sm text-gray-600">{customer.phone}</div>
                              <div className="text-xs text-red-600 mt-1">
                                {new Date(customer.deletedAt).toLocaleDateString("en-IN")} को हटाया गया
                                <br />
                                {daysLeft} दिनों में स्वतः हट जाएगा
                              </div>
                            </div>
                            <Button
                              onClick={() => handleRestoreCustomer(customer.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              पुनर्स्थापित करें
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>

              {/* Deleted Transactions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">हटाए गए लेन-देन</h3>
                {deletedTransactions.filter((t) => !deletedCustomers.some((c) => c.id === t.customerId)).length ===
                0 ? (
                  <Alert>
                    <AlertDescription>कोई हटाए गए लेन-देन नहीं मिले।</AlertDescription>
                  </Alert>
                ) : (
                  deletedTransactions
                    .filter((t) => !deletedCustomers.some((c) => c.id === t.customerId))
                    .map((transaction) => {
                      const daysLeft =
                        30 -
                        Math.floor(
                          (new Date().getTime() - new Date(transaction.deletedAt).getTime()) / (1000 * 60 * 60 * 24),
                        )
                      const customer = customers.find((c) => c.id === transaction.customerId)

                      return (
                        <Card key={transaction.id} className="border-l-4 border-l-orange-400">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800">{transaction.item}</div>
                                <div className="text-sm text-gray-600">ग्राहक: {customer?.name || "अज्ञात"}</div>
                                <div className="text-sm text-gray-600 flex items-center">
                                  <IndianRupee className="h-3 w-3 mr-1" />
                                  {transaction.amount.toLocaleString("en-IN")}
                                  <span
                                    className={`ml-2 ${transaction.type === "due" ? "text-red-600" : "text-green-600"}`}
                                  >
                                    ({transaction.type === "due" ? "बकाया" : "भुगतान"})
                                  </span>
                                </div>
                                <div className="text-xs text-orange-600 mt-1">
                                  {new Date(transaction.deletedAt).toLocaleDateString("en-IN")} को हटाया गया
                                  <br />
                                  {daysLeft} दिनों में स्वतः हट जाएगा
                                </div>
                              </div>
                              <Button
                                onClick={() => handleRestoreTransaction(transaction.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                पुनर्स्थापित करें
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      {/* Selected Customer Screen */}
      {selectedCustomer && (
        <>
          {/* Selected Customer Info */}
          <div className="bg-white p-4 shadow-sm border-b">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedCustomer.name}</h2>
                <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-14 mb-6">
                <TabsTrigger value="dashboard" className="text-lg font-bold">
                  📊
                </TabsTrigger>
                <TabsTrigger value="transactions" className="text-lg font-bold">
                  📋
                </TabsTrigger>
              </TabsList>

              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-6">
                {/* Balance Cards */}
                <div className="grid grid-cols-1 gap-4">
                  <Card
                    className={`border-2 ${currentBalance > 0 ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle
                        className={`text-sm font-medium ${currentBalance > 0 ? "text-orange-700" : "text-blue-700"}`}
                      >
                        वर्तमान बैलेंस
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-2xl font-bold flex items-center ${currentBalance > 0 ? "text-orange-700" : "text-blue-700"}`}
                      >
                        <IndianRupee className="h-6 w-6 mr-1" />
                        {Math.abs(currentBalance).toLocaleString("en-IN")}
                        {currentBalance < 0 && <span className="text-sm ml-2">(एडवांस)</span>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-green-700 text-sm font-medium">कुल भुगतान</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-700 flex items-center">
                        <IndianRupee className="h-6 w-6 mr-1" />
                        {totalPaid.toLocaleString("en-IN")}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-red-700 text-sm font-medium">कुल बकाया</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-700 flex items-center">
                        <IndianRupee className="h-6 w-6 mr-1" />
                        {totalDue.toLocaleString("en-IN")}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-4">
                  <Dialog open={isAddDueOpen} onOpenChange={setIsAddDueOpen}>
                    <DialogTrigger asChild>
                      <Button className="h-16 text-lg font-bold bg-red-600 hover:bg-red-700">
                        <Plus className="h-6 w-6 mr-2" />
                        बकाया जोड़ें
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold">बकाया जोड़ें</DialogTitle>
                      </DialogHeader>
                      <AddEntryForm type="due" onAdd={handleAddTransaction} onClose={() => setIsAddDueOpen(false)} />
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                    <DialogTrigger asChild>
                      <Button className="h-16 text-lg font-bold bg-green-600 hover:bg-green-700">
                        <Plus className="h-6 w-6 mr-2" />
                        भुगतान जोड़ें
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold">भुगतान जोड़ें</DialogTitle>
                      </DialogHeader>
                      <AddEntryForm
                        type="paid"
                        onAdd={handleAddTransaction}
                        onClose={() => setIsAddPaymentOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions" className="space-y-4">
                <div className="space-y-3">
                  {customerTransactions.length === 0 ? (
                    <Alert>
                      <AlertDescription>कोई लेन-देन नहीं मिला।</AlertDescription>
                    </Alert>
                  ) : (
                    customerTransactions.map((transaction) => (
                      <Card key={transaction.id} className="border-l-4 border-l-gray-300">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800 mb-1">{transaction.item}</div>
                              <div className="text-sm text-gray-600 flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(transaction.date).toLocaleDateString("en-IN")}
                              </div>
                              {transaction.note && (
                                <div className="text-sm text-gray-500 mt-1 flex items-center">
                                  <FileText className="h-4 w-4 mr-1" />
                                  {transaction.note}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={transaction.type === "due" ? "destructive" : "default"}
                                className={`text-lg font-bold px-3 py-1 ${
                                  transaction.type === "due"
                                    ? "bg-red-100 text-red-700 hover:bg-red-100"
                                    : "bg-green-100 text-green-700 hover:bg-green-100"
                                }`}
                              >
                                <IndianRupee className="h-4 w-4 mr-1" />
                                {transaction.amount.toLocaleString("en-IN")}
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">
                                {transaction.type === "due" ? "बकाया" : "भुगतान"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  )
}
