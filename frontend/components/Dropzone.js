'use client';

import { useRef, useState } from 'react';

const MAX = 5 * 1024 * 1024;
const OK_EXT = /\.(pdf|docx)$/i;

/** Drag-and-drop or file-picker upload (SRS 3.1). Checks type and size before uploading (REQ-1.1, REQ-1.5). */
export default function Dropzone({ onFile, disabled, onReject }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const take = (file) => {
    if (!file) return;
    if (!OK_EXT.test(file.name)) {
      onReject(`"${file.name}" is not supported. Please upload your resume as a PDF or Word (.docx) file.`);
      return;
    }
    if (file.size > MAX) {
      onReject('This file is larger than 5 MB. Please upload a smaller PDF or DOCX file.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label="Upload resume. PDF or DOCX, up to 5 MB."
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files?.[0]);
      }}
    >
      <strong>Drop your resume here</strong>
      <span className="subtle">or click to choose a file. PDF or Word (.docx), up to 5 MB.</span>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
