"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface AddEntryFormProps {
  type: "due" | "paid"
  onAdd: (data: { item: string; amount: number; date: string; note: string; type: "due" | "paid" }) => void
  onClose: () => void
}

export default function AddEntryForm({ type, onAdd, onClose }: AddEntryFormProps) {
  const [itemName, setItemName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [note, setNote] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (itemName.trim() && amount && Number.parseFloat(amount) > 0) {
      onAdd({
        item: itemName.trim(),
        amount: Number.parseFloat(amount),
        date,
        note: note.trim(),
        type,
      })

      // Reset form
      setItemName("")
      setAmount("")
      setDate(new Date().toISOString().split("T")[0])
      setNote("")
      onClose()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="itemName" className="text-base font-semibold">
          {type === "due" ? "वस्तु का नाम" : "भुगतान विवरण"}
        </Label>
        <Input
          id="itemName"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={type === "due" ? "उदा., चावल 10kg" : "उदा., नकद भुगतान"}
          className="text-lg h-12 mt-1 w-full"
          required
        />
      </div>

      <div>
        <Label htmlFor="amount" className="text-base font-semibold">
          राशि ₹
        </Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="text-lg h-12 mt-1 w-full"
          required
        />
      </div>

      <div>
        <Label htmlFor="date" className="text-base font-semibold">
          दिनांक
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-lg h-12 mt-1 w-full"
          required
        />
      </div>

      <div>
        <Label htmlFor="note" className="text-base font-semibold">
          टिप्पणी - वैकल्पिक
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="अतिरिक्त विवरण..."
          className="text-lg mt-1 w-full"
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-lg bg-transparent">
          रद्द करें
        </Button>
        <Button
          type="submit"
          className={`flex-1 h-12 text-lg font-bold ${
            type === "due" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {type === "due" ? "बकाया जोड़ें" : "भुगतान जोड़ें"}
        </Button>
      </div>
    </form>
  )
}
