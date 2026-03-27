'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// Modern countries (ISO 3166-1) — common genealogy countries first, then alphabetical
const MODERN_COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Ireland', 'Italy', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Netherlands',
  'Russia', 'Ukraine', 'Spain', 'Portugal', 'Mexico', 'Brazil', 'Argentina',
  'South Africa', 'New Zealand', 'Austria', 'Belgium', 'Czech Republic',
  'Finland', 'Greece', 'Hungary', 'Iceland', 'Israel', 'Japan', 'Latvia',
  'Lithuania', 'Luxembourg', 'Romania', 'Slovakia', 'Slovenia', 'Switzerland',
  'Turkey', 'China', 'India', 'Philippines', 'Vietnam', 'South Korea',
  'Thailand', 'Indonesia', 'Malaysia', 'Egypt', 'Nigeria', 'Kenya', 'Ghana',
  'Ethiopia', 'Colombia', 'Peru', 'Chile', 'Cuba', 'Jamaica', 'Trinidad and Tobago',
  'Belarus', 'Moldova', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan',
  'Uzbekistan', 'Croatia', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro',
  'North Macedonia', 'Albania', 'Bulgaria', 'Estonia',
] as const;

// Historical countries/territories relevant to genealogy
const HISTORICAL_COUNTRIES = [
  'USSR (Soviet Union)',
  'Russian Empire',
  'Austria-Hungary',
  'Ottoman Empire',
  'Prussia',
  'Kingdom of Poland',
  'Czechoslovakia',
  'Yugoslavia',
  'East Germany (DDR)',
  'West Germany (BRD)',
  'Mandatory Palestine',
  'British India',
  'Dutch East Indies',
  'French Indochina',
  'Rhodesia',
  'Siam',
  'Persia',
  'Ceylon',
  'Burma',
  'Galicia',
  'Bessarabia',
  'Pale of Settlement',
  'Congress Poland',
  'Grand Duchy of Lithuania',
  'Kingdom of Hungary',
  'Bohemia',
  'Moravia',
  'Transylvania',
  'Silesia',
  'Courland',
  'Livonia',
] as const;

interface PlaceInputProps {
  /** Hidden input name for form submission (e.g. "birthPlace") */
  name: string;
  /** Label text */
  label: string;
  /** Default combined value (e.g. "Springfield, IL, United States") */
  defaultValue?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Responsive height classes */
  className?: string;
}

/** Parse a stored place string into city and country parts */
function parsePlaceValue(value: string): { city: string; country: string } {
  if (!value) return { city: '', country: '' };
  // Try to match last segment against known countries
  const parts = value.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const allCountries = [...MODERN_COUNTRIES, ...HISTORICAL_COUNTRIES];
    if (allCountries.some((c) => c.toLowerCase() === lastPart.toLowerCase())) {
      return {
        city: parts.slice(0, -1).join(', '),
        country: lastPart,
      };
    }
  }
  return { city: value, country: '' };
}

export function PlaceInput({ name, label, defaultValue, disabled, className }: PlaceInputProps) {
  const parsed = parsePlaceValue(defaultValue ?? '');
  const [city, setCity] = useState(parsed.city);
  const [country, setCountry] = useState(parsed.country);
  const [open, setOpen] = useState(false);

  // Combine into the hidden field value
  const combinedValue = country ? (city ? `${city}, ${country}` : country) : city;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={combinedValue} />

      {/* City/Region text input */}
      <Input
        placeholder="e.g. Springfield, IL"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        disabled={disabled}
        className={cn('h-10 md:h-8', className)}
      />

      {/* Country combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-between font-normal md:h-8',
              !country && 'text-muted-foreground',
            )}
          >
            {country || 'Select country (optional)'}
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search countries..." />
            <CommandList>
              <CommandEmpty>No country found. Type a custom value in city field.</CommandEmpty>
              {country && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      setCountry('');
                      setOpen(false);
                    }}
                  >
                    <X className="mr-2 size-4 text-muted-foreground" />
                    Clear country
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Modern">
                {MODERN_COUNTRIES.map((c) => (
                  <CommandItem
                    key={c}
                    value={c}
                    onSelect={() => {
                      setCountry(c);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        country === c ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Historical">
                {HISTORICAL_COUNTRIES.map((c) => (
                  <CommandItem
                    key={c}
                    value={c}
                    onSelect={() => {
                      setCountry(c);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        country === c ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
