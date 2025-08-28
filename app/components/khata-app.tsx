"use client"
import { useState, useEffect, useRef } from "react"
import {
  Search,
  Plus,
  User,
  Users,
  Calendar,
  FileText,
  IndianRupee,
  ArrowLeft,
  UserPlus,
  RefreshCw,
  Trash2,
  RotateCcw,
  PieChart,
  Flame,
  ArchiveRestore,
  BarChart,
  ClipboardList,
  Phone, // <-- Add this import
  MessageSquare, // <-- Add this import
  Pencil,
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
import type { Customer, Transaction, KhataData } from "../../components/types"
import AddCustomerForm from "./add-customer-form"
import AddEntryForm from "./add-entry-form"
import { Bar, Pie } from 'react-chartjs-2';
import ChartJS from 'chart.js/auto';
import { CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);
import { toast } from "@/components/ui/use-toast"

interface KhataAppProps {
  onLogout: () => void
  onLogin?: () => void
}

export default function KhataApp({ onLogout, onLogin }: KhataAppProps) {
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
  const [tabHighlight, setTabHighlight] = useState<string | null>(null);
  const [customerToDeleteId, setCustomerToDeleteId] = useState<number | null>(null)
  const [isDeleteAllCustomersOpen, setIsDeleteAllCustomersOpen] = useState(false)
  const [isDeleteAllTransactionsOpen, setIsDeleteAllTransactionsOpen] = useState(false)
  const [permanentDeleteCustomerId, setPermanentDeleteCustomerId] = useState<number | null>(null)
  const [permanentDeleteAllOpen, setPermanentDeleteAllOpen] = useState(false)
  const [isCloudSyncError, setIsCloudSyncError] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [storeName, setStoreName] = useState<string>("");
  const [showStoreNameModal, setShowStoreNameModal] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteCustomerDialog, setShowDeleteCustomerDialog] = useState(false);
  const [wasOnline, setWasOnline] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<string>("");
  const wasOnlineRef = useRef(true);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Refresh Google account info when analytics tab is opened
  useEffect(() => {
    if (homeTab === "analytics") {
      getGoogleAccountInfo();
    }
  }, [homeTab]);

  // Load data on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeApp();
      } catch (error) {
        console.error("❌ App initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("⏰ App initialization timeout, showing app anyway");
      setIsLoading(false);
    }, 10000); // 10 second timeout

    initApp();

    return () => clearTimeout(timeoutId);
  }, []);

  const initializeApp = async () => {
    setIsLoading(true)
    try {
      console.log('🚀 Initializing Khata Book App...');
      
      // Initialize Google Drive service with timeout
      const driveInitPromise = googleDriveService.initialize();
      const driveTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Drive init timeout')), 5000)
      );
      
      try {
        await Promise.race([driveInitPromise, driveTimeoutPromise]);
        setIsCloudConnected(true);
        console.log('✅ Google Drive service initialized');
      } catch (error) {
        console.warn('⚠️ Google Drive initialization failed, continuing with local mode:', error);
        setIsCloudConnected(false);
      }
      
      // Load data with timeout
      const loadDataPromise = loadData();
      const loadTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data load timeout')), 5000)
      );
      
      try {
        await Promise.race([loadDataPromise, loadTimeoutPromise]);
        console.log('✅ Data loaded successfully');
      } catch (error) {
        console.warn('⚠️ Data loading failed, using empty state:', error);
        // Set empty data to prevent black screen
        setCustomers([]);
        setTransactions([]);
        setDeletedCustomers([]);
        setDeletedTransactions([]);
      }
      
      // Check Google account status (non-blocking)
      getGoogleAccountInfo().catch(error => {
        console.warn('⚠️ Google account info check failed:', error);
      });
      
      console.log('✅ App initialization complete');
    } catch (error) {
      console.error("❌ App initialization error:", error);
      // Set empty data to prevent black screen
      setCustomers([]);
      setTransactions([]);
      setDeletedCustomers([]);
      setDeletedTransactions([]);
    }
  }

  // Function to ensure we have the most recent data
  const ensureLatestData = async () => {
    try {
      console.log('🔍 Checking for most recent data...');
      
      // Check if we have any data loaded
      if (customers.length === 0 && transactions.length === 0) {
        console.log('📝 No data found, ensuring initial structure exists...');
        
        // Create initial data structure if none exists
        const initialData: KhataData = {
          customers: [],
          transactions: [],
          deletedCustomers: [],
          deletedTransactions: [],
          lastUpdated: new Date().toISOString(),
          storeName: storeName || undefined
        };
        
        const saveSuccess = await googleDriveService.saveData(initialData);
        
        if (saveSuccess) {
          console.log('✅ Initial data structure ensured');
        } else {
          console.error('❌ Failed to ensure initial data structure');
        }
      } else {
        console.log('✅ Data already loaded, no action needed');
      }
    } catch (error) {
      console.error('❌ Error ensuring latest data:', error);
    }
  };

  const getGoogleAccountInfo = async () => {
    try {
      const token = localStorage.getItem('khata_google_drive_token');
      const authFlag = localStorage.getItem('khata_auth');
      
      if (!token || authFlag !== 'true') {
        console.log("No valid Google authentication found");
        setGoogleAccount("Not Connected");
        return;
      }
      
      // Always try to get the actual email from Google API
      console.log("Fetching Google account info with token:", token.substring(0, 10) + "...");
      
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log("Google API response status:", response.status);
      
      if (response.ok) {
        const userInfo = await response.json();
        console.log("Google user info received:", userInfo);
        if (userInfo.email) {
          setGoogleAccount(userInfo.email);
        } else if (userInfo.name) {
          setGoogleAccount(userInfo.name);
        } else {
          setGoogleAccount("Google Account Connected");
        }
      } else {
        const errorText = await response.text();
        console.error("Google API error:", errorText);
        setGoogleAccount("Google Account Connected");
      }
      
    } catch (error) {
      console.error("Failed to get Google account info:", error);
      setGoogleAccount("Not Connected");
    }
  }

  // Function to call after successful login
  const onSuccessfulLogin = async () => {
    // Wait a bit for the token to be stored
    setTimeout(async () => {
      await getGoogleAccountInfo();
      // Call the parent's onLogin callback if provided
      if (onLogin) {
        onLogin();
      }
    }, 2000); // Increased delay to ensure token is properly set
  }

  const loadData = async (retry = false) => {
    try {
      console.log('🔄 Starting to load all data from Google Drive...');
      
      // First, try to load from Google Drive
      let data = await googleDriveService.loadData();
      
      if (!data) {
        console.log('❌ No data found in Google Drive, checking authentication...');
        
        // Check if user is authenticated
        const token = localStorage.getItem("khata_google_drive_token");
        const authFlag = localStorage.getItem("khata_auth");
        
        if (!token || authFlag !== "true") {
          console.log('❌ User not authenticated, cannot access Google Drive');
          toast({ 
            title: "Authentication Required", 
            description: "Google Drive access requires authentication. Please log in first.", 
            duration: 6000, 
            variant: "destructive" 
          });
          return;
        }
        
        // Try to load from local storage as fallback
        console.log('🔄 Trying to load from local storage as fallback...');
        const localData = localStorage.getItem('khata_local_data');
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            console.log('✅ Found data in local storage:', parsedData);
            data = parsedData;
          } catch (parseError) {
            console.error('❌ Failed to parse local storage data:', parseError);
          }
        }
        
        if (!data) {
          console.log('❌ No data found anywhere, creating initial data structure...');
          
          // Create initial data structure if no data exists
          const initialData: KhataData = {
            customers: [],
            transactions: [],
            deletedCustomers: [],
            deletedTransactions: [],
            lastUpdated: new Date().toISOString(),
            storeName: undefined
          };
          
          console.log('📝 Creating initial data structure:', initialData);
          
          // Save the initial data to Google Drive
          const saveSuccess = await googleDriveService.saveData(initialData);
          
          if (saveSuccess) {
            console.log('✅ Initial data structure created successfully');
            data = initialData;
          } else {
            console.error('❌ Failed to create initial data structure');
            toast({ title: "Setup Error", description: "प्रारंभिक डेटा बनाने में समस्या आई। (Failed to create initial data)", duration: 6000, variant: "destructive" });
            return;
          }
        }
      }
      
      // Load ALL data at once from Google Drive
      console.log('✅ Loading complete data from Google Drive:', {
        storeName: data.storeName,
        customersCount: data.customers?.length || 0,
        transactionsCount: data.transactions?.length || 0,
        deletedCustomersCount: data.deletedCustomers?.length || 0,
        deletedTransactionsCount: data.deletedTransactions?.length || 0,
        lastUpdated: data.lastUpdated
      });
      
      // Set all data simultaneously
      setCustomers(data.customers || []);
      setTransactions(data.transactions || []);
      setDeletedCustomers(data.deletedCustomers || []);
      setDeletedTransactions(data.deletedTransactions || []);
      setLastSaved(data.lastUpdated || "");
      
      // Set store name
      if (data.storeName) {
        console.log('🏪 Setting store name from loaded data:', data.storeName);
        setStoreName(data.storeName);
        setShowStoreNameModal(false); // Ensure modal is closed if we have a store name
      } else {
        // Check if we have a store name in local storage as fallback
        const localStoreName = localStorage.getItem('khata_store_name');
        if (localStoreName) {
          console.log('🏪 Setting store name from local storage:', localStoreName);
          setStoreName(localStoreName);
          setShowStoreNameModal(false);
        } else {
          console.log('🏪 No store name found, showing setup modal');
          setShowStoreNameModal(true);
        }
      }
      
      console.log('✅ All data loaded successfully from Google Drive');
      
      // Check Google account status after successful data load
      await getGoogleAccountInfo();
      
    } catch (error) {
      console.error("❌ Failed to load data from Google Drive:", error);
      toast({ title: "Google Drive", description: "डेटा लोड करने में विफल: (Failed to load data)", duration: 6000, variant: "destructive" });
    }
  }

  const saveData = async (isAutoSync = false): Promise<boolean> => {
    setIsSaving(true)
    if (isAutoSync) {
      setIsAutoSyncing(true)
    }
    try {
      console.log(`💾 Starting to save ALL data to Google Drive... ${isAutoSync ? '(Auto-sync)' : '(Manual sync)'}`);
      
      const data: KhataData = {
        customers,
        transactions,
        deletedCustomers,
        deletedTransactions,
        lastUpdated: new Date().toISOString(),
        storeName,
      }
      
      console.log('📊 Saving complete data to Google Drive:', {
        customersCount: data.customers.length,
        transactionsCount: data.transactions.length,
        deletedCustomersCount: data.deletedCustomers.length,
        deletedTransactionsCount: data.deletedTransactions.length,
        storeName: data.storeName,
        lastUpdated: data.lastUpdated
      });
      
      const success = await googleDriveService.saveData(data)
      console.log('✅ Save result:', success);
      
      // Save local copy as backup
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('khata_local_data', JSON.stringify(data));
          console.log('💾 Local backup saved');
        } catch (localError) {
          console.error('❌ Failed to save local backup:', localError);
        }
      }
      
      // Always upload CSV after saving JSON
      try {
        const csvSuccess = await googleDriveService.uploadDailyCsv(data);
        if (csvSuccess) {
          console.log('📄 CSV uploaded to Google Drive');
        } else {
          console.error('❌ CSV upload failed');
        }
      } catch (csvErr) {
        console.error('❌ CSV upload error:', csvErr);
      }
      
      setIsCloudSyncError(!success);
      if (success) {
        setLastSaved(new Date().toISOString())
        console.log('✅ All data saved successfully to Google Drive');
        // Only show toast for manual sync, not auto-sync
        if (!isAutoSync) {
          toast({ title: "Sync Success", description: "डेटा Google Drive पर सफलतापूर्वक सहेजा गया।", duration: 4000, variant: "default" })
        }
      } else {
        console.log('❌ Failed to save data to Google Drive');
        // Always show error toast for both manual and auto-sync
        toast({ title: "Sync Failed", description: "डेटा Google Drive पर सहेजने में समस्या आई।", duration: 4000, variant: "destructive" })
      }
      
      return success;
    } catch (error) {
      setIsCloudSyncError(true);
      console.error("❌ Failed to save data:", error)
      toast({ title: "Sync Error", description: "डेटा Google Drive पर सहेजने में त्रुटि आई।", duration: 4000, variant: "destructive" })
      return false;
    } finally {
      setIsSaving(false)
      if (isAutoSync) {
        setIsAutoSyncing(false)
      }
    }
  }

  // Schedule daily backup and auto-sync every 5 minutes
  useEffect(() => {
    const scheduleDailyBackup = () => {
      const now = new Date()
      const lastSavedDate = lastSaved ? new Date(lastSaved) : null

      // Check if last save was on a different day
      if (!lastSavedDate || lastSavedDate.toDateString() !== now.toDateString()) {
        console.log("दैनिक बैकअप किया जा रहा है... (Performing daily backup...)")
        saveData(true) // Pass true to indicate this is auto-sync
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

    // Auto-sync every 5 minutes
    const autoSyncInterval = setInterval(() => {
      if (isOnline && !isSaving) {
        console.log("🔄 Auto-sync triggered (every 5 minutes)...")
        saveData(true) // Pass true to indicate this is auto-sync
      }
    }, 5 * 60 * 1000) // 5 minutes in milliseconds

    // Run immediately on mount to check for initial daily backup
    const initialTimeout = setTimeout(scheduleDailyBackup, 1000) // Small delay to ensure initial data load

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(autoSyncInterval)
    }
  }, [lastSaved, isOnline, isSaving]) // Depend on lastSaved, isOnline, and isSaving to re-evaluate schedule

  const handleStoreNameSubmit = async () => {
    if (!storeNameInput.trim()) return;
    const newName = storeNameInput.trim();
    setStoreName(newName);
    setShowStoreNameModal(false);

    // Save store name to local storage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem('khata_store_name', newName);
    }

    console.log('🏪 Saving store name and ALL data to Google Drive:', { 
      storeName: newName,
      customersCount: customers.length,
      transactionsCount: transactions.length
    });

    // Save to Drive with updated store name and all current data
    const data: KhataData = {
      customers,
      transactions,
      deletedCustomers,
      deletedTransactions,
      lastUpdated: new Date().toISOString(),
      storeName: newName,
    };
    
    try {
      await googleDriveService.saveData(data);
      console.log('✅ Store name and all data saved successfully to Google Drive');
      toast({ title: "Store Name Saved", description: "स्टोर का नाम सफलतापूर्वक सहेजा गया।", duration: 4000 });
    } catch (error) {
      console.error('❌ Failed to save store name:', error);
      toast({ title: "Save Failed", description: "स्टोर का नाम सहेजने में समस्या आई।", duration: 4000, variant: "destructive" });
    }
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      customer.name.toLowerCase().includes(q) ||
      (customer.nameHindi && customer.nameHindi.toLowerCase().includes(q)) ||
      (customer.phone && customer.phone.toLowerCase().includes(q))
    );
  })

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
        ? `नमस्ते ${customer.name}, आपका बकाया ₹${Math.abs(balance).toLocaleString("en-IN") } है। कृपया जल्दी भुगतान करें। धन्यवाद - शर्मा जनरल स्टोर`
        : `नमस्ते ${customer.name}, आपका खाता ₹${Math.abs(balance).toLocaleString("en-IN") } एडवांस में है। धन्यवाद - शर्मा जनरल स्टोर`

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

  const handleAddCustomer = (newCustomer: { name: string; nameHindi: string; phone: string }) => {
    const customer: Customer = {
      id: Date.now(),
      name: newCustomer.name,
      nameHindi: newCustomer.nameHindi,
      phone: newCustomer.phone,
      createdAt: new Date().toISOString(),
    }
    setCustomers((prev) => {
      // Add new customer at the beginning of the list
      const updated = [customer, ...prev];
      setTimeout(saveData, 0);
      return updated;
    });
    setSelectedCustomer(customer)
    setActiveTab('dashboard')
    setIsAddCustomerOpen(false)
    setTabHighlight('dashboard');
    setTimeout(() => setTabHighlight(null), 1000);
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
      setDeletedCustomers((prev) => {
        const updated = [...prev, deletedCustomer];
        setTimeout(saveData, 0);
        return updated;
      });

      // Add customer's transactions to deleted transactions
      const deletedTxns = customerTransactionsToDelete.map((txn) => ({
        ...txn,
        deletedAt: new Date().toISOString(),
      }))
      setDeletedTransactions((prev) => {
        const updated = [...prev, ...deletedTxns];
        setTimeout(saveData, 0);
        return updated;
      });

      // Remove from active customers and transactions
      setCustomers((prev) => {
        const updated = prev.filter((c) => c.id !== customerId);
        setTimeout(saveData, 0);
        return updated;
      });
      setTransactions((prev) => {
        const updated = prev.filter((t) => t.customerId !== customerId);
        setTimeout(saveData, 0);
        return updated;
      });

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
      setDeletedTransactions((prev) => {
        const updated = [...prev, deletedTransaction];
        setTimeout(saveData, 0);
        return updated;
      });

      // Remove from active transactions
      setTransactions((prev) => {
        const updated = prev.filter((t) => t.id !== transactionId);
        setTimeout(saveData, 0);
        return updated;
      });
    }
  }

  const handleRestoreCustomer = (customerId: number) => {
    const customerToRestore = deletedCustomers.find((c) => c.id === customerId)
    const customerTransactionsToRestore = deletedTransactions.filter((t) => t.customerId === customerId)

    if (customerToRestore) {
      // Remove deletedAt property and restore
      const { deletedAt, ...restoredCustomer } = customerToRestore
      setCustomers((prev) => {
        // Add restored customer at the beginning of the list
        const updated = [restoredCustomer, ...prev];
        setTimeout(saveData, 0);
        return updated;
      });

      // Restore customer's transactions
      const restoredTxns = customerTransactionsToRestore.map(({ deletedAt, ...txn }) => txn)
      setTransactions((prev) => {
        // Add restored transactions at the beginning of the list
        const updated = [...restoredTxns, ...prev];
        setTimeout(saveData, 0);
        return updated;
      });

      // Remove from deleted items
      setDeletedCustomers((prev) => {
        const updated = prev.filter((c) => c.id !== customerId);
        setTimeout(saveData, 0);
        return updated;
      });
      setDeletedTransactions((prev) => {
        const updated = prev.filter((t) => t.customerId !== customerId);
        setTimeout(saveData, 0);
        return updated;
      });
    }
  }

  const handleRestoreTransaction = (transactionId: number) => {
    const transactionToRestore = deletedTransactions.find((t) => t.id === transactionId)

    if (transactionToRestore) {
      // Remove deletedAt property and restore
      const { deletedAt, ...restoredTransaction } = transactionToRestore
      setTransactions((prev) => {
        // Add restored transaction at the beginning of the list
        const updated = [restoredTransaction, ...prev];
        setTimeout(saveData, 0);
        return updated;
      });
      setDeletedTransactions((prev) => {
        const updated = prev.filter((t) => t.id !== transactionId);
        setTimeout(saveData, 0);
        return updated;
      });
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

    setTransactions((prevTransactions) => {
      const updated = [newTransaction, ...prevTransactions];
      setTimeout(saveData, 0);
      return updated;
    });
  }

  const handleDeleteAllCustomers = () => {
    if (customers.length === 0) return;
    // Move all customers and their transactions to deleted
    const now = new Date().toISOString();
    const deleted = customers.map(c => ({ ...c, deletedAt: now }))
    const deletedTxns = transactions.map(t => ({ ...t, deletedAt: now }))
    setDeletedCustomers((prev) => {
      const updated = [...prev, ...deleted];
      setTimeout(saveData, 0);
      return updated;
    });
    setDeletedTransactions((prev) => {
      const updated = [...prev, ...deletedTxns];
      setTimeout(saveData, 0);
      return updated;
    });
    setCustomers([])
    setTransactions([])
    setSelectedCustomer(null)
    setIsDeleteAllCustomersOpen(false)
  }
  const handleDeleteAllTransactions = () => {
    if (!selectedCustomer) return;
    const now = new Date().toISOString();
    const txnsToDelete = transactions.filter(t => t.customerId === selectedCustomer.id)
    const deletedTxns = txnsToDelete.map(t => ({ ...t, deletedAt: now }))
    setDeletedTransactions((prev) => {
      const updated = [...prev, ...deletedTxns];
      setTimeout(saveData, 0);
      return updated;
    });
    setTransactions(transactions.filter(t => t.customerId !== selectedCustomer.id))
    setIsDeleteAllTransactionsOpen(false)
  }

  const handlePermanentDeleteCustomer = (customerId: number) => {
    setDeletedCustomers((prev) => {
      const updated = prev.filter((c) => c.id !== customerId);
      setTimeout(saveData, 0);
      return updated;
    });
    setCustomers((prev) => {
      const updated = prev.filter((c) => c.id !== customerId);
      setTimeout(saveData, 0);
      return updated;
    });
    setDeletedTransactions((prev) => {
      const updated = prev.filter((t) => t.customerId !== customerId);
      setTimeout(saveData, 0);
      return updated;
    });
    setPermanentDeleteCustomerId(null);
  };

  const handlePermanentDeleteAllCustomers = () => {
    setDeletedCustomers([])
    setDeletedTransactions([])
    setPermanentDeleteAllOpen(false)
  }

  // Update setTransactions and setCustomers to always save the latest state
  const updateAndSave = (newCustomers: Customer[], newTransactions: Transaction[], newDeletedCustomers = deletedCustomers, newDeletedTransactions = deletedTransactions) => {
    console.log('Saving to Drive:', {
      customers: newCustomers,
      deletedCustomers: newDeletedCustomers,
      transactions: newTransactions,
      deletedTransactions: newDeletedTransactions
    });
    saveDataWithState(newCustomers, newDeletedCustomers, newTransactions, newDeletedTransactions);
  };

  const saveDataWithState = (
    customersToSave: Customer[],
    deletedCustomersToSave: Customer[],
    transactionsToSave: Transaction[],
    deletedTransactionsToSave: Transaction[]
  ) => {
    setIsSaving(true)
    try {
      console.log('💾 Saving state data to Google Drive:', {
        customersCount: customersToSave.length,
        transactionsCount: transactionsToSave.length,
        deletedCustomersCount: deletedCustomersToSave.length,
        deletedTransactionsCount: deletedTransactionsToSave.length,
        storeName: storeName
      });
      
      const data: KhataData = {
        customers: customersToSave,
        deletedCustomers: deletedCustomersToSave,
        transactions: transactionsToSave,
        deletedTransactions: deletedTransactionsToSave,
        lastUpdated: new Date().toISOString(),
        storeName,
      }
      
      googleDriveService.saveData(data).then(success => {
        setIsCloudSyncError(!success);
        if (success) {
          setLastSaved(new Date().toISOString())
          console.log('✅ State data saved successfully to Google Drive');
          toast({ title: "Sync Success", description: "डेटा Google Drive पर सफलतापूर्वक सहेजा गया।", duration: 4000, variant: "default" })
        } else {
          console.log('❌ Failed to save state data to Google Drive');
          toast({ title: "Sync Failed", description: "डेटा Google Drive पर सहेजने में समस्या आई।", duration: 4000, variant: "destructive" })
        }
        setIsSaving(false)
      });
    } catch (error) {
      setIsCloudSyncError(true);
      console.error("❌ Failed to save state data:", error)
      toast({ title: "Sync Error", description: "डेटा Google Drive पर सहेजने में त्रुटि आई।", duration: 4000, variant: "destructive" })
      setIsSaving(false)
    }
  };

  // Connectivity state
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine && wasOnlineRef.current) {
        wasOnlineRef.current = false;
      }
      if (navigator.onLine && !wasOnlineRef.current) {
        wasOnlineRef.current = true;
        // Internet restored: immediately upload data to Drive
        setTimeout(saveData, 0);
      }
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Add useEffect to show the offline dialog automatically when internet is lost (only once per disconnect)
  useEffect(() => {
    if (!isOnline && wasOnlineRef.current) {
      setShowOfflineDialog(true);
      wasOnlineRef.current = false;
    }
    if (isOnline && !wasOnlineRef.current) {
      wasOnlineRef.current = true;
      setShowOfflineDialog(false);
    }
  }, [isOnline]);

  // Auto-sync when user returns to the app (tab focus, app visibility change)
  useEffect(() => {
    let wasHidden = false;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the app/tab
        wasHidden = true;
        console.log('👋 User left the app/tab');
      } else if (wasHidden) {
        // User returned to the app/tab
        wasHidden = false;
        console.log('🔄 User returned to app/tab - triggering auto-sync');
        
        // Only sync if we're online and not already saving
        if (isOnline && !isSaving) {
          // Small delay to ensure the app is fully focused
          setTimeout(() => {
            console.log('🔄 Auto-sync triggered due to app focus');
            saveData(true); // true = auto-sync
          }, 500);
        }
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for window focus events (for when user switches back to the browser)
    const handleWindowFocus = () => {
      if (wasHidden) {
        wasHidden = false;
        console.log('🔄 User returned to browser window - triggering auto-sync');
        
        if (isOnline && !isSaving) {
          setTimeout(() => {
            console.log('🔄 Auto-sync triggered due to window focus');
            saveData(true); // true = auto-sync
          }, 500);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOnline, isSaving]);

  // Sync button click handler
  const handleSyncClick = () => {
    if (!isOnline) {
      setShowOfflineDialog(true);
      return;
    }
    console.log('🔄 Manual sync triggered by user');
    saveData();
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-xl">आपका डेटा लोड हो रहा है...</div>
          <div className="text-sm mt-2 opacity-75">Loading your data...</div>
          <div className="text-xs mt-4 opacity-50">This may take a few seconds</div>
        </div>
      </div>
    )
  }

  // --- Modern Professional Header ---
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header with gradient, wave, and modern layout */}
      <div className="relative z-10">
        {/* Gradient Header */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-400 shadow-lg rounded-b-3xl pb-8 pt-6 px-4 flex flex-col items-stretch">
          <div className="flex items-center justify-between">
            {/* Logo and App Name */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">📖</span>
              <div className="flex flex-col">
                <span className="text-white font-extrabold text-2xl sm:text-3xl tracking-wide drop-shadow">खाता बुक</span>
                <span className="text-blue-100 text-xs font-medium mt-0.5 flex items-center gap-1">
                  {storeName || "Sharma General Store"}
                  <button
                    className="ml-1 p-1 rounded hover:bg-blue-200/30 transition"
                    title="नाम संपादित करें"
                    onClick={() => { setStoreNameInput(storeName); setShowStoreNameModal(true); }}
                    style={{ lineHeight: 0 }}
                  >
                    <Pencil className="h-4 w-4 text-blue-200 hover:text-blue-400" />
                  </button>
                </span>
              </div>
            </div>
            {/* Sync & Logout Buttons */}
            <div className="flex items-center gap-2">
              {/* Cloud Sync Status */}
              <div className="relative">
                <Button
                  size="icon"
                  variant="ghost"
                  className={`rounded-full ${!isOnline ? 'bg-red-600 text-white cursor-not-allowed' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                  onClick={handleSyncClick}
                  disabled={isSaving || !isOnline}
                  title={isAutoSyncing ? "Auto-syncing..." : "Sync now"}
                  aria-label={isAutoSyncing ? "Auto-syncing..." : "Sync now"}
                >
                  {isSaving ? (
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  ) : (
                    <RefreshCw className="h-6 w-6" />
                  )}
                </Button>
                {/* Status Dot */}
                <span className={`absolute top-1 right-1 block w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-300 ${
                  isAutoSyncing ? 'bg-blue-400 animate-pulse' : isSaving ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
                }`} />
              </div>
              

              <Button size="icon" variant="ghost" onClick={() => setShowLogoutDialog(true)} className="rounded-full bg-white/20 hover:bg-white/30 text-white">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </div>
          </div>
          {/* Last Saved Time */}
          <div className="text-blue-100 text-xs text-right mt-2">
            {isAutoSyncing ? (
              <span className="text-blue-200 animate-pulse">🔄 Auto-syncing...</span>
            ) : (
              <>
                अंतिम सहेजा गया: {lastSaved ? new Date(lastSaved).toLocaleTimeString('en-IN') : '—'}
                <span className="ml-2 text-blue-200">• Auto-sync every 5 min</span>
              </>
            )}
          </div>
        </div>
        {/* Wave Divider */}
        <div className="-mt-2">
          <svg viewBox="0 0 500 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8">
            <path d="M0 20 Q125 40 250 20 T500 20 V40 H0Z" fill="#3b82f6" fillOpacity="0.15" />
          </svg>
        </div>
        {/* Overlapping Search Bar (only on customers tab, no customer selected) */}
        {!selectedCustomer && homeTab === "customers" && (
          <div className="absolute left-0 right-0 mx-auto -bottom-7 flex justify-center z-20">
            <div className="w-full max-w-xl px-4 relative">
              <div className="flex items-center bg-white rounded-xl shadow-lg border-2 border-blue-100 px-4 py-2">
                <Search className="h-5 w-5 text-blue-400 mr-2" />
                <Input
                  ref={searchInputRef}
                  placeholder="ग्राहक का नाम खोजें..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border-none shadow-none focus:ring-0 text-lg bg-transparent"
                />
              </div>
              {/* Live search suggestions */}
              {searchQuery.trim() && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-blue-100 z-30 max-h-60 overflow-y-auto animate-fade-in">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => { handleCustomerSelect(customer); setSearchQuery(""); }}
                    >
                      <User className="h-6 w-6 text-blue-400" />
                      <span className="font-semibold text-base text-gray-800 truncate">{customer.name}</span>
                      {customer.nameHindi && <span className="text-blue-500 text-sm ml-1">({customer.nameHindi})</span>}
                      <span className="text-sm text-blue-700 ml-auto font-normal tracking-wide">{customer.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Spacer for search bar overlap */}
      {!selectedCustomer && homeTab === "customers" && <div className="h-10" />}
      {/* Home Screen with Bottom Nav Bar */}
      {!selectedCustomer && (
        <div className="p-6 pb-32">
          {homeTab === "customers" && (
            <>
              {/* Customers List */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-gray-800 mb-4">ग्राहक सूची ({customers.length})</h2>
                {customers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center bg-blue-50/80 rounded-2xl shadow-xl border border-blue-100 p-8 my-8 mx-auto max-w-md animate-fade-in">
                    <div className="bg-blue-100 rounded-full p-4 mb-4 shadow">
                      <Users className="h-12 w-12 text-blue-400" />
                    </div>
                    <div className="text-lg font-bold text-blue-700 mb-1 text-center">कोई ग्राहक नहीं मिला</div>
                    <div className="text-base text-blue-500 text-center">कृपया पहले एक ग्राहक जोड़ें।</div>
                  </div>
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
                      <Card key={customer.id} className="cursor-pointer transition-shadow bg-blue-50/60 rounded-xl shadow-sm p-2 border-l-4 border-blue-300 hover:shadow-lg hover:border-blue-500 hover:-translate-y-0.5 flex items-center group">
                        <CardContent className="p-2 flex-1 min-w-0" onClick={() => handleCustomerSelect(customer)}>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="font-semibold text-base text-gray-800 truncate">
                              {customer.name}{customer.nameHindi ? <span className="text-blue-400 text-sm ml-1">({customer.nameHindi})</span> : null}
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold mt-0.5">
                              <IndianRupee className={`h-4 w-4 ${customerBalance > 0 ? 'text-red-500' : customerBalance < 0 ? 'text-green-500' : 'text-gray-400'}`} />
                              <span className={customerBalance > 0 ? 'text-red-600' : customerBalance < 0 ? 'text-green-600' : 'text-gray-500'}>
                                {Math.abs(customerBalance).toLocaleString("en-IN")}
                                {customerBalance > 0 ? ' बकाया' : customerBalance < 0 ? ' एडवांस' : ''}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        <Button size="icon" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50 rounded-full" onClick={(e) => { e.stopPropagation(); setCustomerToDeleteId(customer.id); setShowDeleteCustomerDialog(true); }} aria-label="ग्राहक हटाएं">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </Card>
                    )
                  })
                )}
              </div>
              {/* Floating Add Customer FAB - only one, only on customers tab */}
            </>
          )}
          {/* Analytics Tab */}
          {homeTab === "analytics" && (
            <>
              {/* Blue Gradient Header with Icon, Google Account, and Last Updated */}
              <div className="relative rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 p-6 mb-6 shadow-lg animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <PieChart className="h-8 w-8 text-white drop-shadow animate-bounce" />
                    <span className="text-white font-extrabold text-2xl tracking-wide drop-shadow">एनालिटिक्स</span>
                  </div>
                  <span className="text-blue-100 text-xs font-medium">अपडेट: {lastSaved ? new Date(lastSaved).toLocaleTimeString('en-IN') : '—'}</span>
                </div>
                {/* Google Account Information */}
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 backdrop-blur-sm">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <span className="text-white text-sm font-medium truncate">
                    {googleAccount || (localStorage.getItem('khata_google_drive_token') ? "Google Account Connected" : "Not Connected")}
                  </span>
                </div>
              </div>
              {/* First 4 Cards in 2x2 Grid */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Total Customers */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-blue-400 hover:scale-105 transition-transform animate-fade-in">
                  <Users className="h-7 w-7 text-blue-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-blue-700">{analyticsData.totalCustomers}</div>
                  <div className="text-sm font-semibold text-blue-500 mt-1">कुल ग्राहक</div>
                </div>
                {/* Total Transactions */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-purple-400 hover:scale-105 transition-transform animate-fade-in delay-75">
                  <FileText className="h-7 w-7 text-purple-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-purple-700">{analyticsData.totalTransactions}</div>
                  <div className="text-sm font-semibold text-purple-500 mt-1">कुल लेन-देन</div>
                </div>
                {/* Total Due */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-red-400 hover:scale-105 transition-transform animate-fade-in delay-100">
                  <IndianRupee className="h-7 w-7 text-red-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-red-700">₹{analyticsData.totalDueAmount.toLocaleString('en-IN')}</div>
                  <div className="text-sm font-semibold text-red-500 mt-1">कुल बकाया</div>
                  <div className="text-xs text-red-400 mt-1">{analyticsData.customersWithDue} ग्राहक</div>
                </div>
                {/* Total Paid */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-green-400 hover:scale-105 transition-transform animate-fade-in delay-150">
                  <IndianRupee className="h-7 w-7 text-green-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-green-700">₹{analyticsData.totalPaidAmount.toLocaleString('en-IN')}</div>
                  <div className="text-sm font-semibold text-green-500 mt-1">कुल भुगतान</div>
                </div>
              </div>
              {/* Charts Section */}
              <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl p-6 mb-8 flex flex-col gap-8 border-t-4 border-blue-300 animate-fade-in delay-200">
                <div className="flex items-center gap-3 mb-4">
                  <PieChart className="h-6 w-6 text-blue-400" />
                  <span className="font-bold text-blue-700 text-lg">लेन-देन ग्राफ</span>
                </div>
                {/* Bar Chart: Monthly Transactions */}
                <div className="w-full h-48 flex items-center justify-center">
                  <Bar
                    data={{
                      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                      datasets: [
                        {
                          label: 'लेन-देन',
                          data: [12, 19, 3, 5, 2, 3, 7, 8, 6, 10, 4, 9], // Replace with real data if available
                          backgroundColor: '#3b82f6',
                          borderRadius: 8,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { x: { grid: { display: false } }, y: { grid: { color: '#e0e7ff' } } },
                    }}
                  />
                </div>
                {/* Pie Chart: Due/Paid/Advance */}
                <div className="w-full h-48 flex items-center justify-center">
                  <Pie
                    data={{
                      labels: ['बकाया', 'भुगतान', 'एडवांस'],
                      datasets: [
                        {
                          data: [analyticsData.totalDueAmount, analyticsData.totalPaidAmount, analyticsData.totalAdvanceAmount],
                          backgroundColor: ['#3b82f6', '#10b981', '#f59e42'],
                          borderWidth: 2,
                          borderColor: '#fff',
                        },
                      ],
                    }}
                    options={{
                      plugins: { legend: { display: true, position: 'bottom' } },
                    }}
                  />
                </div>
                {/* Chart Legend */}
                <div className="flex flex-wrap gap-4 justify-center mt-2 text-xs">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> बकाया</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> भुगतान</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> एडवांस</div>
                </div>
              </div>
              {/* Last 2 Cards in 1x2 Grid */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Total Advance */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-orange-400 hover:scale-105 transition-transform animate-fade-in delay-200">
                  <IndianRupee className="h-7 w-7 text-orange-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-orange-700">₹{analyticsData.totalAdvanceAmount.toLocaleString('en-IN')}</div>
                  <div className="text-sm font-semibold text-orange-500 mt-1">कुल एडवांस</div>
                  <div className="text-xs text-orange-400 mt-1">{analyticsData.customersWithAdvance} ग्राहक</div>
                </div>
                {/* This Month's Transactions */}
                <div className="rounded-2xl bg-white/70 backdrop-blur shadow-xl p-6 flex flex-col items-center border-t-4 border-indigo-400 hover:scale-105 transition-transform animate-fade-in delay-300">
                  <Calendar className="h-7 w-7 text-indigo-500 mb-1 animate-pulse" />
                  <div className="text-3xl font-bold text-indigo-700">{analyticsData.thisMonthTransactions}</div>
                  <div className="text-sm font-semibold text-indigo-500 mt-1">इस महीने के लेन-देन</div>
                </div>
              </div>
              {/* Decorative Blue Wave Divider at Bottom */}
              <div className="-mb-8">
                <svg viewBox="0 0 500 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8">
                  <path d="M0 20 Q125 40 250 20 T500 20 V40 H0Z" fill="#3b82f6" fillOpacity="0.10" />
                </svg>
              </div>
            </>
          )}
          {/* Danger Tab */}
          {homeTab === "danger" && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#b91c1c', marginBottom: 16 }}>डेंजर ग्राहक</h2>
              {dangerCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-red-50/80 rounded-2xl shadow-xl border border-red-100 p-8 my-8 mx-auto max-w-md animate-fade-in">
                  <div className="bg-red-100 rounded-full p-4 mb-4 shadow">
                    <Flame className="h-12 w-12 text-red-400" />
                  </div>
                  <div className="text-lg font-bold text-red-700 mb-1 text-center">कोई डेंजर ग्राहक नहीं</div>
                  <div className="text-base text-red-500 text-center">सभी ग्राहक सक्रिय हैं।</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {dangerCustomers.map((customer) => {
                    const customerTxns = transactions.filter((t) => t.customerId === customer.id)
                    const customerDue = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0)
                    const customerPaid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0)
                    const customerBalance = customerDue - customerPaid
                    const message = `नमस्ते ${customer.name}, आपका बकाया ₹${Math.abs(customerBalance).toLocaleString("en-IN")} है। कृपया जल्दी भुगतान करें। धन्यवाद - ${storeName || "शर्मा जनरल स्टोर"}`;
                    return (
                      <div key={customer.id} className="flex items-center bg-white rounded-xl shadow-sm border-l-4 border-red-400 px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base text-gray-800 truncate">
                            {customer.name}{customer.nameHindi ? <span className="text-blue-400 text-sm ml-1">({customer.nameHindi})</span> : null}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{customer.phone}</div>
                          <div className="flex items-center gap-1 text-xs font-bold mt-0.5">
                            <IndianRupee className="h-4 w-4 text-red-500" />
                            <span className="text-red-600">{Math.abs(customerBalance).toLocaleString("en-IN")} बकाया</span>
                          </div>
                        </div>
                        <a
                          href={`sms:${customer.phone}?body=${encodeURIComponent(message)}`}
                          className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 mr-2"
                          aria-label="Send Message"
                        >
                          <MessageSquare className="h-6 w-6" />
                        </a>
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 hover:bg-green-200 text-green-600"
                          aria-label="Call Customer"
                        >
                          <Phone className="h-6 w-6" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {/* Recycle Bin Tab */}
          {homeTab === "recycle" && (
            <>
              <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center gap-2"><ArchiveRestore className="h-7 w-7 text-gray-400" /> रीसायकल बिन</h2>
              <div>
                <div className="font-semibold text-base text-gray-600 mb-2 flex items-center justify-between">
                  <span>डिलीटेड ग्राहक:</span>
                  {deletedCustomers.length > 0 && (
                    <Button size="sm" variant="destructive" className="rounded-xl px-3 py-1 flex items-center gap-1" onClick={() => setPermanentDeleteAllOpen(true)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {deletedCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center bg-gray-50/80 rounded-2xl shadow-xl border border-gray-200 p-8 my-8 mx-auto max-w-md animate-fade-in">
                    <div className="bg-gray-200 rounded-full p-4 mb-4 shadow">
                      <ArchiveRestore className="h-12 w-12 text-gray-400" />
                    </div>
                    <div className="text-lg font-bold text-gray-700 mb-1 text-center">कोई डिलीटेड ग्राहक नहीं</div>
                    <div className="text-base text-gray-500 text-center">रीसायकल बिन खाली है।</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deletedCustomers.map((customer) => (
                      <div key={customer.id} className="relative flex items-center bg-white/80 rounded-xl shadow-md border-l-4 border-red-300 px-4 py-3 gap-3 overflow-hidden animate-fade-in">
                        <div className="absolute right-2 top-2 opacity-10 pointer-events-none select-none">
                          <Trash2 className="h-16 w-16 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base text-gray-800 truncate">
                            {customer.name}{customer.nameHindi ? <span className="text-blue-400 text-sm ml-1">({customer.nameHindi})</span> : null}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{customer.phone}</div>
                        </div>
                        <Button size="icon" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50 rounded-full" onClick={() => handleRestoreCustomer(customer.id)} aria-label="रीस्टोर">
                          <ArchiveRestore className="h-5 w-5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="ml-2 rounded-full" onClick={() => setPermanentDeleteCustomerId(customer.id)} aria-label="स्थायी हटाएं">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {/* Bottom Navigation Bar - Edge-to-Edge, Stretched, Modern */}
      {!selectedCustomer && (
        <nav
          className="fixed left-0 right-0 bottom-0 z-40 bg-white/80 shadow-2xl backdrop-blur-lg border-t border-blue-200 py-2"
          style={{
            pointerEvents: 'auto',
            minHeight: '64px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            WebkitBackdropFilter: 'blur(16px)',
            backdropFilter: 'blur(16px)',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            bottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="relative flex items-center justify-between w-full px-2 gap-x-2">
            {/* Customers Tab */}
            <button
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 ${homeTab === "customers" ? "bg-blue-600 text-white scale-105 ring-2 ring-blue-200" : "bg-white text-blue-600"}`}
              onClick={() => setHomeTab("customers")}
              aria-label="ग्राहक टैब"
            >
              <Users className="h-6 w-6" />
            </button>
            {/* Analytics Tab */}
            <button
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 ${homeTab === "analytics" ? "bg-blue-600 text-white scale-105 ring-2 ring-blue-200" : "bg-white text-blue-600"} mr-8`}
              onClick={() => setHomeTab("analytics")}
              aria-label="एनालिटिक्स टैब"
            >
              <PieChart className="h-6 w-6" />
            </button>
            {/* Centered Add User Button (absolute center, floating) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-2 flex items-end justify-center">
              <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                <DialogTrigger asChild>
                  <button
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 shadow-2xl text-white border-4 border-white z-50 transition-transform duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 -mt-7"
                    aria-label="नया ग्राहक जोड़ें"
                    style={{
                      pointerEvents: 'auto',
                      boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.25)',
                      border: '4px solid #fff',
                    }}
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
            </div>
            {/* Danger Tab */}
            <button
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400 ${homeTab === "danger" ? "bg-pink-600 text-white scale-105 ring-2 ring-pink-200" : "bg-white text-pink-500"} ml-8`}
              onClick={() => setHomeTab("danger")}
              aria-label="डेंजर टैब"
            >
              <Flame className="h-6 w-6" />
            </button>
            {/* Recycle Bin Tab */}
            <button
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 ${homeTab === "recycle" ? "bg-gray-700 text-white scale-105 ring-2 ring-gray-300" : "bg-white text-gray-600"}`}
              onClick={() => setHomeTab("recycle")}
              aria-label="रिसायकल बिन टैब"
            >
              <ArchiveRestore className="h-6 w-6" />
            </button>
          </div>
        </nav>
      )}
      {/* Selected Customer Screen as before... */}
      {selectedCustomer && (
        <>
          {/* Header with back button and customer info */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-400 shadow-lg rounded-b-3xl pb-8 pt-6 px-4 flex flex-col items-stretch">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="lg" onClick={handleBackToCustomers} className="text-white hover:bg-blue-700 p-3 min-w-[48px] min-h-[48px]">
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="flex flex-col flex-1">
                <span className="text-white font-extrabold text-2xl sm:text-3xl tracking-wide drop-shadow">{selectedCustomer.name}{selectedCustomer.nameHindi ? <span className="text-blue-100 text-base ml-2">({selectedCustomer.nameHindi})</span> : null}</span>
                <span className="text-blue-100 text-xs font-medium mt-0.5">{selectedCustomer.phone}</span>
              </div>
              <a
                href={`tel:${selectedCustomer.phone}`}
                className="ml-2 flex items-center justify-center w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 shadow-lg text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-300"
                style={{ textDecoration: 'none' }}
                aria-label="Call Customer"
              >
                <Phone className="w-7 h-7" />
              </a>
            </div>
          </div>
          {/* Main Content: Dashboard and Transactions Tabs */}
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex w-full justify-center gap-8 p-0 mb-2 bg-transparent">
                <TabsTrigger value="dashboard" className="flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 data-[state=active]:!bg-blue-600 data-[state=active]:!text-white !active:bg-blue-600 !focus:bg-blue-600 !active:text-white !focus:text-white">
                  <PieChart className="h-8 w-8" />
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 data-[state=active]:!bg-blue-600 data-[state=active]:!text-white !active:bg-blue-600 !focus:bg-blue-600 !active:text-white !focus:text-white">
                  <FileText className="h-8 w-8" />
                </TabsTrigger>
              </TabsList>
              <div className="mt-8" />
              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className={`space-y-4 transition-all duration-500 ${tabHighlight === 'dashboard' ? 'ring-4 ring-green-300 bg-green-50/40 animate-pulse' : ''}`}> 
                {/* Add Due and Paid Buttons */}
                <div className="flex gap-3 mb-2 w-full">
                  <Dialog open={isAddDueOpen} onOpenChange={setIsAddDueOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex-1 h-12 text-base font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md">
                        <Plus className="h-5 w-5 mr-2" /> बकाया जोड़ें
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
                      <Button className="flex-1 h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md">
                        <Plus className="h-5 w-5 mr-2" /> भुगतान जोड़ें
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold">भुगतान जोड़ें</DialogTitle>
                      </DialogHeader>
                      <AddEntryForm type="paid" onAdd={handleAddTransaction} onClose={() => setIsAddPaymentOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
                {/* Shorter Modern Balance Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className={`rounded-2xl shadow-xl border-t-4 p-3 flex flex-col items-center hover:scale-105 transition-transform animate-fade-in delay-150 min-h-[110px] ${currentBalance > 0 ? 'bg-orange-50/80 border-orange-300' : 'bg-blue-50/80 border-blue-300'}`}> 
                    <IndianRupee className={`h-7 w-7 mb-1 animate-pulse ${currentBalance > 0 ? 'text-orange-500' : 'text-blue-500'}`} />
                    <div className={`text-xl font-bold ${currentBalance > 0 ? 'text-orange-700' : 'text-blue-700'}`}>{Math.abs(currentBalance).toLocaleString('en-IN')}</div>
                    <div className={`text-sm font-semibold mt-0.5 ${currentBalance > 0 ? 'text-orange-500' : 'text-blue-500'}`}>वर्तमान बैलेंस {currentBalance < 0 && <span className="text-xs ml-2">(एडवांस)</span>}</div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-green-100/80 to-green-50/80 shadow-xl border-t-4 border-green-300 p-3 flex flex-col items-center hover:scale-105 transition-transform animate-fade-in delay-75 min-h-[110px]">
                    <IndianRupee className="h-7 w-7 text-green-500 mb-1 animate-pulse" />
                    <div className="text-xl font-bold text-green-700">₹{totalPaid.toLocaleString('en-IN')}</div>
                    <div className="text-sm font-semibold text-green-500 mt-0.5">कुल भुगतान</div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-red-100/80 to-red-50/80 shadow-xl border-t-4 border-red-300 p-3 flex flex-col items-center hover:scale-105 transition-transform animate-fade-in min-h-[110px]">
                    <IndianRupee className="h-7 w-7 text-red-500 mb-1 animate-pulse" />
                    <div className="text-xl font-bold text-red-700">₹{totalDue.toLocaleString('en-IN')}</div>
                    <div className="text-sm font-semibold text-red-500 mt-0.5">कुल बकाया</div>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Removed Add Due and Add Payment buttons from here */}
                </div>
              </TabsContent>
              {/* Transactions Tab */}
              <TabsContent value="transactions" className={`space-y-4 transition-all duration-500 ${tabHighlight === 'transactions' ? 'ring-4 ring-green-300 bg-green-50/40 animate-pulse' : ''}`}> 
                {customerTransactions.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="destructive"
                      className="rounded-xl px-4 py-2 font-bold flex items-center gap-2 shadow"
                      onClick={() => setIsDeleteAllTransactionsOpen(true)}
                    >
                      <Trash2 className="h-5 w-5" />
                      सभी लेन-देन हटाएं
                    </Button>
                  </div>
                )}
                <div className="space-y-3">
                  {customerTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-blue-50/80 rounded-2xl shadow-xl border border-blue-100 p-8 my-8 mx-auto max-w-md animate-fade-in">
                      <div className="bg-blue-100 rounded-full p-4 mb-4 shadow">
                        <ClipboardList className="h-12 w-12 text-blue-400" />
                      </div>
                      <div className="text-lg font-bold text-blue-700 mb-1 text-center">कोई लेन-देन नहीं मिला</div>
                      <div className="text-base text-blue-500 text-center">यहाँ आपके लेन-देन दिखाई देंगे।</div>
                    </div>
                  ) : (
                    customerTransactions.map((transaction) => (
                      <div key={transaction.id} className={`bg-white rounded-xl shadow-sm flex flex-col gap-1 p-2 border-l-4 ${transaction.type === 'due' ? 'border-red-400' : 'border-green-400'} animate-fade-in min-h-[48px]`}> 
                        <div className="flex items-center gap-2">
                          {transaction.type === 'due' ? (
                            <IndianRupee className="h-5 w-5 text-red-400" />
                          ) : (
                            <IndianRupee className="h-5 w-5 text-green-400" />
                          )}
                          <div className="font-medium text-sm flex-1 truncate text-gray-800">{transaction.item}</div>
                          <span className={`text-base font-bold ${transaction.type === 'due' ? 'text-red-600' : 'text-green-600'}`}>{transaction.amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                          <Calendar className="h-4 w-4 mr-1" />
                          {(() => {
                            const d = new Date(transaction.date);
                            return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
                          })()}
                          {transaction.note && (
                            <>
                              <FileText className="h-4 w-4 ml-2 mr-1 text-blue-300" />
                              <span className="text-gray-400 truncate">{transaction.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
      {/* Confirmation Dialog for Delete */}
      <AlertDialog open={customerToDeleteId !== null} onOpenChange={open => { if (!open) setCustomerToDeleteId(null) }}>
        <AlertDialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <Trash2 className="h-10 w-10 text-red-500 mb-2" />
            <AlertDialogTitle className="text-xl font-bold text-gray-800 mb-1">ग्राहक हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-500 mb-4">यह ग्राहक 30 दिन में पुनर्स्थापित किया जा सकता है।</AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex justify-center gap-3 mt-2">
            <AlertDialogCancel className="rounded-xl px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (customerToDeleteId !== null) { handleDeleteCustomer(customerToDeleteId); setCustomerToDeleteId(null); } }} className="rounded-xl px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow">हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isDeleteAllCustomersOpen} onOpenChange={setIsDeleteAllCustomersOpen}>
        <AlertDialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <Trash2 className="h-10 w-10 text-red-500 mb-2" />
            <AlertDialogTitle className="text-xl font-bold text-gray-800 mb-1">सभी ग्राहक हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-500 mb-4">यह सभी ग्राहक और उनके लेन-देन 30 दिन में पुनर्स्थापित किए जा सकते हैं।</AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex justify-center gap-3 mt-2">
            <AlertDialogCancel className="rounded-xl px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllCustomers} className="rounded-xl px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow">सभी हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isDeleteAllTransactionsOpen} onOpenChange={setIsDeleteAllTransactionsOpen}>
        <AlertDialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <Trash2 className="h-10 w-10 text-red-500 mb-2" />
            <AlertDialogTitle className="text-xl font-bold text-gray-800 mb-1">सभी लेन-देन हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-500 mb-4">यह ग्राहक के सभी लेन-देन 30 दिन में पुनर्स्थापित किए जा सकते हैं।</AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex justify-center gap-3 mt-2">
            <AlertDialogCancel className="rounded-xl px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllTransactions} className="rounded-xl px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow">सभी हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={permanentDeleteCustomerId !== null} onOpenChange={open => { if (!open) setPermanentDeleteCustomerId(null) }}>
        <AlertDialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <Trash2 className="h-10 w-10 text-red-500 mb-2" />
            <AlertDialogTitle className="text-xl font-bold text-gray-800 mb-1">ग्राहक को स्थायी रूप से हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-500 mb-4">यह ग्राहक और उसके सभी लेनदेन स्थायी रूप से हटा दिए जाएंगे। यह क्रिया पूर्ववत नहीं की जा सकती।</AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex justify-center gap-3 mt-2">
            <AlertDialogCancel className="rounded-xl px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={() => handlePermanentDeleteCustomer(permanentDeleteCustomerId!)} className="rounded-xl px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow">स्थायी हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={permanentDeleteAllOpen} onOpenChange={setPermanentDeleteAllOpen}>
        <AlertDialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <Trash2 className="h-10 w-10 text-red-500 mb-2" />
            <AlertDialogTitle className="text-xl font-bold text-gray-800 mb-1">सभी डिलीटेड ग्राहक स्थायी रूप से हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-500 mb-4">{deletedCustomers.length} ग्राहक और उनके सभी लेनदेन स्थायी रूप से हटा दिए जाएंगे। यह क्रिया पूर्ववत नहीं की जा सकती।</AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex justify-center gap-3 mt-2">
            <AlertDialogCancel className="rounded-xl px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDeleteAllCustomers} className="rounded-xl px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow">स्थायी हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center animate-fade-in">
            <div className="bg-blue-100 rounded-full p-4 mb-4 shadow">
              <ArrowLeft className="h-8 w-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-blue-700 mb-2 text-center">क्या आप लॉगआउट करना चाहते हैं?</h2>
            <p className="text-blue-500 text-sm mb-6 text-center">लॉगआउट करने के बाद आपको फिर से लॉगिन करना होगा।</p>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-semibold transition"
                onClick={() => setShowLogoutDialog(false)}
              >रद्द करें</button>
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={async () => {
                  setShowLogoutDialog(false);
                  
                  // Show sync in progress
                  setIsSaving(true);
                  
                  try {
                    console.log('🔄 Auto-syncing data before logout...');
                    
                    // Save all current data to Google Drive
                    const success = await saveData();
                    
                    if (success) {
                      console.log('✅ Data synced successfully before logout');
                      toast({ 
                        title: "Sync Complete", 
                        description: "डेटा सफलतापूर्वक सहेजा गया। (Data saved successfully)", 
                        duration: 2000 
                      });
                    } else {
                      console.log('❌ Failed to sync data before logout');
                      toast({ 
                        title: "Sync Failed", 
                        description: "डेटा सहेजने में समस्या आई। (Failed to save data)", 
                        duration: 3000, 
                        variant: "destructive" 
                      });
                    }
                  } catch (error) {
                    console.error('❌ Error during logout sync:', error);
                    toast({ 
                      title: "Sync Error", 
                      description: "लॉगआउट के दौरान त्रुटि आई। (Error during logout)", 
                      duration: 3000, 
                      variant: "destructive" 
                    });
                  } finally {
                    // Always logout after sync attempt (success or failure)
                    setIsSaving(false);
                    onLogout();
                    window.location.reload();
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    सिंक हो रहा है...
                  </div>
                ) : (
                  'लॉगआउट'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Decorative Ocean Wave at Bottom */}
      {!selectedCustomer && (
        <div className="fixed left-0 right-0 bottom-16 z-30 pointer-events-none select-none">
          <svg viewBox="0 0 500 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-10">
            <path d="M0 20 Q125 40 250 20 T500 20 V40 H0Z" fill="#3b82f6" fillOpacity="0.12" />
          </svg>
        </div>
      )}
      {showStoreNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center border-t-8 border-blue-400 animate-fade-in">
            <div className="bg-blue-200 rounded-full p-4 mb-4 shadow-lg">
              <span className="text-4xl">🏪</span>
            </div>
            <h2 className="text-2xl font-extrabold text-blue-700 mb-2 text-center drop-shadow">अपने स्टोर का नाम दर्ज करें</h2>
            <p className="text-blue-500 text-sm mb-6 text-center">यह नाम आपके होम स्क्रीन पर दिखेगा और Google Drive में सेव रहेगा।</p>
            <input
              className="border-2 border-blue-200 rounded-xl px-4 py-3 w-full mb-4 text-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition bg-white"
              placeholder="जैसे: शर्मा जनरल स्टोर"
              value={storeNameInput}
              onChange={e => setStoreNameInput(e.target.value)}
              autoFocus
              maxLength={40}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold w-full text-lg shadow-md transition disabled:opacity-60"
              onClick={handleStoreNameSubmit}
              disabled={!storeNameInput.trim()}
            >
              सहेजें और आगे बढ़ें
            </button>
          </div>
        </div>
      )}
      {/* Customer Delete Confirmation Dialog */}
      {showDeleteCustomerDialog && customerToDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center animate-fade-in">
            <div className="bg-red-100 rounded-full p-4 mb-4 shadow">
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2 text-center">क्या आप इस ग्राहक को हटाना चाहते हैं?</h2>
            <p className="text-red-500 text-sm mb-6 text-center">यह ग्राहक और उसके लेन-देन 30 दिन में पुनर्स्थापित किए जा सकते हैं।</p>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-semibold transition"
                onClick={() => { setShowDeleteCustomerDialog(false); setCustomerToDeleteId(null); }}
              >रद्द करें</button>
              <button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition"
                onClick={() => { handleDeleteCustomer(customerToDeleteId!); setShowDeleteCustomerDialog(false); setCustomerToDeleteId(null); }}
              >हटाएं</button>
            </div>
          </div>
        </div>
      )}
      {showOfflineDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center animate-fade-in">
            <div className="bg-red-100 rounded-full p-4 mb-4 shadow">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2 text-center">इंटरनेट कनेक्शन नहीं है</h2>
            <p className="text-red-500 text-sm mb-6 text-center">डेटा स्थानीय रूप से सेव किया जाएगा और कनेक्शन मिलते ही Google Drive पर अपलोड होगा।</p>
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold w-full text-lg shadow-md transition"
              onClick={() => setShowOfflineDialog(false)}
            >OK</button>
          </div>
        </div>
      )}
    </div>
  )
} 