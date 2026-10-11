'use client';

import { useRef } from 'react';

interface Props {
  label: string;
  multiple?: boolean;
  onLoad: (files: Array<{ name: string; content: string }>) => void;
  loaded: Array<{ name: string; content: string }>;
}

export default function CsvUpload({ label, multiple, onLoad, loaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const readers = files.map(
      file =>
        new Promise<{ name: string; content: string }>(resolve => {
          const reader = new FileReader();
          reader.onload = ev => resolve({ name: file.name, content: ev.target?.result as string });
          reader.readAsText(file);
        })
    );
    Promise.all(readers).then(onLoad);
  }

  return (
    <div className="mt-2">
      <div
        onClick={() => inputRef.current?.click()}
        className="border border-dashed border-slate-600 rounded-lg px-4 py-3 cursor-pointer hover:border-violet-500 transition-colors text-center"
      >
        <p className="text-sm text-slate-400">{label}</p>
        {loaded.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {loaded.map(f => (
              <p key={f.name} className="text-xs text-green-400">✓ {f.name}</p>
            ))}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
