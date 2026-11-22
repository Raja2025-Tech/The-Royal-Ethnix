import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';

export default function PickSelect({
  value,
  onChange,
  options,
  labels,
  placeholder = 'Select…',
  allowNone = false,
  noneLabel = 'Not set',
  disabled = false,
  className,
}) {
  const current = value === null || value === undefined || value === '' ? undefined : String(value);
  return (
    <Select
      value={current ?? (allowNone ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? 'w-full'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels ? labels[o] ?? o : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
