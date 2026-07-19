'use client';

import { useEffect, useRef, useState } from 'react';

const COMMON_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];

type EmailInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Prepared for future institution/organization-specific domain suggestions - merged with the common list, never replacing it. */
  additionalDomains?: string[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  required?: boolean;
};

/**
 * The one reusable email input for the whole app: after the user types
 * "@", a dropdown offers common domain completions (gmail.com,
 * outlook.com, hotmail.com, yahoo.com, icloud.com, plus any
 * additionalDomains) built from whatever the user already typed after
 * "@" - selecting one never discards the local part before "@". Full
 * keyboard support (Arrow Up/Down to move, Enter to select, Escape to
 * dismiss) and mouse selection both work; typing a domain that isn't in
 * the list and never selecting a suggestion is always allowed - there is
 * no restriction to the suggested set. The input is forced `dir="ltr"`
 * regardless of the surrounding RTL page, since an email address is a
 * left-to-right token and must never visually reverse.
 */
export function EmailInput({
  value,
  onChange,
  additionalDomains = [],
  placeholder,
  ariaLabel,
  className,
  required,
}: EmailInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const atIndex = value.indexOf('@');
  const localPart = atIndex >= 0 ? value.slice(0, atIndex) : value;
  const domainQuery = atIndex >= 0 ? value.slice(atIndex + 1) : '';

  const allDomains = Array.from(new Set([...COMMON_EMAIL_DOMAINS, ...additionalDomains]));
  const normalizedQuery = domainQuery.trim().toLowerCase();
  const suggestions =
    atIndex >= 0
      ? normalizedQuery
        ? allDomains.filter(
            domain => domain.startsWith(normalizedQuery) && domain !== normalizedQuery
          )
        : allDomains
      : [];

  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions.length, domainQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectDomain = (domain: string) => {
    onChange(`${localPart}@${domain}`);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(index => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && domainQuery !== suggestions[highlightedIndex]) {
      event.preventDefault();
      selectDomain(suggestions[highlightedIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        dir="ltr"
        required={required}
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setOpen(event.target.value.includes('@'));
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => value.includes('@') && setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className={className}
      />
      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
          dir="ltr"
        >
          {suggestions.map((domain, index) => (
            <li key={domain} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectDomain(domain)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  index === highlightedIndex
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {localPart}@{domain}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
