"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface AddEntryFormProps {
  type: "due" | "paid"
  onAdd: (data: { item: string; amount: number; date: string; note: string; type: "due" | "paid" }) => void
  onClose: () => void
}

export default function AddEntryForm({ type, onAdd, onClose, open }: AddEntryFormProps & { open?: boolean }) {
  const [itemName, setItemName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0])
    }
  }, [open])

  // Also set date on initial mount if empty
  useEffect(() => {
    if (!date) {
      setDate(new Date().toISOString().split("T")[0])
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Validate date
    const parsedDate = new Date(date)
    const today = new Date()
    today.setHours(0,0,0,0)
    if (!date || isNaN(parsedDate.getTime())) {
      alert('कृपया एक मान्य दिनांक चुनें। (Please select a valid date.)')
      return
    }
    if (parsedDate.setHours(0,0,0,0) > today.getTime()) {
      alert('भविष्य की तिथि स्वीकार्य नहीं है। (Future dates are not allowed.)')
      return
    }
    if (itemName.trim() && amount && Number.parseFloat(amount) > 0) {
      onAdd({
        item: itemName.trim(),
        amount: Number.parseFloat(amount),
        date,
        note: note.trim(),
        type,
      })
      setItemName("")
      setAmount("")
      setDate(new Date().toISOString().split("T")[0])
      setNote("")
      onClose()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs sm:max-w-sm mx-auto rounded-3xl shadow-2xl border border-blue-100 bg-white/70 backdrop-blur-lg p-3 sm:p-6 space-y-3 sm:space-y-5 animate-fade-in"
        style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #e0e7ff 100%)' }}
        autoComplete="off"
      >
        <div className="flex flex-col items-center mb-1 sm:mb-2">
          <div className={`rounded-full p-2 sm:p-4 shadow-lg mb-1 sm:mb-2 ${type === 'due' ? 'bg-red-100' : 'bg-green-100'}`}> 
            {type === 'due' ? (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2.2" /></svg>
            ) : (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2.2" /></svg>
            )}
          </div>
          <div className={`text-lg sm:text-xl font-bold ${type === 'due' ? 'text-red-600' : 'text-green-600'}`}>{type === 'due' ? 'नई बकाया प्रविष्टि' : 'नया भुगतान'}</div>
        </div>
        <div className="relative mb-2">
          <Label htmlFor="itemName" className="block mb-1 text-gray-600 text-sm sm:text-base font-semibold">
          {type === "due" ? "वस्तु का नाम" : "भुगतान विवरण"}
        </Label>
          {type === "paid" ? (
            <select
              id="itemName"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="text-sm sm:text-base h-9 sm:h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80 text-gray-800 pl-4 w-full"
              required
            >
              <option value="" disabled>भुगतान का तरीका चुनें</option>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          ) : (
        <Input
          id="itemName"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
              placeholder=""
              className="text-sm sm:text-base h-9 sm:h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80 text-gray-800 pl-4"
          required
        />
          )}
      </div>
        <div className="relative mb-2">
          <Label htmlFor="amount" className="block mb-1 text-gray-600 text-sm sm:text-base font-semibold">
          राशि ₹
        </Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
            placeholder=""
            className="text-sm sm:text-base h-9 sm:h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80 text-gray-800 pl-4"
          required
        />
      </div>
        <div className="relative">
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
            placeholder=" "
            className="peer text-sm sm:text-base h-9 sm:h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80"
          required
        />
      </div>
        <div className="relative mb-2">
          <Label htmlFor="note" className="block mb-1 text-gray-600 text-sm sm:text-base font-semibold">
          टिप्पणी - वैकल्पिक
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
            placeholder=""
            className="text-sm sm:text-base rounded-xl border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80 min-h-[32px] sm:min-h-[40px] text-gray-800 pl-4"
            rows={2}
        />
      </div>
        <div className="flex gap-2 sm:gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 sm:h-10 text-sm sm:text-base bg-transparent rounded-xl">
          रद्द करें
        </Button>
        <Button
          type="submit"
            className={`flex-1 h-9 sm:h-10 text-sm sm:text-base font-bold rounded-xl shadow-md ${type === "due" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
        >
          {type === "due" ? "बकाया जोड़ें" : "भुगतान जोड़ें"}
        </Button>
      </div>
    </form>
    </div>
  )
}
