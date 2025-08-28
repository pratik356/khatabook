"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddCustomerFormProps {
  onAdd: (customer: { name: string; phone: string }) => void
  onClose: () => void
}

export default function AddCustomerForm({ onAdd, onClose }: AddCustomerFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && phone.trim()) {
      onAdd({ name: name.trim(), phone: phone.trim() })
      setName("")
      setPhone("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="customerName" className="text-base font-semibold">
          ग्राहक का नाम
        </Label>
        <Input
          id="customerName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="उदा., राम शर्मा"
          className="text-lg h-12 mt-1 w-full"
          required
        />
      </div>

      <div>
        <Label htmlFor="customerPhone" className="text-base font-semibold">
          फोन नंबर
        </Label>
        <Input
          id="customerPhone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="9876543210"
          className="text-lg h-12 mt-1 w-full"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-lg bg-transparent">
          रद्द करें
        </Button>
        <Button type="submit" className="flex-1 h-12 text-lg font-bold bg-green-600 hover:bg-green-700">
          ग्राहक जोड़ें
        </Button>
      </div>
    </form>
  )
}
