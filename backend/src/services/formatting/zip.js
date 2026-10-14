'use strict';

/**
 * Minimal ZIP reader (DOCX files are ZIP archives). Reads the central directory and inflates entries
 * with Node's built-in zlib, so formatting checks need no extra dependency.
 */
const zlib = require('zlib');

const MAX_ENTRY_BYTES = 20 * 1024 * 1024; // guard against zip bombs

function readZip(buffer) {
  // Find "End of central directory" record (scan backwards, comment can be up to 64 KB).
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP/DOCX file');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries.set(name, { method, compSize, size, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  function read(name) {
    const e = entries.get(name);
    if (!e) return null;
    if (e.size > MAX_ENTRY_BYTES) throw new Error('ZIP entry too large');
    const lh = e.localOffset;
    const start = lh + 30 + buffer.readUInt16LE(lh + 26) + buffer.readUInt16LE(lh + 28);
    const data = buffer.subarray(start, start + e.compSize);
    if (e.method === 0) return data;
    if (e.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
    throw new Error(`Unsupported ZIP compression method ${e.method}`);
  }

  return {
    names: () => [...entries.keys()],
    readText: (name) => {
      const b = read(name);
      return b ? b.toString('utf8') : null;
    },
  };
}

module.exports = { readZip };
