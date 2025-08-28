"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Sanscript from '@indic-transliteration/sanscript';
import { Users } from "lucide-react"

interface AddCustomerFormProps {
  onAdd: (customer: { name: string; nameHindi: string; phone: string }) => void
  onClose: () => void
}

// Replace transliterateToHindi with a basic phonetic transliteration for all names
function transliterateToHindi(english: string): string {
  // Use Sanscript for accurate Indian name transliteration
  return Sanscript.t(english, 'itrans', 'devanagari');
}

function capitalizeFirstLetter(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function AddCustomerForm({ onAdd, onClose }: AddCustomerFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneError, setPhoneError] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.trim())) {
      setPhoneError("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें");
      return;
    }
    setPhoneError("");
    if (name.trim() && phone.trim()) {
      const nameEnglish = capitalizeFirstLetter(name.trim());
      const nameHindi = transliterateToHindi(name.trim().toLowerCase());
      onAdd({ name: nameEnglish, nameHindi: nameHindi, phone: phone.trim() });
      setName("");
      setPhone("");
      onClose();
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-100/80 to-blue-50/80 rounded-3xl shadow-2xl border border-blue-200 p-8 max-w-md mx-auto animate-fade-in flex flex-col items-center">
      <div className="bg-blue-200 rounded-full p-4 mb-4 shadow-lg">
        <Users className="h-12 w-12 text-blue-500" />
      </div>
      <div className="text-xl font-bold text-blue-700 mb-2 text-center">नया ग्राहक जोड़ें</div>
      <form onSubmit={handleSubmit} className="w-full space-y-6 mt-2">
        <div className="relative">
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder=" "
            className="peer text-lg h-12 w-full rounded-xl border-2 border-blue-100 bg-white/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all"
          required
        />
          {name.trim() === "" && !nameFocused && (
            <Label htmlFor="name" className="absolute left-3 top-2 text-base font-semibold text-blue-600 bg-white/70 px-1 rounded transition-all pointer-events-none">
              ग्राहक का नाम (English)
            </Label>
          )}
      </div>
        <div className="relative">
        <Input
          id="customerPhone"
          type="tel"
          value={phone}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(val);
            setPhoneError("");
          }}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            placeholder=" "
            className="peer text-lg h-12 w-full rounded-xl border-2 border-blue-100 bg-white/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all"
          required
          maxLength={10}
          pattern="\d{10}"
        />
          {phone.trim() === "" && !phoneFocused && (
            <Label htmlFor="customerPhone" className="absolute left-3 top-2 text-base font-semibold text-blue-600 bg-white/70 px-1 rounded transition-all pointer-events-none">
              फोन नंबर
            </Label>
          )}
        {phoneError && <div className="text-red-600 text-sm mt-1">{phoneError}</div>}
      </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-lg bg-transparent border-blue-200 hover:bg-blue-50">
          रद्द करें
        </Button>
          <Button type="submit" className="flex-1 h-12 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg">
          ग्राहक जोड़ें
        </Button>
      </div>
    </form>
    </div>
  )
}
