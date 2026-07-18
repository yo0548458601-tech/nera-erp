'use client';

import { useEffect, useRef, useState } from 'react';

type Suggestion = { id: string; name: string };

type AddressAutocompleteInputProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  fetchSuggestions: (query: string) => Promise<Suggestion[]>;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Identifies the current query CONTEXT this field's suggestions depend
   * on (e.g. a street field passes the selected locality's provider id
   * here). When this changes, suggestions are refetched even though the
   * field's own text value and open/closed state haven't changed - this
   * is what makes "select a locality, then look at a street field that
   * was already open/focused from before the locality was picked" refetch
   * correctly instead of staying stuck on a stale (often empty) result.
   * Omit for a field with no such dependency (e.g. the locality field
   * itself).
   */
  contextKey?: string;
};

/**
 * A locality/street autocomplete field: types freely (always allowed, for
 * manual entry when nothing matches - rural addresses, institutions, P.O.
 * boxes, or any legitimate address the demo provider simply does not
 * know), and a debounced suggestion list appears below when the configured
 * AddressProvider returns matches. Selecting a suggestion is what marks
 * the address as provider-verified; typing without selecting leaves it as
 * free text (unverified) - both are always valid outcomes.
 */
export function AddressAutocompleteInput({
  label,
  value,
  onChange,
  onSelectSuggestion,
  fetchSuggestions,
  disabled,
  placeholder,
  contextKey,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open || disabled) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timeout = window.setTimeout(() => {
      fetchSuggestions(value).then((results) => {
        if (requestIdRef.current === requestId) {
          setSuggestions(results);
        }
      });
    }, 150);
    return () => window.clearTimeout(timeout);
    // fetchSuggestions is intentionally excluded from deps (a fresh closure every render would refetch on every keystroke's parent re-render); contextKey is the deliberate, explicit signal for "the query context changed, refetch" - see this prop's docstring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open, disabled, contextKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400 disabled:opacity-50"
      />
      {open && !disabled && suggestions.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectSuggestion(suggestion);
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-right text-sm text-slate-700 hover:bg-slate-50"
              >
                {suggestion.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
