'use client';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type CsvRow = Record<string, string>;

const REQUIRED_COLUMNS = [
  'platform',
  'date',
  'hours_worked',
  'gross_earned',
  'platform_deductions',
  'net_received',
];

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

export function CsvUpload() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (csvRows: CsvRow[]) => {
      const response = await client.api.shifts.import.$post({ json: { rows: csvRows } });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });
      const result = data as { created: number; errors: { row: number; message: string }[] };
      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        toast.warning(`Imported ${result.created} shift${result.created !== 1 ? 's' : ''}. ${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} had errors.`);
      } else {
        toast.success(`${result.created} shift${result.created !== 1 ? 's' : ''} imported successfully`);
        setRows([]);
        setErrors([]);
      }
    },
    onError: () => {
      toast.error('Import failed. Please try again.');
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);

      if (parsed.length === 0) {
        setParseError('The file appears to be empty or has only a header row.');
        return;
      }

      const firstRow = parsed[0];
      const missing = REQUIRED_COLUMNS.filter((col) => !(col in firstRow));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      setRows(parsed);
    };
    reader.readAsText(file);
  };

  return (
    <div className='space-y-4'>
      <div>
        <label htmlFor='csv-file' className='block text-sm font-medium mb-1.5'>
          Select CSV file
        </label>
        <p className='text-xs text-muted-foreground mb-2'>
          Required columns: <code className='bg-muted px-1 py-0.5 rounded text-xs'>platform, date, hours_worked, gross_earned, platform_deductions, net_received</code>
        </p>
        <Input
          id='csv-file'
          ref={fileRef}
          type='file'
          accept='.csv,text/csv'
          onChange={handleFile}
          className='cursor-pointer'
        />
      </div>

      {parseError && (
        <p className='text-sm text-destructive' role='alert'>
          {parseError}
        </p>
      )}

      {rows.length > 0 && (
        <div className='space-y-3'>
          <p className='text-sm font-medium'>
            Preview — {rows.length} row{rows.length !== 1 ? 's' : ''} found
          </p>
          <div className='border rounded-lg overflow-auto max-h-64'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12'>#</TableHead>
                  {REQUIRED_COLUMNS.map((col) => (
                    <TableHead key={col} className='text-xs whitespace-nowrap'>
                      {col.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const rowError = errors.find((e) => e.row === i + 1);
                  return (
                    <TableRow
                      key={i}
                      className={rowError ? 'bg-destructive/5' : ''}
                    >
                      <TableCell className='text-xs text-muted-foreground'>{i + 1}</TableCell>
                      {REQUIRED_COLUMNS.map((col) => (
                        <TableCell key={col} className='text-xs whitespace-nowrap'>
                          {row[col] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {errors.length > 0 && (
            <ul className='space-y-1' role='list' aria-label='Import errors'>
              {errors.map((err) => (
                <li key={err.row} className='text-sm text-destructive'>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          )}

          <div className='flex gap-2'>
            <Button
              onClick={() => importMutation.mutate(rows)}
              disabled={importMutation.isPending}
              className='min-h-[44px]'
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className='size-4 mr-2 animate-spin' aria-hidden='true' />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className='size-4 mr-2' aria-hidden='true' />
                  Import {rows.length} shift{rows.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setRows([]);
                setErrors([]);
                setParseError(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className='min-h-[44px]'
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
