'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

type RawCsvRow = string[];

type CsvImportRow = {
  source_row_number?: number;
  platform: string;
  date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  notes?: string;
};

type CsvIssue = {
  row: number;
  message: string;
};

const MAX_PREVIEW_ROWS = 40;

const CSV_FIELDS = [
  {
    key: 'platform',
    label: 'Platform',
    description: 'Platform name (for example Bykea, Foodpanda)',
    required: true,
  },
  {
    key: 'date',
    label: 'Date',
    description: 'Shift date',
    required: true,
  },
  {
    key: 'hours_worked',
    label: 'Hours Worked',
    description: 'Total hours for that shift',
    required: true,
  },
  {
    key: 'gross_earned',
    label: 'Gross Earned',
    description: 'Amount before deductions',
    required: true,
  },
  {
    key: 'platform_deductions',
    label: 'Platform Deductions',
    description: 'Platform fee/cut amount',
    required: true,
  },
  {
    key: 'net_received',
    label: 'Net Received',
    description: 'Amount you received after deductions',
    required: true,
  },
  {
    key: 'notes',
    label: 'Notes (Optional)',
    description: 'Any optional note or comment',
    required: false,
  },
] as const;

type CsvFieldKey = (typeof CSV_FIELDS)[number]['key'];
type MappingValue = CsvFieldKey | 'ignore';

const REQUIRED_FIELD_KEYS = CSV_FIELDS.filter((field) => field.required).map(
  (field) => field.key,
);

const REQUIRED_CSV_HEADING_FORMAT = REQUIRED_FIELD_KEYS.join(',');
const FULL_CSV_HEADING_FORMAT = CSV_FIELDS.map((field) => field.key).join(',');

const FIELD_HEADING_ALIASES: Record<CsvFieldKey, string[]> = {
  platform: ['platform', 'app', 'company'],
  date: ['date', 'shiftdate', 'workdate', 'day'],
  hours_worked: ['hoursworked', 'hours', 'duration', 'timeworked'],
  gross_earned: ['grossearned', 'gross', 'earning', 'earnings', 'amountbeforededuction'],
  platform_deductions: ['platformdeductions', 'deductions', 'fees', 'fee', 'commission', 'cut'],
  net_received: ['netreceived', 'net', 'payout', 'takehome', 'amountreceived'],
  notes: ['note', 'notes', 'comment', 'comments', 'remark', 'remarks'],
};

function normalizeHeadingToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSuggestedFieldFromHeading(heading: string): CsvFieldKey | null {
  const normalized = normalizeHeadingToken(heading);

  if (!normalized) {
    return null;
  }

  for (const field of CSV_FIELDS) {
    const aliases = FIELD_HEADING_ALIASES[field.key] ?? [];
    const match = aliases.some((alias) => {
      return normalized === alias || normalized.includes(alias) || alias.includes(normalized);
    });

    if (match) {
      return field.key;
    }
  }

  return null;
}

function isLikelyHeadingRow(row: RawCsvRow): boolean {
  const nonEmptyCells = row.filter((cell) => cell.trim().length > 0);

  if (nonEmptyCells.length === 0) {
    return false;
  }

  const matchedCells = nonEmptyCells.filter((cell) => getSuggestedFieldFromHeading(cell));
  return matchedCells.length >= 2;
}

function parseCsvMatrix(text: string): RawCsvRow[] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: RawCsvRow[] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }

      currentRow.push(currentCell.trim());
      currentCell = '';

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeRows(rows: RawCsvRow[]): RawCsvRow[] {
  if (rows.length === 0) {
    return [];
  }

  const columnCount = rows.reduce(
    (max, row) => Math.max(max, row.length),
    0,
  );

  return rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index]?.trim() ?? ''),
  );
}

function parseNumeric(value: string): number | null {
  const cleaned = value
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/pkr|rs\.?/gi, '')
    .replace(/[^\d.-]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string): string | null {
  const input = value.trim();

  if (!input) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const dayFirstMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const year = Number(dayFirstMatch[3]);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return date.toISOString().slice(0, 10);
      }
    }

    return null;
  }

  const fallback = new Date(input);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return fallback.toISOString().slice(0, 10);
}

function getFieldMeta(fieldKey: CsvFieldKey) {
  return CSV_FIELDS.find((field) => field.key === fieldKey);
}

export function CsvUpload() {
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [columnCount, setColumnCount] = useState(0);
  const [hasHeadingRow, setHasHeadingRow] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<number, MappingValue>>(
    {},
  );
  const [validationErrors, setValidationErrors] = useState<CsvIssue[]>([]);
  const [importErrors, setImportErrors] = useState<CsvIssue[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const selectedFields = useMemo(() => {
    return Object.values(columnMapping).filter(
      (value): value is CsvFieldKey => value !== 'ignore',
    );
  }, [columnMapping]);

  const missingRequiredFields = useMemo(() => {
    return REQUIRED_FIELD_KEYS.filter(
      (fieldKey) => !selectedFields.includes(fieldKey),
    );
  }, [selectedFields]);

  const dataRows = useMemo(
    () => (hasHeadingRow ? rows.slice(1) : rows),
    [rows, hasHeadingRow],
  );

  const headingSuggestions = useMemo(() => {
    const suggestions: Partial<Record<number, CsvFieldKey>> = {};

    if (rows.length === 0 || columnCount === 0) {
      return suggestions;
    }

    const headingRow = rows[0] ?? [];

    for (let index = 0; index < columnCount; index += 1) {
      const suggested = getSuggestedFieldFromHeading(headingRow[index] ?? '');

      if (suggested) {
        suggestions[index] = suggested;
      }
    }

    return suggestions;
  }, [rows, columnCount]);

  const previewRows = useMemo(
    () => dataRows.slice(0, MAX_PREVIEW_ROWS),
    [dataRows],
  );

  const hasMappedColumns = selectedFields.length > 0;

  const rowErrorSet = useMemo(() => {
    return new Set([
      ...validationErrors.map((error) => error.row),
      ...importErrors.map((error) => error.row),
    ]);
  }, [validationErrors, importErrors]);

  const resetWizard = () => {
    setRows([]);
    setColumnCount(0);
    setHasHeadingRow(false);
    setColumnMapping({});
    setValidationErrors([]);
    setImportErrors([]);
    setParseError(null);

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const updateColumnMapping = (columnIndex: number, value: string | null) => {
    const mapped = (value ?? 'ignore') as MappingValue;

    setColumnMapping((previous) => {
      const next = { ...previous, [columnIndex]: mapped };

      if (mapped !== 'ignore') {
        for (const [key, existing] of Object.entries(next)) {
          const parsedIndex = Number(key);

          if (parsedIndex !== columnIndex && existing === mapped) {
            next[parsedIndex] = 'ignore';
          }
        }
      }

      return next;
    });
  };

  const validateAndBuildImportRows = (): CsvImportRow[] | null => {
    if (rows.length === 0 || columnCount === 0) {
      toast.error('Upload a CSV file first.');
      return null;
    }

    if (dataRows.length === 0) {
      toast.error('No data rows found to import.');
      return null;
    }

    const mappedColumns = Object.entries(columnMapping)
      .map(([index, field]) => ({
        index: Number(index),
        field,
      }))
      .filter(
        (entry): entry is { index: number; field: CsvFieldKey } =>
          entry.field !== 'ignore',
      );

    if (mappedColumns.length === 0) {
      toast.error('Map at least one column before importing.');
      return null;
    }

    if (missingRequiredFields.length > 0) {
      const labels = missingRequiredFields
        .map((field) => getFieldMeta(field)?.label ?? field)
        .join(', ');

      toast.error(`Required field mapping missing: ${labels}`);
      return null;
    }

    const mappedFieldKeys = mappedColumns.map((column) => column.field);
    const duplicateFieldKey = mappedFieldKeys.find(
      (field, index) => mappedFieldKeys.indexOf(field) !== index,
    );

    if (duplicateFieldKey) {
      toast.error(
        `${getFieldMeta(duplicateFieldKey)?.label ?? duplicateFieldKey} is mapped more than once.`,
      );
      return null;
    }

    const issues: CsvIssue[] = [];
    const payloadRows: CsvImportRow[] = [];
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const csvRowOffset = hasHeadingRow ? 2 : 1;

    dataRows.forEach((row, rowIndex) => {
      const rowNum = rowIndex + csvRowOffset;
      const mapped = {} as Partial<Record<CsvFieldKey, string>>;

      mappedColumns.forEach(({ index, field }) => {
        mapped[field] = row[index]?.trim() ?? '';
      });

      const platform = mapped.platform ?? '';
      const date = normalizeDate(mapped.date ?? '');
      const hoursWorked = parseNumeric(mapped.hours_worked ?? '');
      const grossEarned = parseNumeric(mapped.gross_earned ?? '');
      const platformDeductions = parseNumeric(mapped.platform_deductions ?? '');
      const netReceived = parseNumeric(mapped.net_received ?? '');
      const notes = (mapped.notes ?? '').trim();

      const rowIssues: string[] = [];

      if (!platform) {
        rowIssues.push('platform is required');
      }

      if (!date) {
        rowIssues.push('date is invalid or missing');
      } else if (date > todayIso) {
        rowIssues.push('date cannot be in the future');
      }

      if (hoursWorked === null || hoursWorked < 0.5 || hoursWorked > 24) {
        rowIssues.push('hours_worked must be between 0.5 and 24');
      }

      if (grossEarned === null || grossEarned <= 0) {
        rowIssues.push('gross_earned must be a positive number');
      }

      if (platformDeductions === null || platformDeductions < 0) {
        rowIssues.push('platform_deductions must be zero or more');
      }

      if (
        grossEarned !== null &&
        platformDeductions !== null &&
        platformDeductions > grossEarned
      ) {
        rowIssues.push('platform_deductions cannot exceed gross_earned');
      }

      if (netReceived === null) {
        rowIssues.push('net_received must be a valid number');
      }

      if (rowIssues.length > 0) {
        issues.push({
          row: rowNum,
          message: rowIssues.join('; '),
        });
        return;
      }

      payloadRows.push({
        source_row_number: rowNum,
        platform,
        date: date!,
        hours_worked: hoursWorked!,
        gross_earned: grossEarned!,
        platform_deductions: platformDeductions!,
        net_received: netReceived!,
        ...(notes ? { notes } : {}),
      });
    });

    setValidationErrors(issues);

    if (issues.length > 0) {
      toast.error(
        `${issues.length} row${issues.length !== 1 ? 's' : ''} failed validation. Fix mapping or data format first.`,
      );
      return null;
    }

    toast.success('CSV mapping and format validation passed.');
    return payloadRows;
  };

  const importMutation = useMutation({
    mutationFn: async (csvRows: CsvImportRow[]) => {
      const response = await client.api.shifts.import.$post({
        json: { rows: csvRows },
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });

      const result = data as {
        created: number;
        errors: CsvIssue[];
      };

      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        toast.warning(
          `Imported ${result.created} shift${result.created !== 1 ? 's' : ''}. ${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} failed on server validation.`,
        );
      } else {
        toast.success(
          `${result.created} shift${result.created !== 1 ? 's' : ''} imported successfully`,
        );
        resetWizard();
      }
    },
    onError: () => {
      toast.error('Import failed. Please try again.');
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setParseError(null);
    setHasHeadingRow(false);
    setValidationErrors([]);
    setImportErrors([]);

    const reader = new FileReader();

    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      const parsed = normalizeRows(parseCsvMatrix(text));

      if (parsed.length === 0) {
        setParseError('The file appears empty or unreadable.');
        setRows([]);
        setColumnCount(0);
        setColumnMapping({});
        return;
      }

      const nextColumnCount = parsed[0]?.length ?? 0;

      if (nextColumnCount === 0) {
        setParseError('No columns detected in CSV.');
        setRows([]);
        setColumnCount(0);
        setColumnMapping({});
        return;
      }

      setRows(parsed);
      setColumnCount(nextColumnCount);

      const detectedHeadingRow = isLikelyHeadingRow(parsed[0] ?? []);

      if (detectedHeadingRow && parsed.length === 1) {
        setParseError('Only heading row found. Add at least one data row.');
        setRows([]);
        setColumnCount(0);
        setHasHeadingRow(false);
        setColumnMapping({});
        return;
      }

      setHasHeadingRow(detectedHeadingRow);

      const initialMapping = {} as Record<number, MappingValue>;
      const usedSuggestions = new Set<CsvFieldKey>();

      for (let index = 0; index < nextColumnCount; index += 1) {
        const suggestion = detectedHeadingRow
          ? getSuggestedFieldFromHeading(parsed[0]?.[index] ?? '')
          : null;

        if (suggestion && !usedSuggestions.has(suggestion)) {
          initialMapping[index] = suggestion;
          usedSuggestions.add(suggestion);
        } else {
          initialMapping[index] = 'ignore';
        }
      }

      setColumnMapping(initialMapping);

      toast.success(
        `Loaded ${parsed.length} row${parsed.length !== 1 ? 's' : ''} and ${nextColumnCount} column${nextColumnCount !== 1 ? 's' : ''}. Now map each column.`,
      );

      if (detectedHeadingRow) {
        toast.info('Detected a heading row. Suggested mappings were auto-selected.');
      }
    };

    reader.readAsText(file);
  };

  const runValidationOnly = () => {
    const payload = validateAndBuildImportRows();

    if (!payload) {
      return;
    }

    toast.success(
      `All good. ${payload.length} row${payload.length !== 1 ? 's' : ''} ready to import.`,
    );
  };

  const handleImport = () => {
    const payload = validateAndBuildImportRows();

    if (!payload) {
      return;
    }

    importMutation.mutate(payload);
  };

  return (
    <div className='space-y-6 w-full'>
      <div className='rounded-2xl border bg-gradient-to-br from-background via-background to-muted/35 p-4 sm:p-5 space-y-3'>
        <div>
          <label htmlFor='csv-file' className='block text-sm font-medium mb-1.5'>
            Upload CSV file
          </label>
          <p className='text-xs text-muted-foreground'>
            Upload raw CSV data. Map headings directly in the table header below.
          </p>
        </div>

        <div className='rounded-xl border bg-background px-3 py-3 text-xs space-y-2'>
          <p className='font-medium text-foreground'>CSV heading format</p>
          <div className='space-y-1'>
            <p className='text-muted-foreground'>Required headings</p>
            <p className='font-mono break-all rounded bg-muted/60 px-2 py-1'>
              {REQUIRED_CSV_HEADING_FORMAT}
            </p>
          </div>
          <div className='space-y-1'>
            <p className='text-muted-foreground'>Full headings (optional included)</p>
            <p className='font-mono break-all rounded bg-muted/60 px-2 py-1'>
              {FULL_CSV_HEADING_FORMAT}
            </p>
          </div>
        </div>

        <Input
          id='csv-file'
          ref={fileRef}
          type='file'
          accept='.csv,text/csv'
          onChange={handleFile}
          className='cursor-pointer bg-background'
        />
      </div>

      {parseError && (
        <Alert variant='destructive'>
          <AlertCircle className='size-4' />
          <AlertTitle>CSV parsing error</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && columnCount > 0 && (
        <div className='space-y-4'>
          <div className='rounded-2xl border bg-muted/20 p-4 space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>Step 1: Upload</Badge>
              <Badge variant={hasMappedColumns ? 'secondary' : 'outline'}>
                Step 2: Map Columns
              </Badge>
              <Badge
                variant={
                  missingRequiredFields.length === 0 && hasMappedColumns
                    ? 'secondary'
                    : 'outline'
                }
              >
                Step 3: Validate & Import
              </Badge>
            </div>

            <div className='flex flex-wrap gap-2'>
              {REQUIRED_FIELD_KEYS.map((fieldKey) => {
                const meta = getFieldMeta(fieldKey);
                const isMapped = selectedFields.includes(fieldKey);

                return (
                  <Badge
                    key={fieldKey}
                    variant={isMapped ? 'secondary' : 'outline'}
                  >
                    {meta?.label ?? fieldKey} {isMapped ? 'mapped' : 'required'}
                  </Badge>
                );
              })}
            </div>

            <p className='text-xs text-muted-foreground'>
              Select the field for each column in the top row. Use Skip for extra CSV
              columns.
            </p>

            {hasHeadingRow ? (
              <Badge variant='outline' className='w-fit'>
                Heading row detected. It will be skipped during import.
              </Badge>
            ) : null}

            <div className='rounded-xl border bg-background px-3 py-2'>
              {missingRequiredFields.length === 0 ? (
                <p className='text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2'>
                  <CheckCircle2 className='size-4' />
                  All required fields are mapped.
                </p>
              ) : (
                <p className='text-sm text-amber-600 dark:text-amber-400'>
                  Missing required mappings:{' '}
                  {missingRequiredFields
                    .map((fieldKey) => getFieldMeta(fieldKey)?.label ?? fieldKey)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className='rounded-2xl border bg-background shadow-sm overflow-hidden'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3'>
              <p className='text-sm font-medium'>
                Preview - {dataRows.length} row{dataRows.length !== 1 ? 's' : ''},{' '}
                {columnCount} column{columnCount !== 1 ? 's' : ''}
              </p>
              <p className='text-xs text-muted-foreground'>
                Map fields from the header row and review sample rows below.
              </p>
            </div>

            <div className='overflow-auto max-h-[68vh]'>
              <Table className='w-full min-w-[1100px]'>
                <TableHeader className='sticky top-0 z-20 bg-background/95 backdrop-blur'>
                  <TableRow className='align-top border-b'>
                    <TableHead className='sticky left-0 z-30 w-16 min-w-16 bg-background/95 backdrop-blur text-xs font-semibold'>
                      Row
                    </TableHead>
                    {Array.from({ length: columnCount }, (_, colIndex) => {
                      const mappedValue = columnMapping[colIndex] ?? 'ignore';
                      const mappedMeta =
                        mappedValue === 'ignore' ? null : getFieldMeta(mappedValue);
                      const headingValue = rows[0]?.[colIndex]?.trim() ?? '';
                      const suggestedField = headingSuggestions[colIndex] ?? null;
                      const suggestedMeta = suggestedField
                        ? getFieldMeta(suggestedField)
                        : null;
                      const sample = previewRows
                        .map((row) => row[colIndex])
                        .filter((value) => value.length > 0)
                        .slice(0, 2)
                        .join(' | ');

                      return (
                        <TableHead
                          key={colIndex}
                          className='min-w-[250px] border-l align-top bg-background/95 backdrop-blur'
                        >
                          <div className='space-y-2 py-1'>
                            <div className='flex items-center justify-between gap-2'>
                              <p className='text-xs font-semibold text-foreground'>
                                Column {colIndex + 1}
                              </p>
                              {mappedMeta ? (
                                <Badge
                                  variant={mappedMeta.required ? 'default' : 'outline'}
                                  className='text-[10px]'
                                >
                                  {mappedMeta.required ? 'Required' : 'Optional'}
                                </Badge>
                              ) : null}
                            </div>

                            <Select
                              value={mappedValue}
                              onValueChange={(value) => updateColumnMapping(colIndex, value)}
                            >
                              <SelectTrigger className='h-9'>
                                <SelectValue placeholder='Assign field' />
                              </SelectTrigger>
                              <SelectContent align='start'>
                                <SelectItem value='ignore'>Skip this column (extra data)</SelectItem>
                                <SelectSeparator />
                                {CSV_FIELDS.map((field) => {
                                  const alreadyUsedElsewhere = Object.entries(
                                    columnMapping,
                                  ).some(([index, value]) => {
                                    return (
                                      Number(index) !== colIndex && value === field.key
                                    );
                                  });

                                  return (
                                    <SelectItem
                                      key={field.key}
                                      value={field.key}
                                      disabled={alreadyUsedElsewhere}
                                    >
                                      {field.label} ({field.key})
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>

                            <div className='space-y-1 text-xs text-muted-foreground leading-snug'>
                              {hasHeadingRow ? (
                                <p>
                                  Heading: <span className='text-foreground'>{headingValue || '-'}</span>
                                </p>
                              ) : (
                                <p>
                                  Heading: <span className='text-foreground'>No heading row detected</span>
                                </p>
                              )}

                              <p>
                                {mappedMeta?.description ?? 'No field selected'}
                              </p>

                              <p>
                                Sample:{' '}
                                <span className='text-foreground'>
                                  {sample || 'No sample value'}
                                </span>
                              </p>
                            </div>

                            {mappedValue === 'ignore' && suggestedMeta ? (
                              <p className='text-xs text-emerald-600 dark:text-emerald-400'>
                                Suggested: {suggestedMeta.label}
                              </p>
                            ) : null}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {previewRows.map((row, rowIndex) => {
                    const csvRowNumber = rowIndex + (hasHeadingRow ? 2 : 1);
                    const rowError = rowErrorSet.has(csvRowNumber);

                    return (
                      <TableRow key={csvRowNumber} className={rowError ? 'bg-destructive/5' : ''}>
                        <TableCell className='sticky left-0 z-10 bg-background text-xs text-muted-foreground font-medium'>
                          {csvRowNumber}
                        </TableCell>
                        {Array.from({ length: columnCount }, (_, colIndex) => (
                          <TableCell key={colIndex} className='text-xs whitespace-nowrap border-l'>
                            {row[colIndex] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {rows.length > MAX_PREVIEW_ROWS ? (
              <p className='border-t px-4 py-2 text-xs text-muted-foreground'>
                Showing first {MAX_PREVIEW_ROWS} rows for preview. All rows will
                be validated and imported.
              </p>
            ) : null}
          </div>

          {validationErrors.length > 0 && (
            <Alert variant='destructive'>
              <AlertCircle className='size-4' />
              <AlertTitle>Validation issues</AlertTitle>
              <AlertDescription>
                <ul className='space-y-1 mt-1' role='list'>
                  {validationErrors.slice(0, 10).map((error, index) => (
                    <li key={`${error.row}-${index}`}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
                {validationErrors.length > 10 ? (
                  <p className='mt-2 text-xs'>
                    ...and {validationErrors.length - 10} more validation issues.
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {importErrors.length > 0 && (
            <Alert variant='destructive'>
              <AlertCircle className='size-4' />
              <AlertTitle>Server import issues</AlertTitle>
              <AlertDescription>
                <ul className='space-y-1 mt-1' role='list'>
                  {importErrors.slice(0, 10).map((error, index) => (
                    <li key={`${error.row}-${index}`}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
                {importErrors.length > 10 ? (
                  <p className='mt-2 text-xs'>
                    ...and {importErrors.length - 10} more server issues.
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          <div className='flex flex-wrap gap-2'>
            <Button onClick={runValidationOnly} variant='outline' className='min-h-[44px]'>
              Validate mapping
            </Button>
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className='min-h-[44px]'
            >
              {importMutation.isPending ? (
                <>
                  <Loader2
                    className='size-4 mr-2 animate-spin'
                    aria-hidden='true'
                  />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className='size-4 mr-2' aria-hidden='true' />
                  Import {dataRows.length} row{dataRows.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            <Button variant='ghost' onClick={resetWizard} className='min-h-[44px]'>
              Clear wizard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
