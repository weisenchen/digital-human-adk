"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

const languages = [
  { code: 'en-GB', name: 'English' },
  { code: 'cmn-CN', name: 'Mandarin' },
  { code: 'Yue-HK', name: 'Cantonese' },
]

export default function LanguageSelector({ 
    selectedLanguage,
    onLanguageChange
  }: LanguageSelectorProps) {
    return (
        <Select
            value={selectedLanguage}
            onValueChange={(value) => onLanguageChange(value)}
        >
        <SelectTrigger className="w-[160px] bg-white text-[var(--md-on-surface)] border border-[var(--md-outline)] hover:border-[var(--md-primary)] transition-colors duration-[var(--motion-sm)]">
          <Globe className="w-4 h-4 mr-2 text-[var(--md-primary)]" />
          <SelectValue placeholder="Select Language" />
        </SelectTrigger>
        <SelectContent className="bg-white text-[var(--md-on-surface)] border border-[var(--md-outline)]">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="hover:bg-[var(--md-primary)]/8 focus:bg-[var(--md-primary)]/12 cursor-pointer">
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
        </Select>
    );
  }
