import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Modal from '../shared/Modal';
import LoadingButton from '../shared/LoadingButton';
import { contacts } from '../../lib/api';
import {
  COUNTRY_CODES,
  getStoredCountryCode,
  setStoredCountryCode,
} from '../../lib/countryCodes';
import { formatPhoneHint } from '../../lib/phoneUtils';

const COLUMN_OPTIONS = ['Name', 'Phone', 'Company', 'Email', 'Tags', 'Skip'];

function detectColumns(headers) {
  const mapping = {};
  headers.forEach((h) => {
    const lower = String(h).toLowerCase();
    if (['name'].includes(lower)) mapping[h] = 'Name';
    else if (['phone', 'whatsapp', 'mobile'].includes(lower)) mapping[h] = 'Phone';
    else if (['company'].includes(lower)) mapping[h] = 'Company';
    else if (['email'].includes(lower)) mapping[h] = 'Email';
    else if (['tags'].includes(lower)) mapping[h] = 'Tags';
    else mapping[h] = 'Skip';
  });
  return mapping;
}

export default function ImportModal({ open, onClose, onImported }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [preview, setPreview] = useState([]);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [defaultCountryCode, setDefaultCountryCode] = useState(getStoredCountryCode());

  const reset = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) {
        toast.error('File must have headers and at least one row');
        return;
      }
      const hdrs = rows[0].map(String);
      const data = rows.slice(1, 6).map((row) => {
        const obj = {};
        hdrs.forEach((h, i) => {
          obj[h] = row[i] ?? '';
        });
        return obj;
      });
      setHeaders(hdrs);
      setPreview(data);
      setMapping(detectColumns(hdrs));
      setFile(f);
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStep(2);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const remapped = rows.map((row) => {
          const obj = {};
          Object.entries(mapping).forEach(([origCol, targetCol]) => {
            if (targetCol !== 'Skip') {
              obj[targetCol] = row[origCol];
            }
          });
          return obj;
        });

        const newWb = XLSX.utils.book_new();
        const newWs = XLSX.utils.json_to_sheet(remapped);
        XLSX.utils.book_append_sheet(newWb, newWs, 'Contacts');
        const buffer = XLSX.write(newWb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const remappedFile = new File([blob], 'import.xlsx', { type: blob.type });

        const res = await contacts.import(remappedFile, defaultCountryCode);
        setResult(res.data);
        setStep(3);
        onImported();
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Contacts" wide>
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-gray-50 border rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default country code for numbers without +
            </label>
            <select
              value={defaultCountryCode}
              onChange={(e) => {
                setDefaultCountryCode(e.target.value);
                setStoredCountryCode(e.target.value);
              }}
              className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.label} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Excel phones like <code className="bg-white px-1 rounded">9902622501</code> will be saved as{' '}
              <code className="bg-white px-1 rounded">{defaultCountryCode}9902622501</code>.
              {' '}{formatPhoneHint(defaultCountryCode)}
            </p>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-accent transition-colors"
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 mb-2">Drop Excel file here or click to browse</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files[0] && processFile(e.target.files[0])}
              className="text-sm"
            />
          </div>

          {preview.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left border-b">
                          <div className="mb-1 font-medium">{h}</div>
                          <select
                            value={mapping[h] || 'Skip'}
                            onChange={(e) =>
                              setMapping({ ...mapping, [h]: e.target.value })
                            }
                            className="text-xs border rounded px-1 py-0.5 w-full"
                          >
                            {COLUMN_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 border-b">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <LoadingButton onClick={handleImport} disabled={!file}>
                  Import
                </LoadingButton>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center py-12">
          <Loader2 size={48} className="animate-spin text-accent mb-4" />
          <p className="text-gray-600">Uploading and importing...</p>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle size={24} />
            <span className="font-medium">Import complete</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-sm text-green-600">Imported</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{result.duplicates}</p>
              <p className="text-sm text-yellow-600">Duplicates</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</p>
              <p className="text-sm text-red-600">Errors</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <details className="border rounded-lg p-4">
              <summary className="cursor-pointer font-medium flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                View errors ({result.errors.length})
              </summary>
              <ul className="mt-3 space-y-1 text-sm text-gray-600 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end">
            <LoadingButton onClick={handleClose}>Done</LoadingButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
